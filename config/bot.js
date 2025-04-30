const { Telegraf, session } = require('telegraf');

// Initialize bot with token from environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// Add session middleware with default values
bot.use(session({
  defaultSession: () => ({
    currentMenu: null,
    waitingForBroadcast: null,
    waitingForUpload: false,
    broadcastData: null,
    waitingForPaymentProof: false,
    sentBroadcastMessages: []
  })
}));

// Configuration values from environment variables
const config = {
  // Admin configuration
  admins: process.env.ADMINS ? process.env.ADMINS.split(',').map(id => id.trim()) : [],
  adminGroupId: process.env.ADMIN_GROUP_ID,
  
  // Channel configuration
  requiredChannel: process.env.REQUIRED_CHANNEL || "@awt_bots",
  channelIds: process.env.CHANNEL_IDS ? process.env.CHANNEL_IDS.split(',') : [],
  
  // Video configuration
  videoBatchSize: parseInt(process.env.VIDEO_BATCH_SIZE) || 10,
  dailyVideoLimit: parseInt(process.env.DAILY_VIDEO_LIMIT) || 30,
  messageDeleteMinutes: parseInt(process.env.MESSAGE_DELETE_MINUTES) || 30,
  
  // Payment configuration
  purchaseGroupLink: process.env.PURCHASE_GROUP_LINK || "https://t.me/yourpurchasegroup",
  purchaseGroupPrice: process.env.PURCHASE_GROUP_PRICE || "₹99",
  upiId: process.env.UPI_ID || "example@upi"
};

module.exports = { bot, config };