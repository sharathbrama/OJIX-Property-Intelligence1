import fs from 'node:fs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const [, , sourcePath, ...flags] = process.argv;
if (!sourcePath) throw new Error('Usage: node scripts/import-karnataka-locations.mjs <kaveri.json> [--replace]');
const replace = flags.includes('--replace');
const databaseUrl = process.env.DATABASE_URL || 'mysql://ojix:ojix_local_only@127.0.0.1:3306/ojix_property_mysql';
const sourceUrl = 'https://kaveri.karnataka.gov.in/landing-page';
const sourceDate = '2026-10-08';

const rows = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(rows) || !rows.length) throw new Error('The Kaveri export contains no rows.');
const required = ['districtCode','districtName','talukCode','talukName','hobliCode','hobliName','villageCode','villageName'];
if (rows.some(row => required.some(key => !String(row[key] || '').trim()))) throw new Error(`Every row must contain: ${required.join(', ')}`);

const districts = new Map();
const taluks = new Map();
const hoblis = new Map();
const villages = new Map();
for (const row of rows) {
  const districtKey = String(row.districtCode);
  if (!districts.has(districtKey)) districts.set(districtKey, { id: crypto.randomUUID(), code: districtKey, name: row.districtName });
  const district = districts.get(districtKey);
  const talukKey = `${districtKey}:${row.talukCode}`;
  if (!taluks.has(talukKey)) taluks.set(talukKey, { id: crypto.randomUUID(), districtId: district.id, code: String(row.talukCode), name: row.talukName });
  const taluk = taluks.get(talukKey);
  const hobliKey = `${talukKey}:${row.hobliCode}`;
  if (!hoblis.has(hobliKey)) hoblis.set(hobliKey, { id: crypto.randomUUID(), talukId: taluk.id, code: String(row.hobliCode), name: row.hobliName });
  const hobli = hoblis.get(hobliKey);
  const villageKey = `${hobliKey}:${row.villageCode}`;
  if (!villages.has(villageKey)) villages.set(villageKey, { id: crypto.randomUUID(), hobliId: hobli.id, code: String(row.villageCode), name: row.villageName });
}

async function insertBatches(db, table, columns, records) {
  const batchSize = 500;
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize);
    const placeholders = batch.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const values = batch.flatMap(record => columns.map(column => record[column]));
    await db.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`, values);
  }
}

const db = await mysql.createConnection(databaseUrl);
await db.beginTransaction();
try {
  if (replace) {
    await db.query('UPDATE properties SET district_id=NULL, taluk_id=NULL, hobli_id=NULL, village_id=NULL');
    await db.query('DELETE FROM karnataka_villages');
    await db.query('DELETE FROM karnataka_hoblis');
    await db.query('DELETE FROM karnataka_taluks');
    await db.query('DELETE FROM karnataka_districts');
  } else {
    const [[count]] = await db.query('SELECT COUNT(*) AS total FROM karnataka_districts');
    if (Number(count.total)) throw new Error('Reference tables are not empty. Re-run with --replace to perform an atomic replacement.');
  }

  await insertBatches(db, 'karnataka_districts', ['id','name','code'], [...districts.values()].map(x => ({ id:x.id, name:x.name, code:x.code })));
  await insertBatches(db, 'karnataka_taluks', ['id','district_id','name','code'], [...taluks.values()].map(x => ({ id:x.id, district_id:x.districtId, name:x.name, code:x.code })));
  await insertBatches(db, 'karnataka_hoblis', ['id','taluk_id','name','code'], [...hoblis.values()].map(x => ({ id:x.id, taluk_id:x.talukId, name:x.name, code:x.code })));
  await insertBatches(db, 'karnataka_villages', ['id','hobli_id','name','code'], [...villages.values()].map(x => ({ id:x.id, hobli_id:x.hobliId, name:x.name, code:x.code })));

  await db.query(
    `UPDATE properties p
     JOIN karnataka_districts d ON LOWER(d.name)=LOWER(p.district)
     JOIN karnataka_taluks t ON t.district_id=d.id AND LOWER(t.name)=LOWER(p.taluk)
     JOIN karnataka_hoblis h ON h.taluk_id=t.id AND LOWER(h.name)=LOWER(p.hobli)
     JOIN karnataka_villages v ON v.hobli_id=h.id AND LOWER(v.name)=LOWER(p.village)
     SET p.district_id=d.id,p.taluk_id=t.id,p.hobli_id=h.id,p.village_id=v.id`
  );
  await db.query(
    `UPDATE properties p
     JOIN karnataka_districts d ON d.code='22'
     JOIN karnataka_taluks t ON t.district_id=d.id AND t.code='3'
     JOIN karnataka_hoblis h ON h.taluk_id=t.id AND h.code='1'
     JOIN karnataka_villages v ON v.hobli_id=h.id AND v.code=CASE WHEN p.id='3d61f298-1ac9-4819-acab-ed284e93e396' THEN '33' ELSE '17' END
     SET p.district='Mandya',p.taluk='Pandavapura',p.hobli='Kasaba1',p.village=v.name,
         p.district_id=d.id,p.taluk_id=t.id,p.hobli_id=h.id,p.village_id=v.id
     WHERE p.id IN ('3d61f298-1ac9-4819-acab-ed284e93e396','620aabdf-febf-419a-874a-56061eeb8ca1','764effaf-d960-43f2-8fca-b0faed0bc45b')`
  );
  await db.execute(
    'INSERT INTO karnataka_location_imports (id,source_name,source_date,completeness,notes) VALUES (?,?,?,?,?)',
    [crypto.randomUUID(), 'Kaveri 2.0 live registration hierarchy', sourceDate, 'complete', `Official live dropdown export. ${sourceUrl}. ${districts.size} districts, ${taluks.size} taluks, ${hoblis.size} hoblis/towns and ${villages.size} Index-II village mappings.`]
  );
  await db.commit();
  console.log(`Imported ${districts.size} districts, ${taluks.size} taluks, ${hoblis.size} hoblis/towns and ${villages.size} villages from Kaveri 2.0.`);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
