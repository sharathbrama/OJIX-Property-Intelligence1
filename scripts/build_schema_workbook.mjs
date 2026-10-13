import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectDir = process.cwd();
const schemaPath = path.join(projectDir, "database", "mysql-schema.sql");
const outputDir = path.join(projectDir, "outputs");
const outputPath = path.join(outputDir, "OJIX_Database_Table_Definitions.xlsx");

const sql = await fs.readFile(schemaPath, "utf8");
const tablePattern = /CREATE TABLE IF NOT EXISTS\s+`?([A-Za-z0-9_]+)`?\s*\(([\s\S]*?)\)\s*ENGINE=/gi;
const ignoredPrefixes = /^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|CHECK|INDEX)\b/i;
const tables = [];

for (const match of sql.matchAll(tablePattern)) {
  const [, tableName, body] = match;
  const columns = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line || line.startsWith("/*") || line.startsWith("*") || line.startsWith("--") || ignoredPrefixes.test(line)) continue;
    const columnMatch = line.match(/^`?([A-Za-z_][A-Za-z0-9_]*)`?\s+(.+)$/);
    if (!columnMatch) continue;
    const [, columnName, definition] = columnMatch;
    const typeMatch = definition.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?(?:\([^)]*\))?(?:\s+UNSIGNED)?)/i);
    if (!typeMatch) continue;
    let dataType = typeMatch[1].toUpperCase();
    dataType = dataType.replace(/\s+(NOT|NULL|DEFAULT|PRIMARY|UNIQUE|AUTO_INCREMENT).*$/i, "").trim();
    columns.push({ columnName, dataType });
  }
  tables.push({ tableName, columns });
}

if (!tables.length) throw new Error("No CREATE TABLE definitions found in the MariaDB schema.");

const workbook = Workbook.create();
const titleFill = "#000000";
const headerFill = "#E6E6E6";
const accentFill = "#F7F7F7";
const borderColor = "#BFBFBF";
const fontName = "Arial";

function typeMeaning(dataType) {
  const base = dataType.split(/[\s(]/)[0];
  const meanings = {
    CHAR: "Fixed-length character value.",
    VARCHAR: "Variable-length text with a defined maximum size.",
    TEXT: "Variable-length text for longer or less predictable content.",
    DATETIME: "Date and time value, including fractional seconds when specified.",
    BOOLEAN: "True/false flag; MariaDB stores this as a small integer.",
    INT: "Whole number within the standard integer range.",
    BIGINT: "Large whole number for values that may exceed the standard integer range.",
    DECIMAL: "Exact fixed-precision numeric value.",
    DOUBLE: "Floating-point numeric value for measurements requiring a broad range.",
    JSON: "Structured JSON document with flexible keys and nested values.",
    GEOMETRY: "Spatial geometry value used for geographic shapes and spatial queries.",
  };
  return meanings[base] || "Database value stored using the declared MariaDB type.";
}

function whyUsed(columnName, dataType) {
  const name = columnName.toLowerCase();
  const base = dataType.split(/[\s(]/)[0];
  if (name === "id") return "Stores a stable UUID-style identifier for the record and supports reliable references from other tables.";
  if (name.endsWith("_id")) return "Stores the identifier of a related record so tables can be linked without duplicating the related data.";
  if (name.endsWith("_at") || name.endsWith("_date") || name === "source_date") return "Records when the event occurred or when the record was created, updated, published, or verified.";
  if (name === "latitude" || name === "longitude") return "Stores geographic coordinates with decimal precision for mapping and proximity calculations.";
  if (name === "geom" || name.includes("geojson")) return "Stores spatial information used for map display, boundaries, distance checks, and location-based analysis.";
  if (base === "JSON") return "The structure may vary between records, so JSON preserves flexible structured details without adding many optional columns.";
  if (base === "BOOLEAN") return "Represents an enabled/disabled or yes/no setting clearly and efficiently.";
  if (name.includes("size_bytes")) return "File sizes can be large, so BIGINT prevents overflow while keeping the value numeric and sortable.";
  if (name.includes("count") || name.includes("points") || name.includes("latency") || name.includes("version")) return "Stores a whole-number measurement used for counting, scoring, timing, or version tracking.";
  if (base === "DECIMAL") return "Uses exact precision so legal, survey, percentage, distance, or configuration values do not gain floating-point rounding errors.";
  if (base === "CHAR" && /\(36\)/.test(dataType)) return "Uses a fixed 36-character field because UUID identifiers always have the same textual length.";
  if (base === "VARCHAR") return "The value has a practical maximum length and is commonly filtered, indexed, validated, or compared.";
  if (base === "TEXT") return "The content can vary significantly in length, so a fixed short limit would be unnecessarily restrictive.";
  if (base === "DATETIME") return "Preserves date and time for audit history, ordering, and operational tracking.";
  if (base === "GEOMETRY") return "Enables MariaDB spatial functions for map features and proximity checks.";
  if (base === "DOUBLE") return "Provides sufficient range and precision for approximate geographic or measurement values.";
  return "Matches the expected form and size of this field while supporting storage and query operations.";
}

const index = workbook.worksheets.add("Table Index");
index.showGridLines = false;
index.tabColor = titleFill;
index.getRange("A2:C2").merge();
index.getRange("A2").values = [["OJIX database table definitions"]];
index.getRange("A2:C2").format.font = { name: fontName, size: 15, bold: true, color: "#000000" };
index.getRange("A3:C3").merge();
index.getRange("A3").values = [["Source: database/mysql-schema.sql"]];
index.getRange("A3:C3").format.font = { name: fontName, size: 10, italic: true, color: "#666666" };
index.getRange("A5:C5").values = [["Table Name", "Worksheet", "Column Count"]];
index.getRange("A5:C5").format.fill = headerFill;
index.getRange("A5:C5").format.font = { name: fontName, size: 10, bold: true, color: "#000000" };
index.getRange("A5:C5").format.horizontalAlignment = "center";
const indexRows = tables.map(t => [t.tableName, t.tableName, t.columns.length]);
index.getRangeByIndexes(5, 0, indexRows.length, 3).values = indexRows;
index.getRange(`A6:C${5 + indexRows.length}`).format.font = { name: fontName, size: 10, color: "#222222" };
index.getRange(`A5:C${5 + indexRows.length}`).format.borders = { preset: "all", style: "thin", color: borderColor };
index.getRange(`C6:C${5 + indexRows.length}`).setNumberFormat("0");
index.getRange(`C6:C${5 + indexRows.length}`).format.horizontalAlignment = "right";
index.getRange("A:A").format.columnWidth = 34;
index.getRange("B:B").format.columnWidth = 34;
index.getRange("C:C").format.columnWidth = 15;
index.freezePanes.freezeRows(5);

for (const table of tables) {
  const sheet = workbook.worksheets.add(table.tableName);
  sheet.showGridLines = false;
  sheet.getRange("A2:D2").merge();
  sheet.getRange("A2").values = [[table.tableName]];
  sheet.getRange("A2:D2").format.font = { name: fontName, size: 14, bold: true, color: "#000000" };
  sheet.getRange("A3:D3").merge();
  sheet.getRange("A3").values = [[`${table.columns.length} columns`]];
  sheet.getRange("A3:D3").format.font = { name: fontName, size: 10, italic: true, color: "#666666" };
  sheet.getRange("A5:D5").values = [["Column Name", "Data Type", "What the Type Means", "Why This Type Is Used"]];
  sheet.getRange("A5:D5").format.fill = headerFill;
  sheet.getRange("A5:D5").format.font = { name: fontName, size: 10, bold: true, color: "#000000" };
  sheet.getRange("A5:D5").format.horizontalAlignment = "center";
  const rows = table.columns.map(c => [c.columnName, c.dataType, typeMeaning(c.dataType), whyUsed(c.columnName, c.dataType)]);
  if (rows.length) {
    sheet.getRangeByIndexes(5, 0, rows.length, 4).values = rows;
    sheet.getRange(`A6:D${5 + rows.length}`).format.font = { name: fontName, size: 10, color: "#222222" };
    sheet.getRange(`C6:D${5 + rows.length}`).format.wrapText = true;
    sheet.getRange(`C6:D${5 + rows.length}`).format.verticalAlignment = "top";
    sheet.getRange(`A6:B${5 + rows.length}`).format.verticalAlignment = "top";
    for (let row = 6; row <= 5 + rows.length; row += 2) sheet.getRange(`A${row}:D${row}`).format.fill = accentFill;
  }
  sheet.getRange(`A5:D${Math.max(5, 5 + rows.length)}`).format.borders = { preset: "all", style: "thin", color: borderColor };
  sheet.getRange("A:A").format.columnWidth = 34;
  sheet.getRange("B:B").format.columnWidth = 24;
  sheet.getRange("C:C").format.columnWidth = 42;
  sheet.getRange("D:D").format.columnWidth = 72;
  if (rows.length) sheet.getRange(`A6:D${5 + rows.length}`).format.autofitRows();
  sheet.freezePanes.freezeRows(5);
}

workbook.recalculate();

const indexCheck = await workbook.inspect({
  kind: "table",
  range: `Table Index!A1:C${5 + tables.length}`,
  include: "values,formulas",
  tableMaxRows: 30,
  tableMaxCols: 5,
});
console.log(indexCheck.ndjson);

const errorCheck = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errorCheck.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const preview = await workbook.render({ sheetName: "Table Index", range: `A1:C${5 + tables.length}`, scale: 1.5 });
await fs.writeFile(path.join(outputDir, "OJIX_Database_Table_Definitions_preview.png"), new Uint8Array(await preview.arrayBuffer()));

const detailPreview = await workbook.render({ sheetName: "organizations", range: "A1:D10", scale: 1.25 });
await fs.writeFile(path.join(outputDir, "OJIX_Database_Table_Definitions_detail_preview.png"), new Uint8Array(await detailPreview.arrayBuffer()));

console.log(JSON.stringify({ outputPath, tableCount: tables.length, tables: tables.map(t => ({ name: t.tableName, columns: t.columns.length })) }, null, 2));
