const { config } = require('../config/bot');

// Middleware to check channel membership
const authMiddleware = async (ctx, next) => {
  // Skip middleware for non-private chats or admin commands
  if (ctx.chat?.type !== 'private') return next();
  
  // If this is an admin in the admin group, skip the check
  const isAdminInAdminGroup = 
    ctx.chat?.id.toString() === config.adminGroupId && 
    config.admins.includes(ctx.from?.id?.toString());
  
  if (isAdminInAdminGroup) return next();

  console.log(`Processing update from ${ctx.from?.id}`);

  const isMember = await checkChannelMembership(ctx, ctx.from?.id);
  console.log(`User ${ctx.from?.id} membership status:`, isMember);

  if (!isMember) {
    const channelName = config.requiredChannel.replace('@', '');
    return ctx.reply(
      `🔒 Please join our channel first: ${config.requiredChannel}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Join Channel", url: `https://t.me/${channelName}` }],
            [{ text: "I Joined ✅", callback_data: "verify_join" }]
          ]
        }
      }
    );
  }

  return next();
};

// Helper function to check channel membership
const checkChannelMembership = async (ctx, userId) => {
  try {
    if (!config.requiredChannel) return true;

    const chatId = config.requiredChannel.startsWith('@') 
      ? config.requiredChannel 
      : Number(config.requiredChannel);

    const chatMember = await ctx.telegram.getChatMember(chatId, userId);
    return ['member', 'administrator', 'creator'].includes(chatMember.status);
  } catch (error) {
    console.error('Membership check error:', {
      error: error.response?.description || error.message,
      userId,
      channel: config.requiredChannel
    });
    return false;
  }
};

// Verify join action handler
const setupVerifyJoinHandler = (bot) => {
  bot.action('verify_join', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isMember = await checkChannelMembership(ctx, ctx.from.id);

      if (isMember) {
        return ctx.reply('🎉 Access granted! Use /start to begin.');
      } else {
        return ctx.reply('❌ Still not a member. Join then try again.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      await ctx.answerCbQuery('⚠️ Verification failed. Try again later.');
    }
  });
};

module.exports = authMiddleware;
module.exports.setupVerifyJoinHandler = setupVerifyJoinHandler;