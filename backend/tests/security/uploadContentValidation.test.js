'use strict';

/**
 * Upload content validation (Phase 2B, TR-MED-3).
 *
 * File-type validation used to be a regex over the client-supplied extension.
 * The extension is chosen by the caller and says nothing about the bytes, so
 * any file renamed to `.png` was accepted, stored, and later streamed back with
 * a Content-Type derived from that same extension.
 *
 * These tests assert the three properties that matter: the bytes are checked,
 * the bytes must agree with the extension, and a rejected upload leaves nothing
 * behind — no database row and no file on disk.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');
const { sniffImageKind, verifyStoredImage } = require('../../utils/fileType');

jest.setTimeout(30000);

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

// Smallest valid 1x1 PNG.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
// Smallest valid JPEG (SOI + APP0 + EOI is enough for a signature check).
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from('JFIF\0'),
  Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]),
]);
const SCRIPT_BYTES = Buffer.from('<?php system($_GET["c"]); ?>');
const HTML_BYTES = Buffer.from('<html><script>alert(document.cookie)</script></html>');

let A;

/** Everything currently stored for this tenant's training. */
const storedFiles = () => {
  const dir = path.join(UPLOADS_ROOT, A.tenantId, 'trainings', A.trainingId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

const imageRows = async () => {
  const { rows } = await pool.query(
    'SELECT id, file_path FROM training_images WHERE training_id = $1',
    [A.trainingId]
  );
  return rows;
};

beforeAll(async () => {
  A = await createTenant('a');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  const tenantDir = path.join(UPLOADS_ROOT, A.tenantId);
  if (fs.existsSync(tenantDir)) fs.rmSync(tenantDir, { recursive: true, force: true });
  await pool.end();
});

const upload = () =>
  request(app)
    .post(`/api/trainings/${A.trainingId}/images`)
    .set('Authorization', `Bearer ${A.token}`);

describe('the signature reader itself', () => {
  test('recognises the formats the application stores', () => {
    expect(sniffImageKind(PNG_BYTES)).toBe('png');
    expect(sniffImageKind(JPEG_BYTES)).toBe('jpeg');
    expect(sniffImageKind(Buffer.from('GIF89a...'))).toBe('gif');
    expect(sniffImageKind(Buffer.concat([
      Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'),
    ]))).toBe('webp');
  });

  test('refuses anything else, including short and empty input', () => {
    expect(sniffImageKind(SCRIPT_BYTES)).toBeNull();
    expect(sniffImageKind(HTML_BYTES)).toBeNull();
    expect(sniffImageKind(Buffer.alloc(0))).toBeNull();
    expect(sniffImageKind(Buffer.from([0xff]))).toBeNull();
    expect(sniffImageKind('not a buffer')).toBeNull();
  });

  test('refuses an extension the application does not serve', () => {
    const tmp = path.join(UPLOADS_ROOT, `sec2b-probe-${Date.now()}.png`);
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
    fs.writeFileSync(tmp, PNG_BYTES);
    try {
      expect(verifyStoredImage(tmp, '.php').ok).toBe(false);
      expect(verifyStoredImage(tmp, '.png').ok).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

describe('TR-MED-3: uploads are validated by content, not by filename', () => {
  test('a real PNG is accepted and recorded', async () => {
    const res = await upload().attach('images', PNG_BYTES, 'legitimate.png');

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(await imageRows()).toHaveLength(1);
    expect(storedFiles()).toHaveLength(1);
  });

  test('a script renamed to .png is rejected, stored nowhere', async () => {
    const before = storedFiles().length;

    const res = await upload().attach('images', SCRIPT_BYTES, 'payload.png');

    expect(res.status).toBe(400);
    expect(await imageRows()).toHaveLength(1); // still just the legitimate one
    // The rejected file must not survive on disk either.
    expect(storedFiles()).toHaveLength(before);
  });

  test('an HTML document renamed to .gif is rejected', async () => {
    const before = storedFiles().length;
    const res = await upload().attach('images', HTML_BYTES, 'xss.gif');

    expect(res.status).toBe(400);
    expect(storedFiles()).toHaveLength(before);
  });

  test('a real JPEG mislabelled as .png is rejected (content must match extension)', async () => {
    // The serving route derives Content-Type from the extension, so a mismatch
    // is exactly the condition that makes a stored file unsafe to hand back.
    const before = storedFiles().length;
    const res = await upload().attach('images', JPEG_BYTES, 'actually-jpeg.png');

    expect(res.status).toBe(400);
    expect(storedFiles()).toHaveLength(before);
  });

  test('the same JPEG under its own extension is accepted', async () => {
    const res = await upload().attach('images', JPEG_BYTES, 'honest.jpg');
    expect(res.status).toBe(201);
  });

  test('one bad file rejects the whole batch, leaving nothing partially stored', async () => {
    const before = storedFiles().length;
    const rowsBefore = (await imageRows()).length;

    const res = await upload()
      .attach('images', PNG_BYTES, 'good.png')
      .attach('images', SCRIPT_BYTES, 'bad.png');

    expect(res.status).toBe(400);
    expect(await imageRows()).toHaveLength(rowsBefore);
    expect(storedFiles()).toHaveLength(before);
  });

  test('a disallowed extension is a 400, not a 500', async () => {
    // multer rejects this in its fileFilter; that error used to reach the
    // global handler and be reported as an internal server error.
    const res = await upload().attach('images', SCRIPT_BYTES, 'payload.php');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+/);
  });

  test('a stored file is still retrievable by its owner', async () => {
    const rows = await imageRows();
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${rows[0].file_path}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
