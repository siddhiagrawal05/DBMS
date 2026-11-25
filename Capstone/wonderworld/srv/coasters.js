const METRICS = ['speed', 'height', 'length', 'inversions'];

const SQL = {
  summary: 'SELECT * FROM v_coaster_summary ORDER BY coasters DESC',
  totals: "SELECT COUNT(*) AS coasters, SUM(status = 'Operating') AS operating,\n       COUNT(DISTINCT manufacturer_id) AS manufacturers,\n       MIN(year_introduced) AS first_year, MAX(year_introduced) AS last_year\nFROM coasters",
  decades: 'SELECT FLOOR(year_introduced / 10) * 10 AS decade, COUNT(*) AS coasters,\n       ROUND(AVG(speed_mph), 1) AS avg_speed_mph\nFROM coasters\nGROUP BY decade\nORDER BY decade',
  makers: "SELECT m.name AS manufacturer, COUNT(*) AS coasters,\n       ROUND(AVG(c.speed_mph), 1) AS avg_speed_mph, MAX(c.height_ft) AS max_height_ft\nFROM coasters c\nJOIN coaster_manufacturers m ON m.id = c.manufacturer_id\nGROUP BY m.id, m.name\nHAVING COUNT(*) >= 20\nORDER BY coasters DESC",
  top: 'CALL sp_top_coasters(?, 10)',
  linked: "SELECT r.id AS rideId, r.name AS ride, r.category, c.id AS coasterId, c.name, c.park, c.year_introduced,\n       m.name AS manufacturer, c.speed_mph, c.height_ft, c.length_ft, c.inversions\nFROM rides r\nLEFT JOIN coasters c ON c.id = r.coaster_id\nLEFT JOIN coaster_manufacturers m ON m.id = c.manufacturer_id\nWHERE r.category = 'Thrill'\nORDER BY r.id",
  search: "SELECT c.id, c.name, c.park, c.year_introduced, c.status, c.type_main, m.name AS manufacturer,\n       c.speed_mph, c.height_ft, c.length_ft, c.inversions\nFROM coasters c\nLEFT JOIN coaster_manufacturers m ON m.id = c.manufacturer_id\nWHERE c.name LIKE ? OR c.park LIKE ? OR m.name LIKE ?\nORDER BY c.status = 'Operating' DESC, c.speed_mph DESC\nLIMIT 15",
};

const num = (v) => (v === null || v === undefined ? null : Number(v));
const clean = (row) => {
  const out = { ...row };
  for (const k of ['speed_mph', 'height_ft', 'length_ft', 'avg_speed_mph', 'top_speed_mph', 'avg_height_ft', 'max_height_ft', 'avg_inversions', 'operating']) {
    if (k in out) out[k] = num(out[k]);
  }
  return out;
};

module.exports = function coasters({ app, db, auth, wrap, fail }) {
  app.get('/api/coasters/stats', auth('admin'), wrap(async (req, res) => {
    const metric = METRICS.includes(req.query.metric) ? req.query.metric : 'speed';
    const [[totals]] = await db.query(SQL.totals);
    if (!totals.coasters) return res.json({ empty: true, sql: SQL });
    const [summary] = await db.query(SQL.summary);
    const [decades] = await db.query(SQL.decades);
    const [makers] = await db.query(SQL.makers);
    const [[top]] = await db.query(SQL.top, [metric]);
    const [linked] = await db.query(SQL.linked);
    res.json({
      metric,
      totals: clean(totals),
      summary: summary.map(clean),
      decades: decades.map(clean),
      makers: makers.map(clean),
      top: top.map(clean),
      linked: linked.map(clean),
      sql: SQL,
    });
  }));

  app.get('/api/coasters/search', auth('admin'), wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) throw fail(400, 'Type at least 2 letters of a coaster, park or manufacturer name.');
    const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    const [rows] = await db.query(SQL.search, [like, like, like]);
    res.json(rows.map(clean));
  }));
};