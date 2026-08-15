'use strict';

/**
 * The database TLS policy from Phase 3 is still intact (Phase 4, Step 14).
 *
 * Phase 3 replaced `ssl: { rejectUnauthorized: false }` — encryption without
 * authentication, which stops a passive listener and does nothing about an
 * active one — with verified TLS by default. That change had no test protecting
 * it, which is how it could quietly regress: the fastest way to make a TLS
 * problem go away during unrelated work is to turn verification off again, and
 * nothing would have failed.
 *
 * Phase 4 touched the connection layer (config/database.js wraps pool.query
 * now), so the policy is pinned here before that layer changes again.
 *
 * These are pure unit tests over `buildSslOptions`: no database, no network,
 * and the real process environment is never mutated — every case passes its own
 * `env` object in. Both the runtime pool and the migration runner build their
 * TLS options from this one function, so pinning it pins both.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSslOptions, TLS_HELP } = require('../../config/dbSsl');

/** A throwaway PEM-ish file, to prove DB_SSL_CA_FILE is actually read. */
let caFile;
const CA_TEXT = '-----BEGIN CERTIFICATE-----\nnot-a-real-certificate\n-----END CERTIFICATE-----\n';

beforeAll(() => {
  caFile = path.join(os.tmpdir(), `treniko-test-ca-${process.pid}.pem`);
  fs.writeFileSync(caFile, CA_TEXT);
});

afterAll(() => {
  if (caFile && fs.existsSync(caFile)) fs.unlinkSync(caFile);
});

const prod = (extra = {}) => ({ NODE_ENV: 'production', ...extra });
const silent = () => jest.fn();

describe('verified TLS is the production default', () => {
  test('production with no TLS configuration verifies the server', () => {
    const { ssl } = buildSslOptions({ env: prod(), warn: silent() });
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  test('the default is not merely truthy — it is explicitly true', () => {
    // `ssl: true` would also enable TLS, but a future refactor returning it
    // would lose the explicitness that makes this reviewable.
    const { ssl } = buildSslOptions({ env: prod(), warn: silent() });
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.rejectUnauthorized).not.toBe(undefined);
  });

  test('the default fails closed rather than falling back to unverified TLS', () => {
    // A private-CA provider will be refused until the operator supplies the CA.
    // That is the intended behaviour: the alternative default is a connection
    // that looks secure and is not.
    const { ssl } = buildSslOptions({ env: prod(), warn: silent() });
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toBeUndefined();
  });
});

describe('a private CA can be supplied without weakening verification', () => {
  test('DB_SSL_CA (inline PEM) is used and verification stays on', () => {
    const { ssl } = buildSslOptions({
      env: prod({ DB_SSL_CA: CA_TEXT }),
      warn: silent(),
    });
    expect(ssl).toEqual({ ca: CA_TEXT, rejectUnauthorized: true });
  });

  test('DB_SSL_CA_FILE is read from disk and verification stays on', () => {
    const { ssl } = buildSslOptions({
      env: prod({ DB_SSL_CA_FILE: caFile }),
      warn: silent(),
    });
    expect(ssl.ca).toBe(CA_TEXT);
    expect(ssl.rejectUnauthorized).toBe(true);
  });

  test('inline PEM takes precedence over the file, and both still verify', () => {
    const { ssl } = buildSslOptions({
      env: prod({ DB_SSL_CA: 'inline-pem', DB_SSL_CA_FILE: caFile }),
      warn: silent(),
    });
    expect(ssl.ca).toBe('inline-pem');
    expect(ssl.rejectUnauthorized).toBe(true);
  });

  test('a missing CA file fails closed rather than silently continuing', () => {
    // Falling back to "no CA, verification off" on a typo'd path would be the
    // worst outcome: a configuration error that presents as a working, but
    // unauthenticated, connection.
    expect(() =>
      buildSslOptions({
        env: prod({ DB_SSL_CA_FILE: path.join(os.tmpdir(), 'definitely-not-here.pem') }),
        warn: silent(),
      })
    ).toThrow();
  });
});

describe('disabling verification remains possible, deliberate and loud', () => {
  test('it requires an explicit opt-out flag', () => {
    const warn = silent();
    const { ssl } = buildSslOptions({
      env: prod({ DB_SSL_REJECT_UNAUTHORIZED: 'false' }),
      warn,
    });
    expect(ssl).toEqual({ rejectUnauthorized: false });
  });

  test('it warns, naming the risk and the remedy', () => {
    const warn = jest.fn();
    buildSslOptions({ env: prod({ DB_SSL_REJECT_UNAUTHORIZED: 'false' }), warn });

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0];
    expect(message).toMatch(/DISABLED/);
    expect(message).toMatch(/not authenticated|interceptor|intercept/i);
    expect(message).toMatch(/DB_SSL_CA/);
  });

  test('any value other than the exact string "false" keeps verification on', () => {
    // Guards against a truthiness bug turning '0', 'no' or '' into an opt-out.
    for (const value of ['0', 'no', 'FALSE', 'off', '', 'true']) {
      const { ssl } = buildSslOptions({
        env: prod({ DB_SSL_REJECT_UNAUTHORIZED: value }),
        warn: silent(),
      });
      expect(ssl.rejectUnauthorized).toBe(true);
    }
  });

  test('a supplied CA wins over the opt-out, rather than the reverse', () => {
    const { ssl } = buildSslOptions({
      env: prod({ DB_SSL_CA: CA_TEXT, DB_SSL_REJECT_UNAUTHORIZED: 'false' }),
      warn: silent(),
    });
    expect(ssl.rejectUnauthorized).toBe(true);
  });
});

describe('development and tests are unaffected', () => {
  test('no TLS outside production', () => {
    expect(buildSslOptions({ env: { NODE_ENV: 'development' }, warn: silent() })).toEqual({});
    expect(buildSslOptions({ env: { NODE_ENV: 'test' }, warn: silent() })).toEqual({});
  });

  test('DB_SSL=false opts out entirely, in production too', () => {
    // Used by the disposable-database tooling, which connects to localhost.
    expect(buildSslOptions({ env: prod({ DB_SSL: 'false' }), warn: silent() })).toEqual({});
  });

  test('opting out of TLS does not silently opt out of verification elsewhere', () => {
    const withoutSsl = buildSslOptions({ env: prod({ DB_SSL: 'false' }), warn: silent() });
    expect(withoutSsl.ssl).toBeUndefined();
  });
});

describe('nothing sensitive is logged', () => {
  test('the CA is never written to the warning channel', () => {
    const warn = jest.fn();
    buildSslOptions({
      env: prod({ DB_SSL_CA: CA_TEXT, DB_SSL_REJECT_UNAUTHORIZED: 'false' }),
      warn,
    });
    const logged = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toContain('BEGIN CERTIFICATE');
    expect(logged).not.toContain(CA_TEXT);
  });

  test('no password or connection string appears in the operator help text', () => {
    expect(TLS_HELP).not.toMatch(/password|postgres:\/\//i);
    expect(TLS_HELP).toMatch(/DB_SSL_CA_FILE/);
  });

  test('the current process environment is never mutated by building options', () => {
    const before = { ...process.env };
    buildSslOptions({ env: prod({ DB_SSL_REJECT_UNAUTHORIZED: 'false' }), warn: silent() });
    expect({ ...process.env }).toEqual(before);
  });
});
