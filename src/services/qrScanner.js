import jsQR from 'jsqr';
import sharp from 'sharp';

/**
 * Scans an image buffer and attempts to decode any QR code.
 * @param {Buffer} imageBuffer - Raw image buffer
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function scanQRCode(imageBuffer) {
  try {
    // Pass 1: Standard RGBA extraction
    const rawImage = sharp(imageBuffer);
    const { data, info } = await rawImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const clampedArray = new Uint8ClampedArray(data);
    let code = jsQR(clampedArray, info.width, info.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data && code.data.trim().length > 0) {
      return { success: true, data: code.data };
    }

    // Pass 2: Enhanced contrast / grayscale if initial scan missed
    const enhanced = await sharp(imageBuffer)
      .greyscale()
      .normalize()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const enhancedClamped = new Uint8ClampedArray(enhanced.data);
    code = jsQR(enhancedClamped, enhanced.info.width, enhanced.info.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data && code.data.trim().length > 0) {
      return { success: true, data: code.data };
    }

    return {
      success: false,
      error: 'No QR code could be found or decoded in the image.',
    };
  } catch (err) {
    console.error('Error scanning QR code:', err);
    return {
      success: false,
      error: err.message || 'Failed to process image for QR detection.',
    };
  }
}
