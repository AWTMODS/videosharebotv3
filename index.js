require('dotenv').config();
const { session } = require('telegraf');
const { bot } = require('./config/bot');
const { connectToMongoDB } = require('./config/database');
const { setupScheduledJobs } = require('./utils/scheduling');
const { registerMiddleware } = require('./middleware');
const { registerHandlers } = require('./handlers');

// Suppress punycode warning
process.removeAllListeners('warning');

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
  console.error("❌ Bot token is not defined in environment variables");
  process.exit(1);
}

const start = async () => {
  try {

    
    // Connect to MongoDB first
    await connectToMongoDB();

    // Register middleware
    registerMiddleware(bot);

    // Register handlers
    registerHandlers(bot);

    // Set up scheduled jobs
    setupScheduledJobs(bot);

    // Start bot
    await bot.launch();
    console.log("🚀 Bot running successfully");

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
};

start();