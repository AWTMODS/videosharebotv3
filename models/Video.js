const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  fileType: { type: String, required: true },
  caption: { type: String, default: '' },
  addedBy: { type: Number },
  addedAt: { type: Date, default: Date.now }
});

const Video = mongoose.model("Video", videoSchema);

module.exports = Video;