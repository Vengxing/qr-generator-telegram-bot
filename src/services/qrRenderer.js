import { createCanvas, loadImage } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import { CONFIG } from '../config.js';

/**
 * Helper to draw a rounded rectangle path.
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Helper to draw a circular image.
 */
function drawCircularImage(ctx, img, x, y, size) {
  ctx.save();
  ctx.beginPath();
  const radius = size / 2;
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  // Draw image centered and covering the circle
  const minDim = Math.min(img.width, img.height);
  const sx = (img.width - minDim) / 2;
  const sy = (img.height - minDim) / 2;
  ctx.drawImage(img, sx, sy, minDim, minDim, x, y, size, size);
  ctx.restore();

  // Draw clean border around the circular image
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2, true);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();
  ctx.restore();
}

/**
 * Generates a standardized FHD QR card with zero wasted space on any side.
 * The QR code spans edge-to-edge with equal, minimal padding on all 4 borders.
 *
 * @param {Object} options
 * @param {string} options.qrData - The decoded data to encode in QR
 * @param {Buffer|null} [options.photoBuffer] - Optional user photo buffer
 * @param {number} options.lineCount - 1 or 2
 * @param {string} options.line1 - First line text (max 20 chars)
 * @param {string} [options.line2] - Second line text (max 20 chars, if 2 lines)
 * @returns {Promise<Buffer>} PNG buffer in FHD 1080x1280
 */
export async function generateFHDCard({
  qrData,
  photoBuffer = null,
  lineCount = 1,
  line1 = '',
  line2 = '',
}) {
  const width = CONFIG.CANVAS.WIDTH;   // 1080
  const height = CONFIG.CANVAS.HEIGHT; // 1280

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Clean white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Subtle outer card border for crisp edges on dark/light themes
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e2e8f0';
  drawRoundedRect(ctx, 4, 4, width - 8, height - 8, 24);
  ctx.stroke();

  // 2. High-resolution standardized QR Code spanning the full width
  const margin = 36;
  const qrSize = width - margin * 2; // 1080 - 72 = 1008px!
  const qrX = margin;                // 36px
  const qrY = margin;                // 36px

  const qrBuffer = await QRCode.toBuffer(qrData, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 1,
    width: qrSize,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const qrImage = await loadImage(qrBuffer);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // 3. Bottom Row Section: exactly matches the QR code's width and alignment
  const bottomSectionWidth = qrSize; // 1008px
  const bottomSectionX = qrX;        // 36px
  const bottomSectionY = qrY + qrSize + 24; // 36 + 1008 + 24 = 1068px
  const bottomSectionHeight = height - bottomSectionY - margin; // 1280 - 1068 - 36 = 176px

  // Bottom row card container
  drawRoundedRect(
    ctx,
    bottomSectionX,
    bottomSectionY,
    bottomSectionWidth,
    bottomSectionHeight,
    24
  );
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  // Bottom-Left: Photo / Avatar
  const photoSize = 136;
  const photoX = bottomSectionX + 20;
  const photoY = bottomSectionY + (bottomSectionHeight - photoSize) / 2;

  if (photoBuffer) {
    try {
      const userPhoto = await loadImage(photoBuffer);
      drawCircularImage(ctx, userPhoto, photoX, photoY, photoSize);
    } catch (e) {
      console.warn('Could not load user photo, using placeholder:', e.message);
      drawPlaceholderAvatar(ctx, photoX, photoY, photoSize);
    }
  } else {
    drawPlaceholderAvatar(ctx, photoX, photoY, photoSize);
  }

  // Same Row: Text next to the photo (middle-aligned in the remaining row area)
  const contentRight = bottomSectionX + bottomSectionWidth - 24;
  const contentLeft = photoX + photoSize + 24;
  const textCenterX = (contentLeft + contentRight) / 2;
  const maxTextWidth = contentRight - contentLeft;

  ctx.textAlign = 'center';

  if (lineCount === 1 || !line2) {
    // 1 Line: Large, bold, perfectly middle-aligned both horizontally and vertically
    const textCenterY = bottomSectionY + bottomSectionHeight / 2;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 50px sans-serif';
    ctx.textBaseline = 'middle';

    const displayLine = fitText(ctx, line1 || 'SCAN TO OPEN', maxTextWidth);
    ctx.fillText(displayLine, textCenterX, textCenterY);
  } else {
    // 2 Lines: Line 1 + Line 2 perfectly middle-aligned horizontally and as a balanced vertical block
    const textCenterY = bottomSectionY + bottomSectionHeight / 2;

    const line1FontSize = 42;
    const line2FontSize = 30;
    const lineSpacing = 10;
    const totalBlockHeight = line1FontSize + lineSpacing + line2FontSize; // 82px
    const blockTopY = textCenterY - totalBlockHeight / 2;

    // Line 1 (Primary Title)
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${line1FontSize}px sans-serif`;
    ctx.textBaseline = 'top';
    const displayLine1 = fitText(ctx, line1, maxTextWidth);
    ctx.fillText(displayLine1, textCenterX, blockTopY);

    // Line 2 (Secondary Subtitle)
    ctx.fillStyle = '#64748b';
    ctx.font = `normal ${line2FontSize}px sans-serif`;
    ctx.textBaseline = 'top';
    const displayLine2 = fitText(ctx, line2, maxTextWidth);
    ctx.fillText(displayLine2, textCenterX, blockTopY + line1FontSize + lineSpacing);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Draws an elegant default vector badge when no user photo is provided.
 */
function drawPlaceholderAvatar(ctx, x, y, size) {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;

  // Background circle
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#2563eb');
  grad.addColorStop(1, '#4f46e5');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer border
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#93c5fd';
  ctx.stroke();

  // Crisp vector icon (stylized QR scanner frame)
  const iconSize = 56;
  const ix = cx - iconSize / 2;
  const iy = cy - iconSize / 2;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';

  const cornerLen = 14;
  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(ix, iy + cornerLen);
  ctx.lineTo(ix, iy);
  ctx.lineTo(ix + cornerLen, iy);
  ctx.stroke();

  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(ix + iconSize - cornerLen, iy);
  ctx.lineTo(ix + iconSize, iy);
  ctx.lineTo(ix + iconSize, iy + cornerLen);
  ctx.stroke();

  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(ix, iy + iconSize - cornerLen);
  ctx.lineTo(ix, iy + iconSize);
  ctx.lineTo(ix + cornerLen, iy + iconSize);
  ctx.stroke();

  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(ix + iconSize - cornerLen, iy + iconSize);
  ctx.lineTo(ix + iconSize, iy + iconSize);
  ctx.lineTo(ix + iconSize, iy + iconSize - cornerLen);
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

/**
 * Truncates text with ellipsis if it overflows canvas width.
 */
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(trimmed + '...').width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed + '...';
}
