const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tso-minds-super-secret-key-2026';
const DB_FILE = path.join(__dirname, 'db.json');

// ─── SIMPLE JSON DATABASE ───
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], content_history: [] }));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { users: [], content_history: [] };
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── MIDDLEWARE ───
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());

// ─── AUTH MIDDLEWARE ───
function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. Please login.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Session expired. Please login again.' });
  }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function getAvatar(name) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }

// ─── ROUTES ───

// Health check
app.get('/', (req, res) => {
  const db = readDB();
  res.json({
    status: '🧠 TSO Minds Backend is live!',
    version: '1.0.0',
    total_users: db.users.length,
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      profile: 'GET /api/user/profile',
      saveContent: 'POST /api/content/save',
      getHistory: 'GET /api/content/history',
      deleteContent: 'DELETE /api/content/:id'
    }
  });
});

// ── REGISTER ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!email.includes('@'))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const db = readDB();
    if (db.users.find(u => u.email === email.toLowerCase().trim()))
      return res.status(409).json({ error: 'This email is already registered. Please login.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      id: genId(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      avatar: getAvatar(name),
      role: 'user',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };

    db.users.push(user);
    writeDB(db);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.status(201).json({
      message: `Welcome to TSO Minds, ${user.name}! 🧠`,
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── LOGIN ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const db = readDB();
    const user = db.users.find(u => u.email === email.toLowerCase().trim());
    if (!user)
      return res.status(404).json({ error: 'No account found with this email. Please register.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });

    user.last_login = new Date().toISOString();
    writeDB(db);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.json({
      message: `Welcome back, ${user.name}! 🧠`,
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── GET PROFILE ──
app.get('/api/user/profile', auth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const contentCount = db.content_history.filter(c => c.user_id === req.user.id).length;
  res.json({
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, created_at: user.created_at, last_login: user.last_login },
    stats: { content_created: contentCount }
  });
});

// ── SAVE CONTENT ──
app.post('/api/content/save', auth, (req, res) => {
  try {
    const { topic, script_type, script, caption, hashtags } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required.' });
    const db = readDB();
    const item = { id: genId(), user_id: req.user.id, topic, script_type, script, caption, hashtags, created_at: new Date().toISOString() };
    db.content_history.push(item);
    writeDB(db);
    res.status(201).json({ message: 'Content saved! ✅', id: item.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET CONTENT HISTORY ──
app.get('/api/content/history', auth, (req, res) => {
  const db = readDB();
  const history = db.content_history
    .filter(c => c.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);
  res.json({ history });
});

// ── DELETE CONTENT ──
app.delete('/api/content/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.content_history.findIndex(c => c.id === req.params.id && c.user_id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Content not found.' });
  db.content_history.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Content deleted. ✅' });
});

// ─── START ───
app.listen(PORT, () => {
  console.log(`🧠 TSO Minds Backend running on port ${PORT}`);
});

module.exports = app;


// v2

