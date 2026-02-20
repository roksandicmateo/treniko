const cron = require('node-cron');
const { checkExpiringSubscriptions } = require('./jobs/subscriptionChecker');

// Run daily at 9:00 AM
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Running daily subscription check...');
  checkExpiringSubscriptions();
});

console.log('✅ Cron jobs initialized - will run daily at 9:00 AM');