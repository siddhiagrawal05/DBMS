import { useEffect, useState } from 'react';
import { FaGlobeAmericas, FaStar, FaSearch, FaDatabase, FaFlag, FaComments, FaChartLine } from 'react-icons/fa';
import { getInsights, searchInsights } from '../api';

const KAGGLE = 'https://www.kaggle.com/datasets/arushchillar/disneyland-reviews';
const pre = { margin: '8px 0 0', padding: 12, background: '#1A1108', color: '#F5E6C8', borderRadius: 10, fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' };
const barColor = (r) => (r >= 4.2 ? '' : r >= 3.8 ? 'warm' : 'hot');

function Sql({ code }) {
  if (!code) return null;
  return (
    <details style={{ marginTop: 10 }}>
      <summary className="small" style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--blue)' }}><FaDatabase /> Show SQL</summary>
      <pre style={pre}>{code}</pre>
    </details>
  );
}

function Bar({ pct, tone = '' }) {
  return <div className={`bar ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}

export default function Insights() {
  const [park, setPark] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [sPark, setSPark] = useState('');
  const [sRating, setSRating] = useState('');
  const [result, setResult] = useState(null);
  const [sErr, setSErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getInsights(park)
      .then((d) => live && (setData(d), setErr('')))
      .catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [park]);

  const search = async (e) => {
    e.preventDefault();
    setSErr('');
    setBusy(true);
    try {
      setResult(await searchInsights(q, sPark, sRating));
    } catch (x) {
      setSErr(x.message);
      setResult(null);
    }
    setBusy(false);
  };

  if (err) return <p className="card err">{err}</p>;
  if (!data) return <p className="card mut">Loading visitor insights...</p>;
  if (data.empty) {
    return (
      <div className="card">
        <h3 className="h"><FaGlobeAmericas /> Visitor Insights</h3>
        <p>The Kaggle reviews are not imported yet.</p>
        <ol className="small">
          <li>Run <b>srv/insights.sql</b> in MySQL Workbench.</li>
          <li>Put <b>DisneylandReviews.csv</b> in <b>srv/data/</b>.</li>
          <li>In the terminal: <b>cd srv</b> then <b>node import_reviews.js</b></li>
        </ol>
      </div>
    );
  }

  const parks = data.summary;
  const total = parks.reduce((s, p) => s + p.reviews, 0);
  const overall = total ? parks.reduce((s, p) => s + p.avg_rating * p.reviews, 0) / total : 0;
  const shown = park ? parks.filter((p) => p.id === +park) : parks;
  const scopeTotal = shown.reduce((s, p) => s + p.reviews, 0);
  const scopeAvg = scopeTotal ? shown.reduce((s, p) => s + p.avg_rating * p.reviews, 0) / scopeTotal : 0;
  const maxCountry = Math.max(1, ...data.countries.map((c) => c.reviews));
  const topics = [...data.topics].sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0));
  const worst = topics[0];

  return (
    <>
      <div className="row between">
        <h3 className="h"><FaGlobeAmericas /> Visitor Insights</h3>
        <a className="btn sm o dark" href={KAGGLE} target="_blank" rel="noreferrer">Dataset on Kaggle</a>
      </div>
      <p className="small mut mb">
        Real data: <b>Disneyland Reviews</b> dataset from Kaggle ({total.toLocaleString('en-IN')} TripAdvisor reviews, 2010–2019) imported into MySQL
        and normalized into <b>benchmark_parks</b>, <b>review_countries</b> and <b>park_reviews</b>. We use it as a benchmark to see what theme-park visitors care about.
      </p>

      <div className="toolbar">
        <button className={`chip ${!park ? 'on' : ''}`} onClick={() => setPark('')}>All parks</button>
        {parks.map((p) => (
          <button key={p.id} className={`chip ${+park === p.id ? 'on' : ''}`} onClick={() => setPark(String(p.id))}>{p.name}</button>
        ))}
      </div>

      <div className="mini-stats">
        {parks.map((p) => (
          <div key={p.id} style={{ opacity: !park || +park === p.id ? 1 : 0.45 }}>
            <small>{p.name} · {p.country}</small>
            <b><FaStar style={{ color: 'var(--gold)' }} /> {p.avg_rating.toFixed(2)}</b>
            <small>{p.reviews.toLocaleString('en-IN')} reviews · {p.pct_five_star}% five-star · {p.pct_low}% 1–2 star</small>
          </div>
        ))}
        <div style={{ background: '#E8EEFB' }}>
          <small>WonderWorld (our ride reviews)</small>
          <b><FaStar style={{ color: 'var(--gold)' }} /> {data.own.avgRating === null ? '—' : data.own.avgRating.toFixed(2)}</b>
          <small>{data.own.reviews} reviews · Disneyland average {overall.toFixed(2)}</small>
        </div>
      </div>
      <Sql code={`${data.sql.summary}\n\n${data.sql.own}`} />

      <div className="two gap-top" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 className="h"><FaStar /> Rating Distribution</h3>
          {shown.map((p) => {
            const rows = data.dist.filter((d) => d.parkId === p.id);
            return (
              <div key={p.id} style={{ marginBottom: 14 }}>
                <b className="small">{p.name}</b>
                {[5, 4, 3, 2, 1].map((r) => {
                  const n = rows.find((d) => d.rating === r)?.n || 0;
                  const pct = p.reviews ? (n * 100) / p.reviews : 0;
                  return (
                    <div key={r} className="row nowrap small" style={{ gap: 8 }}>
                      <span style={{ width: 26 }}>{r}★</span>
                      <div style={{ flex: 1 }}><Bar pct={pct} tone={r >= 4 ? '' : r === 3 ? 'warm' : 'hot'} /></div>
                      <span style={{ width: 92, textAlign: 'right' }}>{pct.toFixed(1)}% ({n.toLocaleString('en-IN')})</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <Sql code={data.sql.dist} />
        </div>

        <div className="card">
          <h3 className="h"><FaChartLine /> Average Rating by Year</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Year</th><th>Reviews</th><th>Avg rating</th><th style={{ width: '40%' }} /></tr></thead>
              <tbody>
                {data.trend.map((t) => (
                  <tr key={t.visit_year}>
                    <td><b>{t.visit_year}</b></td>
                    <td>{t.reviews.toLocaleString('en-IN')}</td>
                    <td>{t.avg_rating.toFixed(2)}</td>
                    <td><Bar pct={((t.avg_rating - 3) / 2) * 100} tone={barColor(t.avg_rating)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Sql code={data.sql.trend.replace('?', park || 'NULL')} />
        </div>
      </div>

      <div className="two gap-top" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 className="h"><FaComments /> What Visitors Talk About</h3>
          <p className="small mut">Counted with a MySQL <b>FULLTEXT</b> index on the review text. Overall average here: <b>{scopeAvg.toFixed(2)}★</b>.</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Topic</th><th>Reviews</th><th>Avg rating</th></tr></thead>
              <tbody>
                {topics.map((t) => (
                  <tr key={t.label}>
                    <td><b>{t.label}</b><div className="small mut">{t.words}</div></td>
                    <td>{t.reviews.toLocaleString('en-IN')}<div className="small mut">{scopeTotal ? ((t.reviews * 100) / scopeTotal).toFixed(1) : 0}% of reviews</div></td>
                    <td style={{ minWidth: 120 }}>{t.avgRating === null ? '—' : t.avgRating.toFixed(2)}<Bar pct={t.avgRating ? ((t.avgRating - 2.5) / 2.5) * 100 : 0} tone={barColor(t.avgRating ?? 0)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {worst && worst.avgRating !== null && (
            <p className="rule small" style={{ marginTop: 10 }}>
              <span>Reviews about <b>{worst.label.toLowerCase()}</b> average only <b>{worst.avgRating.toFixed(2)}★</b>, against {scopeAvg.toFixed(2)}★ overall. That is what WonderWorld should watch most.</span>
            </p>
          )}
          <Sql code={data.sql.topic} />
        </div>

        <div className="card">
          <h3 className="h"><FaFlag /> Top Reviewer Countries</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Country</th><th>Reviews</th><th>Avg</th></tr></thead>
              <tbody>
                {data.countries.map((c) => (
                  <tr key={c.country}>
                    <td><b>{c.country}</b><Bar pct={(c.reviews * 100) / maxCountry} tone="warm" /></td>
                    <td>{c.reviews.toLocaleString('en-IN')}</td>
                    <td>{c.avg_rating.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Sql code={data.sql.countries} />
        </div>
      </div>

      <div className="card gap-top">
        <h3 className="h"><FaSearch /> Search Real Reviews</h3>
        <form onSubmit={search} className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
          <label style={{ flex: 2, minWidth: 200 }}>Word(s)
            <input required value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. fast pass, food, fireworks" />
          </label>
          <label style={{ flex: 1, minWidth: 150 }}>Park
            <select value={sPark} onChange={(e) => setSPark(e.target.value)}>
              <option value="">All parks</option>
              {parks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 120 }}>Rating
            <select value={sRating} onChange={(e) => setSRating(e.target.value)}>
              <option value="">Any</option>
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}★</option>)}
            </select>
          </label>
          <button className="btn" disabled={busy}>{busy ? 'Searching...' : 'Search'}</button>
        </form>
        {sErr && <p className="err">{sErr}</p>}
        {result && (
          <>
            <p className="small gap-top">
              <b>{result.total.toLocaleString('en-IN')}</b> reviews match <code>{result.query}</code>
              {result.avgRating !== null && <> · average <b>{result.avgRating.toFixed(2)}★</b></>}
              {result.total > 10 && ' · showing the 10 newest'}
            </p>
            {result.rows.map((r) => (
              <div key={r.id} className="park-row" style={{ display: 'block', padding: '10px 0' }}>
                <div className="row between nowrap small">
                  <b>{r.park}</b>
                  <span>{'★'.repeat(r.rating)}<span className="mut">{'★'.repeat(5 - r.rating)}</span></span>
                </div>
                <p className="small mut" style={{ margin: '2px 0 4px' }}>{r.country || 'Unknown country'} · {r.year ? `${r.month}/${r.year}` : 'date missing'} · review #{r.id}</p>
                <p className="small" style={{ margin: 0 }}>{r.text}{r.more ? '…' : ''}</p>
              </div>
            ))}
            <Sql code={data.sql.search} />
          </>
        )}
      </div>
    </>
  );
}