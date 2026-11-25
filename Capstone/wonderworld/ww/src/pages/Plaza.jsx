import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaClock, FaMapMarkerAlt, FaLeaf, FaTint, FaUtensils, FaShoppingBag, FaStar, FaMapMarkedAlt, FaChevronDown, FaChevronUp, FaMinus, FaPlus, FaTimes, FaShoppingCart, FaCheckCircle, FaReceipt, FaMobileAlt, FaStore, FaLock } from 'react-icons/fa';
import { all, inr, placeFoodOrder, createFoodPayment, placeShopOrder, createShopPayment } from '../api';
import { useAuth } from '../auth';
import Banner from '../components/Banner';
import Img from '../components/Img';
import Badge from '../components/Badge';
import DemoPay from '../components/DemoPay';

const BANNER = 'https://images.unsplash.com/photo-1758448500813-59f3770da00d?auto=format&fit=crop&w=1920&q=80';
const SHOW_FIRST = 6;
const CART_KEY = 'ww_cart';
const MAX_QTY = { food: 20, shop: 10 };
const ACTIVE = ['Placed', 'Preparing', 'Ready'];
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fmt12 = (t) => {
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};
const PAY = [
  ['Online', 'Pay Online', 'UPI, card or net banking', FaMobileAlt],
  ['Counter', 'Pay at Counter', 'Cash or UPI when you collect', FaStore],
];
const payBtn = (on) => ({ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200, padding: '12px 14px', border: `2px solid ${on ? 'var(--gold)' : '#EDE5D3'}`, borderRadius: 14, background: on ? 'var(--cream)' : '#fff', textAlign: 'left', color: 'var(--txt)' });
const isOpen = (place, mins) => toMin(place.open) <= mins && mins < toMin(place.close);
const emptyCart = { kind: null, placeId: null, items: {} };
const readCart = () => {
  try {
    const c = JSON.parse(sessionStorage.getItem(CART_KEY));
    return c && (c.kind === 'food' || c.kind === 'shop') ? c : emptyCart;
  } catch {
    return emptyCart;
  }
};
const saveCart = (c) => {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(c));
  } catch {
    return;
  }
};

function VegMark({ veg }) {
  const c = veg ? '#16a34a' : '#b91c1c';
  return (
    <span title={veg ? 'Veg' : 'Non-veg'} style={{ width: 14, height: 14, flex: 'none', border: `2px solid ${c}`, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 6, height: 6, flex: 'none', borderRadius: '50%', background: c }} />
    </span>
  );
}

function Qty({ q, onChange }) {
  if (!q) return <button className="add" onClick={() => onChange(1)}>Add</button>;
  return (
    <span className="mq">
      <button onClick={() => onChange(-1)} aria-label="Remove one"><FaMinus /></button>
      <b>{q}</b>
      <button onClick={() => onChange(1)} aria-label="Add one"><FaPlus /></button>
    </span>
  );
}

function MyOrders({ list }) {
  if (!list.length) return null;
  return (
    <div className="my-orders">
      <b>Your orders:</b>
      {list.map((o) => (
        <Link key={o.id} to="/my-bookings?tab=orders">{o.orderCode} <Badge s={o.status} /></Link>
      ))}
    </div>
  );
}

export default function Plaza() {
  const [now, setNow] = useState(new Date());
  const [vegOnly, setVegOnly] = useState(false);
  const [openMenus, setOpenMenus] = useState([]);
  const [openShops, setOpenShops] = useState([]);
  const [cart, setCart] = useState(readCart);
  const [showCart, setShowCart] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [pay, setPay] = useState('Online');
  const [demo, setDemo] = useState(null);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => saveCart(cart), [cart]);

  const mins = now.getHours() * 60 + now.getMinutes();
  const restaurants = all('restaurants');
  const menu = all('menuItems');
  const shops = all('shops');
  const shopItems = all('shopItems');
  const activeFood = all('foodOrders').filter((o) => ACTIVE.includes(o.status));
  const activeShop = all('shopOrders').filter((o) => ACTIVE.includes(o.status));
  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const placesOf = (kind) => (kind === 'shop' ? shops : restaurants);
  const placeIdOf = (kind, item) => (kind === 'shop' ? item.shopId : item.restaurantId);
  const pool = cart.kind === 'shop' ? shopItems : menu;
  const cartPlace = placesOf(cart.kind).find((p) => p.id === cart.placeId);
  const lines = Object.entries(cart.items)
    .map(([id, qty]) => ({ item: pool.find((m) => m.id === +id), qty }))
    .filter((l) => l.item && l.qty > 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const qtyOf = (kind, item) => (cart.kind === kind && cart.placeId === placeIdOf(kind, item) ? cart.items[item.id] || 0 : 0);

  const change = (kind, item, d) => {
    const placeId = placeIdOf(kind, item);
    if (count > 0 && (cart.kind !== kind || cart.placeId !== placeId)) {
      const next = placesOf(kind).find((p) => p.id === placeId);
      if (!window.confirm(`Your cart has items from ${cartPlace?.name}. Start a new order from ${next?.name} instead?`)) return;
      setCart({ kind, placeId, items: { [item.id]: 1 } });
      return;
    }
    const qty = Math.min(MAX_QTY[kind], Math.max(0, (cart.items[item.id] || 0) + d));
    const items = { ...cart.items, [item.id]: qty };
    if (!qty) delete items[item.id];
    setCart(Object.keys(items).length ? { kind, placeId, items } : emptyCart);
  };

  const items = () => lines.map((l) => (cart.kind === 'shop' ? { shopItemId: l.item.id, qty: l.qty } : { menuItemId: l.item.id, qty: l.qty }));

  const finish = async (payment) => {
    try {
      const place = cart.kind === 'shop' ? placeShopOrder : placeFoodOrder;
      const o = await place(cart.placeId, items(), note, payment);
      setPlaced({ ...o, kind: cart.kind });
      setCart(emptyCart);
      setNote('');
    } catch (x) {
      setErr(x.message);
    }
    setDemo(null);
    setBusy(false);
  };

  const order = async () => {
    setErr('');
    if (!user) return nav('/login', { state: { from: '/plaza' } });
    if (user.role !== 'visitor') return setErr('Admins cannot place orders. Please use a visitor account.');
    setBusy(true);
    if (pay === 'Counter') return finish({ method: 'Counter' });
    try {
      const create = cart.kind === 'shop' ? createShopPayment : createFoodPayment;
      setDemo(await create(cart.placeId, items()));
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };

  const closeCart = () => {
    setShowCart(false);
    setPlaced(null);
    setErr('');
  };

  const isShop = cart.kind === 'shop';
  const goods = placed?.kind === 'shop' ? 'items' : 'food';

  return (
    <>
      <Banner img={BANNER} title="Central Plaza" sub="Order food online and shop at the heart of the park" />
      <section className="sec cream" style={{ paddingBottom: 40 }}>
        <div className="grid4">
          <div className="card info"><FaClock /><h3>Open Daily</h3><p className="mut small">10:00 AM – 8:00 PM</p></div>
          <div className="card info"><FaMapMarkerAlt /><h3>Location</h3><p className="mut small">Centre of the park, 2 minutes from the Main Gate</p></div>
          <div className="card info"><FaReceipt /><h3>Order Online</h3><p className="mut small">Skip the queue. Order food or shop items here, pay online or at the counter, and collect.</p></div>
          <div className="card info"><FaTint /><h3>Free Water</h3><p className="mut small">Drinking water stations all around the plaza</p></div>
        </div>
      </section>

      <section className="sec">
        <div className="head">
          <h2><FaUtensils /> Food <span className="hl">Court</span></h2>
          <p className="mut">{restaurants.length} restaurants · {menu.length} dishes · tap <b>Add</b> to order</p>
        </div>

        <MyOrders list={activeFood} />

        <div className="toolbar" style={{ justifyContent: 'center' }}>
          <button className={`chip ${!vegOnly ? 'on' : ''}`} onClick={() => setVegOnly(false)}>All Items</button>
          <button className={`chip ${vegOnly ? 'on' : ''}`} onClick={() => setVegOnly(true)}><FaLeaf /> Veg Only</button>
        </div>

        <div className="grid3">
          {restaurants.map((r) => {
            const list = menu.filter((m) => m.restaurantId === r.id && (!vegOnly || m.veg));
            const full = openMenus.includes(r.id);
            const shown = full ? list : list.slice(0, SHOW_FIRST);
            const open = isOpen(r, mins);
            return (
              <div className="ride" key={r.id}>
                <div className="pic">
                  <Img src={r.img} alt={r.name} />
                  <span className={`badge ${open ? 'b-ok' : 'b-bad'}`}>{open ? 'Open now' : 'Closed now'}</span>
                  <span className="cat-chip"><FaStar /> {r.rating}</span>
                </div>
                <div className="body">
                  <h3>{r.name}</h3>
                  <p className="small mut">{r.cuisine}</p>
                  <p className="small" style={{ margin: '6px 0 10px' }}><FaClock /> {fmt12(r.open)} – {fmt12(r.close)}</p>
                  {!open && <p className="rule">Closed now. You can still pre-order and collect after {fmt12(r.open)}.</p>}
                  {list.length === 0 && <p className="small mut">No items to show.</p>}
                  {shown.map((m) => (
                    <div key={m.id} className="menu-row">
                      <span className="nm"><VegMark veg={m.veg} /> {m.name}</span>
                      <span className="pr">
                        <b>{inr(m.price)}</b>
                        <Qty q={qtyOf('food', m)} onChange={(d) => change('food', m, d)} />
                      </span>
                    </div>
                  ))}
                  {list.length > SHOW_FIRST && (
                    <button className="more" onClick={() => toggle(openMenus, setOpenMenus, r.id)}>
                      {full ? <>Show less <FaChevronUp /></> : <>See full menu ({list.length} items) <FaChevronDown /></>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sec cream">
        <div className="head">
          <h2><FaShoppingBag /> Plaza <span className="hl">Shops</span></h2>
          <p className="mut">{shops.length} shops · {shopItems.length} items · tap <b>Add</b> to order</p>
        </div>

        <MyOrders list={activeShop} />

        <div className="grid3">
          {shops.map((s) => {
            const list = shopItems.filter((i) => i.shopId === s.id);
            const full = openShops.includes(s.id);
            const shown = full ? list : list.slice(0, SHOW_FIRST);
            const open = isOpen(s, mins);
            return (
              <div className="ride" key={s.id}>
                <div className="pic">
                  <Img src={s.img} alt={s.name} />
                  <span className={`badge ${open ? 'b-ok' : 'b-bad'}`}>{open ? 'Open now' : 'Closed now'}</span>
                </div>
                <div className="body">
                  <h3>{s.name}</h3>
                  <p className="mut small">{s.desc}</p>
                  <div className="sched" style={{ margin: '10px 0' }}>
                    {s.priceRange && <span><FaShoppingBag /> {s.priceRange}</span>}
                    <span><FaClock /> {fmt12(s.open)} – {fmt12(s.close)}</span>
                  </div>
                  {!open && <p className="rule">Closed now. You can still order and collect after {fmt12(s.open)}.</p>}
                  {list.length === 0 && <p className="small mut">Items coming soon.</p>}
                  {shown.map((i) => (
                    <div key={i.id} className="menu-row">
                      <span className="nm">{i.name}</span>
                      <span className="pr">
                        <b>{inr(i.price)}</b>
                        <Qty q={qtyOf('shop', i)} onChange={(d) => change('shop', i, d)} />
                      </span>
                    </div>
                  ))}
                  {list.length > SHOW_FIRST && (
                    <button className="more" onClick={() => toggle(openShops, setOpenShops, s.id)}>
                      {full ? <>Show less <FaChevronUp /></> : <>See all items ({list.length}) <FaChevronDown /></>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cta">
        <h2>Find The Plaza</h2>
        <p>The Central Plaza is right in the middle of the park, between all four zones.</p>
        <Link to="/map" className="btn y gap-top"><FaMapMarkedAlt /> Open Park Map</Link>
      </div>

      {count > 0 && !showCart && (
        <div className="cartbar">
          <FaShoppingCart />
          <div>
            <b>{count} item{count > 1 ? 's' : ''} · {inr(total)}</b>
            <small>{cartPlace?.name}</small>
          </div>
          <button className="btn sm" onClick={() => setShowCart(true)}>View Cart</button>
        </div>
      )}

      {(showCart || placed) && !demo && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && closeCart()}>
          <div className="modal">
            <button className="x" onClick={closeCart} aria-label="Close"><FaTimes /></button>
            {placed ? (
              <div className="center-t">
                <FaCheckCircle style={{ fontSize: 52, color: 'var(--ok)' }} />
                <h3 style={{ padding: 0, marginTop: 8 }}>Order Placed!</h3>
                <p className="mut">Show this code at the <b>{placed.place}</b> counter.</p>
                <div className="big-code">{placed.orderCode}</div>
                {placed.paymentMethod === 'Online' ? (
                  <p><FaCheckCircle style={{ color: 'var(--ok)' }} /> Paid online: <b>{inr(placed.total)}</b>. Just show the code and collect your {goods}.</p>
                ) : (
                  <p>Amount to pay at the counter: <b>{inr(placed.total)}</b></p>
                )}
                <p className="small mut gap-top">You can watch the order status change in My Account.</p>
                <div className="row center gap-top">
                  <Link to="/my-bookings?tab=orders" className="btn">Track Order</Link>
                  <button className="btn o dark" onClick={closeCart}>Order More</button>
                </div>
              </div>
            ) : (
              <>
                <h3>Your Order</h3>
                <p className="small mut mb">{cartPlace?.name}</p>
                {lines.map((l) => (
                  <div className="cart-line" key={l.item.id}>
                    <span className="row nowrap" style={{ gap: 8 }}>{!isShop && <VegMark veg={l.item.veg} />} {l.item.name}</span>
                    <Qty q={l.qty} onChange={(d) => change(cart.kind, l.item, d)} />
                    <b style={{ minWidth: 70, textAlign: 'right' }}>{inr(l.item.price * l.qty)}</b>
                  </div>
                ))}
                {!lines.length && <p className="mut">Your cart is empty.</p>}
                <label className="gap-top">{isShop ? 'Note for the shop (optional)' : 'Note for the kitchen (optional)'}
                  <textarea maxLength="150" value={note} onChange={(e) => setNote(e.target.value)} placeholder={isShop ? 'e.g. T-shirt size M, blue colour' : 'e.g. less spicy, no onion'} />
                </label>
                <p className="small" style={{ fontWeight: 700, margin: '16px 0 8px' }}>Payment method</p>
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  {PAY.map(([k, label, sub, Icon]) => (
                    <button key={k} type="button" style={payBtn(pay === k)} onClick={() => setPay(k)}>
                      <Icon style={{ fontSize: 22, color: pay === k ? 'var(--goldd)' : 'var(--mut)' }} />
                      <span><b style={{ display: 'block', fontSize: 14 }}>{label}</b><span className="small mut">{sub}</span></span>
                    </button>
                  ))}
                </div>
                <div className="row between total"><span>Total</span><span>{inr(total)}</span></div>
                <p className="small mut">{pay === 'Online' ? `Pay securely now and just collect your ${isShop ? 'items' : 'food'} at the counter.` : `Pay at the counter when you collect your ${isShop ? 'items' : 'food'}.`}</p>
                {err && <p className="err">{err}</p>}
                <button className="btn full" onClick={order} disabled={busy || !lines.length}>
                  {busy ? 'Please wait...' : !user ? 'Log in to Place Order' : pay === 'Online' ? <><FaLock /> Pay {inr(total)} & Place Order</> : `Place Order · ${inr(total)}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {demo && (
        <DemoPay
          amount={demo.amount / 100}
          onClose={() => { setDemo(null); setBusy(false); }}
          onPaid={() => finish({ method: 'Online', orderId: demo.orderId })}
        />
      )}
    </>
  );
}