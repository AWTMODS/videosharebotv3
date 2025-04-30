const { Markup } = require('telegraf');
const User = require('../models/User');
const { config } = require('../config/bot');
const { isAdmin, escapeMarkdownV2 } = require('../utils/helpers');

// Process payment proof
const processPaymentProof = async (ctx, paymentType) => {
  const userId = ctx.from.id;
  const user = await User.findOne({ userId }) || {};

  try {
    const photo = ctx.message.photo.pop();
    const fileId = photo.file_id;

    const userFirstName = escapeMarkdownV2(ctx.from.first_name);
    const userName = user.username ? '\\@' + escapeMarkdownV2(user.username) : 'None';

    const caption = paymentType === 'group'
      ? `🧾 *Purchase Group Payment*\n\n` +
        `• From: [${userFirstName}](tg://user?id=${userId})\n` +
        `• Username: ${userName}\n` +
        `• User ID: \`${userId}\`\n` +
        `• Amount: ${config.purchaseGroupPrice}`
      : `🧾 *Premium Payment*\n\n` +
        `• From: [${userFirstName}](tg://user?id=${userId})\n` +
        `• Username: ${userName}\n` +
        `• User ID: \`${userId}\``;

    await ctx.telegram.sendPhoto(config.adminGroupId, fileId, {
      caption,
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Approve", `VERIFY_${userId}_${paymentType.toUpperCase()}`),
          Markup.button.callback("❌ Reject", `REJECT_${userId}`)
        ],
        [
          Markup.button.callback("🚫 Ban User", `BAN_${userId}`),
          Markup.button.callback("🗂 View User", `VIEW_USER_${userId}`)
        ]
      ])
    });

    await ctx.reply(
      "✅ Payment proof received! Our team will verify it within 24 hours.\n\n" +
      "You'll receive a confirmation message once approved.",
      Markup.inlineKeyboard([
        Markup.button.url("📞 Contact Support", "https://t.me/stephinjk")
      ])
    );

  } catch (error) {
    console.error("Payment forwarding error:", error);
    await ctx.reply("⚠️ Failed to process your payment proof. Please try again.");
  }
};

// Payment Handlers
const setupPaymentHandlers = (bot) => {
  bot.on("photo", async (ctx) => {
    if (ctx.chat.type !== 'private' || isAdmin(ctx.from.id)) return;
    ctx.session = ctx.session || {};

    if (ctx.session.waitingForPaymentProof) {
      try {
        await processPaymentProof(ctx, ctx.session.waitingForPaymentProof);
        ctx.session.waitingForPaymentProof = null;
      } catch (error) {
        await ctx.reply("⚠️ Failed to process your payment proof. Please try again.");
      }
    }
  });

  bot.action(/^VERIFY_(\d+)_(GROUP|PREMIUM)$/, async (ctx) => {
    try {
      if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Admin only", { show_alert: true });

      const userId = parseInt(ctx.match[1]);
      const verifyType = ctx.match[2].toLowerCase();
      const user = await User.findOne({ userId });
      if (!user) return ctx.answerCbQuery("❌ User not found", { show_alert: true });

      const updateData = {
        isBanned: false,
        [verifyType === 'group' ? 'hasPurchaseGroupAccess' : 'isPremium']: true
      };

      await User.updateOne({ userId }, updateData);

      const approvalText = `✅ *Payment Approved*\n\n` +
        `User: [${escapeMarkdownV2(user.first_name || 'Unknown')}](tg://user?id=${userId})\n` +
        `Type: ${verifyType === 'group' ? 'Group Access' : 'Premium'}\n` +
        `Approved by: @${ctx.from.username || ctx.from.first_name}\n` +
        `At: ${new Date().toLocaleString()}`;

      try {
        await ctx.editMessageCaption(approvalText, {
          parse_mode: "MarkdownV2",
          reply_markup: { inline_keyboard: [] }
        });
      } catch (error) {
        await ctx.reply(approvalText, { parse_mode: "MarkdownV2" });
      }

      await bot.telegram.sendMessage(
        userId,
        verifyType === 'group'
          ? `🎉 *Purchase Group Approved!*\n\nJoin here: ${config.purchaseGroupLink}`
          : "🎉 *Premium Membership Approved!*",
        { parse_mode: "Markdown" }
      );

      await ctx.answerCbQuery("Approved successfully!");
    } catch (error) {
      console.error("Approval error:", error);
      await ctx.answerCbQuery("⚠️ Failed to approve");
    }
  });

  bot.action(/^REJECT_(\d+)$/, async (ctx) => {
    try {
      if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Admin only", { show_alert: true });

      const userId = parseInt(ctx.match[1]);
      const user = await User.findOne({ userId });
      if (!user) return ctx.answerCbQuery("❌ User not found", { show_alert: true });

      const text = `❌ *Payment Rejected*\n\n` +
        `User: [${escapeMarkdownV2(user.first_name || 'Unknown')}](tg://user?id=${userId})\n` +
        `Rejected by: @${ctx.from.username || ctx.from.first_name}\n` +
        `At: ${new Date().toLocaleString()}`;

      try {
        await ctx.editMessageCaption(text, {
          parse_mode: "MarkdownV2",
          reply_markup: { inline_keyboard: [] }
        });
      } catch (error) {
        await ctx.reply(text, { parse_mode: "MarkdownV2" });
      }

      await bot.telegram.sendMessage(
        userId,
        "⚠️ *Payment Rejected*\n\nPlease contact support for assistance.",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            Markup.button.url("📞 Contact Support", "https://t.me/stephinjk")
          ])
        }
      );

      await ctx.answerCbQuery("Rejected successfully!");
    } catch (error) {
      console.error("Rejection error:", error);
      await ctx.answerCbQuery("⚠️ Failed to reject");
    }
  });

  bot.action(/^BAN_(\d+)$/, async (ctx) => {
    try {
      if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Admin only", { show_alert: true });

      const userId = parseInt(ctx.match[1]);
      const user = await User.findOne({ userId });
      if (!user) return ctx.answerCbQuery("❌ User not found", { show_alert: true });

      await User.updateOne({ userId }, {
        isBanned: true,
        isPremium: false,
        hasPurchaseGroupAccess: false
      });

      const text = `🚫 *User Banned*\n\n` +
        `User: [${escapeMarkdownV2(user.first_name || 'Unknown')}](tg://user?id=${userId})\n` +
        `Banned by: @${ctx.from.username || ctx.from.first_name}\n` +
        `At: ${new Date().toLocaleString()}`;

      await ctx.editMessageCaption(text, {
        parse_mode: "MarkdownV2",
        reply_markup: { inline_keyboard: [] }
      });

      await bot.telegram.sendMessage(
        userId,
        "🚫 *Account Banned*\n\nAll premium access has been revoked.",
        { parse_mode: "Markdown" }
      );

      await ctx.answerCbQuery("User banned successfully!");
    } catch (error) {
      console.error("Ban error:", error);
      await ctx.answerCbQuery("⚠️ Failed to ban user");
    }
  });

  bot.action(/^VIEW_USER_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Admin only");

    const userId = parseInt(ctx.match[1]);
    const user = await User.findOne({ userId });
    if (!user) return ctx.answerCbQuery("❌ User not found");

    await ctx.answerCbQuery(`👤 Viewing user ${userId}`);

    const info = `
👤 *User Information*

• Name: [${escapeMarkdownV2(user.first_name || 'Unknown')}](tg://user?id=${userId})
• Username: ${user.username ? '\\@' + escapeMarkdownV2(user.username) : 'None'}
• User ID: \`${userId}\`
• Premium: ${user.isPremium ? '✅' : '❌'}
• Group Access: ${user.hasPurchaseGroupAccess ? '✅' : '❌'}
• Banned: ${user.isBanned ? '🚫' : '✅'}
• Videos Viewed: ${user.viewedVideos?.length || 0}
• Last Active: ${user.lastReset ? new Date(user.lastReset).toLocaleString() : 'Unknown'}
    `;

    await ctx.replyWithMarkdown(info);
  });
};

module.exports = { setupPaymentHandlers };
