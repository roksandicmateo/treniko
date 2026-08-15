'use strict';

/**
 * Training-images feature: end-to-end through the real upload path.
 *
 * routes/uploads.js previously read/wrote `image_url` and `uploaded_at`, but
 * migration 005_phase2.sql defines the table with `file_path`, `original_name`
 * and `created_at` — so every upload failed. The code now matches the schema of
 * record (no extra migration needed). These tests cover the whole feature:
 * upload, metadata, listing, authenticated retrieval, cross-tenant denial and
 * path traversal.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');

jest.setTimeout(30000);

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let A;
let B;

beforeAll(async () => {
  A = await createTenant('imga');
  B = await createTenant('imgb');
});

afterAll(async () => {
  for (const t of [A, B]) {
    if (t) fs.rmSync(path.join(UPLOADS_ROOT, t.tenantId), { recursive: true, force: true });
  }
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

const uploadAs = (tenant, filename = 'progress-photo.png') =>
  request(app)
    .post(`/api/trainings/${tenant.trainingId}/images`)
    .set('Authorization', `Bearer ${tenant.token}`)
    .attach('images', PNG_BYTES, filename);

describe('upload stores correct metadata', () => {
  test('a trainer can upload an image to their own training', async () => {
    const res = await uploadAs(A);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const img = res.body[0];
    expect(img.training_id).toBe(A.trainingId);
    expect(img.tenant_id).toBe(A.tenantId);
    // Stored value is the generated filename only — never a path or URL.
    expect(img.file_path).toMatch(/^[0-9]+-[a-z0-9]+\.png$/);
    expect(img.file_path).not.toContain('/');
    expect(img.original_name).toBe('progress-photo.png');
    expect(img.created_at).toBeTruthy();
    // The client-facing URL is derived, not persisted.
    expect(img.url).toBe(`/api/trainings/${A.trainingId}/images/${img.file_path}`);
  });

  test('the file actually lands in the owning tenant\'s directory', async () => {
    const res = await uploadAs(A, 'on-disk.png');
    expect(res.status).toBe(201);

    const onDisk = path.join(
      UPLOADS_ROOT, A.tenantId, 'trainings', A.trainingId, res.body[0].file_path
    );
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.readFileSync(onDisk)).toEqual(PNG_BYTES);
  });

  test('the row is persisted and listable', async () => {
    const upload = await uploadAs(A, 'listed.png');
    expect(upload.status).toBe(201);

    const list = await request(app)
      .get(`/api/trainings/${A.trainingId}/images`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(list.status).toBe(200);
    const found = list.body.find((i) => i.original_name === 'listed.png');
    expect(found).toBeDefined();
    expect(found.url).toBe(`/api/trainings/${A.trainingId}/images/${found.file_path}`);

    const { rows } = await queryAs(A,
      'SELECT file_path, original_name FROM training_images WHERE id = $1',
      [found.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].original_name).toBe('listed.png');
  });

  test('a non-image extension is rejected', async () => {
    const res = await request(app)
      .post(`/api/trainings/${A.trainingId}/images`)
      .set('Authorization', `Bearer ${A.token}`)
      .attach('images', Buffer.from('#!/bin/sh\necho pwned'), 'payload.sh');

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('retrieval is authenticated and tenant-scoped', () => {
  let uploadedA;

  beforeAll(async () => {
    const res = await uploadAs(A, 'retrieval.png');
    uploadedA = res.body[0];
  });

  test('the owner can retrieve the image bytes', async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${uploadedA.file_path}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(PNG_BYTES);
  });

  test('unauthenticated retrieval is denied', async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${uploadedA.file_path}`);

    expect([401, 403]).toContain(res.status);
    expect(res.body).not.toEqual(PNG_BYTES);
  });

  test("Trainer B cannot retrieve Trainer A's image", async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images/${uploadedA.file_path}`)
      .set('Authorization', `Bearer ${B.token}`);

    expect(res.status).toBe(404);
    expect(res.body).not.toEqual(PNG_BYTES);
  });

  test("Trainer B cannot list Trainer A's images", async () => {
    const res = await request(app)
      .get(`/api/trainings/${A.trainingId}/images`)
      .set('Authorization', `Bearer ${B.token}`);

    expect(res.status).toBe(404);
  });

  test("Trainer B cannot upload into Trainer A's training", async () => {
    const res = await request(app)
      .post(`/api/trainings/${A.trainingId}/images`)
      .set('Authorization', `Bearer ${B.token}`)
      .attach('images', PNG_BYTES, 'intruder.png');

    expect(res.status).toBe(404);

    const { rows } = await queryAs(A,
      'SELECT id FROM training_images WHERE original_name = $1', ['intruder.png']
    );
    expect(rows).toHaveLength(0);
  });

  test('path traversal via filename remains impossible', async () => {
    for (const payload of ['..%2F..%2F..%2Fserver.js', '..%2f..%2fpackage.json']) {
      const res = await request(app)
        .get(`/api/trainings/${A.trainingId}/images/${payload}`)
        .set('Authorization', `Bearer ${A.token}`);

      expect([400, 404]).toContain(res.status);
      expect(res.text || '').not.toContain('TRENIKO Backend Server');
      expect(res.text || '').not.toContain('treniko-backend');
    }
  });
});

describe('deletion', () => {
  test('the owner can delete their image and the file is removed', async () => {
    const upload = await uploadAs(A, 'to-delete.png');
    const img = upload.body[0];
    const onDisk = path.join(
      UPLOADS_ROOT, A.tenantId, 'trainings', A.trainingId, img.file_path
    );
    expect(fs.existsSync(onDisk)).toBe(true);

    const del = await request(app)
      .delete(`/api/trainings/${A.trainingId}/images/${img.id}`)
      .set('Authorization', `Bearer ${A.token}`);

    expect(del.status).toBe(200);
    expect(fs.existsSync(onDisk)).toBe(false);

    const { rows } = await queryAs(A, 'SELECT id FROM training_images WHERE id = $1', [img.id]);
    expect(rows).toHaveLength(0);
  });

  test("Trainer B cannot delete Trainer A's image", async () => {
    const upload = await uploadAs(A, 'protected.png');
    const img = upload.body[0];

    const del = await request(app)
      .delete(`/api/trainings/${A.trainingId}/images/${img.id}`)
      .set('Authorization', `Bearer ${B.token}`);

    expect(del.status).toBe(404);

    const { rows } = await queryAs(A, 'SELECT id FROM training_images WHERE id = $1', [img.id]);
    expect(rows).toHaveLength(1);
  });
});
