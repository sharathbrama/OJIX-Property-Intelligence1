import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';
const htmlFile = path.join(rootDir, 'OJIX_Frame439_Marketing_Banner.html');
const outPng = path.join(rootDir, 'OJIX_Frame439_Marketing_Banner.png');
const brainPng = '/Users/apple/.gemini/antigravity/brain/1b1edc11-6919-489b-9930-57ba842108d0/OJIX_Frame439_Marketing_Banner.png';
const webAsset = path.join(rootDir, 'apps/web/public/assets/OJIX_Frame439_Marketing_Banner.png');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 2
  });

  const fileUrl = 'file://' + htmlFile;
  console.log('Loading:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const banner = page.locator('.banner-master');
  await banner.screenshot({ path: outPng });
  console.log('Saved to:', outPng);

  const brainDir = path.dirname(brainPng);
  if (!fs.existsSync(brainDir)) fs.mkdirSync(brainDir, { recursive: true });
  await banner.screenshot({ path: brainPng });
  console.log('Saved to brain:', brainPng);

  const webDir = path.dirname(webAsset);
  if (fs.existsSync(webDir)) {
    fs.copyFileSync(outPng, webAsset);
    console.log('Copied to web assets:', webAsset);
  }

  await browser.close();
  console.log('Capture finished successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
