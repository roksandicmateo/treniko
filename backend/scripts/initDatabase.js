#!/usr/bin/env node
'use strict';

/**
 * DEPRECATED — replaced by scripts/migrate.js.
 *
 * This script used to be the documented way to set up the database, but it only
 * ever executed `schema.sql`, which creates 4 of the application's 35 tables and
 * applies none of the migration chain. Every database created with it was
 * missing most of the schema, so the server failed as soon as it touched
 * groups, trainings, packages, payments, subscriptions or the GDPR tables.
 *
 * It also printed a seed account's password to the console.
 *
 * It now refuses to run rather than silently producing a broken database.
 * `npm run init-db` is wired to the migration runner instead.
 */

console.error(`
scripts/initDatabase.js is deprecated and no longer runs.

It applied schema.sql only, which produces an incomplete database
(4 of 35 tables) with none of the migrations applied.

Use the migration runner instead:

  npm run db:migrate      create/upgrade the database (safe to re-run)
  npm run db:status       show applied vs pending migrations
  npm run db:baseline     adopt an existing untracked database

For a brand-new database:

  createdb treniko_db
  npm run db:migrate
`);

process.exit(1);
