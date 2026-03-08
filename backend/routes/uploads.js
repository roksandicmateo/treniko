const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', req.user.tenantId, 'trainings', req.params.trainingId);
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
    if (/jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Images only'));
    }
  },
});

// POST /api/trainings/:trainingId/images
router.post('/:trainingId/images', upload.array('images', 10), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { trainingId } = req.params;
    const { rows: [t] } = await pool.query(
      'SELECT id FROM trainings WHERE id=$1 AND tenant_id=$2',
      [trainingId, tenantId]
    );
    if (!t) return res.status(404).json({ error: 'Training not found' });

    const inserted = [];
    for (const file of req.files) {
      const url = `/uploads/${tenantId}/trainings/${trainingId}/${file.filename}`;
      const { rows: [img] } = await pool.query(
        'INSERT INTO training_images (training_id, tenant_id, image_url) VALUES ($1,$2,$3) RETURNING *',
        [trainingId, tenantId, url]
      );
      inserted.push(img);
    }
    res.status(201).json(inserted);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings/:trainingId/images
router.get('/:trainingId/images', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      'SELECT * FROM training_images WHERE training_id=$1 AND tenant_id=$2 ORDER BY uploaded_at',
      [req.params.trainingId, tenantId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trainings/:trainingId/images/:imageId
router.delete('/:trainingId/images/:imageId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows: [img] } = await pool.query(
      'SELECT * FROM training_images WHERE id=$1 AND tenant_id=$2',
      [req.params.imageId, tenantId]
    );
    if (!img) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(__dirname, '..', img.image_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM training_images WHERE id=$1', [img.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
