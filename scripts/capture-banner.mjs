import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  }).catch(() => null);

  const finalBrowser = browser || await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }).catch(() => null);

  if (!finalBrowser) {
    console.error('Chromium launch skipped');
    process.exit(1);
  }

  const page = await finalBrowser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const htmlPath = path.resolve('/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/OJIX_Three_Panel_Marketing_Banner.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const locator = page.locator('.banner-wrapper');

  const targets = [
    '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/OJIX_Three_Panel_Marketing_Banner.png',
    '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/OJIX_Product_Flow_Banner.png',
    '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/apps/web/public/assets/OJIX_Three_Panel_Marketing_Banner.png',
    '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/apps/web/public/assets/OJIX_Product_Flow_Banner.png',
    '/Users/apple/.gemini/antigravity/brain/91df0320-217d-4e1b-a88a-779242cbdc49/OJIX_Three_Panel_Marketing_Banner.png',
    '/Users/apple/.gemini/antigravity/brain/91df0320-217d-4e1b-a88a-779242cbdc49/OJIX_Product_Flow_Banner.png'
  ];

  for (const target of targets) {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await locator.screenshot({ path: target });
    console.log(`Saved screenshot to: ${target}`);
  }

  console.log('SUCCESS: All banner screenshots captured cleanly!');
  await finalBrowser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
