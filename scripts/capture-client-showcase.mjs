import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const rootDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence';
const htmlFile = path.join(rootDir, 'OJIX_Client_Showcase_Banner.html');
const outPng = path.join(rootDir, 'OJIX_Client_Showcase_Banner.png');
const brainPng = '/Users/apple/.gemini/antigravity/brain/5e0fcf1c-96cc-426f-b2d3-de7ebd09f90e/OJIX_Client_Showcase_Banner.png';
const webAsset = path.join(rootDir, 'apps/web/public/assets/OJIX_Client_Showcase_Banner.png');

async function main() {
  console.log('Launching browser for client showcase banner capture...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage({
    viewport: { width: 1720, height: 1120 },
    deviceScaleFactor: 2
  });

  const fileUrl = 'file://' + htmlFile;
  console.log('Loading file:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const banner = page.locator('#bannerMaster');
  console.log('Capturing banner element screenshot at 2x scale...');
  await banner.screenshot({ path: outPng });
  console.log('Saved to root:', outPng);

  const brainDir = path.dirname(brainPng);
  if (!fs.existsSync(brainDir)) {
    fs.mkdirSync(brainDir, { recursive: true });
  }
  await banner.screenshot({ path: brainPng });
  console.log('Saved to brain directory:', brainPng);

  const webDir = path.dirname(webAsset);
  if (fs.existsSync(webDir)) {
    fs.copyFileSync(outPng, webAsset);
    console.log('Copied to web assets:', webAsset);
  }

  await browser.close();
  console.log('Screenshot capture finished successfully!');
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
