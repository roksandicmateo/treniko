'use strict';

/**
 * Scheduled-job wiring (Phase 2B).
 *
 * `node-cron` was upgraded 3.0.3 → 4.6.0 to clear the advisory on its
 * transitive `uuid` dependency. That is a semver-major upgrade, so these tests
 * pin the two properties the application actually relies on: the expression it
 * uses is still valid under the new parser, and scheduling still returns a live
 * task that fires.
 *
 * `cron.js` is deliberately NOT required here. Loading it calls
 * `executePendingDeletions()` immediately, which permanently erases accounts
 * and clients whose 30-day window has passed — importing it from a test would
 * destroy real data. The file is read as text instead, so the expression under
 * test is provably the one the application ships.
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

jest.setTimeout(15000);

const CRON_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'cron.js'), 'utf8'
);

describe('node-cron 4.x still supports how this application schedules work', () => {
  test('cron.js schedules exactly one expression, and it is the documented daily run', () => {
    const expressions = [...CRON_SOURCE.matchAll(/cron\.schedule\(\s*['"]([^'"]+)['"]/g)]
      .map((m) => m[1]);

    expect(expressions).toEqual(['0 9 * * *']);
  });

  test('that expression is valid under the upgraded parser', () => {
    expect(cron.validate('0 9 * * *')).toBe(true);
    expect(cron.validate('nonsense')).toBe(false);
  });

  test('scheduling returns a task that can be stopped', () => {
    const task = cron.schedule('0 9 * * *', () => {});
    expect(typeof task.stop).toBe('function');
    task.stop();
    if (typeof task.destroy === 'function') task.destroy();
  });

  test('a scheduled task actually fires', async () => {
    let fired = 0;
    const task = cron.schedule('* * * * * *', () => { fired += 1; });

    await new Promise((resolve) => setTimeout(resolve, 2200));
    task.stop();
    if (typeof task.destroy === 'function') task.destroy();

    // Proves the upgrade did not leave tasks registered-but-dormant, which is
    // the failure mode a version bump could introduce silently.
    expect(fired).toBeGreaterThan(0);
  });

  test('importing the app does not start the scheduler or the deletion job', () => {
    // Phase 2A guarded this: requiring server.js used to run the destructive
    // deletion job immediately. The guard must survive.
    const serverSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'server.js'), 'utf8'
    );
    expect(serverSource).toMatch(/require\.main === module/);

    const cronIndex = serverSource.indexOf("require('./cron')");
    const guardIndex = serverSource.indexOf('if (isMain)');
    expect(cronIndex).toBeGreaterThan(guardIndex);
    expect(guardIndex).toBeGreaterThan(-1);
  });
});
