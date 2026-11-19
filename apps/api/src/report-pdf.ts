import fs from 'node:fs';
import { chromium, type Browser } from 'playwright-core';
import PDFDocument from 'pdfkit';

const MAX_HTML_BYTES = 5 * 1024 * 1024;
let browserPromise: Promise<Browser> | null = null;
let activePages = 0;
const waiters: Array<() => void> = [];
const MAX_CONCURRENT_PAGES = 2;

function renderFallbackPdfKit(htmlText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const plainText = htmlText
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/?[^>]+(>|$)/g, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      doc.fontSize(16).text('OJIX Property Intelligence — Due Diligence Report', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#64748b').text(`Generated on ${new Date().toISOString()} · Confidential Legal Report`);
      doc.moveDown();
      doc.fontSize(10).fillColor('#1e293b');

      for (const line of plainText.slice(0, 120)) {
        if (line.length > 0) {
          doc.text(line);
          doc.moveDown(0.2);
        }
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function chromiumPath(): string {
  const configured = process.env.CHROMIUM_EXECUTABLE_PATH?.trim();
  if (configured) {
    if (!fs.existsSync(configured)) throw new Error('Configured Chromium executable was not found.');
    return configured;
  }
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error('PDF renderer is unavailable: set CHROMIUM_EXECUTABLE_PATH to an installed Chromium executable.');
  return found;
}

async function acquirePageSlot(): Promise<() => void> {
  while (activePages >= MAX_CONCURRENT_PAGES) await new Promise<void>(resolve => waiters.push(resolve));
  activePages++;
  return () => {
    activePages--;
    waiters.shift()?.();
  };
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      executablePath: chromiumPath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'],
    }).catch(error => {
      browserPromise = null;
      throw error;
    });
  }
  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/** Render trusted, application-generated HTML as a real PDF. */
export async function renderReportPdf(html: string): Promise<Buffer> {
  if (typeof html !== 'string' || !html.trim()) throw new Error('PDF report content is empty.');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('PDF report content exceeds the 5 MB rendering limit.');
  
  // Try Chromium headless rendering first; fallback cleanly to PDFKit if unavailable (e.g. serverless)
  try {
    const release = await acquirePageSlot();
    let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage({ acceptDownloads: false, javaScriptEnabled: false });
      await page.route('**/*', route => route.request().url() === 'about:blank' ? route.continue() : route.abort());
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:8px;width:100%;margin:0 14mm;color:#777"></div>',
        footerTemplate: '<div style="font-size:8px;width:100%;margin:0 14mm;color:#777;display:flex;justify-content:space-between"><span>OJIX Property Intelligence · Confidential</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
        margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' },
      });
      const result = Buffer.from(pdf);
      if (result.length < 800 || result.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Chromium returned an invalid PDF document.');
      return result;
    } finally {
      await page?.close().catch(() => {});
      release();
    }
  } catch (err: any) {
    console.warn('[renderReportPdf] Chromium rendering unavailable or failed, falling back to PDFKit:', err.message);
    return renderFallbackPdfKit(html);
  }
}

export async function closeReportPdfBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (pending) await pending.then(browser => browser.close()).catch(() => {});
}
