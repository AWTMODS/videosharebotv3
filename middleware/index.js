const authMiddleware = require('./auth');
const banCheckMiddleware = require('./banCheck');
const registerMiddleware = (bot) => {

  
  // Register auth middleware first
  bot.use(authMiddleware);
  
  // Register ban check middleware
  bot.use(banCheckMiddleware);
};

module.exports = { 
  registerMiddleware,
  authMiddleware,
  banCheckMiddleware
};

