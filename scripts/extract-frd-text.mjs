import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync('C:/Users/KEERTHANA/.gemini/antigravity/brain/69c783a2-15fe-4a75-88bd-37b41612c13b/.user_uploaded/media_1793768902574_7ce08911.pdf');
const content = buf.toString('latin1');

const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
let match;
let streams = [];

while ((match = streamRegex.exec(content)) !== null) {
  const streamData = Buffer.from(match[1], 'latin1');
  try {
    const decompressed = zlib.inflateSync(streamData).toString('latin1');
    streams.push(decompressed);
  } catch (e) {
    try {
      const decompressed = zlib.inflateRawSync(streamData).toString('latin1');
      streams.push(decompressed);
    } catch {}
  }
}

console.log('Decompressed streams count:', streams.length);

for (let i = 0; i < streams.length; i++) {
  const s = streams[i];
  if (s.includes('Owner') || s.includes('OCR') || s.includes('Role') || s.includes('FRD') || s.includes('Section')) {
    console.log(`Stream ${i} matched! Length: ${s.length}`);
    const lines = s.split(/[\r\n]+/);
    for (const l of lines) {
      if (/owner|ocr|role|tenant|rbac|analyst|lawyer/i.test(l)) {
        console.log('  line:', l.slice(0, 140));
      }
    }
  }
}
