'use strict';

/**
 * Error monitoring.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Everything used to go to `console.error` and from there into a PM2 log file
 * nobody reads. The failures that matter most in this product are the quiet
 * ones — a package charge that rolls back, a reminder job that throws halfway
 * through the list — and they are invisible until a trainer notices a wrong
 * number weeks later and cannot say when it started.
 *
 * ── Why not the Sentry SDK ───────────────────────────────────────────────────
 * Sentry's Node SDK is a large dependency tree, and everything this codebase
 * needs from it is one HTTPS POST of a JSON envelope to the endpoint encoded in
 * the DSN. That is implemented here against Node's own `https` module, so the
 * backend keeps its twelve dependencies and the deployment step stays "set one
 * environment variable".
 *
 * It is deliberately best-effort: reporting never blocks a request, never
 * throws into a handler, and never retries. Losing a report is acceptable;
 * failing a trainer's request because the monitoring endpoint is down is not.
 *
 * ── What is NOT sent ─────────────────────────────────────────────────────────
 * No request bodies, no query strings, no headers, no client names, no email
 * addresses. What goes out is the error, the route pattern, the HTTP method,
 * and the tenant id — an opaque UUID, which is what makes a report actionable
 * ("which trainer is affected") without carrying anything about a person.
 */

const https = require('https');
const { URL } = require('url');

const DSN = process.env.SENTRY_DSN || '';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.APP_RELEASE || null;

/** Parse a Sentry DSN into the pieces the envelope endpoint needs. */
const parseDsn = (dsn) => {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    return {
      host: url.hostname,
      projectId,
      publicKey: url.username,
      path: `/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
};

const target = parseDsn(DSN);

/**
 * Rate limiting, so a failure that repeats a thousand times a minute cannot
 * turn a monitoring endpoint into an outage of its own.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
let windowStart = Date.now();
let sentInWindow = 0;

const withinBudget = () => {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    sentInWindow = 0;
  }
  sentInWindow += 1;
  return sentInWindow <= MAX_PER_WINDOW;
};

/**
 * Report an error.
 *
 * @param {Error|string} error
 * @param {object} [context] — safe, non-personal context: `{ route, method,
 *   tenantId, job, outcome }`. Anything else is dropped rather than trusted.
 */
const captureError = (error, context = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;

  // Always local first: the log is what an operator has at 3am with no network.
  console.error(`[error] ${message}`, {
    ...pickSafeContext(context),
    ...(stack ? { stack: stack.split('\n').slice(0, 4).join('\n') } : {}),
  });

  if (!target || !withinBudget()) return;

  const event = {
    event_id: randomHex32(),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    environment: ENVIRONMENT,
    ...(RELEASE ? { release: RELEASE } : {}),
    server_name: undefined,          // deliberately omitted: it is host detail
    tags: pickSafeContext(context),
    exception: {
      values: [{
        type: error instanceof Error ? error.name : 'Error',
        value: message,
        stacktrace: stack ? { frames: parseStack(stack) } : undefined,
      }],
    },
  };

  send(event);
};

/**
 * The allow-list. Context is opt-in rather than opt-out so a future caller
 * cannot accidentally attach a client's name or a request body by passing an
 * object with the wrong shape.
 */
const pickSafeContext = (context) => {
  const safe = {};
  // A default parameter only covers `undefined`, and a caller passing an
  // explicit null is exactly the sort of thing that happens in an error path.
  // Reporting must not be able to throw a second error on top of the first.
  if (!context || typeof context !== 'object') return safe;
  for (const key of ['route', 'method', 'tenantId', 'job', 'outcome', 'statusCode']) {
    if (context[key] !== undefined && context[key] !== null) {
      safe[key] = String(context[key]).slice(0, 200);
    }
  }
  return safe;
};

const parseStack = (stack) =>
  stack
    .split('\n')
    .slice(1, 25)
    .map((line) => ({ function: line.trim().slice(0, 300) }))
    .reverse();

const randomHex32 = () => require('crypto').randomBytes(16).toString('hex');

/** Fire-and-forget POST of one envelope. Never throws, never awaits. */
const send = (event) => {
  const header = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn: DSN,
  });
  const item = JSON.stringify(event);
  const body = `${header}\n${JSON.stringify({ type: 'event', length: Buffer.byteLength(item) })}\n${item}\n`;

  const req = https.request(
    {
      host: target.host,
      path: target.path,
      method: 'POST',
      timeout: 4000,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'Content-Length': Buffer.byteLength(body),
        'X-Sentry-Auth':
          `Sentry sentry_version=7, sentry_client=treniko/1.0, sentry_key=${target.publicKey}`,
      },
    },
    (res) => { res.resume(); }     // drain, ignore the response
  );

  req.on('error', () => {});       // monitoring must never break the app
  req.on('timeout', () => req.destroy());
  req.write(body);
  req.end();
};

const isConfigured = () => Boolean(target);

module.exports = { captureError, isConfigured, parseDsn };
