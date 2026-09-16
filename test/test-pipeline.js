import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { scanQRCode } from '../src/services/qrScanner.js';
import { generateFHDCard } from '../src/services/qrRenderer.js';

async function runTest() {
  console.log('🧪 Starting QR Pipeline Automated Tests...\n');

  const outputDir = path.resolve('test/output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // --- TEST 1: QR Scanning & Decoding ---
  console.log('--- Test 1: Generate & Decode QR Code ---');
  const testPayload = 'https://example.com/telegram-qr-bot-test';
  const rawQrBuffer = await QRCode.toBuffer(testPayload, {
    errorCorrectionLevel: 'H',
    width: 400,
  });

  const scanResult = await scanQRCode(rawQrBuffer);
  console.log('Scan result:', scanResult);

  if (!scanResult.success || scanResult.data !== testPayload) {
    throw new Error(`QR scan failed! Expected "${testPayload}", got: ${scanResult.data}`);
  }
  console.log('✅ Test 1 Passed: QR code successfully decoded!\n');

  // --- Create a sample user photo for testing ---
  const samplePhoto = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 4,
      background: { r: 59, g: 130, b: 246, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="300" height="300"><circle cx="150" cy="150" r="100" fill="#ffffff" /><text x="150" y="165" font-size="48" font-family="sans-serif" text-anchor="middle" fill="#3b82f6" font-weight="bold">USER</text></svg>'
        ),
      },
    ])
    .png()
    .toBuffer();

  // --- TEST 2: Generate FHD Card (1 Line + User Photo) ---
  console.log('--- Test 2: Generate FHD Card (1 Line + Photo) ---');
  const card1 = await generateFHDCard({
    qrData: testPayload,
    photoBuffer: samplePhoto,
    lineCount: 1,
    line1: 'VIP Access Pass',
  });

  const card1Meta = await sharp(card1).metadata();
  console.log(`Card 1 Dimensions: ${card1Meta.width}x${card1Meta.height}, Format: ${card1Meta.format}`);

  if (card1Meta.width !== 1080 || card1Meta.height !== 1280) {
    throw new Error(`Expected dimensions 1080x1280, got ${card1Meta.width}x${card1Meta.height}`);
  }

  fs.writeFileSync(path.join(outputDir, 'test_card_1_line.png'), card1);
  console.log('✅ Test 2 Passed: 1-line FHD card generated successfully!\n');

  // --- TEST 3: Generate FHD Card (2 Lines + No Photo) ---
  console.log('--- Test 3: Generate FHD Card (2 Lines + Default Badge) ---');
  const card2 = await generateFHDCard({
    qrData: 'https://antigravity.google.com',
    photoBuffer: null,
    lineCount: 2,
    line1: 'Golden Dragon Lounge',
    line2: 'Table Number 08',
  });

  const card2Meta = await sharp(card2).metadata();
  console.log(`Card 2 Dimensions: ${card2Meta.width}x${card2Meta.height}, Format: ${card2Meta.format}`);

  if (card2Meta.width !== 1080 || card2Meta.height !== 1280) {
    throw new Error(`Expected dimensions 1080x1280, got ${card2Meta.width}x${card2Meta.height}`);
  }

  fs.writeFileSync(path.join(outputDir, 'test_card_2_lines.png'), card2);
  console.log('✅ Test 3 Passed: 2-lines FHD card generated successfully!\n');

  // --- TEST 4: Verification - Verify generated card is decodable ---
  console.log('--- Test 4: Scanning Generated Full HD Card ---');
  const rescan = await scanQRCode(card1);
  console.log('Rescan result on generated card:', rescan);
  if (!rescan.success || rescan.data !== testPayload) {
    throw new Error(`Rescanning output card failed! Expected: "${testPayload}", got: ${rescan.data}`);
  }
  console.log('✅ Test 4 Passed: Output card QR is 100% decodable and crisp!\n');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Output images saved in test/output/');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
