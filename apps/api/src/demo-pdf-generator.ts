/**
 * OJIX Property Intelligence — Demo Document PDF Generator
 * 
 * Generates an official-looking, valid PDF-1.4 single-page Karnataka Land Record / Deed
 * with zero external dependencies. Used for serving preview documents in demo workspaces
 * and serverless deployments.
 */

function escapePdf(str: string): string {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function generateOfficialDocumentPdf(doc: any, property?: any): Buffer {
  const p = property || {};
  const docType = String(doc?.doc_type || 'sale_deed').toLowerCase();
  
  let docTypeLabel = 'REGISTERED SALE DEED (ಕ್ರಯ ಪತ್ರ)';
  let docCategory = 'CONVEYANCE & TITLE TRANSFER';
  if (docType === 'rtc' || docType.includes('pahani')) {
    docTypeLabel = 'RECORD OF RIGHTS, TENANCY & CROPS (RTC / ಪಹಣಿ)';
    docCategory = 'REVENUE MUTATION & POSSESSION RECORD';
  } else if (docType === 'ec' || docType.includes('encumbrance')) {
    docTypeLabel = 'ENCUMBRANCE CERTIFICATE (ಭಾರಮುಕ್ತ ಪ್ರಮಾಣಪತ್ರ) - FORM 15';
    docCategory = 'SEARCH OF SEARCHABLE INSTRUMENTS';
  } else if (docType.includes('khata')) {
    docTypeLabel = 'E-KHATA CERTIFICATE (ಇ-ಖಾತಾ ಪ್ರಮಾಣಪತ್ರ)';
    docCategory = 'MUNICIPAL / LOCAL BODY ASSESSMENT';
  } else if (docType.includes('tax')) {
    docTypeLabel = 'PROPERTY TAX RECEIPT & ASSESSMENT CHALAN';
    docCategory = 'TAX ASSESSMENT REVENUE RECORD';
  }

  const survey = (p.survey_number || '89') + (p.subdivision && p.subdivision !== '*' ? '/' + p.subdivision : '');
  const village = p.village || 'Bidadi';
  const taluk = p.taluk || 'Ramanagara';
  const district = p.district || 'Ramanagara';
  const extent = p.extent || '3 acres 15 guntas';
  const bNorth = p.boundary_north || 'KIADB Industrial Layout';
  const bSouth = p.boundary_south || 'Highway Buffer';
  const bEast = p.boundary_east || 'Service Road';
  const bWest = p.boundary_west || 'Sy No. 88';
  const appNo = p.application_number || 'OJ-2026-RMN-005';
  const filename = doc.original_filename || 'Official_Document.pdf';

  const streamContent = [
    'q',
    // Outer and inner border
    '0.04 0.1 0.17 rg', // Dark Navy #0b192c
    '15 15 565 812 re S',
    '19 19 557 804 re S',
    // Header banner (Terracotta)
    '0.76 0.25 0.05 rg',
    '20 782 555 40 re f',
    '1 1 1 rg',
    'BT',
    '/F1 15 Tf',
    '155 799 Td',
    '(GOVERNMENT OF KARNATAKA) Tj',
    'ET',
    'BT',
    '/F2 9 Tf',
    '145 787 Td',
    '(DEPARTMENT OF STAMPS AND REGISTRATION - KAVERI 2.0 PORTAL) Tj',
    'ET',
    // Document Type Banner
    '0.04 0.1 0.17 rg',
    'BT',
    '/F1 12 Tf',
    '35 750 Td',
    `(${escapePdf(docTypeLabel)}) Tj`,
    '0 -14 Td',
    '/F2 8 Tf',
    `(${escapePdf(docCategory + ' | OFFICIAL CERTIFIED DISCLOSURE')}) Tj`,
    'ET',
    '0.4 0.4 0.4 rg',
    '35 730 525 1 re f', // divider line
    // Metadata block
    '0.1 0.1 0.1 rg',
    'BT',
    '/F1 9 Tf',
    '35 712 Td',
    `(${escapePdf('Matter Number: ' + appNo + '    Document File: ' + filename)}) Tj`,
    '0 -15 Td',
    '/F2 9 Tf',
    `(${escapePdf('Sub-Registrar Jurisdiction: ' + taluk + ' Taluk Office, ' + district + ' District')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('Registry Synchronization: Kaveri 2.0 & Bhoomi Integrated Database')}) Tj`,
    'ET',
    // Parties section
    '0.76 0.25 0.05 rg',
    '35 650 525 18 re f',
    '1 1 1 rg',
    'BT',
    '/F1 10 Tf',
    '40 655 Td',
    '(RECORDED PARTIES & EXECUTION RECITAL) Tj',
    'ET',
    '0.1 0.1 0.1 rg',
    'BT',
    '/F2 9 Tf',
    '35 632 Td',
    '(Executant / Transferor : Sri K. Ramesh Kumar s/o Late Krishnappa) Tj',
    '0 -15 Td',
    '(Claimant / Transferee : Sri S. Suresh Reddy s/o Venkata Reddy) Tj',
    '0 -15 Td',
    '(Execution Date: 15-Mar-2024    Registration Date: 16-Mar-2024    Stamp Duty: Paid & Verified) Tj',
    'ET',
    // Schedule of Property
    '0.04 0.1 0.17 rg',
    '35 565 525 18 re f',
    '1 1 1 rg',
    'BT',
    '/F1 10 Tf',
    '40 570 Td',
    '(SCHEDULE OF IMMOVABLE PROPERTY) Tj',
    'ET',
    '0.1 0.1 0.1 rg',
    'BT',
    '/F2 9 Tf',
    '35 545 Td',
    `(${escapePdf('Revenue Village: ' + village + '   |   Taluk: ' + taluk + '   |   District: ' + district)}) Tj`,
    '0 -15 Td',
    `(${escapePdf('Survey Number / Hissa: ' + survey + '   |   Recorded Extent: ' + extent)}) Tj`,
    '0 -18 Td',
    '/F1 9 Tf',
    '(BOUNDARIES AND MEASUREMENTS:) Tj',
    '0 -15 Td',
    '/F2 9 Tf',
    `(${escapePdf('  North : ' + bNorth)}) Tj`,
    '0 -14 Td',
    `(${escapePdf('  South : ' + bSouth)}) Tj`,
    '0 -14 Td',
    `(${escapePdf('  East  : ' + bEast)}) Tj`,
    '0 -14 Td',
    `(${escapePdf('  West  : ' + bWest)}) Tj`,
    'ET',
    // Seal Stamp Box
    '0.05 0.6 0.4 rg', // Emerald
    '35 360 240 70 re S',
    'BT',
    '/F1 9 Tf',
    '45 415 Td',
    '(OFFICIAL SUB-REGISTRAR SEAL) Tj',
    '0 -14 Td',
    '/F2 8 Tf',
    `(${escapePdf('Office: ' + taluk + ' Taluk, ' + district)}) Tj`,
    '0 -12 Td',
    '(Kaveri 2.0 Digitally Encrypted & Sealed) Tj',
    '0 -12 Td',
    '(Signature: Verified / Valid) Tj',
    'ET',
    // Bhoomi Verification Box
    '0.15 0.38 0.9 rg', // Blue
    '300 360 260 70 re S',
    'BT',
    '/F1 9 Tf',
    '310 415 Td',
    '(BHOOMI LAND RECORDS INTEGRATION) Tj',
    '0 -14 Td',
    '/F2 8 Tf',
    `(${escapePdf('RTC Pahani Status: Active & Synchronized')}) Tj`,
    '0 -12 Td',
    `(${escapePdf('Mutation MR No: 12/2023-24 Verified')}) Tj`,
    '0 -12 Td',
    '(Spatial Boundary: Vector Polygon Matched) Tj',
    'ET',
    // Footer notes
    '0.5 0.5 0.5 rg',
    '35 60 525 1 re f',
    'BT',
    '/F2 8 Tf',
    '35 45 Td',
    `(${escapePdf('OJIX Property Intelligence · Case Reference ' + appNo + ' · SHA-256: ' + (doc.sha256 ? String(doc.sha256).slice(0, 32) : 'Verified'))}) Tj`,
    '0 -12 Td',
    '(Certified True Extraction. Prepared under Karnataka Land Revenue Code 1964 and Registration Act 1908.) Tj',
    'ET',
    'Q'
  ];

  const stream = streamContent.join('\n');
  const streamLen = Buffer.byteLength(stream);

  const objects = [
    '1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n',
    '2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n',
    '3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R /F2 5 0 R>>>> /Contents 6 0 R>>\nendobj\n',
    '4 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>>\nendobj\n',
    '5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n',
    `6 0 obj\n<</Length ${streamLen}>>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  let offset = 9;
  const xref = ['xref\n0 7\n0000000000 65535 f \n'];
  for (const obj of objects) {
    xref.push(String(offset).padStart(10, '0') + ' 00000 n \n');
    offset += Buffer.byteLength(obj);
  }

  const trailer = `trailer\n<</Root 1 0 R /Size 7>>\nstartxref\n${offset}\n%%EOF\n`;
  return Buffer.from('%PDF-1.4\n' + objects.join('') + xref.join('') + trailer);
}
