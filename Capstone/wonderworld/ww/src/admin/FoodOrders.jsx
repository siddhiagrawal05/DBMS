import { useState } from 'react';
import { FaSyncAlt, FaArrowRight, FaUtensils, FaShoppingBag } from 'react-icons/fa';
import { all, upsert, loadData, inr, today } from '../api';
import Badge from '../components/Badge';

const KINDS = {
  food: { label: 'Food Orders', icon: FaUtensils, table: 'foodOrders', places: 'restaurants', placeKey: 'restaurantId', placeName: 'restaurant', all: 'All restaurants', flow: ['Placed', 'Preparing', 'Ready', 'Collected'] },
  shop: { label: 'Shop Orders', icon: FaShoppingBag, table: 'shopOrders', places: 'shops', placeKey: 'shopId', placeName: 'shop', all: 'All shops', flow: ['Placed', 'Ready', 'Collected'] },
};

export default function FoodOrders() {
  const [, refresh] = useState(0);
  const re = () => refresh((x) => x + 1);
  const [kind, setKind] = useState('food');
  const [filter, setFilter] = useState('Active');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);

  const k = KINDS[kind];
  const active = k.flow.slice(0, -1);
  const orders = all(k.table);
  const places = all(k.places);
  const t = today();
  const todays = orders.filter((o) => o.createdAt.startsWith(t) && o.status !== 'Cancelled');

  const list = orders.filter((o) =>
    (filter === 'All' || (filter === 'Active' ? active.includes(o.status) : o.status === filter)) &&
    (!place || o[k.placeKey] === +place)
  );

  const switchKind = (x) => {
    setKind(x);
    setFilter('Active');
    setPlace('');
  };

  const setStatus = async (o, status) => {
    try {
      await upsert(k.table, { id: o.id, status });
      re();
    } catch (e) {
      alert(e.message);
    }
  };

  const reload = async () => {
    setBusy(true);
    await loadData();
    setBusy(false);
    re();
  };

  return (
    <>
      <div className="row between">
        <h3 className="h">Food & Shop Orders</h3>
        <button className="btn sm" onClick={reload} disabled={busy}><FaSyncAlt /> {busy ? 'Loading...' : 'Refresh'}</button>
      </div>

      <div className="ptabs">
        {Object.entries(KINDS).map(([key, v]) => {
          const Icon = v.icon;
          const n = all(v.table).filter((o) => v.flow.slice(0, -1).includes(o.status)).length;
          return (
            <button key={key} className={`chip ${kind === key ? 'on' : ''}`} onClick={() => switchKind(key)}>
              <Icon /> {v.label}{n > 0 ? ` (${n})` : ''}
            </button>
          );
        })}
      </div>

      <div className="mini-stats mb">
        <div><small>Orders today</small><b>{todays.length}</b></div>
        <div><small>Sales today</small><b>{inr(todays.reduce((s, o) => s + o.total, 0))}</b></div>
        <div><small>Paid online today</small><b>{inr(todays.filter((o) => o.paymentMethod === 'Online').reduce((s, o) => s + o.total, 0))}</b></div>
        {active.map((s) => (
          <div key={s}><small>{s}</small><b>{orders.filter((o) => o.status === s).length}</b></div>
        ))}
      </div>

      <div className="toolbar">
        {['Active', 'All', ...k.flow, 'Cancelled'].map((s) => (
          <button key={s} className={`chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
        <select className="mini" style={{ marginLeft: 'auto' }} value={place} onChange={(e) => setPlace(e.target.value)}>
          <option value="">{k.all}</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <p className="card mut">No orders here.</p>
      ) : (
        <div className="orders">
          {list.map((o) => {
            const next = k.flow[k.flow.indexOf(o.status) + 1];
            return (
              <div className="card order" key={o.id}>
                <div className="row between">
                  <b>{o.orderCode}</b>
                  <Badge s={o.status} />
                </div>
                <p className="small mut">{o.createdAt} · {o.userName}</p>
                <p className="small row between nowrap">
                  <b>{o[k.placeName]}</b>
                  <span className={`badge ${o.paymentMethod === 'Online' ? 'b-ok' : 'b-warn'}`}>{o.paymentMethod === 'Online' ? 'Paid online' : 'Pay at counter'}</span>
                </p>
                <ul className="order-items">
                  {o.items.map((i, n) => (
                    <li key={n}><span>{i.qty} × {i.name}</span><span>{inr(i.price * i.qty)}</span></li>
                  ))}
                </ul>
                {o.note && <p className="rule small">Note: {o.note}</p>}
                <div className="row between">
                  <b>{inr(o.total)}</b>
                  <div className="row nowrap">
                    {next && <button className="btn sm" onClick={() => setStatus(o, next)}>{next} <FaArrowRight /></button>}
                    {o.status === 'Placed' && <button className="btn sm red" onClick={() => setStatus(o, 'Cancelled')}>Cancel</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}