const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { isUuid } = require('../utils/validation');

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
    console.error('requireOwnedTraining error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Both segments are already validated: tenantId comes from the verified
    // JWT and trainingId passed requireOwnedTraining's UUID + ownership check.
    const dir = path.join(
      UPLOADS_ROOT, req.user.tenantId, 'trainings', req.params.trainingId
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
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

// POST /api/trainings/:trainingId/images
router.post('/:trainingId/images', requireOwnedTraining, upload.array('images', 10), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { trainingId } = req.params;

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
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
