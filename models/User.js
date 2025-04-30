const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  dailyCount: { type: Number, default: 0 },
  lastReset: { type: Date, default: new Date() },
  isPremium: { type: Boolean, default: false },
  hasPurchaseGroupAccess: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  viewedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  sentMessages: [{
    messageId: Number,
    chatId: Number,
    deleteAt: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

module.exports = User;