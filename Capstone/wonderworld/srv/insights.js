const TOPICS = [
  ['Queues & waiting', 'queue* wait* line*'],
  ['Food', 'food restaurant* meal*'],
  ['Prices', 'price* expensive cost*'],
  ['Staff', 'staff friendly helpful'],
  ['Shows & fireworks', 'firework* parade* show*'],
  ['Crowds', 'crowd* busy packed'],
  ['Rude service', 'rude'],
];

const SQL = {
  summary: 'SELECT * FROM v_benchmark_summary ORDER BY reviews DESC',
  dist: 'SELECT park_id AS parkId, rating, COUNT(*) AS n\nFROM park_reviews\nGROUP BY park_id, rating\nORDER BY park_id, rating',
  trend: 'CALL sp_review_trend(?)',
  countries: 'SELECT c.name AS country, COUNT(*) AS reviews, ROUND(AVG(r.rating), 2) AS avg_rating\nFROM park_reviews r\nJOIN review_countries c ON c.id = r.country_id\nWHERE (? IS NULL OR r.park_id = ?)\nGROUP BY c.id, c.name\nORDER BY reviews DESC\nLIMIT 10',
  topic: "SELECT COUNT(*) AS reviews, ROUND(AVG(rating), 2) AS avg_rating\nFROM park_reviews\nWHERE MATCH(review_text) AGAINST(? IN BOOLEAN MODE)\n  AND (? IS NULL OR park_id = ?)",
  own: 'SELECT COUNT(*) AS reviews, ROUND(AVG(rating), 2) AS avg_rating FROM reviews',
  search: "SELECT r.id, p.name AS park, r.rating, r.visit_year AS year, r.visit_month AS month, c.name AS country,\n       LEFT(r.review_text, 320) AS text, CHAR_LENGTH(r.review_text) > 320 AS more\nFROM park_reviews r\nJOIN benchmark_parks p ON p.id = r.park_id\nLEFT JOIN review_countries c ON c.id = r.country_id\nWHERE MATCH(r.review_text) AGAINST(? IN BOOLEAN MODE)\n  AND (? IS NULL OR r.park_id = ?)\n  AND (? IS NULL OR r.rating = ?)\nORDER BY r.visit_year DESC, r.id DESC\nLIMIT 10",
};

module.exports = function insights({ app, db, auth, wrap, fail }) {
  const parkOf = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  app.get('/api/insights', auth('admin'), wrap(async (req, res) => {
    const park = parkOf(req.query.park);
    const [summary] = await db.query(SQL.summary);
    if (!summary.length || !summary.some((p) => p.reviews > 0)) {
      return res.json({ empty: true, sql: SQL });
    }
    const [dist] = await db.query(SQL.dist);
    const [[trend]] = await db.query(SQL.trend, [park]);
    const [countries] = await db.query(SQL.countries, [park, park]);
    const topics = [];
    for (const [label, words] of TOPICS) {
      const [[t]] = await db.query(SQL.topic, [words, park, park]);
      topics.push({ label, words, reviews: t.reviews, avgRating: t.avg_rating === null ? null : Number(t.avg_rating) });
    }
    const [[own]] = await db.query(SQL.own);
    res.json({
      summary: summary.map((p) => ({ ...p, avg_rating: Number(p.avg_rating), pct_five_star: Number(p.pct_five_star), pct_low: Number(p.pct_low) })),
      dist,
      trend: trend.map((t) => ({ ...t, avg_rating: Number(t.avg_rating) })),
      countries: countries.map((c) => ({ ...c, avg_rating: Number(c.avg_rating) })),
      topics,
      own: { reviews: own.reviews, avgRating: own.avg_rating === null ? null : Number(own.avg_rating) },
      sql: SQL,
    });
  }));

  app.get('/api/insights/search', auth('admin'), wrap(async (req, res) => {
    const words = String(req.query.q || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    if (!words.length) throw fail(400, 'Type a word with at least 3 letters, e.g. queue, food, fireworks.');
    const query = words.slice(0, 5).map((w) => `+${w}*`).join(' ');
    const park = parkOf(req.query.park);
    const r = Number(req.query.rating);
    const rating = Number.isInteger(r) && r >= 1 && r <= 5 ? r : null;
    const [[count]] = await db.query(
      "SELECT COUNT(*) AS total, ROUND(AVG(rating), 2) AS avg_rating FROM park_reviews WHERE MATCH(review_text) AGAINST(? IN BOOLEAN MODE) AND (? IS NULL OR park_id = ?) AND (? IS NULL OR rating = ?)",
      [query, park, park, rating, rating]
    );
    const [rows] = await db.query(SQL.search, [query, park, park, rating, rating]);
    res.json({ query, total: count.total, avgRating: count.avg_rating === null ? null : Number(count.avg_rating), rows: rows.map((x) => ({ ...x, more: !!x.more })) });
  }));
};