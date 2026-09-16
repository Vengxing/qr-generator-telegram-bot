import { Telegraf, Markup } from 'telegraf';
import { CONFIG } from './config.js';
import { sessionManager } from './state/sessionManager.js';
import { scanQRCode } from './services/qrScanner.js';
import { generateFHDCard } from './services/qrRenderer.js';

const bot = new Telegraf(CONFIG.BOT_TOKEN);

// Gracefully handle expired callback queries (e.g. clicking buttons on old messages)
bot.use(async (ctx, next) => {
  if (ctx.callbackQuery) {
    const originalAnswerCbQuery = ctx.answerCbQuery.bind(ctx);
    ctx.answerCbQuery = async (...args) => {
      try {
        return await originalAnswerCbQuery(...args);
      } catch (err) {
        if (err.description && err.description.includes('query is too old')) {
          return false;
        }
        throw err;
      }
    };
  }
  return next();
});

/**
 * Downloads a Telegram file into a Buffer.
 */
async function downloadTelegramFile(fileId) {
  const link = await bot.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) {
    throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Escapes characters for Telegram MarkdownV2 (or standard markdown).
 */
function escapeMarkdown(text) {
  return String(text || '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Renders the UI and keyboard corresponding to the current session step.
 */
async function renderCurrentStep(ctx, userId, extraMessage = '') {
  const session = sessionManager.getSession(userId);
  const step = session.step;

  let message = extraMessage ? `${extraMessage}\n\n` : '';
  let keyboard = null;

  switch (step) {
    case 'IDLE':
      message +=
        '👋 *Welcome to QR Studio Bot!*\n\n' +
        'Please send me an image containing a **QR Code** to get started.\n\n' +
        '✨ *Features:*\n' +
        '• Automatic QR detection & validation\n' +
        '• Optional custom logo or photo in bottom-left\n' +
        '• 1 or 2 lines of custom text (max 20 chars)\n' +
        '• Exported in crisp **Full HD (1080x1360)**\n' +
        '• ↩️ *Full reversibility: Go back or change your mind at any point!*';
      keyboard = Markup.removeKeyboard();
      await ctx.reply(message, { parse_mode: 'Markdown' });
      break;

    case 'PHOTO_OPTION': {
      const qrSnippet = session.data.qrData.slice(0, 100);
      message +=
        '✅ *QR Code Detected & Validated!*\n\n' +
        `🔗 *Payload:* \`${escapeMarkdown(qrSnippet)}${session.data.qrData.length > 100 ? '...' : ''}\`\n\n` +
        '📸 *Step 2: Add a Photo / Logo (Optional)*\n\n' +
        'Would you like to display a custom photo or logo at the bottom-left of the card?\n\n' +
        '• **Send any image now**, or\n' +
        '• Click **Skip Photo** to use an icon badge.';

      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⏭️ Skip Photo', 'skip_photo')],
        [
          Markup.button.callback('⬅️ Back (Change QR)', 'nav_back'),
          Markup.button.callback('❌ Cancel', 'nav_cancel'),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      break;
    }

    case 'CHOOSE_LINES':
      message +=
        '📝 *Step 3: Choose Text Layout*\n\n' +
        'Choose how many lines of text you want next to your photo:\n\n' +
        '• **1 Line**: One prominent headline (max 20 characters)\n' +
        '• **2 Lines**: Main title + subtitle (max 20 characters each)';

      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('1️⃣ 1 Line (Max 20 chars)', 'choose_lines_1')],
        [Markup.button.callback('2️⃣ 2 Lines (Max 20 chars each)', 'choose_lines_2')],
        [
          Markup.button.callback('⬅️ Back', 'nav_back'),
          Markup.button.callback('❌ Cancel', 'nav_cancel'),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      break;

    case 'INPUT_LINE_1': {
      const isTwoLines = session.data.lineCount === 2;
      message +=
        `✍️ *Step 4: Enter Text*\n\n` +
        `Please type ${isTwoLines ? '**Line 1 (Main Title)**' : '**your text**'} (Maximum 20 characters):\n\n` +
        `_Example: "Scan to Pay", "VIP Guest", "WiFi Access"_`;

      keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('⬅️ Back', 'nav_back'),
          Markup.button.callback('❌ Cancel', 'nav_cancel'),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      break;
    }

    case 'INPUT_LINE_2':
      message +=
        `✅ Line 1: "*${escapeMarkdown(session.data.line1)}*"\n\n` +
        `✍️ Now type **Line 2 (Subtitle)** (Maximum 20 characters):\n\n` +
        `_Example: "Table 14", "Official Portal", "John Doe"_`;

      keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('⬅️ Back', 'nav_back'),
          Markup.button.callback('❌ Cancel', 'nav_cancel'),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      break;

    case 'COMPLETED':
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Back (Edit Text)', 'nav_back')],
        [Markup.button.callback('🆕 Generate Another QR', 'new_qr')],
      ]);
      await ctx.reply('What would you like to do next?', keyboard);
      break;

    default:
      sessionManager.reset(userId);
      await ctx.reply('Session reset. Please send an image containing a QR code.');
      break;
  }
}

// ---------------- Command Handlers ----------------

bot.command('start', async (ctx) => {
  sessionManager.reset(ctx.from.id);
  await renderCurrentStep(ctx, ctx.from.id);
});

bot.command('help', async (ctx) => {
  await renderCurrentStep(ctx, ctx.from.id);
});

bot.command('cancel', async (ctx) => {
  sessionManager.reset(ctx.from.id);
  await ctx.reply('❌ Process cancelled. Send an image with a QR code whenever you want to start again.');
});

bot.command('back', async (ctx) => {
  const prev = sessionManager.stepBack(ctx.from.id);
  if (!prev) {
    await ctx.reply('You are already at the beginning. Send a QR code image to start!');
    return;
  }
  await renderCurrentStep(ctx, ctx.from.id, '↩️ *Stepped back.*');
});

// ---------------- Callback Query Handlers ----------------

bot.action('nav_back', async (ctx) => {
  await ctx.answerCbQuery();
  const prev = sessionManager.stepBack(ctx.from.id);
  if (!prev) {
    await ctx.reply('You are already at the beginning. Send a QR code image to start!');
    return;
  }
  await renderCurrentStep(ctx, ctx.from.id, '↩️ *Stepped back.*');
});

bot.action('nav_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  sessionManager.reset(ctx.from.id);
  await ctx.reply('❌ Process cancelled. Send an image with a QR code whenever you want to start again.');
});

bot.action('new_qr', async (ctx) => {
  await ctx.answerCbQuery();
  sessionManager.reset(ctx.from.id);
  await renderCurrentStep(ctx, ctx.from.id);
});

bot.action('skip_photo', async (ctx) => {
  await ctx.answerCbQuery();
  const session = sessionManager.getSession(ctx.from.id);
  if (session.step !== 'PHOTO_OPTION') {
    return ctx.reply('Please follow the current prompt.');
  }

  sessionManager.transition(ctx.from.id, 'CHOOSE_LINES', { photoBuffer: null });
  await renderCurrentStep(ctx, ctx.from.id);
});

bot.action('choose_lines_1', async (ctx) => {
  await ctx.answerCbQuery();
  const session = sessionManager.getSession(ctx.from.id);
  if (session.step !== 'CHOOSE_LINES') {
    return ctx.reply('Please follow the current prompt.');
  }

  sessionManager.transition(ctx.from.id, 'INPUT_LINE_1', { lineCount: 1 });
  await renderCurrentStep(ctx, ctx.from.id);
});

bot.action('choose_lines_2', async (ctx) => {
  await ctx.answerCbQuery();
  const session = sessionManager.getSession(ctx.from.id);
  if (session.step !== 'CHOOSE_LINES') {
    return ctx.reply('Please follow the current prompt.');
  }

  sessionManager.transition(ctx.from.id, 'INPUT_LINE_1', { lineCount: 2 });
  await renderCurrentStep(ctx, ctx.from.id);
});

// ---------------- Media Handlers (Photos & Documents) ----------------

bot.on(['photo', 'document'], async (ctx) => {
  const userId = ctx.from.id;
  const session = sessionManager.getSession(userId);

  // Get highest resolution photo or document file id
  let fileId = null;
  if (ctx.message.photo && ctx.message.photo.length > 0) {
    fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  } else if (
    ctx.message.document &&
    ctx.message.document.mime_type &&
    ctx.message.document.mime_type.startsWith('image/')
  ) {
    fileId = ctx.message.document.file_id;
  }

  if (!fileId) {
    return ctx.reply('Please send an image file.');
  }

  try {
    const fileBuffer = await downloadTelegramFile(fileId);

    if (session.step === 'IDLE' || session.step === 'COMPLETED') {
      // Step 1: Detect QR Code
      const statusMsg = await ctx.reply('🔍 *Scanning image for QR code...*', {
        parse_mode: 'Markdown',
      });

      const scanResult = await scanQRCode(fileBuffer);

      if (!scanResult.success) {
        await ctx.reply(
          '❌ *No usable QR code detected.*\n\n' +
            'Please ensure the image contains a clear, well-lit QR code and try sending it again.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Valid QR code detected!
      sessionManager.transition(userId, 'PHOTO_OPTION', {
        qrData: scanResult.data,
        photoBuffer: null,
      });

      await renderCurrentStep(ctx, userId);
      return;
    }

    if (session.step === 'PHOTO_OPTION') {
      // Step 2: User uploaded custom photo/logo
      sessionManager.transition(userId, 'CHOOSE_LINES', {
        photoBuffer: fileBuffer,
      });

      await renderCurrentStep(ctx, userId, '📸 *Photo received successfully!*');
      return;
    }

    // If sent image at an unexpected step:
    await ctx.reply(
      '⚠️ Image received, but we are currently waiting for text input. ' +
        'Please enter the text or use the ⬅️ Back button.'
    );
  } catch (error) {
    console.error('Error handling media:', error);
    await ctx.reply('❌ An error occurred while processing your image. Please try again.');
  }
});

// ---------------- Text Message Handlers ----------------

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const session = sessionManager.getSession(userId);
  const text = ctx.message.text.trim();

  // Handle slash commands that weren't captured above
  if (text.startsWith('/')) {
    return;
  }

  if (session.step === 'INPUT_LINE_1') {
    if (text.length > CONFIG.MAX_CHAR_LENGTH) {
      await ctx.reply(
        `⚠️ *Text exceeds maximum length!*\n\n` +
          `Your text has **${text.length}** characters. Maximum allowed is **${CONFIG.MAX_CHAR_LENGTH}**.\n` +
          `Please try again with 20 characters or fewer:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('⬅️ Back', 'nav_back'),
              Markup.button.callback('❌ Cancel', 'nav_cancel'),
            ],
          ]),
        }
      );
      return;
    }

    if (session.data.lineCount === 1) {
      // 1 Line option completed -> Generate!
      sessionManager.transition(userId, 'GENERATING', {
        line1: text,
        line2: '',
      });
      await handleGenerateCard(ctx, userId);
    } else {
      // 2 Lines option -> Ask for Line 2
      sessionManager.transition(userId, 'INPUT_LINE_2', {
        line1: text,
      });
      await renderCurrentStep(ctx, userId);
    }
    return;
  }

  if (session.step === 'INPUT_LINE_2') {
    if (text.length > CONFIG.MAX_CHAR_LENGTH) {
      await ctx.reply(
        `⚠️ *Text exceeds maximum length!*\n\n` +
          `Your text has **${text.length}** characters. Maximum allowed is **${CONFIG.MAX_CHAR_LENGTH}**.\n` +
          `Please enter Line 2 with 20 characters or fewer:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('⬅️ Back', 'nav_back'),
              Markup.button.callback('❌ Cancel', 'nav_cancel'),
            ],
          ]),
        }
      );
      return;
    }

    // Line 2 completed -> Generate!
    sessionManager.transition(userId, 'GENERATING', {
      line2: text,
    });
    await handleGenerateCard(ctx, userId);
    return;
  }

  if (session.step === 'IDLE' || session.step === 'COMPLETED') {
    await ctx.reply(
      '📷 Please send me an image containing a **QR Code** to start!',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (session.step === 'PHOTO_OPTION') {
    await ctx.reply(
      '📷 Please send a photo or click **⏭️ Skip Photo** below:',
      Markup.inlineKeyboard([
        [Markup.button.callback('⏭️ Skip Photo', 'skip_photo')],
        [
          Markup.button.callback('⬅️ Back', 'nav_back'),
          Markup.button.callback('❌ Cancel', 'nav_cancel'),
        ],
      ])
    );
    return;
  }

  if (session.step === 'CHOOSE_LINES') {
    await ctx.reply(
      'Please select an option using the buttons below:',
      Markup.inlineKeyboard([
        [Markup.button.callback('1️⃣ 1 Line (Max 20 chars)', 'choose_lines_1')],
        [Markup.button.callback('2️⃣ 2 Lines (Max 20 chars each)', 'choose_lines_2')],
        [
          Markup.button.callback('⬅️ Back', 'nav_back'),
          Markup.button.callback('❌ Cancel', 'nav_cancel'),
        ],
      ])
    );
    return;
  }
});

// ---------------- FHD Generation & Delivery ----------------

async function handleGenerateCard(ctx, userId) {
  const session = sessionManager.getSession(userId);
  const { qrData, photoBuffer, lineCount, line1, line2 } = session.data;

  const waitMsg = await ctx.reply('🎨 *Generating your Full HD Standardized QR Card...*', {
    parse_mode: 'Markdown',
  });

  try {
    const cardBuffer = await generateFHDCard({
      qrData,
      photoBuffer,
      lineCount,
      line1,
      line2,
    });

    // Send high-res preview photo
    await ctx.replyWithPhoto(
      { source: cardBuffer },
      {
        caption:
          '🎉 *Here is your Standardized Full HD QR Card!*\n\n' +
          `• Line 1: ${escapeMarkdown(line1)}\n` +
          (line2 ? `• Line 2: ${escapeMarkdown(line2)}\n` : '') +
          '• Resolution: **1080 × 1360 (FHD)**\n\n' +
          '👇 An uncompressed document file is also sent below for maximum print & display quality.',
        parse_mode: 'Markdown',
      }
    );

    // Send uncompressed document to prevent Telegram compression
    await ctx.replyWithDocument(
      { source: cardBuffer, filename: 'qr_card_fhd_1080x1360.png' },
      {
        caption: '📁 *Original Full HD (1080x1360) PNG file.*',
        parse_mode: 'Markdown',
      }
    );

    // Transition to completed step with back navigation options
    session.step = 'COMPLETED';
    await renderCurrentStep(ctx, userId);
  } catch (error) {
    console.error('Error generating card:', error);
    await ctx.reply(
      '❌ Failed to generate the QR card. Please try again or click ⬅️ Back to edit your choices.',
      Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Back', 'nav_back')],
        [Markup.button.callback('❌ Cancel', 'nav_cancel')],
      ])
    );
  }
}

// ---------------- Start Bot ----------------

bot.catch((err, ctx) => {
  if (err.description && err.description.includes('query is too old')) return;
  console.error(`Unhandled bot error on update ${ctx?.update?.update_id}:`, err.message || err);
});

bot.launch({ dropPendingUpdates: true }, () => {
  console.log('🚀 QR Studio Bot is up and running!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
