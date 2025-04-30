const { showMainMenu } = require('./user');
const { showAdminMenu } = require('./admin');
const { isAdmin } = require('../utils/helpers');
const User = require('../models/User');

const setupCommandHandlers = (bot) => {
  // Start command
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const user = {
      userId,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username
    };
    
    await User.findOneAndUpdate({ userId }, user, { upsert: true, new: true });
    await showMainMenu(ctx);
  });

  // Admin command
  bot.command("admin", async (ctx) => {
    if (isAdmin(ctx.from.id)) {
      await showAdminMenu(ctx);
    } else {
      await ctx.reply("❌ You don't have permission to access the admin panel.");
    }
  });

  // Help command
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "🆘 *Bot Help*\n\n" +
      "• /start - Start the bot and show main menu\n" +
      "• /help - Show this help message\n\n" +
      "Use the buttons in the main menu to navigate.\n\n" +
      "For support, contact @stephinjk",
      { parse_mode: "Markdown" }
    );
  });
};

module.exports = { setupCommandHandlers };