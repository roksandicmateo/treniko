const express = require('express');
const { sendDbClientError } = require('../utils/dbErrors');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { isUuid } = require('../utils/validation');
const { verifyStoredImage } = require('../utils/fileType');

router.use(authenticateToken);

// Root of all tenant upload storage. Every resolved path must stay inside it.
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

// Filenames we generate ourselves: "<epoch>-<base36>.<ext>". Anything with a
// path separator, a null byte, or a ".." segment fails this test.
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/;

const ALLOWED_IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

/**
 * Resolve a file inside a tenant's upload directory, refusing to escape it.
 *
 * The tenant segment is taken from the verified JWT by the caller and never
 * from user input, so a request can only ever address its own tenant's tree.
 * The final realpath-style prefix check is defence in depth in case any
 * component slips a traversal sequence past the per-segment validation.
 *
 * @returns {string|null} absolute path, or null if it would escape UPLOADS_ROOT
 */
const resolveTenantFile = (tenantId, trainingId, filename) => {
  if (!isUuid(tenantId) || !isUuid(trainingId)) return null;
  if (typeof filename !== 'string' || !SAFE_FILENAME_RE.test(filename)) return null;
  // basename() strips any directory component that survived the regex.
  if (path.basename(filename) !== filename) return null;

  const candidate = path.resolve(
    UPLOADS_ROOT, tenantId, 'trainings', trainingId, filename
  );
  const prefix = UPLOADS_ROOT + path.sep;
  if (!candidate.startsWith(prefix)) return null;
  return candidate;
};

/**
 * Middleware: prove the caller owns :trainingId BEFORE any file is accepted.
 *
 * This must run ahead of multer. multer's diskStorage callbacks execute while
 * the request body is being parsed, which is earlier than the route handler —
 * so validating inside the handler would already have written an attacker's
 * file to disk (and mkdir'd a directory named after unvalidated input) before
 * the ownership check could reject it.
 */
const requireOwnedTraining = async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { trainingId } = req.params;

    if (!isUuid(trainingId)) {
      return res.status(400).json({ error: 'Invalid training id' });
    }

    const { rows: [training] } = await pool.query(
      'SELECT id FROM trainings WHERE id=$1 AND tenant_id=$2',
      [trainingId, tenantId]
    );
    // Same 404 whether the training belongs to another tenant or does not
    // exist — the response must not confirm another tenant's records.
    if (!training) return res.status(404).json({ error: 'Training not found' });

    next();
  } catch (e) {
    if (sendDbClientError(res, e)) return;
    console.error('requireOwnedTraining error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Both segments are already validated: tenantId comes from the verified
    // JWT and trainingId passed requireOwnedTraining's UUID + ownership check.
    const dir = path.resolve(
      UPLOADS_ROOT, req.user.tenantId, 'trainings', req.params.trainingId
    );
    // Containment is asserted here rather than inferred from those checks, so
    // the property "no upload is ever written outside the uploads root" holds
    // structurally — it does not depend on a caller upstream still validating
    // its inputs. Static analysis flags path.join on request-derived values for
    // exactly this reason; this makes the guarantee local and checkable.
    if (dir !== UPLOADS_ROOT && !dir.startsWith(UPLOADS_ROOT + path.sep)) {
      return cb(new Error('Invalid upload destination'));
    }
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

// A client-supplied filename is metadata, not a path — this application never
// stores under it — but it is still persisted in `original_name` and echoed
// back, so it is validated rather than trusted. A NUL byte in particular used
// to reach PostgreSQL and be reported as a 500 (`invalid byte sequence for
// encoding UTF8: 0x00`); path separators and traversal segments are refused for
// the same reason, since nothing legitimate produces them.
const FORBIDDEN_FILENAME_CHAR_CODES = [0, 47, 92]; // NUL, forward slash, backslash

const isAcceptableOriginalName = (name) =>
  typeof name === 'string'
  && name.length > 0
  && name.length <= 255
  && ![...name].some((c) => FORBIDDEN_FILENAME_CHAR_CODES.includes(c.charCodeAt(0)))
  && name !== '.'
  && name !== '..';

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAcceptableOriginalName(file.originalname)) {
      return cb(new Error('Invalid file name'));
    }
    if (ALLOWED_IMAGE_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Images only'));
    }
  },
});

/**
 * Shape a training_images row for API consumers.
 *
 * `file_path` holds the bare stored filename, never a path or a URL — the
 * serving route rebuilds the location from the caller's own tenant id, so a
 * stored value can never redirect a read outside the owner's directory. The
 * client-facing URL is derived here instead of being persisted.
 */
const toImageResponse = (row, trainingId) => ({
  ...row,
  url: `/api/trainings/${trainingId}/images/${row.file_path}`,
});

/**
 * Delete files this request wrote. Used when validation rejects an upload, so a
 * refused file never survives on disk.
 */
const discardUploadedFiles = (files = []) => {
  for (const file of files) {
    try {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (e) {
      console.error('[uploads] could not remove rejected file:', e.message);
    }
  }
};

// POST /api/trainings/:trainingId/images
router.post('/:trainingId/images', requireOwnedTraining, upload.array('images', 10), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { trainingId } = req.params;

    // Content-based validation (TR-MED-3). multer's fileFilter can only see the
    // client-supplied filename, so it cannot tell an image from a renamed
    // executable, script or HTML document. Now that the bytes are on disk we
    // read each file's header and require it to be a real image AND to match
    // the extension it will be served under — the serving route derives
    // Content-Type from that extension, so a mismatch is the exact condition
    // that makes a stored upload dangerous to hand back.
    //
    // A single bad file rejects the whole request and every file it wrote:
    // partially accepting a batch would leave the caller unsure what was stored.
    for (const file of req.files || []) {
      const ext = path.extname(file.filename).toLowerCase();
      const check = verifyStoredImage(file.path, ext);
      if (!check.ok) {
        discardUploadedFiles(req.files);
        return res.status(400).json({ error: 'Invalid image file', reason: check.reason });
      }
    }

    const inserted = [];
    for (const file of req.files) {
      // Columns per migration 005_phase2.sql: file_path, original_name.
      const { rows: [img] } = await pool.query(
        `INSERT INTO training_images (training_id, tenant_id, file_path, original_name)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [trainingId, tenantId, file.filename, file.originalname]
      );
      inserted.push(toImageResponse(img, trainingId));
    }
    res.status(201).json(inserted);
  } catch (e) {
    if (sendDbClientError(res, e)) return;
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings/:trainingId/images
router.get('/:trainingId/images', requireOwnedTraining, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      'SELECT * FROM training_images WHERE training_id=$1 AND tenant_id=$2 ORDER BY created_at',
      [req.params.trainingId, tenantId]
    );
    res.json(rows.map((row) => toImageResponse(row, req.params.trainingId)));
  } catch (e) {
    if (sendDbClientError(res, e)) return;
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings/:trainingId/images/:filename
//
// Replaces the previous `app.use('/uploads', express.static(...))` mount, which
// served every tenant's uploaded client photos to anyone who knew (or was
// leaked) a URL, with no authentication at all. Access now requires a valid JWT
// AND ownership of the parent training; the tenant directory is derived from
// the token rather than from the request path.
router.get('/:trainingId/images/:filename', requireOwnedTraining, async (req, res) => {
  const filePath = resolveTenantFile(
    req.user.tenantId, req.params.trainingId, req.params.filename
  );
  if (!filePath) return res.status(400).json({ error: 'Invalid file name' });

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  // These are private client photos: never let a shared cache retain them.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

// DELETE /api/trainings/:trainingId/images/:imageId
router.delete('/:trainingId/images/:imageId', requireOwnedTraining, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { imageId } = req.params;

    if (!isUuid(imageId)) return res.status(404).json({ error: 'Not found' });

    const { rows: [img] } = await pool.query(
      'SELECT * FROM training_images WHERE id=$1 AND training_id=$2 AND tenant_id=$3',
      [imageId, req.params.trainingId, tenantId]
    );
    if (!img) return res.status(404).json({ error: 'Not found' });

    // Rebuild the on-disk path from validated components instead of trusting
    // the stored value, so a malformed/legacy row cannot steer the unlink.
    const storedName = path.basename(img.file_path || '');
    const filePath = resolveTenantFile(tenantId, req.params.trainingId, storedName);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query(
      'DELETE FROM training_images WHERE id=$1 AND tenant_id=$2',
      [img.id, tenantId]
    );
    res.json({ success: true });
  } catch (e) {
    if (sendDbClientError(res, e)) return;
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Upload error handling ────────────────────────────────────────────────────
// multer rejects oversized files, too many files and disallowed extensions by
// passing an Error to next(). Without this, those all fell through to the
// global handler and were answered as 500 Internal Server Error — the caller
// could not tell a rejected upload from a broken server, and (before the error
// handler was hardened) multer's message was echoed back verbatim.
router.use((err, req, res, next) => {
  if (!err) return next();
  discardUploadedFiles(req.files);

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File too large (maximum 10MB)'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Too many files'
        : 'Upload rejected';
    return res.status(400).json({ error: message });
  }

  if (err.message === 'Images only') {
    return res.status(400).json({ error: 'Only image files are accepted' });
  }

  if (err.message === 'Invalid file name' || err.message === 'Invalid upload destination') {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  // busboy rejects a corrupt multipart body before multer sees any file — a NUL
  // byte in a filename, for instance, breaks the part header itself. That is a
  // malformed request, so it is answered as one; it previously fell through to
  // the global handler and was reported as an internal server error.
  if (/malformed part|unexpected end of form|boundary not found|missing boundary|malformed multipart/i
    .test(err.message || '')) {
    return res.status(400).json({ error: 'Malformed upload request' });
  }

  next(err);
});

module.exports = router;
