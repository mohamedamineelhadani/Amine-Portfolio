require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Message, Admin } = require('./models');

const { MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PORT = 3000, NODE_ENV } = process.env;
if (!MONGO_URI || !JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Set MONGO_URI and a JWT_SECRET of 32+ characters in .env');
}
const prod = NODE_ENV === 'production';
const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: prod };

const app = express();
app.set('trust proxy', 1); // needed behind Render/Heroku/Nginx so rate limits see the real IP
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ['https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: null, // would break fetch() when the site is served over plain http
  } },
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// CORS for the contact form only (lets you open the page from Live Server / file:// while developing).
// In production set CORS_ORIGIN=https://your-site.com if the form is hosted on another domain.
app.use('/api/contact', (req, res, next) => {
  const o = req.headers.origin;
  const allowed = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
  const devOk = !prod && (o === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o || ''));
  if (o && (allowed.includes(o) || devOk)) {
    res.set({ 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limiter = (windowMin, max, error) => rateLimit({
  windowMs: windowMin * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
  message: { error },
});


/* ---------- public: contact form ---------- */
app.post('/api/contact', limiter(60, 5, 'Too many messages. Please try again later.') , async (req, res, next) => {
  try {
    const { fullname, email, message, website } = req.body || {};
    if (website) return res.json({ ok: true });
    const data = { name: clean(fullname, 100), email: clean(email, 150).toLowerCase(), message: clean(message, 3000) };
    if (!data.name || !emailRe.test(data.email) || data.message.length < 5) {
      return res.status(400).json({ error: 'Please enter your name, a valid email and a message.' });
    }
    const saved = await Message.create({ ...data, ip: req.ip });
    console.log('Saved message', saved.id, 'to database', mongoose.connection.name);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- admin auth ---------- */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps timing equal for unknown emails
const auth = (req, res, next) => {
  try { req.admin = jwt.verify(req.cookies.token, JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: 'Not signed in' }); }
};

app.post('/api/admin/login', limiter(15, 10, 'Too many attempts. Try again in 15 minutes.'), async (req, res, next) => {
  try {
    const email = clean(req.body?.email, 150).toLowerCase();
    const pw = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
    const admin = await Admin.findOne({ email });
    const ok = await bcrypt.compare(pw, admin ? admin.hash : DUMMY_HASH);
    if (!admin || !ok) return res.status(401).json({ error: 'Wrong email or password' });
    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
    res.cookie('token', token, { ...cookieOpts, maxAge: 8 * 3600 * 1000 });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('token', cookieOpts); res.json({ ok: true }); });
app.get('/api/admin/me', auth, (req, res) => res.json({ ok: true }));

/* ---------- admin: messages ---------- */
app.get('/api/admin/messages', auth, async (req, res, next) => {
  try {
    const q = clean(req.query.q, 100), filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { message: rx }];
    }
    if (req.query.status === 'unread') filter.read = false;
    const [items, unread, total, week, today] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
      Message.countDocuments({ read: false }),
      Message.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } }),
      Message.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    ]);
    res.json({ items, unread, total, week, today });
  } catch (e) { next(e); }
});

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Bad id' });

app.patch('/api/admin/messages/:id', auth, validId, async (req, res, next) => {
  try {
    const m = await Message.findByIdAndUpdate(req.params.id, { read: req.body?.read === true }, { new: true });
    m ? res.json(m) : res.status(404).json({ error: 'Not found' });
  } catch (e) { next(e); }
});
app.delete('/api/admin/messages/:id', auth, validId, async (req, res, next) => {
  try {
    const m = await Message.findByIdAndDelete(req.params.id);
    m ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (e) { next(e); }
});

/* ---------- static site + errors ---------- */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Server error. Please try again.' });
});

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected, database:', mongoose.connection.name);
  if (ADMIN_EMAIL && ADMIN_PASSWORD && !(await Admin.exists({}))) {
    if (ADMIN_PASSWORD.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');
    await Admin.create({ email: ADMIN_EMAIL, hash: await bcrypt.hash(ADMIN_PASSWORD, 12) });
    console.log('Admin account created for', ADMIN_EMAIL);
  }
  app.listen(PORT, () => console.log(`Portfolio on http://localhost:${PORT}  |  Admin: /admin/`));
})().catch((e) => { console.error(e); process.exit(1); });
