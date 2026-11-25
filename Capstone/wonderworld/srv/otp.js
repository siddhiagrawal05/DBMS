const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendCodeEmail, mailReady } = require('./mailer');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_TRIES = 5;

const clean = (e) => String(e || '').trim().toLowerCase();
const mask = (e) => {
  const [a, d] = String(e).split('@');
  return `${a.slice(0, 2)}${'*'.repeat(Math.max(3, a.length - 2))}@${d}`;
};

module.exports = function otp({ app, db, wrap, fail, sign, today }) {
  const hash = (email, code, purpose) => crypto.createHash('sha256').update(`${purpose}:${email}:${code}:${process.env.JWT_SECRET}`).digest('hex');

  async function issue(email, purpose, { name = '' } = {}) {
    await db.query('DELETE FROM login_codes WHERE created_at < NOW() - INTERVAL 1 DAY');
    const code = String(crypto.randomInt(100000, 1000000));
    const [ins] = await db.query(
      'INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)',
      [email, hash(email, code, purpose)]
    );
    await db.query('UPDATE login_codes SET used = TRUE WHERE email = ? AND used = FALSE AND id <> ?', [email, ins.insertId]);

    if (!mailReady) {
      console.log(`[${purpose}] code for ${email}: ${code} (MAIL_USER / MAIL_PASS not set, email not sent)`);
      return { email: mask(email), terminal: true };
    }
    try {
      await sendCodeEmail(email, code, name, purpose);
    } catch (e) {
      console.error('Code email failed:', e.message);
      await db.query('DELETE FROM login_codes WHERE email = ? AND used = FALSE', [email]);
      throw fail(500, 'We could not send the email right now. Please try again in a minute.');
    }
    return { email: mask(email) };
  }

  async function check(email, code, purpose) {
    code = String(code || '').trim();
    if (!/^\d{6}$/.test(code)) throw fail(400, 'Please enter the 6-digit code from your email.');
    const [[row]] = await db.query(
      'SELECT id, code_hash, attempts, expires_at > NOW() AS live FROM login_codes WHERE email = ? AND used = FALSE ORDER BY id DESC LIMIT 1',
      [email]
    );
    if (!row || !row.live) throw fail(400, 'This code has expired or was already used. Please ask for a new one.');
    if (row.attempts >= MAX_TRIES) throw fail(400, 'Too many wrong tries. Please ask for a new code.');
    const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(email, code, purpose)));
    if (!ok) {
      await db.query('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
      const left = MAX_TRIES - row.attempts - 1;
      throw fail(400, left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Please ask for a new code.');
    }
    await db.query('UPDATE login_codes SET used = TRUE WHERE id = ?', [row.id]);
  }

  const roleOf = (r) => (r === 'admin' ? 'admin' : 'visitor');
  const wrongRole = (role) => fail(403, role === 'admin' ? 'This is not an admin account.' : 'Admins must use the Admin Login page.');

  app.post('/api/auth/code/send', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const role = roleOf(req.body.role);
    if (!EMAIL.test(email)) throw fail(400, 'Please enter a valid email address.');
    const [[u]] = await db.query('SELECT id, name, role FROM users WHERE email = ?', [email]);
    if (u && u.role !== role) throw wrongRole(role);
    if (!u && role === 'admin') throw fail(404, 'No admin account found with this email.');
    const r = await issue(email, role === 'admin' ? 'login-admin' : 'code', { name: u ? u.name : '' });
    res.json({ sent: true, newUser: !u, ...r });
  }));

  app.post('/api/auth/code/verify', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const role = roleOf(req.body.role);
    let [[u]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (u && u.role !== role) throw wrongRole(role);
    if (!u && role === 'admin') throw fail(404, 'No admin account found with this email.');
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (!u && (!name || !/^\d{10}$/.test(phone))) throw fail(400, 'Please enter your name and a 10-digit phone number to create your account.');
    await check(email, req.body.code, role === 'admin' ? 'login-admin' : 'code');
    if (!u) {
      const randomHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      const [r] = await db.query(
        'INSERT INTO users (name, email, phone, password_hash, role, joined) VALUES (?, ?, ?, ?, ?, ?)',
        [name.slice(0, 100), email, phone, randomHash, 'visitor', today()]
      );
      [[u]] = await db.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
    }
    res.json(sign(u));
  }));

  app.post('/api/auth/login', wrap(async (req, res) => {
    const email = clean(req.body.email);
    const role = roleOf(req.body.role);
    const [[u]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password_hash))) throw fail(401, 'Wrong email or password.');
    if (u.role !== role) throw wrongRole(role);
    res.json(sign(u));
  }));

  app.post('/api/auth/register', wrap(async (req, res) => {
    const f = {
      name: String(req.body.name || '').trim().slice(0, 100),
      email: clean(req.body.email),
      phone: String(req.body.phone || '').trim(),
      password: String(req.body.password || ''),
    };
    if (!f.name || !EMAIL.test(f.email) || !/^\d{10}$/.test(f.phone) || f.password.length < 6) throw fail(400, 'Please fill all fields correctly.');
    const [[found]] = await db.query('SELECT id FROM users WHERE email = ?', [f.email]);
    if (found) throw fail(400, 'This email is already registered. Please log in instead.');
    const hash = await bcrypt.hash(f.password, 10);
    const [r] = await db.query(
      'INSERT INTO users (name, email, phone, password_hash, role, joined) VALUES (?, ?, ?, ?, ?, ?)',
      [f.name, f.email, f.phone, hash, 'visitor', today()]
    );
    const [[u]] = await db.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
    res.json(sign(u));
  }));

  async function ensureAdmin() {
    const email = clean(process.env.ADMIN_EMAIL);
    const password = String(process.env.ADMIN_PASSWORD || '');
    if (!email) return;
    if (!EMAIL.test(email) || password.length < 6) {
      console.log('Admin account skipped: ADMIN_EMAIL must be valid and ADMIN_PASSWORD at least 6 characters.');
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const [[u]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (u) {
      await db.query("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?", [hash, u.id]);
    } else {
      await db.query(
        'INSERT INTO users (name, email, phone, password_hash, role, joined) VALUES (?, ?, ?, ?, ?, ?)',
        [String(process.env.ADMIN_NAME || 'Park Admin').slice(0, 100), email, String(process.env.ADMIN_PHONE || '9000000001'), hash, 'admin', today()]
      );
    }
    console.log(`Admin account ready: ${mask(email)}`);
  }

  return { ensureAdmin };
};