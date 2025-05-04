const { Markup } = require('telegraf');
const User = require('../models/User');
const Video = require('../models/Video');
const { config } = require('../config/bot');
const { clearMenuState, scheduleDeletion } = require('../utils/helpers');

// Show main menu
const showMainMenu = async (ctx) => {
  clearMenuState(ctx);
  ctx.session.currentMenu = 'main';

  const buttons = [
    [Markup.button.callback(`📥 GET ${config.videoBatchSize} VIDEOS`, "GET_VIDEO")],
    [Markup.button.callback("💳 SUBSCRIBE", "SUBSCRIBE")],
    [Markup.button.callback("👥 PURCHASE GROUP", "PURCHASE_GROUP")],
    [Markup.button.callback("🆕 DEMO", "DEMO")]
  ];

  await ctx.reply("🎬 MAIN MENU", Markup.inlineKeyboard(buttons));
};

// Send UPI payment details
const sendUPIDetails = async (ctx, paymentType) => {
  clearMenuState(ctx);
  ctx.session.waitingForPaymentProof = paymentType;
  ctx.session.currentMenu = 'payment';

  const caption = paymentType === 'group' 
    ? `💳 *Purchase Group Access (${config.purchaseGroupPrice})*\n\n1. Scan the QR or copy UPI ID\n2. Send payment proof to get the group link`
    : `💳 *Premium Subscription*\n\n1. Scan the QR or copy UPI ID\n2. Send payment proof to get the premium(must)`;

  const buttons = [
    [Markup.button.callback("📋 Copy UPI ID", "COPY_UPI")],
    [Markup.button.callback("🔙 Back", "MAIN_MENU")]
  ];

  await ctx.replyWithPhoto({ 
    source: paymentType === 'group' ? "./purchase_qr.png" : "./premium_qr.png" 
  }, {
    caption,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons)
  });
};

// Send purchase group details
const sendPurchaseGroupDetails = async (ctx) => {
  clearMenuState(ctx);
  ctx.session.currentMenu = 'purchase_group';

  const user = await User.findOne({ userId: ctx.from.id });

  if (user?.hasPurchaseGroupAccess) {
    await ctx.reply(`✅ You already have access to the purchase group!`, 
      Markup.inlineKeyboard([
        Markup.button.url("👥 Join Purchase Group", config.purchaseGroupLink),
        Markup.button.callback("🔙 Back", "MAIN_MENU")
      ])
    );
    return;
  }

  const buttons = [
    [Markup.button.callback(`💳 PAY ${config.purchaseGroupPrice}`, "PURCHASE_GROUP_PAY")],
    [Markup.button.callback("🔙 Back", "MAIN_MENU")]
  ];

  await ctx.replyWithPhoto({ source: "./purchase_group.png" }, {
    caption: `👥 *PURCHASE GROUP ACCESS (${config.purchaseGroupPrice})*\n\nGet exclusive content and offers in our private group!`,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons)
  });
};

// Send demo content
const sendDemoContent = async (ctx) => {
  clearMenuState(ctx);
  ctx.session.currentMenu = 'demo';

  try {
    const msg = await ctx.replyWithPhoto({ source: "./demo.jpg" }, {
      caption: "🆕 Here's a demo of our content (view once, expires in 20 seconds)",
      has_spoiler: true
    });

    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
      } catch (error) {
        console.error("Error deleting demo message:", error);
      }
    }, 20000);
  } catch (error) {
    console.error("Error sending demo:", error);
    await ctx.reply("⚠️ Error sending demo. Please try again.");
  }
};

// Send a batch of videos
const sendVideoBatch = async (ctx, user, isFirstBatch = true) => {
  clearMenuState(ctx);
  ctx.session.currentMenu = 'videos';

  try {
    let availableVideos = await Video.find({
      _id: { $nin: user.viewedVideos }
    });

    if (availableVideos.length < config.videoBatchSize) {
      await User.updateOne(
        { userId: user.userId },
        { $set: { viewedVideos: [] } }
      );
      availableVideos = await Video.find({});
    }

    const selectedVideos = availableVideos
      .sort(() => 0.5 - Math.random())
      .slice(0, config.videoBatchSize);

    const sentMessageIds = [];
    for (const video of selectedVideos) {
      const msg = await ctx.replyWithVideo(video.fileId);
      sentMessageIds.push(msg.message_id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await scheduleDeletion(user.userId, sentMessageIds, ctx.chat.id);

    await User.updateOne(
      { userId: user.userId },
      { 
        $inc: { dailyCount: config.videoBatchSize },
        $addToSet: { viewedVideos: { $each: selectedVideos.map(v => v._id) } }
      }
    );

    // Show different buttons based on whether it's the first batch
    if (isFirstBatch) {
      await ctx.reply(
        "🎬 Enjoy your videos!",
        Markup.inlineKeyboard([
          [Markup.button.callback(`📥 GET ${config.videoBatchSize} MORE VIDEOS`, "GET_VIDEO")],
          [Markup.button.callback("🏠 MAIN MENU", "MAIN_MENU")]
        ])
      );
    } else {
      await showMainMenu(ctx);
    }

  } catch (error) {
    console.error("Error sending videos:", error);
    ctx.reply("⚠️ Error sending videos. Please try again.");
  }
};

// Set up user-related handlers
const setupUserHandlers = (bot) => {
  // Main menu action
  bot.action("MAIN_MENU", showMainMenu);

  // Get videos action
  bot.action("GET_VIDEO", async (ctx) => {
    const userId = ctx.from.id;
    const user = await User.findOne({ userId });

    if (!user) return ctx.reply("⚠️ Please send /start first");

    const dailyLimit = user.isPremium ? Infinity : config.dailyVideoLimit;

    if (user.dailyCount >= dailyLimit) {
      return ctx.reply(
        `⚠️ Daily limit reached (${dailyLimit} videos). Subscribe for unlimited access.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("💳 SUBSCRIBE", "SUBSCRIBE")],
          [Markup.button.callback("🔙 Back", "MAIN_MENU")]
        ])
      );
    }

    await ctx.answerCbQuery();
    const isFirstBatch = user.dailyCount === 0;
    await sendVideoBatch(ctx, user, isFirstBatch);
  });

  // Subscribe action
  bot.action("SUBSCRIBE", async (ctx) => {
    await sendUPIDetails(ctx, 'premium');
  });

  // Purchase group actions
  bot.action("PURCHASE_GROUP", sendPurchaseGroupDetails);
  bot.action("PURCHASE_GROUP_PAY", async (ctx) => {
    await sendUPIDetails(ctx, 'group');
  });

  // Demo action
  bot.action("DEMO", sendDemoContent);

  // Copy UPI ID action
  bot.action("COPY_UPI", async (ctx) => {
    await ctx.reply(`✅ UPI ID: \`${config.upiId}\` (copy manually)`, { 
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        Markup.button.callback("🔙 Back", "MAIN_MENU")
      ])
    });
  });
};

module.exports = {
  showMainMenu,
  sendUPIDetails,
  sendPurchaseGroupDetails,
  sendDemoContent,
  sendVideoBatch,
  setupUserHandlers
};
