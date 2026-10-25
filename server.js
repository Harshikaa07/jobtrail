require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected'];

// Connection pool: reuses MySQL connections instead of opening one per request
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  multipleStatements: true,
  dateStrings: true // DATE columns come back as 'YYYY-MM-DD' text
});

const sign = (id) => jwt.sign({ id }, SECRET, { expiresIn: '7d' });

// Middleware: checks the token and sets req.uid, otherwise rejects with 401
const auth = (req, res, next) => {
  try {
    req.uid = jwt.verify((req.headers.authorization || '').split(' ')[1], SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again' });
  }
};

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Fill every field (password needs 6+ characters)' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)',
      [name.trim(), email.trim().toLowerCase(), hash]);
    res.json({ token: sign(r.insertId) });
  } catch (e) {
    const dup = e.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ error: dup ? 'That email is already registered' : 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email = '', password = '' } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(rows[0].id) });
});

// Validates input and returns values in the order the SQL expects
const clean = (b) => [
  (b.company || '').trim(),
  (b.role || '').trim(),
  STATUSES.includes(b.status) ? b.status : 'Applied',
  /^https?:\/\//i.test(b.link || '') ? b.link : null,
  b.notes || null,
  b.applied_on || null
];
const getOne = async (id, uid) =>
  (await pool.query('SELECT * FROM applications WHERE id = ? AND user_id = ?', [id, uid]))[0][0];

app.get('/api/applications', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC', [req.uid]);
  res.json(rows);
});

app.post('/api/applications', auth, async (req, res) => {
  const v = clean(req.body);
  if (!v[0] || !v[1]) return res.status(400).json({ error: 'Company and role are required' });
  const [r] = await pool.query(
    'INSERT INTO applications (user_id, company, role, status, link, notes, applied_on) VALUES (?,?,?,?,?,?,?)',
    [req.uid, ...v]);
  res.json(await getOne(r.insertId, req.uid));
});

app.put('/api/applications/:id', auth, async (req, res) => {
  const v = clean(req.body);
  if (!v[0] || !v[1]) return res.status(400).json({ error: 'Company and role are required' });
  await pool.query(
    'UPDATE applications SET company=?, role=?, status=?, link=?, notes=?, applied_on=? WHERE id=? AND user_id=?',
    [...v, req.params.id, req.uid]);
  res.json(await getOne(req.params.id, req.uid));
});

app.delete('/api/applications/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM applications WHERE id = ? AND user_id = ?', [req.params.id, req.uid]);
  res.json({ ok: true });
});

// On startup: create the tables if they don't exist, then listen
(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Jobtrail running on http://localhost:${port}`));
})().catch((e) => { console.error('Database setup failed:', e.message); process.exit(1); });
