# 🚀 Telegram Standardized QR Generator Bot (Node.js)

A production-ready Telegram Bot built with Node.js that scans incoming QR codes, validates their readability, allows users to attach custom photos/logos, supports 1-line or 2-line custom text, and renders a standardized, high-contrast **Full HD (1080×1920)** branded card.

Users can reverse their decision or step back at **any point** in the flow without losing progress!

---

## ✨ Features

- 🔍 **Automated QR Detection**: Automatically detects, extracts, and validates QR codes from uploaded images using `jsqr` and `sharp`.
- 🖼️ **Optional Photo / Logo**: Users can send any image to be neatly cropped and placed at the bottom-left corner, or skip to use an elegant vector badge.
- ✍️ **1-Line or 2-Line Layout**:
  - **1 Line**: Prominent headline (max 20 characters) vertically centered with the photo.
  - **2 Lines**: Main title + subtitle (max 20 characters each) vertically stacked next to the photo.
  - Enforces character limits and provides instant validation warnings.
- 🎨 **Full HD Standardized Output (1080 × 1080)**:
  - Generates high-resolution output using `@napi-rs/canvas`.
  - Sent both as a **Telegram Photo preview** and as an **Uncompressed Document (.png)** to preserve crisp print-ready quality.
  - Zero wasted space, with the QR code dominating the card and photo + text cleanly aligned on the bottom row.
- ↩️ **Full Reversibility**:
  - Interactive `[ ⬅️ Back ]` buttons at every stage.
  - `/back` and `/cancel` commands available at all times.
  - Preserves prior inputs when stepping backward.

---

## 📋 Conversational Flow

```text
[User sends QR Image]
        │
        ▼
[Bot decodes & validates QR]
        │
        ├─► [Invalid QR] ──► Prompt user for a clearer image
        │
        ▼
[Step 2: Add Photo / Logo?]
        ├── Send image ──► Saved
        └── Skip Photo ──► Default badge
        │
        ▼
[Step 3: Choose Layout]
        ├── [ 1️⃣ 1 Line ]  ──► Prompt for text (max 20 chars)
        └── [ 2️⃣ 2 Lines ] ──► Prompt for Line 1 (max 20 chars)
                               Prompt for Line 2 (max 20 chars)
        │
        ▼
[Step 4: Bot Renders & Delivers FHD Card]
        ├── Photo Preview
        └── Uncompressed Document (.png)
        │
        ▼
[Actions: Edit Text / New QR]
```

*Note: At any prompt, the user can click `[ ⬅️ Back ]` to return to the previous state.*

---

## 🛠️ Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js**: v18 or later

### 2. Configure Environment
Create or edit `.env` in the root directory:
```env
BOT_TOKEN=your_telegram_bot_token_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Automated Tests
Verifies QR scanning, canvas rendering, and decodability of generated cards:
```bash
npm test
```
*Generated sample output cards will be saved to `test/output/`.*

### 5. Start the Bot
```bash
# Production mode
npm start

# Development mode (auto-reloads on file changes)
npm run dev
```

---

## ☁️ Hosting & Deployment

### Option A: Docker / Docker Compose (Recommended for VPS)
```bash
docker compose up -d --build
```
To check logs:
```bash
docker compose logs -f
```

### Option B: PM2 on VPS
```bash
npm install -g pm2
pm2 start src/bot.js --name "qr-bot"
pm2 save
pm2 startup
```

### Option C: Cloud Hosting (Railway / Render / Fly.io)
1. Fork or push this repository to GitHub.
2. In your cloud provider dashboard:
   - Create a new **Web Service** or **Background Worker**.
   - Add the environment variable `BOT_TOKEN`.
   - Build Command: `npm install`
   - Start Command: `npm start` (or deploy directly using the provided `Dockerfile`).

---

## 📁 Project Structure

```text
qr-generator-bot/
├── src/
│   ├── config.js              # Environment settings & canvas constants
│   ├── bot.js                 # Telegram Bot handlers & conversation flow
│   ├── services/
│   │   ├── qrScanner.js       # QR detection with sharp and jsqr
│   │   └── qrRenderer.js      # Full HD canvas rendering with @napi-rs/canvas
│   └── state/
│       └── sessionManager.js  # History stack state machine for reversibility
├── test/
│   ├── test-pipeline.js       # Automated end-to-end tests
│   └── output/                # Test output PNG files
├── .env                       # Environment variables
├── Dockerfile                 # Container image
├── docker-compose.yml         # Container orchestration
└── package.json
```
