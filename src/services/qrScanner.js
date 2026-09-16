import jsQR from 'jsqr';
import sharp from 'sharp';

/**
 * Converts any raw Sharp pixel buffer (1, 2, 3, or 4 channels)
 * into a 4-channel RGBA Uint8ClampedArray required by jsQR.
 */
function toRGBAClampedArray(data, channels, width, height) {
  const totalPixels = width * height;
  if (channels === 4 && data.length === totalPixels * 4) {
    return new Uint8ClampedArray(data);
  }

  const rgba = new Uint8ClampedArray(totalPixels * 4);
  if (channels === 1) {
    for (let i = 0, j = 0; i < totalPixels; i++, j += 4) {
      const val = data[i];
      rgba[j] = val;
      rgba[j + 1] = val;
      rgba[j + 2] = val;
      rgba[j + 3] = 255;
    }
  } else if (channels === 2) {
    for (let i = 0, j = 0; i < totalPixels * 2; i += 2, j += 4) {
      const val = data[i];
      rgba[j] = val;
      rgba[j + 1] = val;
      rgba[j + 2] = val;
      rgba[j + 3] = data[i + 1];
    }
  } else if (channels === 3) {
    for (let i = 0, j = 0; i < totalPixels * 3; i += 3, j += 4) {
      rgba[j] = data[i];
      rgba[j + 1] = data[i + 1];
      rgba[j + 2] = data[i + 2];
      rgba[j + 3] = 255;
    }
  }
  return rgba;
}

/**
 * Scans an image buffer and attempts to decode any QR code.
 * @param {Buffer} imageBuffer - Raw image buffer
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function scanQRCode(imageBuffer) {
  try {
    // Pass 1: Standard RGBA extraction with auto-rotation for phone orientation
    const rawImage = sharp(imageBuffer).rotate();
    const { data, info } = await rawImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const clampedArray = toRGBAClampedArray(data, info.channels, info.width, info.height);
    let code = jsQR(clampedArray, info.width, info.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data && code.data.trim().length > 0) {
      return { success: true, data: code.data };
    }

    // Pass 2: Enhanced contrast / grayscale if initial scan missed
    const enhanced = await sharp(imageBuffer)
      .rotate()
      .greyscale()
      .normalize()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const enhancedClamped = toRGBAClampedArray(
      enhanced.data,
      enhanced.info.channels,
      enhanced.info.width,
      enhanced.info.height
    );

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
