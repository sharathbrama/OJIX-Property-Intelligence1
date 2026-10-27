import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 120_000);
const OCR_MAX_PAGES = Math.min(10, Math.max(1, Number(process.env.OCR_MAX_PAGES || 5)));
const OCR_LANGUAGES = process.env.OCR_LANGUAGES || 'kan+eng';

async function recogniseImage(imagePath: string) {
  const { stdout } = await execFileAsync(
    'tesseract',
    [imagePath, 'stdout', '-l', OCR_LANGUAGES, '--psm', '6', 'quiet'],
    { timeout: OCR_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout.trim();
}

export async function runLocalOcr(filePath: string, mimeType: string) {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ojix-ocr-'));
  try {
    let imagePaths = [filePath];
    const isPdf = mimeType === 'application/pdf' || path.extname(filePath).toLowerCase() === '.pdf';
    if (isPdf) {
      const prefix = path.join(temporaryDirectory, 'page');
      await execFileAsync(
        'pdftoppm',
        ['-f', '1', '-l', String(OCR_MAX_PAGES), '-r', '220', '-png', filePath, prefix],
        { timeout: OCR_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
      );
      imagePaths = (await fs.readdir(temporaryDirectory))
        .filter(name => /^page-\d+\.png$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(name => path.join(temporaryDirectory, name));
    }
    if (!imagePaths.length) throw new Error('No readable pages were produced from the document.');
    const pages: string[] = [];
    for (const [index, imagePath] of imagePaths.entries()) {
      const text = await recogniseImage(imagePath);
      if (text) pages.push(`--- Page ${index + 1} ---\n${text}`);
    }
    const combinedText = pages.join('\n\n').trim();
    if (combinedText.length < 20) throw new Error('OCR could not detect enough readable text. Upload a clearer scan.');
    return { text: combinedText, pageCount: imagePaths.length, languages: OCR_LANGUAGES, engine: 'tesseract' as const };
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
