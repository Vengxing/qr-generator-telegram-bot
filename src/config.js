import dotenv from 'dotenv';
dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN is missing in environment variables or .env file!');
  process.exit(1);
}

export const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MAX_CHAR_LENGTH: 20,
  CANVAS: {
    WIDTH: 1080,
    HEIGHT: 1280,
    BACKGROUND_COLOR: '#ffffff',
    PRIMARY_TEXT_COLOR: '#111827',
    SECONDARY_TEXT_COLOR: '#4b5563',
    ACCENT_COLOR: '#2563eb',
  },
};
