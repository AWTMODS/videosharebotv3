const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  messageId: { type: Number, required: true },
  chatId: { type: Number, required: true },
  content: { type: Object, required: true },
  targetType: { type: String, required: true, enum: ['user', 'group', 'channel', 'all'] },
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: Number }
});

const Broadcast = mongoose.model("Broadcast", broadcastSchema);

module.exports = Broadcast;