#!/usr/bin/env node
// scripts/generate-assets.js
// Generates all required App Store icons and splash screens
// Run: node scripts/generate-assets.js
//
// Requires: npm install sharp --save-dev

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ACCENT  = { r: 0,   g: 229, b: 160 };
const BG      = { r: 10,  g: 10,  b: 15  };

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  console.log('Generating FitBet assets...\n');

  // ── App Icon (1024×1024) ──────────────────────────────────
  // Dark background + FitBet "F" monogram + accent circle
  await sharp({
    create: {
      width: 1024, height: 1024, channels: 4,
      background: BG,
    },
  })
  .composite([
    // Accent circle background
    {
      input: Buffer.from(`
        <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
          <circle cx="512" cy="512" r="340" fill="rgb(0,229,160)" opacity="0.12"/>
          <circle cx="512" cy="512" r="280" fill="rgb(0,229,160)" opacity="0.08"/>
          <text x="512" y="600"
            font-family="sans-serif"
            font-weight="900"
            font-size="420"
            fill="rgb(0,229,160)"
            text-anchor="middle">F</text>
          <circle cx="512" cy="512" r="460"
            fill="none"
            stroke="rgb(0,229,160)"
            stroke-width="8"
            opacity="0.3"/>
        </svg>
      `),
      top: 0, left: 0,
    },
  ])
  .png()
  .toFile(path.join(assetsDir, 'icon.png'));
  console.log('✓  icon.png (1024×1024)');

  // ── Adaptive icon foreground (1024×1024, transparent bg) ─
  await sharp({
    create: {
      width: 1024, height: 1024, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  .composite([{
    input: Buffer.from(`
      <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <text x="512" y="620"
          font-family="sans-serif"
          font-weight="900"
          font-size="520"
          fill="rgb(0,229,160)"
          text-anchor="middle">F</text>
      </svg>
    `),
    top: 0, left: 0,
  }])
  .png()
  .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✓  adaptive-icon.png (1024×1024)');

  // ── Splash screen (1284×2778 — iPhone 14 Pro Max) ────────
  await sharp({
    create: {
      width: 1284, height: 2778, channels: 4,
      background: BG,
    },
  })
  .composite([{
    input: Buffer.from(`
      <svg width="1284" height="2778" xmlns="http://www.w3.org/2000/svg">
        <circle cx="642" cy="1300" r="200" fill="rgb(0,229,160)" opacity="0.08"/>
        <text x="642" y="1220"
          font-family="sans-serif"
          font-weight="900"
          font-size="260"
          fill="rgb(0,229,160)"
          text-anchor="middle">FB</text>
        <text x="642" y="1380"
          font-family="sans-serif"
          font-weight="700"
          font-size="80"
          fill="rgb(240,240,248)"
          text-anchor="middle"
          letter-spacing="20">FITBET</text>
        <text x="642" y="1480"
          font-family="sans-serif"
          font-weight="400"
          font-size="52"
          fill="rgb(90,90,114)"
          text-anchor="middle">Veðmál við vini. Þjálfun í leik.</text>
      </svg>
    `),
    top: 0, left: 0,
  }])
  .png()
  .toFile(path.join(assetsDir, 'splash.png'));
  console.log('✓  splash.png (1284×2778)');

  // ── Notification icon (96×96, white on transparent) ──────
  await sharp({
    create: {
      width: 96, height: 96, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  .composite([{
    input: Buffer.from(`
      <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="white"/>
        <text x="48" y="68"
          font-family="sans-serif"
          font-weight="900"
          font-size="52"
          fill="rgb(10,10,15)"
          text-anchor="middle">F</text>
      </svg>
    `),
    top: 0, left: 0,
  }])
  .png()
  .toFile(path.join(assetsDir, 'notification-icon.png'));
  console.log('✓  notification-icon.png (96×96)');

  // ── Favicon (32×32) ──────────────────────────────────────
  await sharp({
    create: {
      width: 32, height: 32, channels: 4,
      background: BG,
    },
  })
  .composite([{
    input: Buffer.from(`
      <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <text x="16" y="25"
          font-family="sans-serif"
          font-weight="900"
          font-size="24"
          fill="rgb(0,229,160)"
          text-anchor="middle">F</text>
      </svg>
    `),
    top: 0, left: 0,
  }])
  .png()
  .toFile(path.join(assetsDir, 'favicon.png'));
  console.log('✓  favicon.png (32×32)');

  console.log('\nAll assets generated in ./assets/');
  console.log('\nNext: run `npx expo start` to preview');
}

main().catch(console.error);
