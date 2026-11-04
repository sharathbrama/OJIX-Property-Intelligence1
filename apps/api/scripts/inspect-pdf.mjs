import fs from 'node:fs';
import path from 'node:path';

const pdfPath = path.resolve('sample-headless-report.pdf');
console.log('Inspecting PDF at:', pdfPath);

if (!fs.existsSync(pdfPath)) {
  console.error('File does NOT exist!');
  process.exit(1);
}

const stats = fs.statSync(pdfPath);
console.log('File size:', stats.size, 'bytes');

const buffer = fs.readFileSync(pdfPath);
const header = buffer.subarray(0, 8).toString();
console.log('PDF Magic Header:', header);

const content = buffer.toString('binary');

// Find pages
const pageObjMatches = content.match(/\/Type\s*\/Page\b/g) || [];
const pagesObjMatches = content.match(/\/Type\s*\/Pages\b/g) || [];
console.log('Page objects count (/Type /Page):', pageObjMatches.length);
console.log('Pages catalog count (/Type /Pages):', pagesObjMatches.length);

// Check for fonts embedded / used
const fontMatches = content.match(/\/BaseFont\s*\/([A-Za-z0-9+_-]+)/g) || [];
console.log('Embedded/referenced fonts:', fontMatches.slice(0, 10));

// Check for Creator / Producer
const producerMatch = content.match(/\/Producer\s*\(([^)]+)\)/);
const creatorMatch = content.match(/\/Creator\s*\(([^)]+)\)/);
if (producerMatch) console.log('Producer:', producerMatch[1]);
if (creatorMatch) console.log('Creator:', creatorMatch[1]);

// Check for streams and flate decoding
const streamCount = (content.match(/stream\r?\n/g) || []).length;
console.log('Number of content/font/metadata streams:', streamCount);

