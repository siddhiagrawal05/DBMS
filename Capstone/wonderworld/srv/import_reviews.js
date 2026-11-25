require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

const FILE = path.resolve(__dirname, process.argv[2] || 'data/DisneylandReviews.csv');
const HEADER = ['Review_ID', 'Rating', 'Year_Month', 'Reviewer_Location', 'Review_Text', 'Branch'];

function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
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
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

(async () => {
  try {
    if (!fs.existsSync(FILE)) throw new Error(`CSV file not found: ${FILE}`);
    const lines = fs.readFileSync(FILE, 'latin1').split(/\r?\n/).filter((l) => l.trim());
    const head = parseLine(lines[0]).map((h) => h.trim());
    if (HEADER.some((h, i) => head[i] !== h)) throw new Error('This does not look like DisneylandReviews.csv (wrong columns).');

    const rows = [];
    let bad = 0;
    for (const line of lines.slice(1)) {
      const f = parseLine(line);
      if (f.length !== 6 || !/^\d+$/.test(f[0]) || !/^[1-5]$/.test(f[1])) {
        bad++;
        continue;
      }
      rows.push([Number(f[0]), Number(f[1]), f[2].trim(), f[3].trim(), f[4], f[5].trim()]);
    }
    console.log(`Read ${rows.length} rows from the CSV (${bad} bad rows skipped).`);

    await db.query('TRUNCATE TABLE raw_reviews');
    for (let i = 0; i < rows.length; i += 1000) {
      await db.query('INSERT INTO raw_reviews (review_id, rating, ym, reviewer_location, review_text, branch) VALUES ?', [rows.slice(i, i + 1000)]);
      process.stdout.write(`\rStaged ${Math.min(i + 1000, rows.length)} / ${rows.length}`);
    }
    console.log('\nNormalizing with sp_load_reviews() ...');
    const [result] = await db.query('CALL sp_load_reviews()');
    console.table(result[0]);
    console.log('Done.');
  } catch (e) {
    console.error('Import failed:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();