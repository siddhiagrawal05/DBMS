import { useEffect, useState } from 'react';
import { FaBolt, FaDatabase, FaLink, FaUnlink, FaSearch, FaTrophy, FaIndustry, FaHistory, FaLayerGroup } from 'react-icons/fa';
import { getCoasterStats, searchCoasters, upsert } from '../api';

const KAGGLE = 'https://www.kaggle.com/datasets/robikscube/rollercoaster-database';
const METRICS = [
  ['speed', 'Fastest', 'speed_mph', 'mph'],
  ['height', 'Tallest', 'height_ft', 'ft'],
  ['length', 'Longest', 'length_ft', 'ft'],
  ['inversions', 'Most inversions', 'inversions', 'inversions'],
];
const pre = { margin: '8px 0 0', padding: 12, background: '#1A1108', color: '#F5E6C8', borderRadius: 10, fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' };
const fmt = (v, unit) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-IN')} ${unit}`);
const kmh = (mph) => (mph ? ` (${Math.round(mph * 1.609)} km/h)` : '');

function Sql({ code }) {
  return (
    <details style={{ marginTop: 10 }}>
      <summary className="small" style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--blue)' }}><FaDatabase /> Show SQL</summary>
      <pre style={pre}>{code}</pre>
    </details>
  );
}

function Specs({ c }) {
  return (
    <span className="small mut">
      {c.park ? `${c.park} · ` : ''}{c.year_introduced} · {c.manufacturer || 'Unknown maker'} · {fmt(c.speed_mph, 'mph')} · {fmt(c.height_ft, 'ft')} high · {fmt(c.length_ft, 'ft')} long · {c.inversions} inversions
    </span>
  );
}

export default function Coasters() {
  const [metric, setMetric] = useState('speed');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [picking, setPicking] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [sErr, setSErr] = useState('');

  useEffect(() => {
    let live = true;
    getCoasterStats(metric)
      .then((d) => live && (setData(d), setErr('')))
      .catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [metric, tick]);

  const search = async (e) => {
    e.preventDefault();
    setSErr('');
    try {
      setFound(await searchCoasters(q));
    } catch (x) {
      setSErr(x.message);
      setFound(null);
    }
  };

  const link = async (rideId, coasterId) => {
    try {
      await upsert('rides', { id: rideId, coasterId });
      setPicking(null);
      setFound(null);
      setQ('');
      setTick((t) => t + 1);
    } catch (x) {
      alert(x.message);
    }
  };

  if (err) return <p className="card err">{err}</p>;
  if (!data) return <p className="card mut">Loading coaster data...</p>;
  if (data.empty) {
    return (
      <div className="card">
        <h3 className="h"><FaBolt /> Coaster Data</h3>
        <p>The Kaggle coaster data is not imported yet.</p>
        <ol className="small">
          <li>Run <b>srv/coasters.sql</b> in MySQL Workbench.</li>
          <li>Put <b>coaster_db.csv</b> in <b>srv/data/</b>.</li>
          <li>In the terminal: <b>cd srv</b> then <b>node import_coasters.js</b></li>
        </ol>
      </div>
    );
  }

  const t = data.totals;
  const [, mLabel, mKey, mUnit] = METRICS.find(([k]) => k === metric);
  const maxDecade = Math.max(1, ...data.decades.map((d) => d.coasters));
  const maxMaker = Math.max(1, ...data.makers.map((m) => m.coasters));

  return (
    <>
      <div className="row between">
        <h3 className="h"><FaBolt /> Coaster Data</h3>
        <a className="btn sm o dark" href={KAGGLE} target="_blank" rel="noreferrer">Dataset on Kaggle</a>
      </div>
      <p className="small mut mb">
        Real data: <b>Roller Coaster Database</b> from Kaggle (scraped from Wikipedia, CC0 public domain). Cleaned in MySQL with <b>fn_to_feet()</b> and <b>sp_load_coasters()</b>{' '}
        into <b>coasters</b> and <b>coaster_manufacturers</b>. Our thrill rides are linked to real coasters through <b>rides.coaster_id</b>.
      </p>

      <div className="mini-stats">
        <div><small>Coasters</small><b>{t.coasters.toLocaleString('en-IN')}</b></div>
        <div><small>Still operating</small><b>{t.operating}</b></div>
        <div><small>Manufacturers</small><b>{t.manufacturers}</b></div>
        <div><small>Years covered</small><b>{t.first_year}–{t.last_year}</b></div>
        <div><small>Our rides linked</small><b>{data.linked.filter((r) => r.coasterId).length} / {data.linked.length}</b></div>
      </div>

      <div className="card gap-top">
        <h3 className="h"><FaLink /> Our Thrill Rides, Modelled on Real Coasters</h3>
        <p className="small mut">Each link shows real height, speed and length on the public Rides page. Drop towers and pendulum rides are not coasters, so they can stay unlinked.</p>
        {data.linked.map((r) => (
          <div key={r.rideId} className="park-row" style={{ display: 'block', padding: '10px 0' }}>
            <div className="row between" style={{ gap: 8 }}>
              <span><b>{r.ride}</b>{r.coasterId ? <> → <b style={{ color: 'var(--blue)' }}>{r.name}</b></> : <span className="small mut"> · not linked</span>}</span>
              <span className="row nowrap" style={{ gap: 6 }}>
                <button className="add" onClick={() => { setPicking(picking === r.rideId ? null : r.rideId); setFound(null); setSErr(''); }}>{r.coasterId ? 'Change' : 'Link a coaster'}</button>
                {r.coasterId && <button className="add" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }} onClick={() => link(r.rideId, null)}><FaUnlink /> Unlink</button>}
              </span>
            </div>
            {r.coasterId && <Specs c={r} />}
            {picking === r.rideId && (
              <div style={{ marginTop: 8 }}>
                <form onSubmit={search} className="row nowrap" style={{ gap: 8 }}>
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coaster, park or maker, e.g. Intamin" style={{ margin: 0 }} />
                  <button className="btn sm" style={{ marginTop: 0 }}><FaSearch /> Search</button>
                </form>
                {sErr && <p className="err">{sErr}</p>}
                {found && !found.length && <p className="small mut">No coasters found.</p>}
                {found && found.map((c) => (
                  <div key={c.id} className="row between nowrap" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid #F3EDE0' }}>
                    <span><b className="small">{c.name}</b><br /><Specs c={c} /></span>
                    <button className="btn sm" style={{ marginTop: 0 }} onClick={() => link(r.rideId, c.id)}>Link</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <Sql code={`${data.sql.linked}\n\n${data.sql.search}`} />
      </div>

      <div className="card gap-top">
        <div className="row between">
          <h3 className="h" style={{ margin: 0 }}><FaTrophy /> Top 10 Real Coasters</h3>
          <div className="row" style={{ gap: 6 }}>
            {METRICS.map(([k, label]) => (
              <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="tbl-wrap gap-top">
          <table className="tbl">
            <thead><tr><th>#</th><th>Coaster</th><th>Park</th><th>Year</th><th>Maker</th><th>{mLabel}</th></tr></thead>
            <tbody>
              {data.top.map((c, i) => (
                <tr key={c.name + c.year_introduced}>
                  <td><b>{i + 1}</b></td>
                  <td><b>{c.name}</b><div className="small mut">{c.type_main}</div></td>
                  <td>{c.park || '—'}</td>
                  <td>{c.year_introduced}</td>
                  <td>{c.manufacturer || '—'}</td>
                  <td><b>{fmt(c[mKey], mUnit)}</b>{metric === 'speed' && <span className="small mut">{kmh(c.speed_mph)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Sql code={data.sql.top.replace('?', `'${metric}'`)} />
      </div>

      <div className="two gap-top" style={{ alignItems: 'start' }}>
        <div className="card" style={{ minWidth: 0 }}>
          <h3 className="h"><FaLayerGroup /> Steel vs Wood</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Type</th><th>Coasters</th><th>Operating</th><th>Avg speed</th><th>Top speed</th><th>Avg height</th></tr></thead>
              <tbody>
                {data.summary.map((s) => (
                  <tr key={s.type_main}>
                    <td><b>{s.type_main}</b></td>
                    <td>{s.coasters}</td>
                    <td>{s.operating}</td>
                    <td>{fmt(s.avg_speed_mph, 'mph')}</td>
                    <td>{fmt(s.top_speed_mph, 'mph')}</td>
                    <td>{fmt(s.avg_height_ft, 'ft')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Sql code={data.sql.summary} />

          <h3 className="h gap-top"><FaIndustry /> Biggest Manufacturers</h3>
          {data.makers.map((m) => (
            <div key={m.manufacturer} style={{ marginBottom: 8 }}>
              <div className="row between small" style={{ gap: 4 }}><b>{m.manufacturer}</b><span>{m.coasters} coasters · avg {fmt(m.avg_speed_mph, 'mph')}</span></div>
              <div className="bar warm"><i style={{ width: `${(m.coasters * 100) / maxMaker}%` }} /></div>
            </div>
          ))}
          <Sql code={data.sql.makers} />
        </div>

        <div className="card" style={{ minWidth: 0 }}>
          <h3 className="h"><FaHistory /> Coasters by Decade</h3>
          {data.decades.map((d) => (
            <div key={d.decade} style={{ marginBottom: 8 }}>
              <div className="row between nowrap small"><b>{d.decade}s</b><span>{d.coasters} coaster{d.coasters === 1 ? '' : 's'}{d.avg_speed_mph !== null ? ` · avg ${fmt(d.avg_speed_mph, 'mph')}` : ''}</span></div>
              <div className="bar"><i style={{ width: `${(d.coasters * 100) / maxDecade}%` }} /></div>
            </div>
          ))}
          <Sql code={data.sql.decades} />
        </div>
      </div>
    </>
  );
}