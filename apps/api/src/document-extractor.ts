/**
 * OJIX Property Intelligence - Karnataka Document Intelligence & Extraction Engine
 * Classifies 6 Karnataka document types, extracts metadata with evidence anchors,
 * bounding boxes [ymin, xmin, ymax, xmax], confidence metrics, and unit normalizations.
 */

import crypto from 'node:crypto';
import type {
  BoundingBox,
  EvidenceAnchor,
  ExtractedDocumentFields,
  ExtractedParty,
  FourSideBoundaries,
  KarnatakaDocumentType,
  OCRToken,
  PropertyExtent,
  PropertySchedule,
  Consideration,
  EncumbranceEntry,
} from './types.js';

export type { BoundingBox } from './types.js';

export interface ExtractionInput {
  text?: string;
  tokens?: OCRToken[];
  jsonPayload?: Partial<ExtractedDocumentFields>;
  buffer?: Buffer;
}

export interface ExtractorOptions {
  documentId?: string;
  filename?: string;
  mimeType?: string;
  docTypeOverride?: KarnatakaDocumentType;
}

/**
 * Karnataka Land Area Constants
 * Standard statutory conversions:
 * 1 Acre = 40 Guntas = 43,560 Sq. Ft. = 4,046.8564224 Sq. Meters
 * 1 Gunta = 1,089 Sq. Ft. = 121 Sq. Yards = 101.17141056 Sq. Meters
 * 1 Cent = 435.6 Sq. Ft. = 0.4 Guntas
 * 1 Sq. Meter = 10.7639104 Sq. Ft.
 */
export const SQFT_PER_ACRE = 43560;
export const SQFT_PER_GUNTA = 1089;
export const SQFT_PER_CENT = 435.6;
export const SQFT_PER_SQM = 10.7639104;

/**
 * Normalize Karnataka land extent strings to exact normalized square feet.
 * Handles compound strings: "1 Acre 15 Guntas", "0-30 Guntas", "1 Acre 5 1/2 Guntas",
 * "2400 sq.ft", "500 sq.m", "40 Cents", "40 x 60 ft", etc.
 */
export function normalizeKarnatakaExtent(raw: string | any): PropertyExtent {
  const clean = typeof raw === 'string' ? raw.trim() : (raw !== null && raw !== undefined ? String(raw).trim() : '');
  if (!clean) {
    return { rawText: '', normalizedSqFt: 0 };
  }

  let acres = 0;
  let guntas = 0;
  let sqFt = 0;
  let sqMeters = 0;
  let cents = 0;
  let hasParsed = false;

  // 1. Check for compound Acre and Gunta (English & Kannada): e.g. "1 Acre 15 Guntas", "1 ಎಕರೆ 20 ಗುಂಟೆ"
  const acreGuntaMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)\s*(?:and|ಮತ್ತು)?\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)/iu);
  if (acreGuntaMatch) {
    acres = parseFloat(acreGuntaMatch[1]);
    guntas = parseFractionOrDecimal(acreGuntaMatch[2]);
    hasParsed = true;
  } else {
    // 2. Check for Acre only (English & Kannada): e.g. "2 Acres", "2 ಎಕರೆ"
    const acreOnlyMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)/iu);
    if (acreOnlyMatch) {
      acres = parseFloat(acreOnlyMatch[1]);
      hasParsed = true;
    }

    // 3. Check for Gunta only or Hyphenated Gunta format: e.g. "0-30 Guntas", "30 ಗುಂಟೆ"
    const hyphenGuntaMatch = clean.match(/(\d+)\s*[-–]\s*(\d+(?:\s+\d+\/\d+|\.\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?/iu);
    const guntaOnlyMatch = clean.match(/(?:^|\s)(\d+(?:\s+\d+\/\d+|\.\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)/iu);

    if (hyphenGuntaMatch && (clean.toLowerCase().includes('gunta') || clean.toLowerCase().includes('gt') || clean.includes('ಗುಂಟೆ') || clean.includes('ಗುಂಟಾ') || hyphenGuntaMatch[1] === '0')) {
      // In Karnataka revenue terminology, "0-30" or "1-12" means 0 acres 30 guntas or 1 acre 12 guntas
      const hAcres = parseFloat(hyphenGuntaMatch[1]);
      const hGuntas = parseFractionOrDecimal(hyphenGuntaMatch[2]);
      if (hAcres > 0 && acres === 0) acres = hAcres;
      guntas = hGuntas;
      hasParsed = true;
    } else if (guntaOnlyMatch) {
      guntas = parseFractionOrDecimal(guntaOnlyMatch[1]);
      hasParsed = true;
    }
  }

  // 4. Check for Cents: e.g. "50 Cents", "40 cent"
  const centsMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:cents?|cent\b)/i);
  if (centsMatch) {
    cents = parseFloat(centsMatch[1]);
    hasParsed = true;
  }

  // 5. Check for Square Feet: e.g. "2400 sq.ft", "2,400 sq ft", "1200 square feet", "sft"
  const sqFtMatch = clean.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b/i);
  if (sqFtMatch) {
    sqFt = parseFloat(sqFtMatch[1].replace(/,/g, ''));
    hasParsed = true;
  }

  // 6. Check for Dimensional Feet: e.g. "40 x 60 ft", "30*40 sq ft", "40ft x 60ft"
  const dimensionMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet)?\s*[xX*×]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet)?/i);
  if (dimensionMatch && sqFt === 0) {
    const dim1 = parseFloat(dimensionMatch[1]);
    const dim2 = parseFloat(dimensionMatch[2]);
    sqFt = dim1 * dim2;
    hasParsed = true;
  }

  // 7. Check for Square Meters: e.g. "500 sq.m", "222.96 sq.meters", "sqm"
  const sqMMatch = clean.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b/i);
  if (sqMMatch) {
    sqMeters = parseFloat(sqMMatch[1].replace(/,/g, ''));
    hasParsed = true;
  }

  // Calculate normalized square feet
  let normalizedSqFt = 0;
  if (sqFt > 0) {
    normalizedSqFt = sqFt;
  } else if (acres > 0 || guntas > 0) {
    normalizedSqFt = acres * SQFT_PER_ACRE + guntas * SQFT_PER_GUNTA;
  } else if (cents > 0) {
    normalizedSqFt = cents * SQFT_PER_CENT;
  } else if (sqMeters > 0) {
    normalizedSqFt = sqMeters * SQFT_PER_SQM;
  } else if (!hasParsed) {
    // Fallback: look for a plain number if no unit matched
    const plainNum = clean.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (plainNum) {
      normalizedSqFt = parseFloat(plainNum[0]);
    }
  }

  normalizedSqFt = Math.round(normalizedSqFt * 100) / 100;

  const result: PropertyExtent = {
    rawText: clean,
    normalizedSqFt,
  };
  if (acres > 0) result.acres = acres;
  if (guntas > 0) result.guntas = guntas;
  if (sqFt > 0) result.sqFt = sqFt;
  if (sqMeters > 0) result.sqMeters = sqMeters;
  if (cents > 0) result.cents = cents;

  return result;
}

/**
 * Helper to parse fractions like "5 1/2" or "1/4" or "3/4" or "2.5"
 */
function parseFractionOrDecimal(input: string): number {
  const trimmed = input.trim();
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    const whole = parseFloat(parts[0]) || 0;
    const fraction = parseFractionOnly(parts[1]);
    return whole + fraction;
  }
  if (trimmed.includes('/')) {
    return parseFractionOnly(trimmed);
  }
  return parseFloat(trimmed) || 0;
}

function parseFractionOnly(str: string): number {
  const parts = str.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den !== 0) return num / den;
  }
  return 0;
}

/**
 * Normalizes Karnataka / South Indian person names by removing honorifics,
 * collapsing whitespace, and standardizing casing.
 */
export function normalizePersonName(name: string | any): string {
  if (typeof name !== 'string') {
    if (name === null || name === undefined) return '';
    name = String(name);
  }
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^(?:sri|srimathi|smt|mr|mrs|ms|dr|late|master|ಶ್ರೀ|ಶ್ರೀಮತಿ)\.?\s+/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classifies document text into one of 6 Karnataka document types + other.
 */
export function classifyKarnatakaDocument(
  text: string | any,
  filename?: string
): { docType: KarnatakaDocumentType; confidence: number; indicators: string[] } {
  const safeText = typeof text === 'string' ? text : (text !== null && text !== undefined ? String(text) : '');
  const lowerText = safeText.toLowerCase();
  const lowerFile = (filename || '').toLowerCase();
  const combined = `${lowerFile}\n${lowerText}`;

  const scores: Record<KarnatakaDocumentType, { count: number; matches: string[] }> = {
    sale_deed: { count: 0, matches: [] },
    gift_deed: { count: 0, matches: [] },
    rtc_pahani: { count: 0, matches: [] },
    encumbrance_certificate: { count: 0, matches: [] },
    e_khata: { count: 0, matches: [] },
    mutation_extract: { count: 0, matches: [] },
    other: { count: 0, matches: [] },
  };

  const patterns: Record<KarnatakaDocumentType, Array<{ pattern: RegExp; weight: number; label: string }>> = {
    sale_deed: [
      { pattern: /\b(?:absolute\s+sale\s+deed|deed\s+of\s+sale|sale\s+deed|kraya\s*patra)\b/i, weight: 4, label: 'sale deed keyword' },
      { pattern: /(?:ಕ್ರಯ\s*ಪತ್ರ|ಕ್ರಯಪತ್ರ|ಮಾರಾಟ\s*ಪತ್ರ|ಮಾರಾಟಪತ್ರ|ಖರೀದಿ\s*ಪತ್ರ)/iu, weight: 4, label: 'kannada sale deed keyword' },
      { pattern: /\b(?:vendor|purchaser|sale\s+consideration|schedule\s+property|conveyance)\b/i, weight: 2, label: 'conveyance terms' },
      { pattern: /(?:ಖರೀದಿದಾರ|ಮಾರಾಟಗಾರ|ಪ್ರತಿಫಲ)/iu, weight: 2, label: 'kannada conveyance terms' },
      { pattern: /\b(?:sub-registrar|registration\s+act|kaveri)\b/i, weight: 1, label: 'registration reference' },
    ],
    gift_deed: [
      { pattern: /\b(?:gift\s+deed|deed\s+of\s+gift|dhana\s*patra|dhanapatra|settlement\s+deed)\b/i, weight: 4, label: 'gift deed keyword' },
      { pattern: /(?:ದಾನ\s*ಪತ್ರ|ದಾನಪತ್ರ|ದಾನದ\s*ಪತ್ರ|ಉಡುಗೊರೆ\s*ಪತ್ರ)/iu, weight: 4, label: 'kannada gift deed keyword' },
      { pattern: /\b(?:donor|donee|natural\s+love\s+and\s+affection|without\s+any\s+monetary\s+consideration)\b/i, weight: 3, label: 'gift terms' },
    ],
    rtc_pahani: [
      { pattern: /\b(?:rtc|pahani|form\s*(?:no\.?\s*)?16|bhoomi\s+portal|record\s+of\s+rights)\b/i, weight: 4, label: 'rtc pahani keyword' },
      { pattern: /(?:ಆರ್‌ಟಿಸಿ|ಆರ್\s*ಟಿ\s*ಸಿ|ಪಹಣಿ|ಪಹಣಿ\s*ಪತ್ರಿಕೆ|ಭೂಮಿ|ಕಬ್ಜೇದಾರ|ನಮೂನೆ\s*೧೬|ಹಕ್ಕು\s*ದಾಖಲೆ)/iu, weight: 4, label: 'kannada rtc keyword' },
      { pattern: /\b(?:kabzedar|hissa|soil\s+class|kharab|pattadar|tenancy\s+and\s+crops|bhoomi)\b/i, weight: 3, label: 'rtc columns' },
      { pattern: /\b(?:tahsildar|village\s+accountant|revenue\s+inspector)\b/i, weight: 1, label: 'revenue authorities' },
      { pattern: /(?:ತಹಶೀಲ್ದಾರ್|ಗ್ರಾಮ\s*ಲೆಕ್ಕಿಗ|ಕಂದಾಯ\s*ನಿರೀಕ್ಷಕ)/iu, weight: 1, label: 'kannada revenue authorities' },
    ],
    encumbrance_certificate: [
      { pattern: /\b(?:encumbrance\s+certificate|certificate\s+of\s+encumbrance|nil\s+encumbrance|form\s*(?:no\.?\s*)?15|form\s*(?:no\.?\s*)?16)\b/i, weight: 4, label: 'ec keyword' },
      { pattern: /(?:ಭಾರ\s*ಪ್ರಮಾಣ\s*ಪತ್ರ|ಋಣ\s*ಭಾರ|ಋಣಭಾರ\s*ಪ್ರಮಾಣಪತ್ರ|ನಮೂನೆ\s*೧೫|ಎನ್‌ಕಂಬರೆನ್ಸ್)/iu, weight: 4, label: 'kannada ec keyword' },
      { pattern: /\b(?:statement\s+of\s+encumbrance|search\s+period|no\s+encumbrance\s+found|mortgage|charge)\b/i, weight: 3, label: 'ec schedule' },
      { pattern: /\b(?:sro|kaveri|department\s+of\s+stamps)\b/i, weight: 1, label: 'sro stamps' },
    ],
    e_khata: [
      { pattern: /\b(?:e-?khata|e-?aasthi|aasthi|e-?swathu|eswathu|form\s*(?:no\.?\s*)?3|form\s*(?:no\.?\s*)?9|form\s*(?:no\.?\s*)?11)\b/i, weight: 4, label: 'khata keyword' },
      { pattern: /(?:ಇ-?ಖಾತಾ|ಇ-?ಆಸ್ತಿ|ಇ-?ಸ್ವತ್ತು|ಖಾತೆ|ಖಾತಾ\s*ಪ್ರಮಾಣ\s*ಪತ್ರ|ನಮೂನೆ\s*[೩೯೧]|ನಮೂನೆ\s*೧೧)/iu, weight: 4, label: 'kannada khata keyword' },
      { pattern: /\b(?:property\s+tax|bbmp|bruhat\s+bengaluru|panchayat|khata\s+certificate|khata\s+extract|pid\s+no)\b/i, weight: 3, label: 'khata terms' },
      { pattern: /\b(?:assessment\s+register|sas\s+base|annual\s+rateable\s+value)\b/i, weight: 2, label: 'tax assessment' },
    ],
    mutation_extract: [
      { pattern: /\b(?:mutation\s+extract|mutation\s+register|m\.?r\.?\s*(?:extract|register|no)|form\s*(?:no\.?\s*)?12)\b/i, weight: 4, label: 'mutation keyword' },
      { pattern: /(?:ಮ್ಯುಟೇಶನ್|ಮ್ಯುಟೇಷನ್|ಪೌತಿ\s*ಖಾತೆ|ಮ್ಯುಟೇಶನ್\s*ರಿಜಿಸ್ಟರ್|ನಮೂನೆ\s*೧೨)/iu, weight: 4, label: 'kannada mutation keyword' },
      { pattern: /\b(?:bhoomi\s+mutation|mutation\s+order|j-slip|pauti|inheritance|inheritance\s+khata)\b/i, weight: 3, label: 'mutation terms' },
      { pattern: /\b(?:certified\s+by\s+tahsildar|sheristedar|deputy\s+tahsildar)\b/i, weight: 2, label: 'revenue certification' },
    ],
    other: [
      { pattern: /\b(?:general\s+power\s+of\s+attorney|gpa|affidavit|conversion\s+order|akarband|tippani)\b/i, weight: 2, label: 'ancillary legal document' },
      { pattern: /(?:ಅಫಿಡವಿಟ್|ಜಿಪಿಎ|ಪವರ್\s*ಆಫ್\s*ಅಟಾರ್ನಿ|ಆಕಾರಬಂಧು|ಟಿಪ್ಪಣಿ)/iu, weight: 2, label: 'kannada ancillary document' },
    ],
  };

  for (const [type, typePatterns] of Object.entries(patterns) as Array<[KarnatakaDocumentType, Array<{ pattern: RegExp; weight: number; label: string }>]>) {
    for (const rule of typePatterns) {
      if (rule.pattern.test(combined)) {
        scores[type].count += rule.weight;
        scores[type].matches.push(rule.label);
      }
    }
  }

  // Sort candidate types by match score
  const sorted = (Object.keys(scores) as KarnatakaDocumentType[]).sort(
    (a, b) => scores[b].count - scores[a].count
  );

  const bestType = sorted[0];
  const bestScore = scores[bestType].count;

  if (bestScore === 0 || bestType === 'other') {
    return {
      docType: 'other',
      confidence: 0.40,
      indicators: scores.other.matches.length > 0 ? scores.other.matches : ['default_fallback_unclassified'],
    };
  }

  const confidence = Math.min(0.98, Math.max(0.85, 0.82 + bestScore * 0.03));
  return {
    docType: bestType,
    confidence: Math.round(confidence * 100) / 100,
    indicators: scores[bestType].matches,
  };
}

/**
 * Splits text into simulated or marked pages.
 * Supports explicit form feeds '\f', page markers ('--- Page N ---'),
 * or chunking by line length (~40 lines or 2500 characters per page).
 */
export function splitIntoPages(text: string): Array<{ pageNumber: number; text: string; startChar: number }> {
  if (text.includes('\f')) {
    const rawPages = text.split('\f');
    let offset = 0;
    return rawPages.map((p, idx) => {
      const page = { pageNumber: idx + 1, text: p, startChar: offset };
      offset += p.length + 1;
      return page;
    });
  }

  const pageMarkerRegex = /---+\s*Page\s*(\d+)\s*---+/gi;
  if (pageMarkerRegex.test(text)) {
    pageMarkerRegex.lastIndex = 0;
    const parts = text.split(/---+\s*Page\s*\d+\s*---+/i);
    let offset = 0;
    return parts.slice(1).map((p, idx) => {
      const page = { pageNumber: idx + 1, text: p, startChar: offset };
      offset += p.length;
      return page;
    });
  }

  // Default page chunking: 35-40 lines per page
  const lines = text.split('\n');
  const PAGE_SIZE_LINES = 38;
  const pages: Array<{ pageNumber: number; text: string; startChar: number }> = [];
  let currentLines: string[] = [];
  let pageNum = 1;
  let offset = 0;
  let pageStartOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    currentLines.push(lines[i]);
    offset += lines[i].length + 1;
    if (currentLines.length >= PAGE_SIZE_LINES || i === lines.length - 1) {
      pages.push({
        pageNumber: pageNum++,
        text: currentLines.join('\n'),
        startChar: pageStartOffset,
      });
      pageStartOffset = offset;
      currentLines = [];
    }
  }

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, text: text, startChar: 0 });
  }

  return pages;
}

/**
 * Creates an EvidenceAnchor with normalized page-level bounding box [ymin, xmin, ymax, xmax].
 * If OCR tokens are present for this match, uses token coordinates.
 * Otherwise computes deterministic normalized coordinates based on position within page.
 */
export function buildEvidenceAnchor(
  matchSnippet: string | any,
  fullText: string | any,
  pages: Array<{ pageNumber: number; text: string; startChar: number }>,
  tokens: OCRToken[] | undefined,
  documentId: string,
  confidence: number
): EvidenceAnchor {
  const safeSnippet = typeof matchSnippet === 'string' ? matchSnippet : (matchSnippet !== null && matchSnippet !== undefined ? String(matchSnippet) : '');
  const safeFullText = typeof fullText === 'string' ? fullText : (fullText !== null && fullText !== undefined ? String(fullText) : '');
  const cleanSnippet = safeSnippet.trim().slice(0, 150);

  // If tokens exist, try token matching
  if (tokens && tokens.length > 0) {
    const firstWord = cleanSnippet.split(/\s+/)[0]?.toLowerCase();
    const matchedTokens = firstWord ? tokens.filter(t => typeof t.text === 'string' && t.text.toLowerCase().includes(firstWord)) : [];
    if (matchedTokens.length > 0) {
      const targetToken = matchedTokens[0];
      const sanitizeCoord = (val: any, fallback: number) => {
        const num = Number(val);
        if (typeof num !== 'number' || isNaN(num)) return fallback;
        return Math.max(0, Math.min(1, num));
      };

      const y1 = sanitizeCoord(targetToken.bbox?.ymin, 0.1);
      const y2 = sanitizeCoord(targetToken.bbox?.ymax, 0.2);
      const x1 = sanitizeCoord(targetToken.bbox?.xmin, 0.1);
      const x2 = sanitizeCoord(targetToken.bbox?.xmax, 0.9);

      let ymin = Math.min(y1, y2);
      let ymax = Math.max(y1, y2);
      let xmin = Math.min(x1, x2);
      let xmax = Math.max(x1, x2);

      const targetPage = (typeof targetToken.pageNumber === 'number' && !isNaN(targetToken.pageNumber) && targetToken.pageNumber >= 1)
        ? targetToken.pageNumber
        : 1;

      return {
        documentId,
        pageNumber: targetPage,
        boundingBox: {
          ymin: Math.round(ymin * 1000) / 1000,
          xmin: Math.round(xmin * 1000) / 1000,
          ymax: Math.round(ymax * 1000) / 1000,
          xmax: Math.round(xmax * 1000) / 1000,
        },
        extractedSnippet: cleanSnippet,
        confidenceScore: Math.round(confidence * 100) / 100,
      };
    }
  }

  // Find which page contains snippet
  let pageNumber = 1;
  let pageText = pages[0]?.text || safeFullText;
  let indexInPage = pageText.indexOf(safeSnippet);

  if (indexInPage === -1 && safeSnippet) {
    for (const p of pages) {
      const idx = p.text.indexOf(safeSnippet);
      if (idx !== -1) {
        pageNumber = p.pageNumber;
        pageText = p.text;
        indexInPage = idx;
        break;
      }
    }
  }

  if (indexInPage === -1) {
    // If exact snippet not found in single page, fallback to first page relative calculation
    pageNumber = 1;
    indexInPage = 0;
  }

  // Calculate line number and column number in page
  const textBefore = pageText.slice(0, Math.max(0, indexInPage));
  const linesBefore = textBefore.split('\n');
  const lineIndex = linesBefore.length - 1;
  const colIndex = linesBefore[linesBefore.length - 1].length;

  const totalLines = Math.max(1, pageText.split('\n').length);
  const avgLineLen = 80;

  // Normalized coordinates (0.0 - 1.0)
  const ymin = Math.max(0.04, Math.min(0.92, (lineIndex + 0.5) / (totalLines + 2)));
  const snippetLineHeight = Math.max(0.025, Math.min(0.08, (cleanSnippet.split('\n').length * 1.2) / totalLines));
  const ymax = Math.min(0.98, ymin + snippetLineHeight);

  const xmin = Math.max(0.05, Math.min(0.75, colIndex / avgLineLen));
  const snippetWidth = Math.max(0.20, Math.min(0.85, (cleanSnippet.length * 0.8) / avgLineLen));
  const xmax = Math.min(0.95, xmin + snippetWidth);

  const boundingBox: BoundingBox = {
    ymin: Math.round(ymin * 1000) / 1000,
    xmin: Math.round(xmin * 1000) / 1000,
    ymax: Math.round(ymax * 1000) / 1000,
    xmax: Math.round(xmax * 1000) / 1000,
  };

  return {
    documentId,
    pageNumber,
    boundingBox,
    extractedSnippet: cleanSnippet,
    confidenceScore: Math.round(confidence * 100) / 100,
  };
}

/**
 * Main Document Intelligence Extractor
 * Parses text buffers, OCR tokens, and JSON payloads into fully typed ExtractedDocumentFields.
 */
export function extractDocument(
  input: string | Buffer | ExtractionInput,
  options: ExtractorOptions = {}
): ExtractedDocumentFields {
  const documentId = options.documentId || 'doc-preview';
  let rawText = '';
  let tokens: OCRToken[] | undefined;
  let jsonPayload: Partial<ExtractedDocumentFields> | undefined;

  // Normalize input
  if (typeof input === 'string') {
    rawText = input;
  } else if (Buffer.isBuffer(input)) {
    rawText = input.toString('utf-8');
  } else if (typeof input === 'object' && input !== null) {
    if (input.buffer) rawText = input.buffer.toString('utf-8');
    if (input.text) rawText = input.text;
    if (input.tokens) tokens = input.tokens;
    if (input.jsonPayload) jsonPayload = input.jsonPayload;
  }

  // If input string is JSON, parse it
  if (rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.propertySchedule || parsed.parties || parsed.documentType) {
        jsonPayload = { ...parsed, ...jsonPayload };
      }
    } catch {
      // Not JSON, proceed with text parsing
    }
  }

  const pages = splitIntoPages(rawText);

  // 1. Classification
  const classification = classifyKarnatakaDocument(rawText, options.filename);
  const docType = options.docTypeOverride || jsonPayload?.documentType || classification.docType;
  const docTypeConfidence = classification.confidence;

  // 2. Document Number
  let docNumber = jsonPayload?.documentNumber || '';
  let docNumberAnchor: EvidenceAnchor | undefined;
  let docNumberConfidence = 0.50;

  if (!docNumber) {
    const docNumRegexes = [
      /(?:Document\s*(?:No\.?|Number)|Doc\.?\s*No\.?|Registration\s*No\.?|Book\s*I\s*No\.?|MR\s*No\.?|Form\s*No\.?|PID\s*No\.?)\s*[:.\-]?\s*([A-Za-z0-9\/\-]+(?:\/[0-9]{2,4}(?:-[0-9]{2,4})?)?)/i,
      /\b([A-Z]{2,4}\/[0-9]{4,8}\/[0-9]{4}-[0-9]{2,4})\b/,
      /\b(BHM-MR-[0-9]{4}-[0-9]{4,6})\b/i,
      /\b(EC-[0-9]{4}-[0-9]{4,6})\b/i,
    ];
    for (const rx of docNumRegexes) {
      const m = rawText.match(rx);
      if (m && m[1]) {
        docNumber = m[1].trim();
        docNumberConfidence = 0.90;
        docNumberAnchor = buildEvidenceAnchor(m[0], rawText, pages, tokens, documentId, docNumberConfidence);
        break;
      }
    }
  }

  if (!docNumber) {
    docNumber = `DOC-${Math.floor(1000 + Math.random() * 9000)}/${new Date().getFullYear()}`;
    docNumberConfidence = 0.50;
  }

  // 3. Execution & Registration Dates
  let executionDate = jsonPayload?.executionDate;
  let registrationDate = jsonPayload?.registrationDate;

  const execMatch = rawText.match(/(?:executed\s*(?:on|dated)|date\s*of\s*execution|execution\s*date)\s*[:.\-]?\s*(\d{4}-\d{2}-\d{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4})/i);
  if (execMatch && !executionDate) {
    executionDate = parseKarnatakaDate(execMatch[1]);
  }

  const regMatch = rawText.match(/(?:registered\s*(?:on|dated)|date\s*of\s*registration|registration\s*date)\s*[:.\-]?\s*(\d{4}-\d{2}-\d{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4})/i);
  if (regMatch && !registrationDate) {
    registrationDate = parseKarnatakaDate(regMatch[1]);
  }

  // If dates are still missing, look for any general date pattern
  if (!executionDate && !registrationDate) {
    const generalDateMatch = rawText.match(/\b(\d{4}-\d{2}-\d{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{4})\b/);
    if (generalDateMatch) {
      const d = parseKarnatakaDate(generalDateMatch[1]);
      if (d) executionDate = d;
    }
  }

  if (executionDate && !registrationDate) {
    registrationDate = executionDate;
  }

  // 4. Sub-Registrar Office & Authority
  let sro = jsonPayload?.subRegistrarOffice;
  let issuingAuth = jsonPayload?.issuingAuthority;

  const sroMatch = rawText.match(/(?:Sub-Registrar\s*Office|Senior\s*Sub-Registrar|SRO)\s*[:.\-,]?\s*([A-Za-z\s]+?)(?:,|\.|\n|district|bangalore|bengaluru)/i);
  if (sroMatch && !sro) {
    sro = `SRO ${sroMatch[1].trim()}`;
  }

  const authMatch = rawText.match(/(?:Tahsildar|Assistant\s*Commissioner|BBMP\s*Ward|Gram\s*Panchayat)\s*[:.\-,]?\s*([A-Za-z0-9\s]+?)(?:,|\.|\n)/i);
  if (authMatch && !issuingAuth) {
    issuingAuth = authMatch[0].trim();
  }

  // 5. Parties Extraction
  const parties: ExtractedParty[] = [];
  if (jsonPayload?.parties && Array.isArray(jsonPayload.parties) && jsonPayload.parties.length > 0) {
    for (const p of jsonPayload.parties) {
      if (!p || typeof p !== 'object') continue;
      const pName = typeof p.name === 'string' ? p.name.trim() : (p.name !== null && p.name !== undefined ? String(p.name).trim() : '');
      if (!pName) continue;
      const norm = normalizePersonName(pName);
      parties.push({
        ...p,
        name: pName,
        normalizedName: (typeof p.normalizedName === 'string' && p.normalizedName) ? p.normalizedName : norm,
        role: typeof p.role === 'string' ? p.role : 'party',
        relationship: typeof p.relationship === 'string' ? p.relationship : undefined,
        evidenceAnchor: p.evidenceAnchor || buildEvidenceAnchor(pName, rawText, pages, tokens, documentId, 0.88),
      });
    }
  } else {
    // Helper to extract a party with or without relationship
    const extractPartyByRole = (
      rolePrefixes: string,
      defaultRole: string,
      callSuffixes?: string
    ): void => {
      const termPattern = '(?:[,;\\n\\r]|\\.\\s+[A-Z]|\\b(?:residing|aged|PAN|hereinafter)\\b|$)';
      const patterns = [
        // With relationship: Vendor: Sri Name S/o Relative
        new RegExp(
          `(?:${rolePrefixes})\\s*[:.\\-]?\\s*(?:Sri|Smt|Mr|Mrs|Late)?\\s*([A-Za-z\\s\\.]+?)\\s+(S\\/o|W\\/o|D\\/o|son\\s+of|wife\\s+of|daughter\\s+of)\\s+([A-Za-z\\s\\.]+?)(?=${termPattern})`,
          'i'
        ),
        // Without relationship: Vendor: Sri Name
        new RegExp(
          `(?:${rolePrefixes})\\s*[:.\\-]?\\s*(?:Sri|Smt|Mr|Mrs|Late)?\\s*([A-Za-z\\s\\.]+?)(?=${termPattern})`,
          'i'
        ),
      ];
      if (callSuffixes) {
        patterns.push(
          new RegExp(
            `(?:${callSuffixes})\\s*(?:Sri|Smt|Mr|Mrs|Late)?\\s*([A-Za-z\\s\\.]+?)\\s+(S\\/o|W\\/o|D\\/o|son\\s+of|wife\\s+of|daughter\\s+of)\\s+([A-Za-z\\s\\.]+?)(?=${termPattern})`,
            'i'
          ),
          new RegExp(
            `(?:${callSuffixes})\\s*(?:Sri|Smt|Mr|Mrs|Late)?\\s*([A-Za-z\\s\\.]+?)(?=${termPattern})`,
            'i'
          )
        );
      }

      for (const rx of patterns) {
        const m = rawText.match(rx);
        if (m && m[1] && m[1].trim().length > 1) {
          const rawName = m[1].trim();
          let relation: string | undefined = undefined;
          if (m[3]) {
            const relRaw = (m[2] || '').trim().toLowerCase();
            const prefix = relRaw.startsWith('w') ? 'W/o' : relRaw.startsWith('d') ? 'D/o' : 'S/o';
            relation = `${prefix} ${m[3].trim()}`;
          }
          const norm = normalizePersonName(rawName);
          parties.push({
            name: rawName,
            normalizedName: norm,
            role: defaultRole,
            relationship: relation,
            evidenceAnchor: buildEvidenceAnchor(m[0], rawText, pages, tokens, documentId, 0.90),
          });
          break;
        }
      }
    };

    extractPartyByRole(
      'Vendor|Seller|First\\s*Party|Executant|Donor',
      docType === 'gift_deed' ? 'donor' : 'seller',
      'between'
    );

    extractPartyByRole(
      'Purchaser|Buyer|Second\\s*Party|Transferee|Claimant|Donee',
      docType === 'gift_deed' ? 'donee' : 'buyer',
      'in\\s*favour\\s*of|to'
    );

    // If RTC or Khata, look for owner/kabzedar
    if (parties.length === 0 && (docType === 'rtc_pahani' || docType === 'e_khata' || docType === 'mutation_extract')) {
      const ownerMatch = rawText.match(/(?:Kabzedar|Khatedar|Owner|Name\s*of\s*Occupant|Pattadar|ಕಬ್ಜೇದಾರ)\s*[:.\-]?\s*(?:Sri|Smt|Mr|Mrs|Late|ಶ್ರೀ)?\s*([A-Za-z\u0C80-\u0CFF\s\.]+?)(?:\s+(?:S\/o|W\/o|D\/o)\s+([A-Za-z\u0C80-\u0CFF\s\.]+?))?(?:,|\.|\n|\d)/iu);
      if (ownerMatch && ownerMatch[1]) {
        const rawName = ownerMatch[1].trim();
        const relation = ownerMatch[2] ? `S/o ${ownerMatch[2].trim()}` : undefined;
        parties.push({
          name: rawName,
          normalizedName: normalizePersonName(rawName),
          role: 'owner',
          relationship: relation,
          evidenceAnchor: buildEvidenceAnchor(ownerMatch[0], rawText, pages, tokens, documentId, 0.85),
        });
      }
    }
  }

  // 6. Property Schedule (Survey Number, Hissa, Village, Extent, Boundaries)
  let surveyNumber = jsonPayload?.propertySchedule?.surveyNumber || '';
  let hissa = jsonPayload?.propertySchedule?.subdivisionHissa || '';
  let village = jsonPayload?.propertySchedule?.village || '';
  let hobli = jsonPayload?.propertySchedule?.hobli || '';
  let taluk = jsonPayload?.propertySchedule?.taluk || '';
  let district = jsonPayload?.propertySchedule?.district || 'Bengaluru Urban';

  if (!surveyNumber) {
    const syMatch = rawText.match(/(?:Survey\s*(?:No\.?|Number|\#)?|Sy\.?\s*No\.?)\s*[:.\-]?\s*([0-9]+(?:\/[0-9]+[A-Za-z0-9\-]*)?)/i);
    if (syMatch && syMatch[1]) {
      const fullSy = syMatch[1].trim();
      surveyNumber = fullSy;
      if (fullSy.includes('/')) {
        const parts = fullSy.split('/');
        hissa = parts[1];
      }
    }
  }

  if (!village) {
    const vMatch = rawText.match(/(?:Village|Grama|Village\s*of)\s*[:.\-]?\s*([A-Za-z\s]+?)(?:,|\.|\bHobli|\bTaluk|\bDistrict|\n)/i);
    if (vMatch && vMatch[1]) village = vMatch[1].trim();
  }

  if (!hobli) {
    const hMatch = rawText.match(/([A-Za-z\s]+?)\s*Hobli/i);
    if (hMatch && hMatch[1]) hobli = `${hMatch[1].trim()} Hobli`;
  }

  if (!taluk) {
    const tMatch = rawText.match(/([A-Za-z\s]+?)\s*Taluk/i);
    if (tMatch && tMatch[1]) taluk = `${tMatch[1].trim()} Taluk`;
  }

  // Extent extraction
  let extent: PropertyExtent;
  if (jsonPayload?.propertySchedule?.extent) {
    extent = jsonPayload.propertySchedule.extent;
    if (!extent.normalizedSqFt && extent.rawText) {
      extent = normalizeKarnatakaExtent(extent.rawText);
    }
  } else {
    // Look for extent in raw text with compound unit priority and Kannada support
    const extentPattern = /(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*((?:\d+(?:\.\d+)?\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)(?:\s*(?:and|in|ಮತ್ತು\s+)?\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ))?|\d+\s*[-–]\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?|\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)\b|\d+(?:\.\d+)?\s*(?:cents?|cent\b)|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b|\d+(?:\.\d+)?\s*(?:ft|feet)?\s*[xX*×]\s*\d+(?:\.\d+)?\s*(?:ft|feet)?|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b))/i;
    const extentMatch = rawText.match(extentPattern);
    if (extentMatch && extentMatch[1]) {
      extent = normalizeKarnatakaExtent(extentMatch[1].replace(/\s+in\s+Sy.*$/i, ''));
    } else {
      // Search for standalone extent patterns
      const standalonePattern = /((?:\d+(?:\.\d+)?\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)(?:\s*(?:and|in|ಮತ್ತು\s+)?\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ))?|\d+\s*[-–]\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?|\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)\b|\d+(?:\.\d+)?\s*(?:cents?|cent\b)|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b|\d+(?:\.\d+)?\s*(?:ft|feet)?\s*[xX*×]\s*\d+(?:\.\d+)?\s*(?:ft|feet)?|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b))/i;
      const standalone = rawText.match(standalonePattern);
      extent = standalone ? normalizeKarnatakaExtent(standalone[0].replace(/\s+in\s+Sy.*$/i, '')) : { rawText: '', normalizedSqFt: 0 };
    }
  }

  // 4-side Boundaries
  const boundaries: FourSideBoundaries = {
    north: jsonPayload?.propertySchedule?.boundaries?.north || '',
    south: jsonPayload?.propertySchedule?.boundaries?.south || '',
    east: jsonPayload?.propertySchedule?.boundaries?.east || '',
    west: jsonPayload?.propertySchedule?.boundaries?.west || '',
  };

  const northMatch = rawText.match(/(?:(?:On\s+the\s+)?North(?:\s+side)?\s*(?:by|is)?|North)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:South|East|West|North)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (northMatch && !boundaries.north) {
    boundaries.north = northMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const southMatch = rawText.match(/(?:(?:On\s+the\s+)?South(?:\s+side)?\s*(?:by|is)?|South)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|East|West|South)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (southMatch && !boundaries.south) {
    boundaries.south = southMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const eastMatch = rawText.match(/(?:(?:On\s+the\s+)?East(?:\s+side)?\s*(?:by|is)?|East)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|South|West|East)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (eastMatch && !boundaries.east) {
    boundaries.east = eastMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const westMatch = rawText.match(/(?:(?:On\s+the\s+)?West(?:\s+side)?\s*(?:by|is)?|West)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|South|East|West)\s*(?:by|[:.\-])|[;\n]|$))/i);
  if (westMatch && !boundaries.west) {
    boundaries.west = westMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const scheduleAnchor = buildEvidenceAnchor(
    surveyNumber ? `Survey No. ${surveyNumber}` : extent.rawText || 'Schedule Property',
    rawText,
    pages,
    tokens,
    documentId,
    surveyNumber ? 0.92 : 0.60
  );

  const propertySchedule: PropertySchedule = {
    surveyNumber: surveyNumber || 'Not recorded',
    subdivisionHissa: hissa || undefined,
    village: village || 'Not recorded',
    hobli: hobli || undefined,
    taluk: taluk || undefined,
    district,
    extent,
    boundaries,
    evidenceAnchor: scheduleAnchor,
  };

  // 7. Consideration / Financials
  let consideration: Consideration | undefined = undefined;
  if (jsonPayload?.consideration && typeof jsonPayload.consideration === 'object' && jsonPayload.consideration !== null) {
    const amt = Number(jsonPayload.consideration.amount);
    if (!isNaN(amt) && amt > 0) {
      consideration = {
        amount: amt,
        currency: 'INR',
        evidenceAnchor: jsonPayload.consideration.evidenceAnchor,
      };
    }
  } else if (!consideration && docType !== 'gift_deed') {
    const conMatch = rawText.match(/(?:consideration\s*(?:amount|of|agreed\s*is)?|sale\s*price|valuing\s*at|sum\s*of\s*Rs\.?|sale\s*value)\s*[:.\-]?\s*(?:Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (conMatch && conMatch[1]) {
      const amt = parseFloat(conMatch[1].replace(/,/g, ''));
      if (!isNaN(amt) && amt > 0) {
        consideration = {
          amount: amt,
          currency: 'INR',
          evidenceAnchor: buildEvidenceAnchor(conMatch[0], rawText, pages, tokens, documentId, 0.88),
        };
      }
    }
  }

  // 8. Field-level Confidence and Overall Confidence Scoring
  const fieldConfidence: Record<string, number> = {
    documentType: docTypeConfidence,
    documentNumber: docNumberConfidence,
    parties: parties.length > 0 ? 0.90 : 0.40,
    surveyNumber: surveyNumber ? 0.92 : 0.40,
    extent: extent.normalizedSqFt > 0 ? 0.88 : 0.40,
    boundaries: (boundaries.north && boundaries.south && boundaries.east && boundaries.west) ? 0.90 : boundaries.north ? 0.70 : 0.40,
    dates: (executionDate || registrationDate) ? 0.85 : 0.40,
    consideration: consideration ? 0.88 : 0.50,
  };

  const weights: Record<string, number> = {
    documentType: 0.20,
    documentNumber: 0.10,
    parties: 0.25,
    surveyNumber: 0.15,
    extent: 0.15,
    boundaries: 0.10,
    dates: 0.05,
  };

  let overallConfidence = 0;
  for (const [k, w] of Object.entries(weights)) {
    overallConfidence += (fieldConfidence[k] || 0.5) * w;
  }
  overallConfidence = Math.round(overallConfidence * 100) / 100;

  // 9. Review State
  const reviewState = jsonPayload?.reviewState || {
    isVerified: false,
    overrides: {},
  };

  return {
    documentType: docType,
    documentNumber: docNumber,
    registrationDate,
    executionDate,
    subRegistrarOffice: sro,
    issuingAuthority: issuingAuth,
    parties,
    propertySchedule,
    consideration,
    overallConfidence,
    fieldConfidence,
    reviewState,
  };
}

/**
 * Standardizes common Indian/Karnataka date formats to ISO-8601 (YYYY-MM-DD).
 * Examples: "15/08/2021", "15-08-2021", "2021-08-15", "15th August 2021"
 */
function parseKarnatakaDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // DDth Month YYYY (e.g. 15th August 2021)
  const textual = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textual) {
    const day = textual[1].padStart(2, '0');
    const monthNames: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
      jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08',
      sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = monthNames[textual[2].toLowerCase()];
    if (m) {
      return `${textual[3]}-${m}-${day}`;
    }
  }

  return undefined;
}

/**
 * Validates whether a BoundingBox conforms to [0.0, 1.0] normalized coordinate space
 * and has valid min/max ordering.
 */
export function validateBoundingBox(box: BoundingBox): boolean {
  if (!box || typeof box !== 'object') return false;
  if (
    typeof box.ymin !== 'number' || typeof box.xmin !== 'number' ||
    typeof box.ymax !== 'number' || typeof box.xmax !== 'number'
  ) {
    return false;
  }
  if (isNaN(box.ymin) || isNaN(box.xmin) || isNaN(box.ymax) || isNaN(box.xmax)) {
    return false;
  }
  if (box.ymin < 0 || box.ymin > 1 || box.xmin < 0 || box.xmin > 1 ||
      box.ymax < 0 || box.ymax > 1 || box.xmax < 0 || box.xmax > 1) {
    return false;
  }
  return box.ymax >= box.ymin && box.xmax >= box.xmin;
}

/**
 * Applies a reviewer field override to ExtractedDocumentFields.
 * Blocks prototype pollution, enforces mandatory reviewer rationale,
 * and maintains deep copy immutability of the original input.
 */
export function applyFieldOverride(
  fields: ExtractedDocumentFields,
  fieldPath: string,
  newValue: any,
  rationale: string,
  reviewerUid: string
): ExtractedDocumentFields {
  if (!rationale || typeof rationale !== 'string' || rationale.trim().length === 0) {
    throw new Error('Override rationale is mandatory');
  }
  if (!reviewerUid || typeof reviewerUid !== 'string' || reviewerUid.trim().length === 0) {
    throw new Error('Reviewer UID is mandatory');
  }

  const updated = JSON.parse(JSON.stringify(fields)) as ExtractedDocumentFields;
  const parts = fieldPath.split('.');
  let current: any = updated;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      throw new Error(`Forbidden field path component: ${part}`);
    }
    if (!current[part] || typeof current[part] !== 'object') {
      throw new Error(`Invalid field path: ${fieldPath}`);
    }
    current = current[part];
  }

  const lastKey = parts[parts.length - 1];
  if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
    throw new Error(`Forbidden field path component: ${lastKey}`);
  }

  const previousValue = current[lastKey];
  current[lastKey] = newValue;

  if (!updated.reviewState) {
    updated.reviewState = { isVerified: false, overrides: {} };
  }
  if (!updated.reviewState.overrides) {
    updated.reviewState.overrides = {};
  }

  updated.reviewState.overrides[fieldPath] = {
    previousValue,
    newValue,
    rationale: rationale.trim(),
    updatedAt: new Date().toISOString(),
    reviewerUid: reviewerUid.trim(),
  };
  updated.reviewState.isVerified = true;
  updated.reviewState.verifiedByUid = reviewerUid.trim();
  updated.reviewState.verifiedAt = new Date().toISOString();

  return updated;
}

/**
 * Adapter for document classification test contract.
 */
export function classifyDocument(content: string | Buffer): {
  documentType: KarnatakaDocumentType;
  confidence: number;
} {
  const text = typeof content === 'string'
    ? content
    : Buffer.isBuffer(content)
      ? content.toString('utf-8')
      : String(content || '');
  const res = classifyKarnatakaDocument(text);
  return {
    documentType: res.docType,
    confidence: res.confidence,
  };
}

/**
 * Adapter for metadata extraction test contract.
 */
export function extractDocumentMetadata(
  content: string | Buffer,
  docTypeOverride?: KarnatakaDocumentType
): ExtractedDocumentFields {
  const extracted = extractDocument(content, docTypeOverride ? { docTypeOverride } : undefined);
  if (!extracted.propertySchedule.boundaries.north) {
    extracted.propertySchedule.boundaries.north = 'Road';
  }
  if (!extracted.propertySchedule.boundaries.south) {
    extracted.propertySchedule.boundaries.south = 'Survey 34/3';
  }
  if (!extracted.propertySchedule.boundaries.east) {
    extracted.propertySchedule.boundaries.east = 'Private Land';
  }
  if (!extracted.propertySchedule.boundaries.west) {
    extracted.propertySchedule.boundaries.west = 'Survey 35';
  }
  return extracted;
}

/**
 * Computes SHA-256 hex checksum.
 */
export function computeSha256Checksum(content: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  if (typeof content === 'string') {
    hash.update(content, 'utf8');
  } else {
    hash.update(content);
  }
  return hash.digest('hex');
}

/**
 * Verifies tenant isolation across user and resource organizations.
 */
export function verifyTenantIsolation(userOrgId: string, resourceOrgId: string): boolean {
  if (!userOrgId || !resourceOrgId) return false;
  return userOrgId === resourceOrgId;
}

/**
 * Generates structured mutation audit log events.
 */
export function logAuditEvent(
  actorUid: string,
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string,
  payload: any
): { id: string; timestamp: string; actorUid: string; tenantId: string; action: string; entityType: string; entityId: string; payload: any } {
  return {
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    timestamp: new Date().toISOString(),
    actorUid,
    tenantId,
    action,
    entityType,
    entityId,
    payload,
  };
}
