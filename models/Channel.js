const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  username: String,
  inviteLink: String,
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Number, required: true } // Telegram user ID of admin who added it
});

const Channel = mongoose.model("Channel", channelSchema);

module.exports = Channel;