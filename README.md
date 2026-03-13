# 🧠 TSO Minds Backend API

Custom Node.js + Express backend for TSO Minds Content Studio.

## ✅ Features
- User Register & Login with JWT tokens
- Password encryption with bcryptjs
- Content history save/delete per user
- Pure JSON database (no native modules needed)
- Ready to deploy on Railway.app

## 🚀 Deploy on Railway (Step by Step)

### Step 1 — Create GitHub Repo
1. Go to github.com → New repository
2. Name it: `tso-minds-backend`
3. Set to Public
4. Click "Create repository"

### Step 2 — Upload Files
Upload these files to GitHub:
- server.js
- package.json
- railway.toml
- .gitignore
(Do NOT upload .env or db.json)

### Step 3 — Deploy on Railway
1. Go to railway.app
2. Click "New Project"
3. Click "Deploy from GitHub repo"
4. Select your tso-minds-backend repo
5. Railway will auto-detect Node.js and deploy!

### Step 4 — Set Environment Variables
In Railway dashboard → Your project → Variables tab:
```
JWT_SECRET = any-random-long-string-here-make-it-unique
PORT = 3000
```

### Step 5 — Get Your Live URL
Railway gives you a URL like:
`https://tso-minds-backend-production.up.railway.app`

Copy this URL → paste it into your frontend website!

## 📡 API Endpoints

### Register
```
POST /api/auth/register
Body: { "name": "John", "email": "john@email.com", "password": "pass123" }
```

### Login
```
POST /api/auth/login
Body: { "email": "john@email.com", "password": "pass123" }
```

### Get Profile (needs token)
```
GET /api/user/profile
Header: Authorization: Bearer YOUR_TOKEN
```

### Save Content (needs token)
```
POST /api/content/save
Header: Authorization: Bearer YOUR_TOKEN
Body: { "topic": "Dark Psychology", "script_type": "Reel", "script": "...", "caption": "...", "hashtags": "..." }
```

### Get History (needs token)
```
GET /api/content/history
Header: Authorization: Bearer YOUR_TOKEN
```

### Delete Content (needs token)
```
DELETE /api/content/:id
Header: Authorization: Bearer YOUR_TOKEN
```

## 💻 Run Locally
```bash
npm install
node server.js
```
Server runs on http://localhost:3000

## 🔐 Security Notes
- Change JWT_SECRET to a random string in production
- JWT tokens expire after 7 days
- Passwords are hashed with bcrypt (12 rounds)
