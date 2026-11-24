import { chromium } from 'playwright-core';

async function render() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 1540, height: 1060 },
    deviceScaleFactor: 2
  });
  await page.goto('file:///Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/banner-ojix-property.html', { waitUntil: 'networkidle' });
  const banner = await page.locator('.banner-container');
  await banner.screenshot({ path: '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/OJIX_Property_Showcase_Banner.png' });
  console.log('Banner PNG successfully generated at /Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/OJIX_Property_Showcase_Banner.png');
  await browser.close();
}

render().catch(err => {
  console.error(err);
  process.exit(1);
});
