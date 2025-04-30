const { config } = require('../config/bot');
const User = require('../models/User');
const Channel = require('../models/Channel');


function escapeMarkdownV2(text = "") {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}


// Helper function to escape HTML
const escapeHtml = (text) => {
  if (!text) return '';
  return text.replace(/[<>&]/g, function(c) {
    return {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    }[c];
  });
};

// Check if user is an admin
const isAdmin = (userId) => {
  return config.admins.includes(userId.toString());
};

// Clear session state
const clearMenuState = (ctx) => {
  ctx.session.currentMenu = null;
  ctx.session.waitingForBroadcast = null;
  ctx.session.waitingForUpload = false;
  ctx.session.waitingForPaymentProof = null;
};

// Schedule message deletion
const scheduleDeletion = async (userId, messageIds, chatId) => {
  const deleteAt = new Date(Date.now() + config.messageDeleteMinutes * 60000);
  await User.updateOne(
    { userId },
    { $push: { sentMessages: messageIds.map(id => ({
      messageId: id,
      chatId,
      deleteAt
    })) }}
  );
};

// Clean inactive users
const cleanInactiveUsers = async (bot) => {
  const users = await User.find({});
  for (const user of users) {
    try {
      // Try sending a hidden message to check if user is reachable
      await bot.telegram.sendMessage(user.userId, " ", { disable_notification: true });
    } catch (error) {
      if (error.description && (
          error.description.includes('blocked') || 
          error.description.includes('deleted') ||
          error.description.includes('chat not found'))) {
        console.log(`Removing inactive user ${user.userId}`);
        await User.deleteOne({ userId: user.userId });
      }
    }
  }
};

// Check if bot is admin in a channel
const isBotAdminInChannel = async (bot, channelId) => {
  try {
    const chatMember = await bot.telegram.getChatMember(channelId, bot.botInfo.id);
    return ['administrator', 'creator'].includes(chatMember.status);
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
};

// Refresh channel list from database
const refreshChannelList = async () => {
  try {
    const channels = await Channel.find({});
    config.channelIds = channels.map(c => c.channelId);
    return config.channelIds;
  } catch (error) {
    console.error("Error refreshing channel list:", error);
    return [];
  }
};

module.exports = {
  escapeHtml,
  isAdmin,
  clearMenuState,
  scheduleDeletion,
  cleanInactiveUsers,
  isBotAdminInChannel,
  refreshChannelList
};