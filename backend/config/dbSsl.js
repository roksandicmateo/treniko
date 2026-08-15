'use strict';

const fs = require('fs');

/**
 * TLS options for the PostgreSQL connection (Security Hardening Phase 3).
 *
 * ── What was wrong ───────────────────────────────────────────────────────────
 * Both the runtime pool (`config/database.js`) and the migration runner
 * (`scripts/migrate.js`) connected in production with:
 *
 *     ssl: { rejectUnauthorized: false }
 *
 * That enables encryption but disables *authentication* of the server: the
 * client accepts any certificate from anything that answers on the host and
 * port. Anyone able to intercept the connection can present their own
 * certificate, read every query and response — every tenant's client records,
 * health notes and session data — and capture the database credentials on the
 * way past. Encryption without verification is not protection against an
 * active attacker, which is the only attacker TLS is there to stop.
 *
 * The pattern is common because managed providers (DigitalOcean, Railway,
 * Heroku) issue certificates from their own CA, and turning verification off is
 * the quickest way to make the connection work. Supplying that CA is barely
 * more effort and is the actual fix.
 *
 * ── The three supported configurations ───────────────────────────────────────
 *  1. `DB_SSL_CA` (PEM text) or `DB_SSL_CA_FILE` (path) — verified TLS against
 *     that CA. **Recommended**: every managed provider publishes its CA
 *     certificate.
 *  2. `DB_SSL_REJECT_UNAUTHORIZED=false` — the old unverified behaviour, kept
 *     available but now a deliberate, greppable choice that logs a warning at
 *     startup rather than a silent default.
 *  3. Neither — verified TLS against the system trust store.
 *
 * Case 3 is the new default, and it fails closed: a provider using a private CA
 * will refuse to connect until the operator picks 1 or 2. That is intentional.
 * The alternative default is a connection that looks secure and is not, and the
 * failure is a clear startup error naming both remedies rather than a silent
 * exposure.
 *
 * SSL is only ever configured in production. Local development connects to
 * localhost without TLS exactly as before.
 */

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env] defaults to process.env
 * @param {(message: string) => void} [options.warn] defaults to console.warn
 * @returns {{ssl?: object}} spreadable into a pg Pool/Client config
 */
const buildSslOptions = ({ env = process.env, warn = console.warn } = {}) => {
  const isProduction = env.NODE_ENV === 'production';

  // Unchanged from before: no TLS outside production, and DB_SSL=false opts out.
  if (!isProduction || env.DB_SSL === 'false') return {};

  const ca = env.DB_SSL_CA
    || (env.DB_SSL_CA_FILE ? fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8') : undefined);

  if (ca) {
    return { ssl: { ca, rejectUnauthorized: true } };
  }

  if (env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    warn(
      '[db] WARNING: TLS certificate verification is DISABLED for the database '
      + 'connection (DB_SSL_REJECT_UNAUTHORIZED=false). The connection is '
      + 'encrypted but the server is not authenticated, so an attacker able to '
      + 'intercept it can read all traffic and capture credentials. Supply your '
      + "provider's CA certificate via DB_SSL_CA or DB_SSL_CA_FILE instead."
    );
    return { ssl: { rejectUnauthorized: false } };
  }

  return { ssl: { rejectUnauthorized: true } };
};

/**
 * Human-readable description of what a connection failure most likely means,
 * appended to TLS errors so the remedy is in the error the operator sees.
 */
const TLS_HELP = [
  'If this is a TLS certificate error, the database is presenting a certificate',
  'that cannot be verified against the system trust store. Either:',
  '  - set DB_SSL_CA_FILE to your provider\'s CA certificate (recommended), or',
  '  - set DB_SSL_REJECT_UNAUTHORIZED=false to accept any certificate',
  '    (encrypted but unauthenticated — an interceptor can read everything).',
].join('\n  ');

module.exports = { buildSslOptions, TLS_HELP };
