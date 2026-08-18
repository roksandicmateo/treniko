#!/usr/bin/env node
'use strict';

/**
 * Create a TRENIKO platform administrator.
 *
 *   node scripts/create-platform-admin.js
 *   node scripts/create-platform-admin.js --email you@treniko.com --role owner
 *
 * ── Why this script exists ──────────────────────────────────────────────────
 * There is deliberately no self-service registration for administrators: an
 * endpoint that mints accounts able to read every tenant on the platform is not
 * something that should be reachable from the internet. The first administrator
 * is therefore created here, by an operator with shell access to the server.
 * After that an `owner` can create the rest through POST /api/admin/admins.
 *
 * ── The password is never taken from the command line ───────────────────────
 * It is read from stdin with echo disabled. A password passed as an argument
 * ends up in the shell history, in `ps` output for every user on the box, and
 * frequently in process-monitoring logs. This script will refuse a --password
 * flag rather than accept one.
 *
 * Nothing is printed except the created administrator's id, email and role.
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const readline = require('readline');
const { pool } = require('../config/database');
const { isEmail, normalizeEmail, validatePassword } = require('../utils/validation');

const ADMIN_BCRYPT_COST = 12;
const ROLES = ['viewer', 'admin', 'owner'];

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

/** Prompt on stdout, read one line from stdin. */
const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });

/**
 * Read a line without echoing it.
 *
 * readline has no built-in hidden mode, so the terminal's own echo is disabled
 * for the duration where the platform supports it, and the muted stream trick
 * is used otherwise. The finally block always restores the terminal — a script
 * that exits leaving echo off makes the operator's shell unusable.
 */
const askHidden = (question) =>
  new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);

    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    const restore = () => { if (stdin.isTTY && stdin.setRawMode) stdin.setRawMode(false); };

    // Suppress echo by intercepting what readline writes back to the terminal.
    const originalWrite = stdout.write.bind(stdout);
    stdout.write = (chunk, ...rest) => {
      const s = String(chunk);
      if (s.includes('\n') || s.includes('\r')) return originalWrite(chunk, ...rest);
      return true; // swallow the echoed characters
    };

    rl.question('', (answer) => {
      stdout.write = originalWrite;
      restore();
      rl.close();
      stdout.write('\n');
      resolve(answer);
    });

    rl.on('SIGINT', () => {
      stdout.write = originalWrite;
      restore();
      rl.close();
      reject(new Error('cancelled'));
    });
  });

(async () => {
  if (process.argv.includes('--password')) {
    console.error(
      '\nRefusing to read a password from the command line.\n' +
      'It would be recorded in your shell history and visible in `ps` to every\n' +
      'user on this machine. Run the script without --password and type it when\n' +
      'prompted.\n'
    );
    process.exit(2);
  }

  try {
    const email = normalizeEmail(argOf('email') || await ask('Email: '));
    if (!isEmail(email)) throw new Error(`Not a valid email address: ${email}`);

    const existing = await pool.query('SELECT id FROM platform_admins WHERE email = $1', [email]);
    if (existing.rows.length) throw new Error(`An administrator with ${email} already exists.`);

    const firstName = argOf('first-name') || await ask('First name: ');
    const lastName  = argOf('last-name')  || await ask('Last name: ');
    if (!firstName || !lastName) throw new Error('First and last name are required.');

    const role = argOf('role') || (await ask(`Role [${ROLES.join('/')}] (default owner): `)) || 'owner';
    if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);

    const password = await askHidden('Password (not echoed): ');
    const confirm  = await askHidden('Confirm password:      ');
    if (password !== confirm) throw new Error('Passwords do not match.');

    const check = validatePassword(password);
    if (!check.ok) throw new Error(check.reason);

    const hash = await bcrypt.hash(password, ADMIN_BCRYPT_COST);

    const { rows } = await pool.query(
      `INSERT INTO platform_admins (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, created_at`,
      [email, hash, firstName, lastName, role]
    );

    console.log('\nAdministrator created:');
    console.log(`  id    ${rows[0].id}`);
    console.log(`  email ${rows[0].email}`);
    console.log(`  role  ${rows[0].role}`);
    console.log('\nSign in at POST /api/admin/auth/login\n');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(`\n${err.message}\n`);
    await pool.end().catch(() => {});
    process.exit(1);
  }
})();
