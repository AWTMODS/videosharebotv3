const mongoose = require('mongoose');

// Connect to MongoDB
const connectToMongoDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MongoDB URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

module.exports = { connectToMongoDB };