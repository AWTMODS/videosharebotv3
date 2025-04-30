const User = require('../models/User');
const Channel = require('../models/Channel');
const Broadcast = require('../models/Broadcast');

// Execute a broadcast to users, groups, or channels
const executeBroadcast = async (ctx, target, content) => {
  let success = 0;
  let failed = 0;
  const broadcastMessages = [];

  try {
    await ctx.editMessageText("🔄 Sending broadcast...");

    // Broadcast to users
    if (target === 'users' || target === 'all') {
      const users = await User.find({});
      for (const user of users) {
        try {
          let message;
          if (content.text) {
            message = await ctx.telegram.sendMessage(user.userId, content.text);
          } else {
            if (content.type === "photo") {
              message = await ctx.telegram.sendPhoto(user.userId, content.fileId, { caption: content.caption });
            } else if (content.type === "video") {
              message = await ctx.telegram.sendVideo(user.userId, content.fileId, { caption: content.caption });
            } else if (content.type === "document") {
              message = await ctx.telegram.sendDocument(user.userId, content.fileId, { caption: content.caption });
            }
          }
          broadcastMessages.push({
            messageId: message.message_id,
            chatId: message.chat.id,
            content: content,
            targetType: 'user',
            sentBy: ctx.from.id
          });
          success++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to send to user ${user.userId}:`, error);
          failed++;
        }
      }
    }

    // Broadcast to channels
    if (target === 'channels' || target === 'all') {
      const channels = await Channel.find();
      for (const channel of channels) {
        try {
          let message;
          if (content.text) {
            message = await ctx.telegram.sendMessage(channel.channelId, content.text);
          } else {
            if (content.type === "photo") {
              message = await ctx.telegram.sendPhoto(channel.channelId, content.fileId, { caption: content.caption });
            } else if (content.type === "video") {
              message = await ctx.telegram.sendVideo(channel.channelId, content.fileId, { caption: content.caption });
            } else if (content.type === "document") {
              message = await ctx.telegram.sendDocument(channel.channelId, content.fileId, { caption: content.caption });
            }
          }
          broadcastMessages.push({
            messageId: message.message_id,
            chatId: message.chat.id,
            content: content,
            targetType: 'channel',
            sentBy: ctx.from.id
          });
          success++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to send to channel ${channel.channelId}:`, error);
          failed++;
        }
      }
    }

    // Save broadcast messages for possible deletion
    if (broadcastMessages.length > 0) {
      await Broadcast.insertMany(broadcastMessages);
    }

    await ctx.editMessageText(
      `✅ Broadcast completed\n\n` +
      `Success: ${success}\n` +
      `Failed: ${failed}`
    );

  } catch (error) {
    console.error("Broadcast error:", error);
    await ctx.reply("⚠️ Error during broadcast");
  }
};

module.exports = { executeBroadcast };