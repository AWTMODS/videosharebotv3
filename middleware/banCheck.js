const User = require('../models/User');

// Middleware to check if a user is banned
const banCheckMiddleware = async (ctx, next) => {
  // Only apply this middleware in private chats
  if (ctx.chat?.type !== 'private' || !ctx.from) {
    return next();
  }

  try {
    const user = await User.findOne({ userId: ctx.from.id });
    
    if (user?.isBanned) {
      return ctx.reply("🚫 Your account has been banned. Contact support: @stephinjk");
    }
  } catch (error) {
    console.error("Error checking user ban status:", error);
  }
  
  return next();
};

module.exports = banCheckMiddleware;