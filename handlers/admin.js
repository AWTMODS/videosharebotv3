const { Markup } = require('telegraf');
const User = require('../models/User');
const Video = require('../models/Video');
const Channel = require('../models/Channel');
const Broadcast = require('../models/Broadcast');
const { isAdmin, clearMenuState } = require('../utils/helpers');
const { executeBroadcast } = require('../services/broadcasts');
const { isBotAdminInChannel } = require('../utils/helpers');

// Show admin menu
const showAdminMenu = async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  clearMenuState(ctx);
  ctx.session.currentMenu = 'admin';

  const buttons = [
    [Markup.button.callback("📢 Broadcast Message", "ADMIN_BROADCAST_TEXT")],
    [Markup.button.callback("📷 Broadcast Media", "ADMIN_BROADCAST_MEDIA")],
    [Markup.button.callback("🎥 Upload Media", "ADMIN_UPLOAD_MEDIA")],
    [Markup.button.callback("📺 Manage Channels", "ADMIN_MANAGE_CHANNELS")],
    [Markup.button.callback("🗑 Delete Broadcast", "ADMIN_DELETE_BROADCAST")],
    [Markup.button.callback("📊 Stats", "ADMIN_STATS")],
    [Markup.button.callback("🔙 Main Menu", "MAIN_MENU")]
  ];

  await ctx.reply("🛠 ADMIN PANEL", Markup.inlineKeyboard(buttons));
};

// Set up admin handlers
const setupAdminHandlers = (bot) => {
  // Admin broadcast handlers
  bot.action("ADMIN_BROADCAST_TEXT", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    clearMenuState(ctx);
    ctx.session.waitingForBroadcast = "text";
    ctx.session.currentMenu = 'broadcast';

    await ctx.reply("📢 Enter the broadcast message (or /cancel to abort):\n\nYou can mention:\n- @allusers (for all users)\n- @allgroups (for all groups)\n- @allchannels (for all channels)", 
      Markup.inlineKeyboard([
        Markup.button.callback("❌ Cancel", "ADMIN_CANCEL")
      ])
    );
  });

  bot.action("ADMIN_BROADCAST_MEDIA", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    clearMenuState(ctx);
    ctx.session.waitingForBroadcast = "media";
    ctx.session.currentMenu = 'broadcast';

    await ctx.reply("📷 Send media to broadcast (photo/video/document):", 
      Markup.inlineKeyboard([
        Markup.button.callback("❌ Cancel", "ADMIN_CANCEL")
      ])
    );
  });

  // Upload media handler
  bot.action("ADMIN_UPLOAD_MEDIA", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    clearMenuState(ctx);
    ctx.session.waitingForUpload = true;
    ctx.session.currentMenu = 'upload';

    await ctx.reply("🎥 Send media to add to the database:", 
      Markup.inlineKeyboard([
        Markup.button.callback("❌ Cancel", "ADMIN_CANCEL")
      ])
    );
  });

  // Text handler for broadcasts
  bot.on("text", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    ctx.session = ctx.session || {};

    if (ctx.session.waitingForBroadcast === "text") {
      const buttons = [
        [Markup.button.callback("👤 Users", "CONFIRM_BROADCAST_TEXT_USERS")],
        [Markup.button.callback("👥 Groups", "CONFIRM_BROADCAST_TEXT_GROUPS")],
        [Markup.button.callback("📺 Channels", "CONFIRM_BROADCAST_TEXT_CHANNELS")],
        [Markup.button.callback("🌐 All", "CONFIRM_BROADCAST_TEXT_ALL")],
        [Markup.button.callback("❌ Cancel", "ADMIN_CANCEL")]
      ];

      await ctx.reply(
        `📢 Broadcast Preview:\n\n${ctx.message.text}`,
        Markup.inlineKeyboard(buttons)
      );

      ctx.session.broadcastData = { text: ctx.message.text };
      ctx.session.waitingForBroadcast = null;
    }
  });

  // Handle media for broadcasts and uploads
  bot.on(["photo", "video", "document"], async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    ctx.session = ctx.session || {};

    if (ctx.session.waitingForUpload) {
      const fileType = ctx.message.photo ? 'photo' : 
                      ctx.message.video ? 'video' : 'document';
      const fileId = ctx.message.photo?.[0]?.file_id || 
                    ctx.message.video?.file_id || 
                    ctx.message.document?.file_id;

      try {
        const exists = await Video.findOne({ fileId });
        if (exists) {
          await ctx.reply("⚠️ This media already exists in the database.");
        } else {
          await Video.create({ 
            fileId, 
            fileType,
            caption: ctx.message.caption || '',
            addedBy: ctx.from.id
          });
          await ctx.reply("✅ Media successfully uploaded to database!");
        }
      } catch (error) {
        console.error("Error uploading media:", error);
        await ctx.reply("⚠️ Error uploading media to database.");
      }
      ctx.session.waitingForUpload = false;
      return;
    }

    if (ctx.session.waitingForBroadcast === "media") {
      const fileId = ctx.message.photo?.[0]?.file_id || 
                    ctx.message.video?.file_id || 
                    ctx.message.document?.file_id;

      const buttons = [
        [Markup.button.callback("👤 Users", "CONFIRM_BROADCAST_MEDIA_USERS")],
        [Markup.button.callback("👥 Groups", "CONFIRM_BROADCAST_MEDIA_GROUPS")],
        [Markup.button.callback("📺 Channels", "CONFIRM_BROADCAST_MEDIA_CHANNELS")],
        [Markup.button.callback("🌐 All", "CONFIRM_BROADCAST_MEDIA_ALL")],
        [Markup.button.callback("❌ Cancel", "ADMIN_CANCEL")]
      ];

      await ctx.reply(
        `📢 Media Broadcast Preview\n\nCaption: ${ctx.message.caption || "None"}`,
        Markup.inlineKeyboard(buttons)
      );

      ctx.session.broadcastData = {
        fileId,
        type: ctx.message.photo ? "photo" : 
             ctx.message.video ? "video" : "document",
        caption: ctx.message.caption || ""
      };
      ctx.session.waitingForBroadcast = null;
    }
  });

  // Channel management handlers
  bot.action("ADMIN_MANAGE_CHANNELS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    clearMenuState(ctx);
    ctx.session.currentMenu = 'manage_channels';

    const buttons = [
      [Markup.button.callback("➕ Add Channel", "ADD_CHANNEL")],
      [Markup.button.callback("➖ Remove Channel", "REMOVE_CHANNEL")],
      [Markup.button.callback("📋 List Channels", "LIST_CHANNELS")],
      [Markup.button.callback("🔙 Back", "ADMIN_CANCEL")]
    ];

    await ctx.reply(
      "📺 Channel Management",
      Markup.inlineKeyboard(buttons)
    );
  });

  // Add channel handler
  bot.action("ADD_CHANNEL", async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("❌ Admin only");
    }

    // Set session state
    ctx.session.waitingForChannelAdd = true;
    ctx.session.currentMenu = 'add_channel';

    await ctx.reply(
      `📢 <b>How to add a channel:</b>\n\n` +
      `1. Add @${ctx.botInfo.username} as admin to your channel\n` +
      `2. Make sure bot has <b>post messages</b> permission\n` +
      `3. <b>Forward</b> any message from that channel here\n\n` +
      `<b>OR</b> send the channel ID (like @channelname or -1001234567890)\n\n` +
      `<i>Current status: Waiting for channel info...</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback("❌ Cancel", "ADMIN_CANCEL")
        ]),
        disable_web_page_preview: true
      }
    );

    await ctx.answerCbQuery();
  });

  // List channels handler
  bot.action("LIST_CHANNELS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const channels = await Channel.find().sort({ title: 1 });
    if (channels.length === 0) {
      await ctx.reply("ℹ️ No channels registered yet");
      return;
    }

    let message = "📺 *Registered Channels*\n\n";
    for (const channel of channels) {
      try {
        const isActiveAdmin = await isBotAdminInChannel(bot, channel.channelId);
        message += `- ${channel.title} \`${channel.channelId}\` ${isActiveAdmin ? '✅' : '❌'}\n`;
      } catch {
        message += `- ${channel.title} \`${channel.channelId}\` ❌\n`;
      }
    }

    await ctx.replyWithMarkdown(message);
  });

  // Remove channel handler
  bot.action("REMOVE_CHANNEL", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const channels = await Channel.find().sort({ title: 1 });
    if (channels.length === 0) {
      await ctx.reply("ℹ️ No channels to remove");
      return;
    }

    const buttons = [];
    // Show 3 channels per row
    for (let i = 0; i < channels.length; i += 3) {
      const row = [];
      for (let j = 0; j < 3 && i + j < channels.length; j++) {
        row.push(
          Markup.button.callback(
            `❌ ${channels[i + j].title.substring(0, 15)}`,
            `REMOVE_CHANNEL_${channels[i + j]._id}`
          )
        );
      }
      buttons.push(row);
    }
    buttons.push([Markup.button.callback("🔙 Back", "ADMIN_CANCEL")]);

    await ctx.reply(
      "Select a channel to remove:",
      Markup.inlineKeyboard(buttons)
    );
  });

  // Handle channel removal
  bot.action(/^REMOVE_CHANNEL_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const channelId = ctx.match[1];
    try {
      const channel = await Channel.findByIdAndDelete(channelId);
      if (!channel) {
        await ctx.reply("⚠️ Channel not found");
        return;
      }

      await ctx.replyWithMarkdown(
        `🗑 *Channel Removed*\n\n` +
        `*Name:* ${channel.title}\n` +
        `*ID:* \`${channel.channelId}\``
      );
    } catch (error) {
      console.error("Channel removal error:", error);
      await ctx.reply("⚠️ Error removing channel");
    } finally {
      await showAdminMenu(ctx);
    }
  });

  // Stats handler
  bot.action("ADMIN_STATS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    clearMenuState(ctx);
    ctx.session.currentMenu = 'stats';

    try {
      const userCount = await User.countDocuments();
      const premiumCount = await User.countDocuments({ isPremium: true });
      const videoCount = await Video.countDocuments();
      const groupAccessCount = await User.countDocuments({ hasPurchaseGroupAccess: true });
      const channelCount = await Channel.countDocuments();

      await ctx.reply(
        `📊 Bot Statistics:\n\n` +
        `👥 Total Users: ${userCount}\n` +
        `💎 Premium Users: ${premiumCount}\n` +
        `👑 Purchase Group Members: ${groupAccessCount}\n` +
        `🎥 Videos Available: ${videoCount}\n` +
        `📺 Registered Channels: ${channelCount}`
      );
    } catch (error) {
      console.error("Error getting stats:", error);
      await ctx.reply("⚠️ Error retrieving statistics");
    }
  });

  // Delete broadcast handler
  bot.action("ADMIN_DELETE_BROADCAST", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    clearMenuState(ctx);
    ctx.session.currentMenu = 'delete_broadcast';

    // Get last 10 broadcasts
    const broadcasts = await Broadcast.find().sort({ sentAt: -1 }).limit(10);

    if (broadcasts.length === 0) {
      await ctx.reply("No recent broadcasts found.");
      return;
    }

    const buttons = broadcasts.map(broadcast => [
      Markup.button.callback(
        `🗑 ${new Date(broadcast.sentAt).toLocaleString()} (${broadcast.targetType})`,
        `DELETE_BROADCAST_${broadcast._id}`
      )
    ]);

    buttons.push([Markup.button.callback("🔙 Back", "ADMIN_CANCEL")]);

    await ctx.reply(
      "Select a broadcast to delete:",
      Markup.inlineKeyboard(buttons)
    );
  });

  // Delete broadcast action
  bot.action(/^DELETE_BROADCAST_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const broadcastId = ctx.match[1];
    const broadcast = await Broadcast.findById(broadcastId);

    if (!broadcast) {
      await ctx.reply("Broadcast not found.");
      return;
    }

    try {
      // Try to delete the message
      await ctx.telegram.deleteMessage(broadcast.chatId, broadcast.messageId);
      await Broadcast.deleteOne({ _id: broadcastId });
      await ctx.reply("✅ Broadcast message deleted successfully.");
    } catch (error) {
      console.error("Error deleting broadcast:", error);
      await ctx.reply("⚠️ Failed to delete broadcast message. It may have been already deleted.");
    }

    await showAdminMenu(ctx);
  });

  // Admin cancel action
  bot.action("ADMIN_CANCEL", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    clearMenuState(ctx);
    await ctx.deleteMessage();
    await showAdminMenu(ctx);
  });

  // Text broadcast confirmation handlers
  bot.action("CONFIRM_BROADCAST_TEXT_USERS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await executeBroadcast(ctx, 'users', { text: ctx.session.broadcastData.text });
  });

  bot.action("CONFIRM_BROADCAST_TEXT_CHANNELS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await executeBroadcast(ctx, 'channels', { text: ctx.session.broadcastData.text });
  });

  bot.action("CONFIRM_BROADCAST_TEXT_ALL", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await executeBroadcast(ctx, 'all', { text: ctx.session.broadcastData.text });
  });

  // Media broadcast confirmation handlers
  bot.action("CONFIRM_BROADCAST_MEDIA_USERS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await executeBroadcast(ctx, 'users', ctx.session.broadcastData);
  });

  bot.action("CONFIRM_BROADCAST_MEDIA_CHANNELS", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await executeBroadcast(ctx, 'channels', ctx.session.broadcastData);
  });

  bot.action("CONFIRM_BROADCAST_MEDIA_ALL", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await executeBroadcast(ctx, 'all', ctx.session.broadcastData);
  });
};

module.exports = {
  showAdminMenu,
  setupAdminHandlers
};