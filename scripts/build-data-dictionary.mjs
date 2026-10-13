import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const schemaPath = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/database/mysql-schema.sql';
const outputDir = '/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/output/excel';
const outputPath = `${outputDir}/OJIX_Database_Data_Dictionary.xlsx`;
const schema = await fs.readFile(schemaPath, 'utf8');

const tablePurposes = {
  organizations: 'Tenant and organisation master data.',
  org_memberships: 'Links users to organisations and access roles.',
  karnataka_districts: 'Reference list of Karnataka districts.',
  karnataka_taluks: 'Reference list of taluks within districts.',
  karnataka_hoblis: 'Reference list of hoblis or towns within taluks.',
  karnataka_villages: 'Reference list of villages within hoblis.',
  karnataka_location_imports: 'Tracks the provenance and completeness of location imports.',
  properties: 'Primary property dossier and identity record.',
  parcel_refs: 'Multiple parcel, survey and subdivision references linked to one property dossier.',
  documents: 'Uploaded evidence files and extraction results.',
  risk_findings: 'Explainable preliminary review findings and next actions.',
  spatial_layers: 'GIS layer catalogue, provenance and configuration.',
  audit_events: 'Immutable activity trail for accountable system changes.',
  title_events: 'Chronological property title-chain events.',
  title_reviews: 'Professional review decisions for title-chain events.',
  source_registry_verifications: 'Stores government-source connection or verification attempts.',
  legal_bookmarks: 'Saved legal research references.',
  workspace_settings: 'Organisation-level product and review settings.'
};

const propertyPurposes = {
  id: 'Stable internal property identifier.', tenant_id: 'Separates each organisation’s data.', name: 'Human-readable property or project name.',
  property_identifier: 'PID, khata, site or municipal identifier where applicable.', property_type: 'Classifies the property for the correct workflow.',
  village: 'Village name used in land and registration records.', hobli: 'Hobli or town administrative level.', taluk: 'Taluk administrative level.', district: 'District administrative level.',
  district_id: 'Validated link to the district reference record.', taluk_id: 'Validated link to the taluk reference record.', hobli_id: 'Validated link to the hobli reference record.', village_id: 'Validated link to the village reference record.',
  survey_number: 'Primary land survey identifier.', subdivision: 'Hissa or subdivision within a survey number.', extent: 'Area exactly as stated in the source record.',
  extent_value: 'Numeric area used for comparison and calculation.', extent_unit: 'Unit for the normalized extent value.',
  boundary_north: 'North-side schedule boundary description.', boundary_south: 'South-side schedule boundary description.', boundary_east: 'East-side schedule boundary description.', boundary_west: 'West-side schedule boundary description.',
  address: 'Postal address, landmark or directions.', latitude: 'Latitude of the recorded property point.', longitude: 'Longitude of the recorded property point.', location: 'Spatial point used for GIS operations.',
  coordinate_source: 'Explains where the coordinates came from.', coordinate_confidence: 'Reviewer confidence from 0 to 100.', coordinate_captured_at: 'When the coordinate was captured or entered.',
  notes: 'Initial context and reviewer notes.', identity_state: 'Known, verified, disputed or unknown state of property identity.', status: 'Current property-review workflow status.',
  created_by_uid: 'User who created the property record.', updated_by_uid: 'User who last updated the property record.', created_at: 'Record creation timestamp.', updated_at: 'Most recent update timestamp.'
};

const migration006 = new Set(['property_identifier','property_type','extent_value','extent_unit','boundary_north','boundary_south','boundary_east','boundary_west','coordinate_source','coordinate_confidence','coordinate_captured_at','identity_state']);

function genericPurpose(column) {
  if (column === 'id') return 'Stable internal row identifier.';
  if (column.endsWith('_id')) return `Reference to the related ${column.slice(0, -3).replaceAll('_', ' ')} record.`;
  if (column.endsWith('_at')) return `Timestamp for ${column.slice(0, -3).replaceAll('_', ' ')}.`;
  if (column.endsWith('_uid')) return `User identifier for ${column.slice(0, -4).replaceAll('_', ' ')}.`;
  if (column.startsWith('is_') || column === 'active') return 'Boolean workflow or availability flag.';
  if (column.includes('status')) return 'Current workflow or processing status.';
  if (column.includes('name')) return 'Human-readable name.';
  if (column.includes('notes') || column.includes('description') || column.includes('explanation')) return 'Descriptive context retained for review.';
  if (column.includes('source')) return 'Source or provenance information.';
  return `Stores ${column.replaceAll('_', ' ')} for this record.`;
}

const tables = [];
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\) ENGINE=/g;
for (const match of schema.matchAll(tableRegex)) {
  const [, name, body] = match;
  const constraintLines = body.split('\n').filter(line => /^\s*(PRIMARY KEY|UNIQUE KEY|KEY|CONSTRAINT)/.test(line));
  const columns = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim().replace(/,$/, '');
    if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/') || /^(PRIMARY KEY|UNIQUE KEY|KEY|CONSTRAINT)/.test(line)) continue;
    const parsed = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([A-Z]+(?:\([^)]*\))?(?:\s+UNSIGNED)?)\s*(.*)$/);
    if (!parsed) continue;
    const [, column, dataType, modifiers] = parsed;
    const defaultMatch = modifiers.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s,]+)/i);
    const keys = constraintLines.filter(item => {
      const localColumns = item.match(/\(([^)]+)\)/)?.[1]
        .split(',')
        .map(value => value.trim().replace(/\(.*/, '')) || [];
      return localColumns.includes(column);
    }).map(item => item.trim().replace(/,$/, '')).join('; ');
    columns.push({
      column,
      dataType,
      nullable: /NOT NULL/i.test(modifiers) ? 'No' : 'Yes',
      defaultValue: defaultMatch ? defaultMatch[1].replace(/^'|'$/g, '') : '',
      key: keys,
      purpose: name === 'properties' && propertyPurposes[column] ? propertyPurposes[column] : genericPurpose(column),
      change: name === 'properties' && migration006.has(column) ? 'Added in migration 006' : name === 'parcel_refs' ? 'Added in migration 007' : 'Base schema',
      source: name === 'properties' && migration006.has(column) ? '006_complete_property_identity.sql' : name === 'parcel_refs' ? '007_property_parcel_references.sql' : 'mysql-schema.sql'
    });
  }
  tables.push({ name, columns });
}

const workbook = Workbook.create();
const black = '#111111';
const darkGray = '#333333';
const lightGray = '#E7E7E7';
const paleGray = '#F5F5F5';
const amber = '#FFF2CC';
const font = 'Arial';

const overview = workbook.worksheets.add('Overview');
overview.showGridLines = false;
overview.tabColor = black;
overview.getRange('A2:F2').merge();
overview.getRange('A2').values = [['OJIX Database Data Dictionary']];
overview.getRange('A2').format = { font: { name: font, size: 16, bold: true, color: black } };
overview.getRange('A3:F3').values = [['MariaDB schema reference for development, review and future changes', '', '', '', '', '']];
overview.getRange('A3:F3').format = { font: { name: font, size: 10, italic: true, color: '#555555' } };
overview.getRange('A5:F5').values = [['Table', 'Purpose', 'Columns', 'Schema Source', 'Last Schema Update', 'Maintenance Note']];
const overviewRows = tables.map(t => [t.name, tablePurposes[t.name] || '', t.columns.length, 'database/mysql-schema.sql', t.name === 'parcel_refs' ? 'Migration 007' : t.name === 'properties' ? 'Migration 006' : 'Base schema', 'Update this workbook whenever a migration changes the table.']);
overview.getRange(`A6:F${5 + overviewRows.length}`).values = overviewRows;
overview.tables.add(`A5:F${5 + overviewRows.length}`, true, 'DatabaseOverview').style = 'TableStyleLight1';
overview.getRange('A5:F5').format = { fill: black, font: { name: font, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
overview.getRange(`A6:F${5 + overviewRows.length}`).format = { font: { name: font, size: 10, color: black }, verticalAlignment: 'center' };
overview.getRange(`A6:F${5 + overviewRows.length}`).format.borders = { preset: 'inside', style: 'thin', color: lightGray };
overview.getRange('C6:C30').format.horizontalAlignment = 'center';
overview.getRange('A:F').format.autofitColumns();
overview.getRange('B:B').format.columnWidth = 42;
overview.getRange('F:F').format.columnWidth = 48;
overview.freezePanes.freezeRows(5);

const changeLog = workbook.worksheets.add('Change Log');
changeLog.showGridLines = false;
changeLog.getRange('A2:F2').merge();
changeLog.getRange('A2').values = [['Schema Change Log']];
changeLog.getRange('A2').format = { font: { name: font, size: 16, bold: true, color: black } };
changeLog.getRange('A4:F4').values = [['Migration', 'Date', 'Table', 'Columns', 'Reason', 'Status']];
changeLog.getRange('A5:F6').values = [
  ['006_complete_property_identity.sql', new Date('2026-10-09T00:00:00'), 'properties', [...migration006].join(', '), 'Complete property identity, boundary, extent and coordinate provenance fields required by the RFD.', 'Implemented'],
  ['007_property_parcel_references.sql', new Date('2026-10-09T00:00:00'), 'parcel_refs', 'All parcel_refs columns', 'Support multiple survey numbers, subdivisions and parcels within one property dossier.', 'Implemented']
];
changeLog.getRange('B5:B6').setNumberFormat('yyyy-mm-dd');
changeLog.tables.add('A4:F6', true, 'SchemaChangeLog').style = 'TableStyleLight1';
changeLog.getRange('A4:F4').format = { fill: black, font: { name: font, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center' };
changeLog.getRange('A5:F6').format = { font: { name: font, size: 10, color: black }, wrapText: true, verticalAlignment: 'top' };
changeLog.getRange('A:F').format.autofitColumns();
changeLog.getRange('D:D').format.columnWidth = 52;
changeLog.getRange('E:E').format.columnWidth = 52;

for (const tableInfo of tables) {
  const sheet = workbook.worksheets.add(tableInfo.name);
  sheet.showGridLines = false;
  if (tableInfo.name === 'properties') sheet.tabColor = darkGray;
  sheet.getRange('A2:H2').merge();
  sheet.getRange('A2').values = [[tableInfo.name]];
  sheet.getRange('A2').format = { font: { name: font, size: 15, bold: true, color: black } };
  sheet.getRange('A3:H3').values = [[tablePurposes[tableInfo.name] || '', '', '', '', '', '', '', '']];
  sheet.getRange('A3:H3').format = { font: { name: font, size: 10, italic: true, color: '#555555' } };
  sheet.getRange('A5:H5').values = [['Column Name', 'SQL Data Type', 'Nullable', 'Default', 'Key / Constraint', 'Purpose / Why Used', 'Schema Change', 'Source']];
  const rows = tableInfo.columns.map(c => [c.column, c.dataType, c.nullable, c.defaultValue, c.key, c.purpose, c.change, c.source]);
  const endRow = 5 + rows.length;
  sheet.getRange(`A6:H${endRow}`).values = rows;
  sheet.tables.add(`A5:H${endRow}`, true, `T_${tableInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`).style = 'TableStyleLight1';
  sheet.getRange('A5:H5').format = { fill: black, font: { name: font, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
  sheet.getRange(`A6:H${endRow}`).format = { font: { name: font, size: 10, color: black }, verticalAlignment: 'top' };
  sheet.getRange(`A6:H${endRow}`).format.borders = { preset: 'inside', style: 'thin', color: lightGray };
  sheet.getRange(`C6:D${endRow}`).format.horizontalAlignment = 'center';
  sheet.getRange(`E6:H${endRow}`).format.wrapText = true;
  if (tableInfo.name === 'properties') {
    rows.forEach((row, index) => {
      if (row[6] === 'Added in migration 006') sheet.getRange(`A${index + 6}:H${index + 6}`).format.fill = amber;
    });
  }
  sheet.getRange('A:A').format.columnWidth = 25;
  sheet.getRange('B:B').format.columnWidth = 20;
  sheet.getRange('C:D').format.columnWidth = 12;
  sheet.getRange('E:E').format.columnWidth = 42;
  sheet.getRange('F:F').format.columnWidth = 48;
  sheet.getRange('G:G').format.columnWidth = 24;
  sheet.getRange('H:H').format.columnWidth = 34;
  sheet.freezePanes.freezeRows(5);
}

workbook.recalculate();
await fs.mkdir(outputDir, { recursive: true });
for (const sheetName of ['Overview', 'Change Log', ...tables.map(table => table.name)]) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 0.8, format: 'png' });
  await fs.writeFile(`/tmp/ojix-data-dictionary-${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const inspection = await workbook.inspect({ kind: 'table', range: 'properties!A1:H40', include: 'values,formulas', tableMaxRows: 40, tableMaxCols: 8 });
console.log(inspection.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 300 }, summary: 'final formula error scan' });
console.log(errors.ndjson);
console.log(outputPath);
