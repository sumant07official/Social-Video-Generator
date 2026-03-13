const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tso-minds-super-secret-key-2026';

// ─── DATABASE SETUP (JSON file - no native modules needed) ───
const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

db.defaults({
  users: [],
  content_history: []
}).write();

console.log('✅ Database ready (db.json)');

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

// ─── HELPERS ───
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function getAvatar(name) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2); }

// ─── ROUTES ───

// Health check
app.get('/', (req, res) => {
  res.json({
    status: '🧠 TSO Minds Backend is live!',
    version: '1.0.0',
    users: db.get('users').size().value(),
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
    if (!email.includes('@') || !email.includes('.'))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const existing = db.get('users').find({ email: email.toLowerCase() }).value();
    if (existing)
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

    db.get('users').push(user).write();

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
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

    const user = db.get('users').find({ email: email.toLowerCase().trim() }).value();
    if (!user)
      return res.status(404).json({ error: 'No account found with this email. Please register.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });

    // Update last login
    db.get('users').find({ id: user.id }).assign({ last_login: new Date().toISOString() }).write();

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
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
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const contentCount = db.get('content_history').filter({ user_id: req.user.id }).size().value();

  res.json({
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, created_at: user.created_at, last_login: user.last_login },
    stats: { content_created: contentCount }
  });
});

// ── UPDATE PROFILE ──
app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const { name, password } = req.body;
    const updates = {};
    if (name) { updates.name = name.trim(); updates.avatar = getAvatar(name); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      updates.password = await bcrypt.hash(password, 12);
    }
    db.get('users').find({ id: req.user.id }).assign(updates).write();
    res.json({ message: 'Profile updated successfully! ✅' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── SAVE CONTENT ──
app.post('/api/content/save', auth, (req, res) => {
  try {
    const { topic, script_type, script, caption, hashtags } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required.' });

    const item = {
      id: genId(),
      user_id: req.user.id,
      topic, script_type, script, caption, hashtags,
      created_at: new Date().toISOString()
    };

    db.get('content_history').push(item).write();
    res.status(201).json({ message: 'Content saved! ✅', id: item.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET CONTENT HISTORY ──
app.get('/api/content/history', auth, (req, res) => {
  const history = db.get('content_history')
    .filter({ user_id: req.user.id })
    .orderBy('created_at', 'desc')
    .take(20)
    .value();
  res.json({ history });
});

// ── DELETE CONTENT ──
app.delete('/api/content/:id', auth, (req, res) => {
  const item = db.get('content_history').find({ id: req.params.id, user_id: req.user.id }).value();
  if (!item) return res.status(404).json({ error: 'Content not found.' });
  db.get('content_history').remove({ id: req.params.id }).write();
  res.json({ message: 'Content deleted. ✅' });
});

// ── ADMIN: ALL USERS ──
app.get('/api/admin/users', auth, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user || user.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required.' });
  const users = db.get('users').map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at, last_login: u.last_login })).value();
  res.json({ users, total: users.length });
});

// ─── START ───
app.listen(PORT, () => {
  console.log(`
  🧠 TSO MINDS BACKEND
  ━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Running on port ${PORT}
  🗄️  Database: db.json
  🔐 JWT: 7 day sessions
  👥 Users: ${db.get('users').size().value()}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;
