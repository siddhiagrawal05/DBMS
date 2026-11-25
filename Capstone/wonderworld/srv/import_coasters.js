require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

const FILE = path.resolve(__dirname, process.argv[2] || 'data/coaster_db.csv');
const COLS = [
  ['coaster_name', 'coaster_name'],
  ['Length', 'length_raw'],
  ['Location', 'location'],
  ['Status', 'status'],
  ['Type', 'type_raw'],
  ['Manufacturer', 'manufacturer'],
  ['Model', 'model'],
  ['Height', 'height_raw'],
  ['year_introduced', 'year_introduced'],
  ['latitude', 'latitude'],
  ['longitude', 'longitude'],
  ['Type_Main', 'type_main'],
  ['opening_date_clean', 'opening_date'],
  ['speed_mph', 'speed_mph'],
  ['Inversions_clean', 'inversions'],
  ['Gforce_clean', 'gforce'],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

(async () => {
  try {
    if (!fs.existsSync(FILE)) throw new Error(`CSV file not found: ${FILE}`);
    const [head, ...data] = parseCsv(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, ''));
    const idx = COLS.map(([csv]) => head.indexOf(csv));
    const missing = COLS.filter((c, i) => idx[i] < 0).map(([csv]) => csv);
    if (missing.length) throw new Error(`This does not look like coaster_db.csv. Missing columns: ${missing.join(', ')}`);

    const rows = data.map((r) => idx.map((i) => {
      const v = (r[i] ?? '').trim();
      return v === '' || v.toLowerCase() === 'nan' ? null : v;
    }));
    console.log(`Read ${rows.length} coasters from the CSV.`);

    await db.query('TRUNCATE TABLE raw_coasters');
    for (let i = 0; i < rows.length; i += 500) {
      await db.query(`INSERT INTO raw_coasters (${COLS.map(([, c]) => c).join(', ')}) VALUES ?`, [rows.slice(i, i + 500)]);
    }
    console.log('Cleaning with sp_load_coasters() ...');
    const [result] = await db.query('CALL sp_load_coasters()');
    console.table(result[0]);
    console.log('Done.');
  } catch (e) {
    console.error('Import failed:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();