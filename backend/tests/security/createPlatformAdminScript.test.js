'use strict';

/**
 * scripts/create-platform-admin.js — the only way a platform administrator can
 * be created, so its failure modes matter as much as its success path.
 *
 * ── Why the non-interactive mode exists, and why it is tested here ──────────
 * The interactive path cannot be driven from a pipe. Each prompt opens its own
 * readline interface on `process.stdin`; once the first closes, a piped stream
 * is exhausted, so the second prompt never receives input and the process
 * exits **0 having done nothing**. In automation that is indistinguishable from
 * success — a deploy script would report a created administrator that does not
 * exist. That was observed for real while provisioning, and `--non-interactive`
 * is the fix.
 *
 * These tests spawn the real script as a child process. Nothing is mocked: the
 * point is the process boundary — argv handling, stdin, exit codes — which a
 * unit test of an exported function would not exercise at all.
 */

const { spawn } = require('child_process');
const path = require('path');
const { pool } = require('../helpers/fixtures');

jest.setTimeout(60000);

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'create-platform-admin.js');
const MARKER = `scripttest-${Date.now()}`;
const PASSWORD = 'ScriptTestPassw0rd!';

/**
 * Run the script.
 * @param {string[]} args
 * @param {{stdin?: string, env?: object}} opts
 */
const run = (args, { stdin, env } = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    if (stdin !== undefined) child.stdin.write(stdin);
    child.stdin.end();

    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

const emailFor = (label) => `${MARKER}-${label}@example.test`;

const countFor = async (email) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM platform_admins WHERE email = $1', [email]);
  return rows[0].n;
};

afterAll(async () => {
  await pool.query('DELETE FROM admin_audit_log WHERE admin_email LIKE $1', [`${MARKER}%`]);
  await pool.query('DELETE FROM platform_admins WHERE email LIKE $1', [`${MARKER}%`]);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the password never comes from the command line', () => {
  test('--password is refused outright, in both modes', async () => {
    const interactive = await run(['--password', 'hunter2', '--email', emailFor('argv')]);
    expect(interactive.code).toBe(2);
    expect(interactive.stderr).toMatch(/Refusing to read a password from the command line/i);

    const nonInteractive = await run([
      '--non-interactive', '--password', 'hunter2',
      '--email', emailFor('argv2'), '--first-name', 'A', '--last-name', 'B',
    ]);
    expect(nonInteractive.code).toBe(2);

    expect(await countFor(emailFor('argv'))).toBe(0);
    expect(await countFor(emailFor('argv2'))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('--non-interactive creates an administrator from piped stdin', () => {
  const email = () => emailFor('stdin');

  test('an account is created and the password is never echoed', async () => {
    const res = await run(
      ['--non-interactive', '--email', email(), '--first-name', 'Script', '--last-name', 'Test', '--role', 'admin'],
      { stdin: PASSWORD }
    );

    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/Administrator created/);

    // The one thing that must never appear in output a CI job would capture.
    expect(res.stdout).not.toContain(PASSWORD);
    expect(res.stderr).not.toContain(PASSWORD);
    expect(res.stdout).not.toMatch(/\$2[aby]\$/);   // nor the hash

    const { rows } = await pool.query(
      'SELECT email, role, is_active, locked_until FROM platform_admins WHERE email = $1', [email()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('admin');
    expect(rows[0].is_active).toBe(true);
    expect(rows[0].locked_until).toBeNull();
  });

  test('the created account can actually authenticate', async () => {
    // A row whose hash does not verify would be worse than no row at all.
    const request = require('supertest');
    const app = require('../../server');
    const res = await request(app).post('/api/admin/auth/login')
      .send({ email: email(), password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe(email());
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('a duplicate email is refused and creates nothing', async () => {
    const res = await run(
      ['--non-interactive', '--email', email(), '--first-name', 'Dup', '--last-name', 'Test'],
      { stdin: PASSWORD }
    );
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/already exists/i);
    expect(await countFor(email())).toBe(1);   // still exactly one
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('--non-interactive fails loudly rather than silently', () => {
  // The whole reason this mode exists: a silent exit 0 that creates nothing is
  // the dangerous outcome, because automation reads it as success.

  test('no password at all is an error, not a no-op', async () => {
    const res = await run(
      ['--non-interactive', '--email', emailFor('nopw'), '--first-name', 'A', '--last-name', 'B'],
      { stdin: '' }
    );
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/No password supplied/i);
    expect(await countFor(emailFor('nopw'))).toBe(0);
  });

  test('a missing required flag is an error', async () => {
    for (const args of [
      ['--non-interactive', '--first-name', 'A', '--last-name', 'B'],
      ['--non-interactive', '--email', emailFor('nofn'), '--last-name', 'B'],
      ['--non-interactive', '--email', emailFor('noln'), '--first-name', 'A'],
    ]) {
      const res = await run(args, { stdin: PASSWORD });
      expect(res.code).toBe(1);
      expect(res.stderr).toMatch(/required in --non-interactive mode/i);
    }
  });

  test('a weak password is refused', async () => {
    const res = await run(
      ['--non-interactive', '--email', emailFor('weak'), '--first-name', 'A', '--last-name', 'B'],
      { stdin: 'x' }
    );
    expect(res.code).toBe(1);
    expect(await countFor(emailFor('weak'))).toBe(0);
  });

  test('an invalid role is refused', async () => {
    const res = await run(
      ['--non-interactive', '--email', emailFor('role'), '--first-name', 'A', '--last-name', 'B', '--role', 'superuser'],
      { stdin: PASSWORD }
    );
    expect(res.code).toBe(1);
    expect(await countFor(emailFor('role'))).toBe(0);
  });

  test('an invalid email is refused', async () => {
    const res = await run(
      ['--non-interactive', '--email', 'not-an-email', '--first-name', 'A', '--last-name', 'B'],
      { stdin: PASSWORD }
    );
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/valid email/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the password can come from the environment when stdin is a terminal', () => {
  // Piped stdin wins; the env var is the fallback for a TTY-attached run. Here
  // stdin is a pipe, so the pipe must take precedence and the env var must be
  // ignored — otherwise an operator could create an account with a password
  // they did not intend.
  test('piped stdin takes precedence over TRENIKO_ADMIN_PASSWORD', async () => {
    const email = emailFor('envprec');
    const res = await run(
      ['--non-interactive', '--email', email, '--first-name', 'A', '--last-name', 'B'],
      { stdin: PASSWORD, env: { TRENIKO_ADMIN_PASSWORD: 'a-different-password-entirely' } }
    );
    expect(res.code).toBe(0);

    const request = require('supertest');
    const app = require('../../server');

    const wrong = await request(app).post('/api/admin/auth/login')
      .send({ email, password: 'a-different-password-entirely' });
    expect(wrong.status).toBe(401);

    const right = await request(app).post('/api/admin/auth/login')
      .send({ email, password: PASSWORD });
    expect(right.status).toBe(200);
  });
});
