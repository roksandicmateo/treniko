'use strict';

/**
 * Private upload access control (Phase 2A).
 *
 * TR-CRIT-1: `/uploads` was an express.static mount with no authentication, so
 * any caller holding (or guessing) a URL could read another tenant's client
 * photos. TR-CRIT-4/TR-HIGH-4: the multer destination was built from an
 * unvalidated :trainingId and files were written before the ownership check.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');

jest.setTimeout(30000);

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

// Smallest valid PNG, used as fixture content.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let A;
let B;
const createdDirs = [];

/** Place a real file inside a tenant's upload tree, bypassing the API. */
const seedFile = (tenant, filename) => {
  const dir = path.join(UPLOADS_ROOT, tenant.tenantId, 'trainings', tenant.trainingId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), PNG_BYTES);
  createdDirs.push(path.join(UPLOADS_ROOT, tenant.tenantId));
  return filename;
};

let fileA;
let fileB;

beforeAll(async () => {
  A = await createTenant('upa');
  B = await createTenant('upb');
  fileA = seedFile(A, 'owned-by-a.png');
  fileB = seedFile(B, 'owned-by-b.png');
});

afterAll(async () => {
  for (const dir of createdDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

describe('TR-CRIT-1: private uploads are no longer publicly served', () => {
  test('the old unauthenticated /uploads static route no longer serves files', async () => {
    const res = await request(app).get(
      `/uploads/${A.tenantId}/trainings/${A.trainingId}/${fileA}`
    );

    expect(res.status).toBe(404);
    // Must not have returned the image bytes.
    expect(res.headers['content-type']).not.toMatch(/image/);
    expect(res.body).not.toEqual(PNG_BYTES);
  });

  test('the old path is not served even with a valid token', async () => {
    const res = await request(app)
      .get(`/uploads/${A.tenantId}/trainings/${A.trainingId}/${fileA}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).not.toMatch(/image/);
  });

  test('an unauthenticated caller cannot read a file via the new endpoint', async () => {
    const res = await request(app).get(
      `/api/trainings/${A.trainingId}/images/${fileA}`
    );

    expect([401, 403]).toContain(res.status);
    expect(res.headers['content-type']).not.toMatch(/image/);
  });

  test("Trainer A cannot read Trainer B's file", async () => {
    const res = await request(app)
      .get(`/api/trainings/${B.trainingId}/images/${fileB}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).not.toMatch(/image/);
  });

  test("Trainer A cannot read B's file by pairing A's trainingId with B's filename", async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${fileB}`)
      .set('Authorization', `Bearer ${A.token}`);

    // A owns the training, but that filename does not exist in A's directory —
    // and the tenant segment comes from A's token, so B's tree is unreachable.
    expect(res.status).toBe(404);
  });

  test('the legitimate owner can read their own file', async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${fileA}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(PNG_BYTES);
    expect(res.headers['cache-control']).toContain('no-store');
  });
});

describe('path traversal is rejected', () => {
  const traversals = [
    '..%2F..%2F..%2Fserver.js',
    '..%2f..%2fpackage.json',
    '%2e%2e%2f%2e%2e%2fserver.js',
    '....//....//server.js',
  ];

  test.each(traversals)('filename traversal %s cannot escape the upload root', async (payload) => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${payload}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect([400, 404]).toContain(res.status);
    const body = res.text || '';
    expect(body).not.toContain('TRENIKO Backend Server');
    expect(body).not.toContain('treniko-backend');
  });

  test('a traversal in :trainingId is rejected before any filesystem access', async () => {
    const res = await request(app)
      .get(`/api/trainings/${encodeURIComponent('../../etc')}/images/x.png`)
      .set('Authorization', `Bearer ${A.token}`);

    expect([400, 404]).toContain(res.status);
  });
});

describe('TR-HIGH-4: upload ownership is checked before anything is written', () => {
  test('uploading to another tenant\'s training is refused and writes nothing', async () => {
    const targetDir = path.join(UPLOADS_ROOT, A.tenantId, 'trainings', B.trainingId);
    fs.rmSync(targetDir, { recursive: true, force: true });

    const res = await request(app)
      .post(`/api/trainings/${B.trainingId}/images`)
      .set('Authorization', `Bearer ${A.token}`)
      .attach('images', PNG_BYTES, 'evil.png');

    expect(res.status).toBe(404);
    // multer must never have run: no directory, no file.
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  test('a malformed trainingId is rejected and creates no directory', async () => {
    const before = fs.existsSync(UPLOADS_ROOT)
      ? fs.readdirSync(UPLOADS_ROOT).length
      : 0;

    const res = await request(app)
      .post('/api/trainings/not-a-uuid/images')
      .set('Authorization', `Bearer ${A.token}`)
      .attach('images', PNG_BYTES, 'evil.png');

    expect(res.status).toBe(400);

    const after = fs.existsSync(UPLOADS_ROOT)
      ? fs.readdirSync(UPLOADS_ROOT).length
      : 0;
    expect(after).toBe(before);
  });

  test('an unauthenticated upload is refused', async () => {
    const res = await request(app)
      .post(`/api/trainings/${A.trainingId}/images`)
      .attach('images', PNG_BYTES, 'evil.png');

    expect([401, 403]).toContain(res.status);
  });
});
