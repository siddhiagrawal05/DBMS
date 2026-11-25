import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaDirections, FaCar, FaBus, FaTrain, FaParking, FaClock, FaRulerVertical, FaChild, FaUsers, FaTimes, FaCalendarAlt, FaExclamationTriangle } from 'react-icons/fa';
import { all, PICS } from '../api';
import Banner from '../components/Banner';
import Badge from '../components/Badge';
import Img from '../components/Img';

const PARK_ADDRESS = 'WonderWorld Road, Near Expressway, Pune, Maharashtra';
const MAP_QUERY = 'Pune, Maharashtra';

const CATS = ['Thrill', 'Water', 'Family', 'Kids'];

const ZONES = {
  Thrill: { name: 'Thrill Zone', color: '#E26E18', x: 50, y: 50, gate: [410, 200] },
  Water: { name: 'Water Kingdom', color: '#1E6ED2', x: 590, y: 50, gate: [590, 200] },
  Family: { name: 'Family Fun', color: '#6228C8', x: 50, y: 300, gate: [410, 360] },
  Kids: { name: 'Kids Land', color: '#7E9612', x: 590, y: 300, gate: [590, 360] },
};
const ZW = 360;
const ZH = 210;
const SLOTS = [[65, 92], [180, 92], [295, 92], [65, 165], [180, 165], [295, 165]];

const STATUS_COLOR = { Open: '#16a34a', Closed: '#dc2626', 'Under Maintenance': '#f59e0b' };

const FACILITIES = [
  { label: 'Guest Services', short: 'i', x: 320, y: 536, color: '#1E44A8' },
  { label: 'Ticket Counter', short: 'T', x: 430, y: 536, color: '#1E44A8' },
  { label: 'Lockers', short: 'L', x: 570, y: 536, color: '#334155' },
  { label: 'First Aid', short: '+', x: 680, y: 536, color: '#dc2626' },
];
const SMALL = [
  { label: 'Restrooms', short: 'WC', color: '#0E7490', spots: [[500, 95], [455, 450]] },
  { label: 'Drinking Water', short: 'W', color: '#0284C7', spots: [[500, 150], [545, 450]] },
];

const label = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 };
const dot = (bg) => ({ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', background: bg, color: '#fff', fontWeight: 700, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

export default function ParkMap() {
  const [sel, setSel] = useState(null);
  const [cat, setCat] = useState('All');
  const nav = useNavigate();

  const scheds = all('schedules');
  const restaurants = all('restaurants');
  const shops = all('shops');

  const placed = [];
  CATS.forEach((c) => {
    const z = ZONES[c];
    all('rides')
      .filter((r) => r.category === c)
      .forEach((r, i) => {
        const [sx, sy] = SLOTS[i % SLOTS.length];
        const extra = Math.floor(i / SLOTS.length) * 22;
        placed.push({ ...r, num: placed.length + 1, x: z.x + sx + extra, y: z.y + sy + extra });
      });
  });

  const ride = placed.find((r) => r.id === sel);
  const shown = (r) => cat === 'All' || r.category === cat;
  const zonesShown = cat === 'All' ? CATS : [cat];

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(MAP_QUERY)}`;
  const embed = `https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=13&output=embed`;

  return (
    <>
      <Banner img={PICS.zFamily} title="Park Map" sub="Find every ride, food court and facility" />

      <section className="sec cream">
        <div className="head">
          <h2>Explore The <span className="hl">Park</span></h2>
          <p className="mut">Enter at the Main Gate, walk up to the Central Plaza, and every zone is one short path away</p>
        </div>

        <div className="toolbar" style={{ justifyContent: 'center' }}>
          {['All', ...CATS].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
              {c === 'All' ? 'All Zones' : ZONES[c].name}
            </button>
          ))}
        </div>

        <div className="book">
          <div className="card" style={{ padding: 12 }}>
            <svg viewBox="0 0 1000 720" style={{ width: '100%', display: 'block', borderRadius: 16, background: '#EEF2E6' }}>
              <rect x="20" y="20" width="960" height="580" rx="40" fill="#CFE8B5" stroke="#7FB069" strokeWidth="6" />

              <g>
                <rect x="290" y="628" width="420" height="78" rx="14" fill="#D9DEE5" stroke="#94A3B8" strokeWidth="2" />
                {Array.from({ length: 13 }, (_, i) => (
                  <line key={i} x1={312 + i * 31} y1="636" x2={312 + i * 31} y2="660" stroke="#fff" strokeWidth="2" />
                ))}
                <text x="500" y="690" textAnchor="middle" fontFamily="'Lilita One', cursive" fontSize="18" fill="#334155">P  PARKING · Cars & Bikes</text>
                <path d="M20 667 L290 667" stroke="#94A3B8" strokeWidth="18" strokeLinecap="round" />
                <text x="150" y="672" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">ENTRY ROAD</text>
              </g>

              <g stroke="#F3E2BC" strokeWidth="26" strokeLinecap="round" fill="none">
                <path d="M500 600 L500 352" />
                {CATS.map((c) => <path key={c} d={`M500 280 L${ZONES[c].gate[0]} ${ZONES[c].gate[1]}`} />)}
                <path d="M500 208 L500 70" />
                <path d="M300 536 L700 536" />
              </g>

              {CATS.map((c) => {
                const z = ZONES[c];
                const dim = cat !== 'All' && cat !== c;
                return (
                  <g key={c} opacity={dim ? 0.3 : 1} onClick={() => setCat(cat === c ? 'All' : c)} style={{ cursor: 'pointer' }}>
                    <title>{`${z.name} – tap to show only this zone`}</title>
                    <rect x={z.x} y={z.y} width={ZW} height={ZH} rx="34" fill="#fff" fillOpacity="0.55" stroke={z.color} strokeWidth="4" />
                    <rect x={z.x} y={z.y} width={ZW} height="46" rx="20" fill={z.color} fillOpacity="0.15" />
                    <text x={z.x + 22} y={z.y + 32} fontFamily="'Lilita One', cursive" fontSize="24" fill={z.color}>{z.name}</text>
                    <text x={z.x + ZW - 20} y={z.y + 31} textAnchor="end" fontSize="13" fontWeight="700" fill={z.color}>
                      {placed.filter((r) => r.category === c).length} rides
                    </text>
                  </g>
                );
              })}

              <path d="M800 205 q40 -18 90 -4 q30 12 -6 30 q-50 14 -90 0 q-20 -12 6 -26 z" fill="#7DD3FC" opacity="0.8" />
              <text x="840" y="223" textAnchor="middle" fontSize="11" fontWeight="700" fill="#075985">Wave Pool</text>

              <g onClick={() => nav('/plaza')} style={{ cursor: 'pointer' }}>
                <title>Central Plaza – tap to see food, shops and live shows</title>
                <circle cx="500" cy="280" r="76" fill="#F5B84A" stroke="#fff" strokeWidth="6" />
                <text x="500" y="262" textAnchor="middle" fontFamily="'Lilita One', cursive" fontSize="20" fill="#1A1108">Central Plaza</text>
                <text x="500" y="283" textAnchor="middle" fontFamily="Quicksand, sans-serif" fontWeight="700" fontSize="12" fill="#1A1108">{restaurants.length} Restaurants · {shops.length} Shops</text>
                <text x="500" y="300" textAnchor="middle" fontFamily="Quicksand, sans-serif" fontWeight="700" fontSize="12" fill="#1A1108">Live Show Stage</text>
                <text x="500" y="320" textAnchor="middle" fontFamily="Quicksand, sans-serif" fontWeight="700" fontSize="11" fill="#1E44A8">Tap to explore</text>
              </g>

              {SMALL.map((f) => f.spots.map(([x, y]) => (
                <g key={f.label + x + y} transform={`translate(${x},${y})`}>
                  <title>{f.label}</title>
                  <circle r="13" fill={f.color} stroke="#fff" strokeWidth="3" />
                  <text textAnchor="middle" dy="4" fontSize={f.short.length > 1 ? 9 : 12} fontWeight="700" fill="#fff">{f.short}</text>
                </g>
              )))}

              {FACILITIES.map((f) => (
                <g key={f.label} transform={`translate(${f.x},${f.y})`}>
                  <title>{f.label}</title>
                  <circle r="15" fill={f.color} stroke="#fff" strokeWidth="3" />
                  <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fill="#fff">{f.short}</text>
                  <text textAnchor="middle" y="31" fontSize="12" fill="#1A1108" style={label}>{f.label}</text>
                </g>
              ))}

              <rect x="430" y="582" width="140" height="38" rx="10" fill="#1E44A8" stroke="#fff" strokeWidth="3" />
              <text x="500" y="607" textAnchor="middle" fontFamily="'Lilita One', cursive" fontSize="18" fill="#fff">MAIN GATE</text>
              <g transform="translate(590,602)">
                <path d="M0 0 c-9 -14 -9 -24 0 -24 c9 0 9 10 0 24 z" fill="#dc2626" stroke="#fff" strokeWidth="2" />
                <circle cy="-16" r="3.5" fill="#fff" />
                <text x="12" y="-10" fontSize="12" fill="#dc2626" style={label}>You are here</text>
              </g>

              <g transform="translate(940,670)">
                <circle r="22" fill="#fff" stroke="#94A3B8" strokeWidth="2" />
                <path d="M0 -16 L6 2 L0 -2 L-6 2 Z" fill="#dc2626" />
                <text textAnchor="middle" y="15" fontSize="11" fontWeight="700" fill="#334155">N</text>
              </g>

              {placed.map((r) => (
                <g
                  key={r.id}
                  transform={`translate(${r.x},${r.y})`}
                  onClick={() => setSel(r.id)}
                  style={{ cursor: 'pointer' }}
                  opacity={shown(r) ? 1 : 0.2}
                >
                  <title>{`${r.name} – ${r.status}`}</title>
                  {sel === r.id && <circle r="25" fill="none" stroke="#1A1108" strokeWidth="3" />}
                  <circle r="17" fill={STATUS_COLOR[r.status] || '#64748b'} stroke="#fff" strokeWidth="3" />
                  <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fill="#fff">{r.num}</text>
                  <text textAnchor="middle" y="34" fontSize="12" fill="#1A1108" style={label}>{r.name}</text>
                </g>
              ))}
            </svg>

            <div className="row center small" style={{ marginTop: 12, gap: 16 }}>
              {Object.entries(STATUS_COLOR).map(([s, c]) => (
                <span key={s} className="row nowrap" style={{ gap: 6 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, display: 'inline-block' }} /> {s}
                </span>
              ))}
              {[...SMALL, ...FACILITIES].map((f) => (
                <span key={f.label} className="row nowrap" style={{ gap: 6 }}>
                  <span style={dot(f.color)}>{f.short}</span> {f.label}
                </span>
              ))}
            </div>
          </div>

          <aside className="card summary" style={{ maxHeight: 720, overflowY: 'auto' }}>
            {ride ? (
              <>
                <div className="row between">
                  <h3 style={{ margin: 0 }}>{ride.num}. {ride.name}</h3>
                  <button className="btn sm o dark" onClick={() => setSel(null)} title="Close"><FaTimes /></button>
                </div>
                <div style={{ height: 170, borderRadius: 14, overflow: 'hidden', margin: '12px 0' }}>
                  <Img src={ride.img} alt={ride.name} className="" />
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <Badge s={ride.status} />
                  <span className="small mut">{ZONES[ride.category]?.name}</span>
                </div>
                <p className="mut small">{ride.desc}</p>
                <div className="facts">
                  <span><FaUsers /> {ride.capacity} seats</span>
                  <span><FaRulerVertical /> {ride.minHeight ? `${ride.minHeight}+ cm` : 'Any height'}</span>
                  <span><FaChild /> {ride.minAge ? `${ride.minAge}+ yrs` : 'All ages'}</span>
                  <span><FaClock /> {ride.duration} min</span>
                </div>
                {ride.rules && <p className="rule"><FaExclamationTriangle /> {ride.rules}</p>}
                <div className="sched">
                  {scheds.filter((s) => s.rideId === ride.id).map((s) => (
                    <span key={s.id}><FaCalendarAlt /> {s.days}: {s.open} – {s.close}</span>
                  ))}
                </div>
                <Link to="/tickets" className="btn full">Book Tickets</Link>
              </>
            ) : (
              <>
                <h3>Rides by Zone</h3>
                <p className="mut small mb">Tap a pin on the map or a ride below.</p>
                {zonesShown.map((c) => {
                  const z = ZONES[c];
                  const list = placed.filter((r) => r.category === c);
                  return (
                    <div key={c} style={{ marginBottom: 14 }}>
                      <div className="row between nowrap" style={{ borderLeft: `4px solid ${z.color}`, paddingLeft: 8, marginBottom: 4 }}>
                        <b style={{ color: z.color }}>{z.name}</b>
                        <span className="small mut">{list.filter((r) => r.status === 'Open').length} of {list.length} open</span>
                      </div>
                      {list.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSel(r.id)}
                          className="row nowrap"
                          style={{ width: '100%', gap: 10, padding: '7px 4px', border: 'none', borderBottom: '1px solid #F3EDE0', background: 'none', textAlign: 'left' }}
                        >
                          <span style={{ ...dot(STATUS_COLOR[r.status] || '#64748b'), width: 26, height: 26, fontSize: 12 }}>{r.num}</span>
                          <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
                          {r.status !== 'Open' && <Badge s={r.status} />}
                        </button>
                      ))}
                    </div>
                  );
                })}
                <Link to="/plaza" className="btn full">Central Plaza: Food, Shops & Shows</Link>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="sec">
        <div className="head">
          <h2>How To <span className="hl">Reach Us</span></h2>
          <p className="mut"><FaMapMarkerAlt /> {PARK_ADDRESS}</p>
        </div>

        <div className="two">
          <div className="card" style={{ padding: 12 }}>
            <iframe
              title="WonderWorld location"
              src={embed}
              style={{ width: '100%', height: 400, border: 0, borderRadius: 16, display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a href={directions} target="_blank" rel="noreferrer" className="btn full"><FaDirections /> Get Directions</a>
          </div>

          <div className="grid4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', alignContent: 'start' }}>
            <div className="card info"><FaCar /><h3>By Car</h3><p className="mut small">Click "Get Directions" for the fastest route from your location.</p></div>
            <div className="card info"><FaBus /><h3>Free Shuttle</h3><p className="mut small">Every 30 minutes from the city bus stand, 10 AM to 6 PM.</p></div>
            <div className="card info"><FaTrain /><h3>By Train / Air</h3><p className="mut small">From the city railway station or airport, take a cab or the free shuttle.</p></div>
            <div className="card info"><FaParking /><h3>Parking</h3><p className="mut small">Parking for cars and two-wheelers right outside the Main Gate. Book a slot with your ticket in My Account.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}