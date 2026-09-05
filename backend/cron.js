const { executePendingDeletions } = require('./jobs/deletionJob');
const cron = require('node-cron');
const { checkExpiringSubscriptions } = require('./jobs/subscriptionChecker');
const { sendDueReminders } = require('./jobs/sessionReminders');

// Run daily at 9:00 AM
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Running daily subscription check...');
  checkExpiringSubscriptions();
});

// Session reminders, hourly on the hour.
//
// Hourly rather than daily because trainers work in every zone the day has: a
// single daily run would have to pick one hour, and any session before it would
// be reminded too late or not at all. The job's window is wider than the tick
// (23–25 hours out) so a missed run still catches the session, and the unique
// constraint on session_reminders means the overlap cannot send twice.
cron.schedule('0 * * * *', async () => {
  try {
    await sendDueReminders();
  } catch (err) {
    // sendDueReminders already reports per-send failures; this is the net for
    // the job itself, so one bad hour cannot take the process down.
    console.error('[cron] session reminders failed:', err.message);
  }
});

console.log('✅ Cron jobs initialized - subscriptions daily at 9:00, reminders hourly');
// Run deletion job daily at 2am
setInterval(executePendingDeletions, 24 * 60 * 60 * 1000);
executePendingDeletions(); // run once on startup
