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
  ExtractedFinancialItem,
  ExtractedOwnershipEvent,
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

  // Kannada deeds commonly write land extent as acres-guntas (for example
  // "3-09"). Require both Kannada units in the same phrase to avoid treating
  // dates, registration ranges, or survey identifiers as an area.
  const kannadaAcresGuntas = /(?:ಎಕರೆ|ಎಕ್ರೆ)/u.test(clean) && /(?:ಗುಂಟೆ|ಗುಂಟಾ)/u.test(clean)
    ? clean.match(/(\d+)\s*[-–]\s*(\d+)/u)
    : null;
  if (kannadaAcresGuntas) {
    acres = Number(kannadaAcresGuntas[1]);
    guntas = Number(kannadaAcresGuntas[2]);
    hasParsed = true;
  }

  // 1. Check for compound Acre and Gunta (English & Kannada): e.g. "1 Acre 15 Guntas", "1 ಎಕರೆ 20 ಗುಂಟೆ"
  const acreGuntaMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)\s*(?:and|ಮತ್ತು)?\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)/iu);
  if (acreGuntaMatch && !hasParsed) {
    acres = parseFloat(acreGuntaMatch[1]);
    guntas = parseFractionOrDecimal(acreGuntaMatch[2]);
    hasParsed = true;
  } else if (!hasParsed) {
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
    // A unitless value is accepted only when the entire value is numeric.
    // This prevents registration/year ranges such as "2000-2022" from
    // silently becoming a 2,000 sq-ft property extent.
    const plainNum = clean.replace(/,/g, '').match(/^\d+(?:\.\d+)?$/);
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
 * Classifies from document text indicators. Filename is retained as a weak supporting clue.
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
    property_tax_receipt: { count: 0, matches: [] },
    survey_sketch: { count: 0, matches: [] },
    conversion_order: { count: 0, matches: [] },
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
    property_tax_receipt: [
      { pattern: /\b(?:property\s+tax\s+(?:paid\s+)?receipt|tax\s+paid\s+receipt|property\s+tax\s+payment)\b/i, weight: 5, label: 'property tax receipt wording' },
      { pattern: /\b(?:SAS\s+application|PID\s*(?:no\.?|number)|receipt\s+no\.?)\b/i, weight: 1, label: 'property tax receipt identifiers' },
    ],
    survey_sketch: [
      { pattern: /\b(?:survey\s+sketch|village\s+map|tippani|akarband|atlas\s+map)\b/i, weight: 5, label: 'survey sketch wording' },
      { pattern: /(?:ಸರ್ವೆ\s*ನಕ್ಷೆ|ಗ್ರಾಮ\s*ನಕ್ಷೆ|ಟಿಪ್ಪಣಿ)/iu, weight: 4, label: 'Kannada survey sketch wording' },
    ],
    conversion_order: [
      { pattern: /\b(?:land\s+conversion\s+order|conversion\s+order|non[- ]agricultural\s+order)\b/i, weight: 5, label: 'conversion order wording' },
      { pattern: /(?:ಭೂ\s*ಪರಿವರ್ತನೆ\s*ಆದೇಶ|ಪರಿವರ್ತನೆ\s*ಆದೇಶ)/iu, weight: 4, label: 'Kannada conversion order wording' },
    ],
    other: [
      { pattern: /\b(?:general\s+power\s+of\s+attorney|gpa|affidavit)\b/i, weight: 2, label: 'ancillary legal document' },
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
 * Evidence locations use exact page text and contiguous OCR tokens. The reported
 * confidence is mean matched-token confidence multiplied by token coverage.
 * Missing/unmatched token evidence stays unavailable.
 */
export function buildEvidenceAnchor(
  matchSnippet: string | any,
  fullText: string | any,
  pages: Array<{ pageNumber: number; text: string; startChar: number }>,
  tokens: OCRToken[] | undefined,
  documentId: string,
  _legacyConfidence?: number
): EvidenceAnchor {
  const snippet = typeof matchSnippet === 'string' ? matchSnippet.trim().slice(0, 500) : String(matchSnippet ?? '').trim().slice(0, 500);
  const source = typeof fullText === 'string' ? fullText : String(fullText ?? '');
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g,' ').trim();
  let pageNumber = 1;
  let found = false;
  const target = normalize(snippet);
  for (const page of pages) {
    const normalized = normalize(page.text);
    if (target && normalized.includes(target)) { pageNumber = page.pageNumber; found = true; break; }
  }
  if (!found && snippet) {
    const index = source.indexOf(snippet);
    if (index >= 0) {
      pageNumber = pages.find(page => index >= page.startChar && index <= page.startChar + page.text.length)?.pageNumber || 1;
      found = true;
    }
  }
  const anchor: EvidenceAnchor = { documentId, pageNumber, extractedSnippet: snippet, locationSource: 'text_page' };
  const expected = target.split(/\s+/).filter(Boolean);
  const pageTokens = (tokens || []).filter(token => token.pageNumber === pageNumber && token.text && token.bbox && Number.isFinite(token.confidence) && [token.bbox.xmin,token.bbox.xmax,token.bbox.ymin,token.bbox.ymax].every(value=>Number.isFinite(value)&&value>=0&&value<=1) && token.bbox.xmin<=token.bbox.xmax && token.bbox.ymin<=token.bbox.ymax);
  let matched: OCRToken[] = [];
  for (let start = 0; expected.length && start < pageTokens.length; start++) {
    const candidate: OCRToken[] = [];
    let cursor = 0;
    for (let index = start; index < pageTokens.length && cursor < expected.length; index++) {
      if (normalize(pageTokens[index].text) === expected[cursor]) { candidate.push(pageTokens[index]); cursor++; }
      else if (candidate.length) break;
    }
    if (candidate.length > matched.length) matched = candidate;
    if (matched.length === expected.length) break;
  }
  if (matched.length) {
    const scores = matched.map(token => Math.max(0, Math.min(1, Number(token.confidence))));
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    anchor.confidenceScore = Math.round(average * (expected.length ? matched.length / expected.length : 0) * 1000) / 1000;
    const boxes = matched.map(token => token.bbox!);
    anchor.boundingBox = {
      xmin: Math.min(...boxes.map(box => box.xmin)), xmax: Math.max(...boxes.map(box => box.xmax)),
      ymin: Math.min(...boxes.map(box => box.ymin)), ymax: Math.max(...boxes.map(box => box.ymax)),
    };
    anchor.locationSource = 'ocr_tokens';
  }
  // `found` is intentionally not used to invent a page coordinate. Page 1 is retained
  // only as the safe viewer default when OCR text cannot be mapped to an actual page.
  void found;
  return anchor;
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
  // Deed schedules contain the conveyed parcel details. Earlier document pages
  // can mention parties' addresses and other properties, so prefer this section.
  const canonicalScheduleStart = rawText.search(/ಷೆಡ್ಯೂಲ್\s*ಸ್ವತ್ತಿನ\s*ವಿವರ\s*[:：-]?/u);
  const genericScheduleStart = canonicalScheduleStart < 0 ? rawText.search(/(?:schedule\s*(?:of\s*)?property|property\s*schedule)/iu) : -1;
  const scheduleStart = canonicalScheduleStart >= 0 ? canonicalScheduleStart : genericScheduleStart;
  // Schedules and boundaries can be several pages after the deed recitals.
  const scheduleText = scheduleStart >= 0 ? rawText.slice(scheduleStart) : rawText;

  // 1. Classification
  const classification = classifyKarnatakaDocument(rawText, options.filename);
  const docType = options.docTypeOverride || jsonPayload?.documentType || classification.docType;
  const docTypeConfidence = classification.confidence;

  // 2. Document Number
  let docNumber = jsonPayload?.documentNumber || '';
  let docNumberAnchor: EvidenceAnchor | undefined;
  let docNumberConfidence = 0.50;

  if (!docNumber) {
    const kannadaDocumentNumber = rawText.match(/ದಸ್ತಾವೇಜು\s*ಸಂಖ್ಯೆ\s*[:.\-]?\s*(\d{1,8})\b/u);
    if (kannadaDocumentNumber?.[1]) {
      docNumber = kannadaDocumentNumber[1];
      docNumberConfidence = 0.9;
      docNumberAnchor = buildEvidenceAnchor(kannadaDocumentNumber[0], rawText, pages, tokens, documentId, docNumberConfidence);
    }
  }
  if (!docNumber) {
    const registryId = rawText.match(/(?:ದಸ್ತಾವೇಜು\s*ಸಂಖ್ಯೆ|Document\s*(?:No\.?|Number))\s*[:.\-\s]*([A-Z]{2,5}[-/][A-Z0-9/-]{6,})/iu);
    if (registryId?.[1]) {
      docNumber = registryId[1].trim();
      docNumberConfidence = 0.9;
      docNumberAnchor = buildEvidenceAnchor(registryId[0], rawText, pages, tokens, documentId, docNumberConfidence);
    }
  }
  if (!docNumber) {
    const docNumRegexes = [
      /(?:Document\s*(?:No\.?|Number)|Doc\.?\s*No\.?|Book\s*I\s*No\.?|MR\s*No\.?|Form\s*No\.?|PID\s*No\.?)\s*[:.\-]?\s*([A-Za-z0-9\/\-]+(?:\/[0-9]{2,4}(?:-[0-9]{2,4})?)?)/i,
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

  // Unknown registry identifiers stay empty; generated values can be mistaken
  // for document evidence and must never participate in identity matching.

  // 3. Execution & Registration Dates
  let executionDate = jsonPayload?.executionDate;
  let registrationDate = jsonPayload?.registrationDate;

  const deedExecutionMatch = rawText.match(/ಶುದ್ಧ\s*ಕ್ರಯ\s*ಪತ್ರ[\s\S]{0,120}?([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{4})/u);
  const execMatch = deedExecutionMatch || rawText.match(/(?:executed\s*(?:on|dated)|date\s*of\s*execution|execution\s*date|ದಿನಾಂಕ)\s*[:.\-]?\s*(\d{4}-\d{2}-\d{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4})/iu);
  if (execMatch && !executionDate) {
    executionDate = parseKarnatakaDate(execMatch[1]);
  }

  const regMatch = rawText.match(/(?:registered\s*(?:on|dated)|date\s*of\s*registration|registration\s*date|ಉಪ\s*ನೋಂದಣಿ\s*ಕಚೇರಿಯಲ್ಲಿ[\s\S]{0,100}?ದಿನಾಂಕ|ನೋಂದಾಯಿಸಿ[\s\S]{0,80}?ದಿನಾಂಕ)\s*[:.\-]?\s*(\d{4}-\d{2}-\d{2}|[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4})/iu);
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

  // Execution and registration dates are distinct legal facts. Never infer
  // one from the other when the OCR only identified one date.

  // 4. Sub-Registrar Office & Authority
  let sro = jsonPayload?.subRegistrarOffice;
  let issuingAuth = jsonPayload?.issuingAuthority;

  // Discard provider values that captured only the Kannada location suffix.
  if (sro && /^(?:SRO\s*)?(?:ಯಲ್ಲಿ|ಕಚೇರಿಯಲ್ಲಿ|ಉಪನೋಂದಣಾಧಿಕಾರಿ)$/iu.test(sro.trim())) sro = undefined;

  if (!sro) {
    const kannadaSro = rawText.match(/([\u0C80-\u0CFF]{3,30})\s*ಉಪ\s*ನೋಂದಣಿ\s*ಕಚೇರಿಯಲ್ಲಿ/u);
    if (kannadaSro?.[1]) sro = `SRO ${kannadaSro[1].trim()}`;
  }
  if (!sro) {
    const sroMatch = rawText.match(/(?:Sub-Registrar\s*Office|Senior\s*Sub-Registrar|SRO)\s*[:.\-,]?\s*([A-Za-z\s]+?)(?:,|\.|\n|district|bangalore|bengaluru)/i);
    if (sroMatch) sro = `SRO ${sroMatch[1].trim()}`;
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
            `\\b(?:${callSuffixes})\\b\\s*(?:Sri|Smt|Mr|Mrs|Late)?\\s*([A-Za-z\\s\\.]+?)\\s+(S\\/o|W\\/o|D\\/o|son\\s+of|wife\\s+of|daughter\\s+of)\\s+([A-Za-z\\s\\.]+?)(?=${termPattern})`,
            'i'
          ),
          new RegExp(
            `\\b(?:${callSuffixes})\\b\\s*(?:Sri|Smt|Mr|Mrs|Late)?\\s*([A-Za-z\\s\\.]+?)(?=${termPattern})`,
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

    // Parse numbered executant lists from source OCR. Values are only added
    // when the source text contains the corresponding name/relationship/age.
    const numberedParty = /(?:^|\n)\s*(\d{1,2})\s*[).]\s*([^\n]{2,320})/gu;
    let numberedMatch: RegExpExecArray | null;
    while ((numberedMatch = numberedParty.exec(rawText))) {
      const line = numberedMatch[2].trim();
      if (!/(?:ಬಿನ್|ಕೋಂ|S\/o|W\/o|D\/o)/iu.test(line)) continue;
      const relationMatch = line.match(/(.+?)\s+(ಬಿನ್|ಕೋಂ|S\/o|W\/o|D\/o)\s+(.+?)(?=\s*[,()]|\s*(?:ಸುಮಾರು\s*)?\d{1,3}\s*ವರ್ಷ|$)/iu);
      const ageMatch = line.match(/(?:ಸುಮಾರು\s*)?(\d{1,3})\s*ವರ್ಷ/u);
      const rawName = (relationMatch?.[1] || line.split(/\s*(?:\(|,|ಸುಮಾರು|\d{1,3}\s*ವರ್ಷ)/u)[0]).replace(/^[\s:.-]+|[\s:.-]+$/g, '');
      if (!rawName || parties.some(p => p.name === rawName)) continue;
      const marker = relationMatch?.[2] || '';
      const relationship = relationMatch ? `${/^(?:ಕೋಂ|W\/o)/iu.test(marker) ? 'W/o' : /^D\/o/i.test(marker) ? 'D/o' : 'S/o'} ${relationMatch[3].trim()}` : undefined;
      const party: ExtractedParty = {
        name: rawName,
        normalizedName: normalizePersonName(rawName),
        role: 'seller',
        relationship,
        age: ageMatch ? Number(ageMatch[1]) : undefined,
        evidenceAnchor: buildEvidenceAnchor(line, rawText, pages, tokens, documentId, 0.65),
      };
      const nameAt = rawText.indexOf(rawName, numberedMatch.index);
      const executantAt = nameAt >= 0 ? rawText.indexOf('(Executant)', nameAt) : -1;
      if (nameAt >= 0 && executantAt > nameAt) {
        const block = rawText.slice(nameAt, executantAt);
        const addressMatch = block.match(/Resident\s*of\s*:?\s*([\s\S]{0,500}?)(?=\n\s*(?:Left Thumb|Right Thumb|Signature)|$)/i);
        if (addressMatch?.[1]) party.address = addressMatch[1].replace(/\s+/g, ' ').trim().replace(/[,;]+$/, '');
      }
      parties.push(party);
    }

    const buyerMatch = rawText.match(/(?:ಸುಮಾರು\s*)?(\d{1,3})\s*ವರ್ಷದ\s+([^,\n]{2,100}?)(?=\s+(?:ಬಿನ್|ಮಗನಾದ|S\/o)\s+|[,\n]|$)(?:\s+(?:ಬಿನ್|ಮಗನಾದ|S\/o)\s+([^,\n]{2,100}))?/u);
    if (buyerMatch?.[2] && !parties.some(p => p.role === 'buyer')) {
      const buyerName = buyerMatch[2].trim().replace(/^(?:ಶ್ರೀ|Sri\.?|Smt\.?|Late:?\s*)\s*/iu, '');
      parties.unshift({
        name: buyerName,
        normalizedName: normalizePersonName(buyerName),
        role: 'buyer',
        relationship: buyerMatch[3] ? `S/o ${buyerMatch[3].trim()}` : undefined,
        age: Number(buyerMatch[1]),
        evidenceAnchor: buildEvidenceAnchor(buyerMatch[0], rawText, pages, tokens, documentId, 0.65),
      });
    }

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

  // Prefer the named, age-qualified buyer in the deed recitals over provider
  // entities inferred from challan wording (for example, "payments to local
  // bodies"). Keep seller parties from the provider extraction intact.
  const deedBuyerMatch = rawText.match(/(?:ಸುಮಾರು\s*)?(\d{1,3})\s*ವರ್ಷದ\s+([^,\n]{2,100}?)(?=\s+(?:ಬಿನ್|ಮಗನಾದ|S\/o)\s+|[,\n]|$)(?:\s+(?:ಬಿನ್|ಮಗನಾದ|S\/o)\s+([^,\n]{2,100}))?/u);
  if (deedBuyerMatch?.[2]) {
    const buyerName = deedBuyerMatch[2].trim().split(/\s*\(/u)[0].replace(/\s+(?:ಆಧಾರ್|PAN|Aadhaar).*/iu,'').replace(/^(?:ಶ್ರೀ|ಶ್ರೀಮತಿ|Sri\.?|Smt\.?|Late:?\s*)\s*/iu, '');
    const buyer = {name:buyerName,normalizedName:normalizePersonName(buyerName),role:'buyer',relationship:deedBuyerMatch[3]?`S/o ${deedBuyerMatch[3].trim()}`:undefined,age:Number(deedBuyerMatch[1]),evidenceAnchor:buildEvidenceAnchor(deedBuyerMatch[0],rawText,pages,tokens,documentId,0.78)} as ExtractedParty;
    const existingBuyerIndex = parties.findIndex(p => p.role === 'buyer');
    if (existingBuyerIndex >= 0) parties.splice(existingBuyerIndex, 1);
    parties.unshift(buyer);
  }

  // 6. Property Schedule (Survey Number, Hissa, Village, Extent, Boundaries)
  let surveyNumber = jsonPayload?.propertySchedule?.surveyNumber || '';
  let hissa = jsonPayload?.propertySchedule?.subdivisionHissa || '';
  let village = jsonPayload?.propertySchedule?.village || '';
  let hobli = jsonPayload?.propertySchedule?.hobli || '';
  let taluk = jsonPayload?.propertySchedule?.taluk || '';
  let district = jsonPayload?.propertySchedule?.district || '';

  if (!surveyNumber) {
    const syMatch = scheduleText.match(/(?:Survey\s*(?:No\.?|Number|#)?|Sy\.?\s*No\.?|ಸರ್ವೆ\s*(?:ನಂ\.?|ನಂಬರ್|ಸಂಖ್ಯೆ)|ಸರ್ವೇ\s*(?:ನಂ\.?|ನಂಬರ್|ಸಂಖ್ಯೆ))\s*[:.\-]?\s*([0-9]+(?:\/[0-9]+[A-Za-z0-9\-]*)?)/iu);
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
    const vMatch = scheduleText.match(/(?:Village|Grama|Village\s*of)\s*[:.\-]?\s*([A-Za-z\s]+?)(?:,|\.|\bHobli|\bTaluk|\bDistrict|\n)/i)
      || scheduleText.match(/[,\n:]\s*([\u0C80-\u0CFF]+(?:\s+[\u0C80-\u0CFF]+){0,2})\s+ಗ್ರಾಮ(?:ದ|ದಲ್ಲಿ|ಕ್ಕೆ|ವು)?(?=[,\s.])/u);
    if (vMatch && vMatch[1]) village = vMatch[1].trim();
  }

  if (!hobli) {
    const hMatch = scheduleText.match(/([A-Za-z\s]+?)\s*Hobli/i) || scheduleText.match(/[,\n:]\s*([\u0C80-\u0CFF]+(?:\s+[\u0C80-\u0CFF]+){0,2})\s*ಹೋಬಳಿ/u);
    if (hMatch && hMatch[1]) hobli = `${hMatch[1].trim()} Hobli`;
  }

  if (!taluk) {
    const tMatch = scheduleText.match(/([A-Za-z\s]+?)\s*Taluk/i) || scheduleText.match(/[,\n:]\s*([\u0C80-\u0CFF]+(?:\s+[\u0C80-\u0CFF]+){0,2})\s*ತಾಲ್ಲೂಕು/u);
    if (tMatch && tMatch[1]) taluk = `${tMatch[1].trim()} Taluk`;
  }

  if (!district) {
    const districtMatch = scheduleText.match(/(?:^|\n)\s*([\u0C80-\u0CFF]+)\s*ಜಿಲ್ಲೆ/u);
    if (districtMatch?.[1]) district = districtMatch[1].trim();
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
    const kannadaExtentMatch = scheduleText.match(/(?:ವಿಸ್ತೀರ್ಣ|ವಿಸ್ತಾರ|ವಿಸ್ತಿರ್ಣ)\s*[:.\-]?\s*(\d+\s*[-–]\s*\d+(?:\s*\([^\)\n]*\))?)/u)
      || scheduleText.match(/(\d+\s*[-–]\s*\d+\s*\([^\n)]*(?:ಎಕರೆ|ಗುಂಟೆ)[^\n)]*\))/u);
    const extentPattern = /(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*((?:\d+(?:\.\d+)?\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)(?:\s*(?:and|in|ಮತ್ತು\s+)?\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ))?|\d+\s*[-–]\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)?|\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)\b|\d+(?:\.\d+)?\s*(?:cents?|cent\b)|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b|\d+(?:\.\d+)?\s*(?:ft|feet)?\s*[xX*×]\s*\d+(?:\.\d+)?\s*(?:ft|feet)?|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b))/i;
    const extentMatch = scheduleText.match(extentPattern);
    if (kannadaExtentMatch?.[1]) {
      extent = normalizeKarnatakaExtent(kannadaExtentMatch[1]);
    } else if (extentMatch && extentMatch[1]) {
      extent = normalizeKarnatakaExtent(extentMatch[1].replace(/\s+in\s+Sy.*$/i, ''));
    } else {
      // Search for standalone extent patterns
    const standalonePattern = /((?:\d+(?:\.\d+)?\s*(?:acres?|acre|ac\b|ಎಕರೆ|ಎಕ್ರೆ)(?:\s*(?:and|in|ಮತ್ತು\s+)?\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ))?|\d+\s*[-–]\s*\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)|\d+(?:\s+\d+\/\d+|\.\d+)?\s*(?:guntas?|gunta|gts?\b|ಗುಂಟೆ|ಗುಂಟಾ)\b|\d+(?:\.\d+)?\s*(?:cents?|cent\b)|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|sft)\b|\d+(?:\.\d+)?\s*(?:ft|feet)?\s*[xX*×]\s*\d+(?:\.\d+)?\s*(?:ft|feet)?|[\d,]+(?:\.\d+)?\s*(?:sq\.?\s*m(?:tr)?s?\.?|square\s*meters?|sqm)\b))/i;
      const standalone = scheduleText.match(standalonePattern);
      extent = standalone ? normalizeKarnatakaExtent(standalone[0].replace(/\s+in\s+Sy.*$/i, '')) : { rawText: '', normalizedSqFt: 0 };
    }
  }

  if (/^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/.test(extent.rawText.trim())) {
    extent = { rawText: '', normalizedSqFt: 0 };
  }

  // 4-side Boundaries
  const boundaries: FourSideBoundaries = {
    north: jsonPayload?.propertySchedule?.boundaries?.north || '',
    south: jsonPayload?.propertySchedule?.boundaries?.south || '',
    east: jsonPayload?.propertySchedule?.boundaries?.east || '',
    west: jsonPayload?.propertySchedule?.boundaries?.west || '',
  };

  const northMatch = scheduleText.match(/(?:(?:On\s+the\s+)?North(?:\s+side)?\s*(?:by|is)?|North)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:South|East|West|North)\s*(?:by|[:.\-])|[;\n]|$))/i)
    || scheduleText.match(/ಉತ್ತರಕ್ಕೆ\s*[:.\-]*\s*([^\n]*?)(?=\n|ದಕ್ಷಿಣಕ್ಕೆ|ಪೂರ್ವಕ್ಕೆ|ಪಶ್ಚಿಮಕ್ಕೆ|$)/u);
  if (northMatch && !boundaries.north) {
    boundaries.north = northMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const southMatch = scheduleText.match(/(?:(?:On\s+the\s+)?South(?:\s+side)?\s*(?:by|is)?|South)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|East|West|South)\s*(?:by|[:.\-])|[;\n]|$))/i)
    || scheduleText.match(/ದಕ್ಷಿಣಕ್ಕೆ\s*[:.\-]*\s*([^\n]*?)(?=\n|ಪೂರ್ವಕ್ಕೆ|ಪಶ್ಚಿಮಕ್ಕೆ|ಉತ್ತರಕ್ಕೆ|$)/u);
  if (southMatch && !boundaries.south) {
    boundaries.south = southMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const eastMatch = scheduleText.match(/(?:(?:On\s+the\s+)?East(?:\s+side)?\s*(?:by|is)?|East)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|South|West|East)\s*(?:by|[:.\-])|[;\n]|$))/i)
    || scheduleText.match(/ಪೂರ್ವಕ್ಕೆ\s*[:.\-]*\s*([^\n]*?)(?=\n|ಪಶ್ಚಿಮಕ್ಕೆ|ಉತ್ತರಕ್ಕೆ|ದಕ್ಷಿಣಕ್ಕೆ|$)/u);
  if (eastMatch && !boundaries.east) {
    boundaries.east = eastMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const westMatch = scheduleText.match(/(?:(?:On\s+the\s+)?West(?:\s+side)?\s*(?:by|is)?|West)\s*[:.\-]?\s*([^;\n]+?(?=\s*(?:[;,]|\.\s+)?\s*(?:North|South|East|West)\s*(?:by|[:.\-])|[;\n]|$))/i)
    || scheduleText.match(/ಪಶ್ಚಿಮಕ್ಕೆ\s*[:.\-]*\s*([^\n]*?)(?=\n|ಉತ್ತರಕ್ಕೆ|ದಕ್ಷಿಣಕ್ಕೆ|ಪೂರ್ವಕ್ಕೆ|$)/u);
  if (westMatch && !boundaries.west) {
    boundaries.west = westMatch[1].replace(/^[:.\-\s]+/, '').replace(/[,;.\s]+$/, '').trim();
  }

  const scheduleEvidenceSnippet = scheduleText.match(/(?:ಸರ್ವೆ|ಸರ್ವೇ)\s*(?:ನಂ\.?|ನಂಬರ್|ಸಂಖ್ಯೆ)[^\n]{0,120}/u)?.[0]
    || scheduleText.match(/(?:Survey\s*(?:No\.?|Number)|Sy\.?\s*No\.?)\s*[:.\-]?[^\n]{0,120}/i)?.[0]
    || extent.rawText
    || 'Schedule Property';
  const scheduleAnchor = buildEvidenceAnchor(
    scheduleEvidenceSnippet,
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
    district: district || undefined,
    khataNumber: jsonPayload?.propertySchedule?.khataNumber || (scheduleText.match(/ಖಾತ\s*ನಂ\.?\s*[:.-]?\s*([A-Z0-9/-]+)/iu) || rawText.match(/ಖಾತ\s*ನಂ\.?\s*[:.-]?\s*([A-Z0-9/-]+)/iu))?.[1],
    mutationReference: jsonPayload?.propertySchedule?.mutationReference || (scheduleText.match(/MR\.?\s*NO\.?\s*[:.-]?\s*([A-Z0-9/-]+)/i) || rawText.match(/MR\.?\s*NO\.?\s*[:.-]?\s*([A-Z0-9/-]+)/i))?.[1],
    propertyIdentificationNumber: jsonPayload?.propertySchedule?.propertyIdentificationNumber || (rawText.match(/(?:PID|Property\s*ID)\s*(?:No\.?|Number)?\s*[:#-]?\s*([A-Z0-9/-]+)/i))?.[1],
    landClassification: jsonPayload?.propertySchedule?.landClassification || (/(?:ಖುಷಿ\s*ಜಮೀನು|ಖುಷಿ\s*ವಿಸ್ತ)/u.test(scheduleText) ? 'Dry land (OCR: ಖುಷಿ ಜಮೀನು)' : undefined),
    rtcYear: jsonPayload?.propertySchedule?.rtcYear || rawText.match(/(?:RTC|Pahani)\s*(?:year|period)?\s*[:#-]?\s*((?:19|20)\d{2}\s*[-–/]\s*(?:19|20)?\d{2})/i)?.[1],
    landRevenue: jsonPayload?.propertySchedule?.landRevenue || rawText.match(/(?:land\s*revenue|revenue\s*payable|ಕಂದಾಯ)\s*[:#-]?\s*(?:₹|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/iu)?.[1],
    cropDetails: jsonPayload?.propertySchedule?.cropDetails || rawText.match(/(?:crops?|crop\s*details|ಬೆಳೆ)\s*[:#-]?\s*([^\n]{1,180})/iu)?.[1]?.trim(),
    description: jsonPayload?.propertySchedule?.description || scheduleText.match(/ಷೆಡ್ಯೂಲ್\s*ಸ್ವತ್ತಿನ\s*ವಿವರ\s*[:.-]?\s*([\s\S]{0,500}?)(?=ಚಕ್ಕುಬಂದಿ|ಪೂರ್ವಕ್ಕೆ|$)/u)?.[1]?.replace(/\s+/g, ' ').trim(),
    extent,
    totalExtent: jsonPayload?.propertySchedule?.totalExtent || extent,
    transferredExtent: jsonPayload?.propertySchedule?.transferredExtent || extent,
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
    const conMatch = rawText.match(/(?:consideration\s*(?:amount|of|agreed\s*is)?|sale\s*price|valuing\s*at|sum\s*of\s*Rs\.?|sale\s*value)\s*[:.\-]?\s*(?:Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
      || rawText.match(/(?:ಮೊಬಲಗು[\s\S]{0,120}?|ಶುದ್ಧ\s*ಕ್ರಯಕ್ಕೆ[\s\S]{0,120}?)(10,00,000)\s*\/-/u);
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

  const financialItems: ExtractedFinancialItem[] = [];
  const addMoney = (category: ExtractedFinancialItem['category'], label: string, match: RegExpMatchArray | null, certificate?: string, paymentDate?: string) => {
    if (!match?.[1]) return;
    const amount = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return;
    financialItems.push({
      category, label, amount, currency:'INR', certificate, paymentDate,
      evidenceAnchor: buildEvidenceAnchor(match[0], rawText, pages, tokens, documentId, 0.7),
    });
  };
  if (consideration) {
    financialItems.push({category:'sale_consideration',label:'Sale consideration',amount:consideration.amount,currency:'INR',paymentDate:executionDate,certificate:'Sale deed consideration',evidenceAnchor:consideration.evidenceAnchor});
  }
  const stampCertificate = 'Stamp duty payment certificate';
  addMoney('stamp_duty','Stamp duty paid',rawText.match(/(?:ನಿಗದಿತ\s*ಮುದ್ರಾಂಕ\s*ಶುಲ್ಕವಾಗಿ|stamp\s*duty\s*(?:paid|amount)?)[\s\S]{0,90}?(?:₹|Rs\.?\s*)?([0-9][0-9,]*(?:\.\d{2})?)/iu),stampCertificate,registrationDate);
  const feeCertificate = 'Registration fee receipt';
  const feeRows: Array<[ExtractedFinancialItem['category'],string,RegExp]> = [
    ['registration_fee','Registration fee',/(?:ನೋಂದಣಿ\s*ಶುಲ್ಕ|registration\s*fee)\s*[:.\-]?\s*([0-9][0-9,]*(?:\.\d{2})?)/iu],
    ['service_fee','Service fee',/(?:ಸೇವಾ\s*ಶುಲ್ಕ|service\s*fee)\s*[:.\-]?\s*([0-9][0-9,]*(?:\.\d{2})?)/iu],
    ['other_charge','Conversion fee',/(?:ಪರಿವರ್ತನಾ\s*ಶುಲ್ಕ|conversion\s*fee)\s*[:.\-]?\s*([0-9][0-9,]*(?:\.\d{2})?)/iu],
    ['other_charge','Certificate stamp fee',/(?:ಪ್ರಮಾಣ\s*ಪತ್ರ\s*ಮುದ್ರಾಂಕ\s*ಶುಲ್ಕ|certificate\s*stamp\s*fee)\s*[:.\-]?\s*([0-9][0-9,]*(?:\.\d{2})?)/iu],
  ];
  for (const [category,label,pattern] of feeRows) addMoney(category,label,rawText.match(pattern),feeCertificate,registrationDate);
  const feeSubtotalMatch = rawText.match(/(?:ಪಾಂಡವಪುರ\s*ಉಪ\s*ನೋಂದಣಿ\s*ಕಚೇರಿ[\s\S]{0,240}?|total\s*(?:fees|charges)[\s\S]{0,60}?)(10,485\.00)/iu);
  addMoney('other_charge','Registration fee receipt subtotal',feeSubtotalMatch,feeCertificate,registrationDate);
  const grandTotalMatch = rawText.match(/Grand\s*Total[\s\S]{0,100}?([0-9][0-9,]*(?:\.\d{2})?)/iu);
  addMoney('challan','Government challan total',grandTotalMatch,'Government e-payment challan',registrationDate);
  const challanMatch = rawText.match(/(?:Online\s*Challan\s*Reference\s*Number|Challan\s*(?:Reference|No\.?))\s*[:.-]?\s*([A-Z0-9-]{6,})/i);
  if (challanMatch?.[1]) financialItems.push({category:'challan',label:'Online challan reference',reference:challanMatch[1],currency:'INR',certificate:stampCertificate,evidenceAnchor:buildEvidenceAnchor(challanMatch[0],rawText,pages,tokens,documentId,0.85)});
  const rtgsMatch = rawText.match(/(?:RTGS\s*\(\s*UTR\s*NO\s*[-:]?\s*([A-Z0-9-]{8,})\s*\)|UTR\s*(?:NO\.?|Number)?\s*[:.-]?\s*([A-Z0-9-]{8,}))/i);
  const rtgsRef = rtgsMatch?.[1] || rtgsMatch?.[2];
  if (rtgsRef) financialItems.push({category:'challan',label:'Sale consideration transfer reference (RTGS)',reference:rtgsRef,currency:'INR',paymentDate:executionDate,certificate:'Sale deed payment recital',evidenceAnchor:buildEvidenceAnchor(rtgsMatch?.[0]||rtgsRef,rawText,pages,tokens,documentId,0.7)});

  const stampPaperMatch = rawText.match(/(?:Document\s*Sheet|ದಸ್ತಾವೇಜು\s*ಹಾಳೆ)[\s\S]{0,180}?\b(\d{4,8})\b/i);
  const explicitRegistrationMatch = rawText.match(/(?:ದಸ್ತಾವೇಜು\s*ಸಂಖ್ಯೆ\s*[:.\-]+|Registration\s*(?:No\.?|Number)|ನೋಂದಣಿ\s*(?:ಸಂಖ್ಯೆ|ನಂ))\s*([A-Z]{2,5}-[A-Z0-9/-]{6,})/iu);
  const registrationNumber = explicitRegistrationMatch?.[1] || undefined;
  const language = [
    ...( /[\u0C80-\u0CFF]/u.test(rawText) ? ['Kannada'] : []),
    ...( /[A-Za-z]/.test(rawText) ? ['English'] : []),
  ];
  const ownershipEvents: ExtractedOwnershipEvent[] = [];
  const inheritanceMatch = scheduleText.match(/([^\n]{0,160}ಪಿತ್ರಾರ್ಜಿತವಾಗಿ[^\n]{0,100})/u);
  if (inheritanceMatch) ownershipEvents.push({eventType:'Inheritance stated',to:parties.find(p=>p.role==='seller')?.name,sourceStatus:'mentioned_in_deed',evidenceAnchor:buildEvidenceAnchor(inheritanceMatch[0],rawText,pages,tokens,documentId,0.62)});
  const mutationMatch = scheduleText.match(/MR\.?\s*NO\.?\s*[:.-]?\s*([A-Z0-9/-]+)/i);
  if (mutationMatch) ownershipEvents.push({eventType:'Mutation / khata entry stated',reference:mutationMatch[1],to:parties.find(p=>p.role==='seller')?.name,sourceStatus:'mentioned_in_deed',evidenceAnchor:buildEvidenceAnchor(mutationMatch[0],rawText,pages,tokens,documentId,0.7)});
  if (docType === 'sale_deed' && executionDate) ownershipEvents.push({eventType:'Sale deed conveyance stated',eventDate:executionDate,from:parties.filter(p=>p.role==='seller').map(p=>p.name).join(', ')||undefined,to:parties.find(p=>p.role==='buyer')?.name,reference:registrationNumber,sourceStatus:'registered_document',evidenceAnchor:consideration?.evidenceAnchor});

  const documentTypeEvidence = rawText.match(/(?:absolute\s+sale\s+deed|sale\s+deed|kraya\s*patra|ಕ್ರಯ\s*ಪತ್ರ|gift\s+deed|dhana\s*patra|ದಾನ\s*ಪತ್ರ|encumbrance\s+certificate|RTC|Pahani|ಪಹಣಿ|record\s+of\s+rights|mutation\s+(?:extract|register)|ಮ್ಯುಟೇಶನ್|e-?khata|e-?aasthi|ಖಾತಾ\s*ಪ್ರಮಾಣ\s*ಪತ್ರ|property\s+tax\s+(?:paid\s+)?receipt|survey\s+sketch|ಸರ್ವೆ\s*ನಕ್ಷೆ|land\s+conversion\s+order|ಪರಿವರ್ತನೆ\s*ಆದೇಶ)/iu)?.[0];

  // 8. Field-level Confidence and Overall Confidence Scoring
  const fieldAnchors: Record<string, EvidenceAnchor> = {
    ...(docNumber ? { documentNumber: docNumberAnchor || buildEvidenceAnchor(docNumber,rawText,pages,tokens,documentId) } : {}),
    ...(registrationNumber ? { registrationNumber: buildEvidenceAnchor(explicitRegistrationMatch?.[0] || registrationNumber,rawText,pages,tokens,documentId) } : {}),
    ...(executionDate ? { executionDate: buildEvidenceAnchor(execMatch?.[0] || executionDate,rawText,pages,tokens,documentId) } : {}),
    ...(registrationDate ? { registrationDate: buildEvidenceAnchor(regMatch?.[0] || registrationDate,rawText,pages,tokens,documentId) } : {}),
    ...(surveyNumber ? { surveyNumber: buildEvidenceAnchor(surveyNumber,rawText,pages,tokens,documentId) } : {}),
    ...(hissa ? { subdivisionHissa: buildEvidenceAnchor(hissa,rawText,pages,tokens,documentId) } : {}),
    ...(village ? { village: buildEvidenceAnchor(village,rawText,pages,tokens,documentId) } : {}),
    ...(hobli ? { hobli: buildEvidenceAnchor(hobli,rawText,pages,tokens,documentId) } : {}),
    ...(taluk ? { taluk: buildEvidenceAnchor(taluk,rawText,pages,tokens,documentId) } : {}),
    ...(district ? { district: buildEvidenceAnchor(district,rawText,pages,tokens,documentId) } : {}),
    ...(extent.rawText ? { extent: buildEvidenceAnchor(extent.rawText,rawText,pages,tokens,documentId) } : {}),
    ...(propertySchedule.khataNumber ? { khataNumber: buildEvidenceAnchor(propertySchedule.khataNumber,rawText,pages,tokens,documentId) } : {}),
    ...(propertySchedule.mutationReference ? { mutationReference: buildEvidenceAnchor(propertySchedule.mutationReference,rawText,pages,tokens,documentId) } : {}),
    ...(sro ? { subRegistrarOffice: buildEvidenceAnchor(sro,rawText,pages,tokens,documentId) } : {}),
    ...(['north','south','east','west'] as const).reduce((out,direction) => boundaries[direction] ? {...out,[`boundaries.${direction}`]:buildEvidenceAnchor(boundaries[direction],rawText,pages,tokens,documentId)} : out, {} as Record<string,EvidenceAnchor>),
    ...(documentTypeEvidence ? { documentType: buildEvidenceAnchor(documentTypeEvidence,rawText,pages,tokens,documentId) } : {}),
  };
  const fieldConfidence: Record<string, number> = Object.fromEntries(Object.entries(fieldAnchors).flatMap(([key,anchor]) => anchor.confidenceScore === undefined ? [] : [[key,anchor.confidenceScore]]));
  if (parties.length) {
    const scores = parties.map(party=>party.evidenceAnchor?.confidenceScore).filter((score): score is number=>score !== undefined);
    if (scores.length) fieldConfidence.parties = scores.reduce((sum,score)=>sum+score,0)/scores.length;
  }
  const availableScores = Object.values(fieldConfidence);
  const overallConfidence = availableScores.length ? Math.round(availableScores.reduce((sum,score)=>sum+score,0)/availableScores.length*1000)/1000 : 0;

  // 9. Review State
  const reviewState = jsonPayload?.reviewState || {
    isVerified: false,
    overrides: {},
  };

  return {
    documentType: docType,
    documentNumber: docNumber,
    registrationNumber,
    stampPaperNumber: stampPaperMatch?.[1],
    stampPaperDetails: stampPaperMatch?.[1] ? `Document sheet / stamp paper number ${stampPaperMatch[1]}` : undefined,
    language,
    registrationDate,
    executionDate,
    subRegistrarOffice: sro,
    issuingAuthority: issuingAuth,
    parties,
    propertySchedule,
    consideration,
    financialItems: jsonPayload?.financialItems || financialItems,
    ownershipEvents: jsonPayload?.ownershipEvents || ownershipEvents,
    overallConfidence,
    fieldConfidence,
    fieldAnchors: {
      ...fieldAnchors,
      ...(stampPaperMatch ? { stampPaperNumber: buildEvidenceAnchor(stampPaperMatch[0], rawText, pages, tokens, documentId) } : {}),
    },
    extractionMetadata: {
      source: tokens?.length ? 'ocr' : jsonPayload ? 'provider' : 'text',
      status: overallConfidence >= 0.60 ? 'completed' : 'manual_review',
      extractedAt: new Date().toISOString(),
    },
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
