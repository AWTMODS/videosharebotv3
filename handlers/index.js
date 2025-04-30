const { setupCommandHandlers } = require('./commands');
const { setupUserHandlers } = require('./user');
const { setupAdminHandlers } = require('./admin');
const { setupPaymentHandlers } = require('./payments');
const { setupVerifyJoinHandler } = require('../middleware/auth');

const registerHandlers = (bot) => {
  setupVerifyJoinHandler(bot);
  setupCommandHandlers(bot);
  setupUserHandlers(bot);
  setupAdminHandlers(bot);
  setupPaymentHandlers(bot);


  
  // Error handling
  bot.catch((err, ctx) => {
    console.error(`⚠️ Error in ${ctx?.updateType}:`, err);
    return ctx?.reply?.("❌ An error occurred. Please try again.");
  });
};

module.exports = { registerHandlers };