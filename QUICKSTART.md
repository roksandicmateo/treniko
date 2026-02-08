# ⚡ QUICK START GUIDE

Follow these commands in order. Each section must complete successfully before moving to the next.

## 1️⃣ Create Database

```bash
createdb treniko_db
```

**✅ Success:** No error message
**❌ Error?** PostgreSQL might not be running. Run: `brew services start postgresql@16`

---

## 2️⃣ Setup Backend

```bash
cd ~/Desktop/treniko/backend
cp .env.example .env
nano .env
```

**In nano editor:**
1. Find the line: `DB_PASSWORD=your_password_here`
2. Replace `your_password_here` with your PostgreSQL password (or leave blank if none)
3. Press `Ctrl+X`, then `Y`, then `Enter` to save

**Then run:**
```bash
npm install
npm run init-db
npm run dev
```

**✅ Success:** You see "TRENIKO Backend Server Started"
**Keep this terminal open!**

---

## 3️⃣ Setup Frontend (New Terminal)

**Open a NEW terminal window (Cmd+T in Terminal, or Terminal → New Terminal in VS Code)**

```bash
cd ~/Desktop/treniko/frontend
cp .env.example .env
npm install
npm run dev
```

**✅ Success:** You see "Local: http://localhost:5173/"

---

## 4️⃣ Open App

**In your browser, go to:**
```
http://localhost:5173
```

**Login with:**
- Email: `demo@treniko.com`
- Password: `password123`

---

## 🎉 Done!

You now have:
- ✅ Backend running on port 3000
- ✅ Frontend running on port 5173
- ✅ Database with demo account
- ✅ Full TRENIKO app working!

**Both terminals must stay open** while you use the app.

---

## 🛑 To Stop the App

1. In **backend terminal**: Press `Ctrl+C`
2. In **frontend terminal**: Press `Ctrl+C`

## ▶️ To Start Again Later

**Terminal 1 (Backend):**
```bash
cd ~/Desktop/treniko/backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd ~/Desktop/treniko/frontend
npm run dev
```

Then open http://localhost:5173 in your browser.
