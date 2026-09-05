'use strict';

/**
 * Error monitoring must not become a data leak.
 *
 * Reporting exists so that quiet failures — a package charge that rolled back,
 * a reminder job that threw halfway down the list — reach someone. It runs on
 * every error path in the API, which makes it a place where a client's name or
 * a request body could very easily start leaving the building.
 *
 * These tests pin the two properties that matter: only allow-listed,
 * non-personal context is attached, and a missing or malformed DSN degrades to
 * local logging rather than throwing inside a request handler.
 */

const { parseDsn, captureError, isConfigured } = require('../../config/errorMonitor');

describe('DSN handling', () => {
  test('a well-formed DSN yields the envelope endpoint', () => {
    const target = parseDsn('https://abc123@o1.ingest.sentry.io/456');
    expect(target).toEqual({
      host: 'o1.ingest.sentry.io',
      projectId: '456',
      publicKey: 'abc123',
      path: '/api/456/envelope/',
    });
  });

  test('a malformed DSN is refused rather than half-used', () => {
    expect(parseDsn('not-a-url')).toBeNull();
    expect(parseDsn('https://o1.ingest.sentry.io/456')).toBeNull();  // no public key
    expect(parseDsn('https://abc123@o1.ingest.sentry.io/')).toBeNull(); // no project
    expect(parseDsn('')).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });

  test('with no DSN configured the module reports as unconfigured', () => {
    // The suite runs without SENTRY_DSN, which is the state a developer and an
    // un-provisioned production box are both in.
    expect(isConfigured()).toBe(process.env.SENTRY_DSN ? true : false);
  });
});

describe('what leaves the process', () => {
  const originalError = console.error;
  let logged;

  beforeEach(() => {
    logged = [];
    console.error = (...args) => logged.push(args);
  });
  afterEach(() => { console.error = originalError; });

  test('personal and request data passed by mistake is dropped', () => {
    captureError(new Error('boom'), {
      route: '/api/clients/:id',
      method: 'GET',
      tenantId: '11111111-1111-1111-1111-111111111111',
      // Everything below is NOT on the allow-list and must not survive.
      clientName: 'Marko Marković',
      email: 'marko@example.com',
      body: { password: 'hunter2' },
      authorization: 'Bearer eyJhbGciOi',
    });

    const context = logged[0][1];
    expect(context.route).toBe('/api/clients/:id');
    expect(context.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    expect(context.clientName).toBeUndefined();
    expect(context.email).toBeUndefined();
    expect(context.body).toBeUndefined();
    expect(context.authorization).toBeUndefined();

    const serialised = JSON.stringify(logged);
    expect(serialised).not.toContain('Marković');
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('eyJhbGciOi');
  });

  test('a non-Error is reported without throwing', () => {
    expect(() => captureError('a string failure', { job: 'cron' })).not.toThrow();
    expect(logged[0][0]).toContain('a string failure');
  });

  test('reporting never throws into the caller, whatever it is handed', () => {
    expect(() => captureError(null)).not.toThrow();
    expect(() => captureError(undefined, null)).not.toThrow();
    expect(() => captureError(new Error('x'), { tenantId: { nested: true } })).not.toThrow();
  });
});
