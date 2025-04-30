const schedule = require('node-schedule');
const User = require('../models/User');
const { cleanInactiveUsers, refreshChannelList } = require('./helpers');

// Set up scheduled jobs
const setupScheduledJobs = (bot) => {
  // Message deletion job - runs every minute
  schedule.scheduleJob('*/1 * * * *', async () => {
    const now = new Date();
    const users = await User.find({
      "sentMessages.deleteAt": { $lte: now }
    });

    for (const user of users) {
      const toDelete = user.sentMessages.filter(m => m.deleteAt <= now);

      for (const msg of toDelete) {
        try {
          await bot.telegram.deleteMessage(msg.chatId, msg.messageId);
        } catch (error) {
          console.error(`Error deleting message ${msg.messageId}:`, error);
        }
      }

      await User.updateOne(
        { userId: user.userId },
        { $pull: { sentMessages: { deleteAt: { $lte: now } } } }
      );
    }

    // Clean inactive users at midnight
    if (new Date().getHours() === 0 && new Date().getMinutes() === 0) {
      await cleanInactiveUsers(bot);
    }
  });

  // Daily reset job - resets user daily counts at midnight
  schedule.scheduleJob("0 0 * * *", async () => {
    await User.updateMany({}, { dailyCount: 0, lastReset: new Date() });
    console.log("🔄 Reset daily video counts for all users");
  });

  // Refresh channel list every hour
  schedule.scheduleJob("0 * * * *", async () => {
    await refreshChannelList();
  });

  // Initial call to refresh channel list on startup
  refreshChannelList();
};

module.exports = { setupScheduledJobs };