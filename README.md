# TRENIKO - Training Management System

A modern, multi-tenant training management system for personal trainers built with Node.js, PostgreSQL, and React.

## 🎯 Features

- **Multi-tenant Architecture**: Complete data isolation between trainers
- **Client Management**: Add, edit, search, and manage clients
- **Session Scheduling**: Interactive calendar for training sessions
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Secure Authentication**: JWT-based authentication

---

## 📋 Prerequisites (Already Installed ✅)

You've already installed:
- ✅ Homebrew
- ✅ Node.js & npm
- ✅ PostgreSQL 16
- ✅ VS Code
- ✅ Git

---

## 🚀 Getting Started

### Step 1: Download the Project Files

1. **Download all the TRENIKO files** from Claude (I'll provide them to you)
2. **Extract** them to your Desktop/treniko folder
3. **Open** the treniko folder in VS Code

### Step 2: Set Up the Database

1. **Open Terminal in VS Code** (View → Terminal or `` Ctrl + ` ``)

2. **Create the database:**
   ```bash
   createdb treniko_db
   ```

3. **Verify** it was created:
   ```bash
   psql -l | grep treniko
   ```
   You should see `treniko_db` in the list.

### Step 3: Configure Backend

1. **Navigate to backend folder:**
   ```bash
   cd backend
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env file** (open it in VS Code):
   - Change `DB_PASSWORD` to your PostgreSQL password
   - If you don't have a PostgreSQL password, keep it blank

4. **Install dependencies:**
   ```bash
   npm install
   ```
   This will take 2-3 minutes. You'll see lots of packages being downloaded.

5. **Create the database schema:**
   ```bash
   npm run db:migrate
   ```
   This applies the baseline schema and every migration, in order, and records
   each one in the `schema_migrations` table. It is safe to run again at any
   time — already-applied migrations are skipped.

   You should see `done — N migration(s) applied`.

6. **Start the backend server:**
   ```bash
   npm run dev
   ```
   You should see:
   ```
   ╔════════════════════════════════════════╗
   ║     TRENIKO Backend Server Started    ║
   ╠════════════════════════════════════════╣
   ║  Port: 3000                           ║
   ╚════════════════════════════════════════╝
   ```

**Keep this terminal running!** Open a new terminal for the next steps.

### Step 4: Configure Frontend

1. **Open a NEW terminal** (Terminal → New Terminal)

2. **Navigate to frontend folder:**
   ```bash
   cd frontend
   ```

3. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```
   (You don't need to edit this file)

4. **Install dependencies:**
   ```bash
   npm install
   ```
   This will take 3-5 minutes.

5. **Start the frontend:**
   ```bash
   npm run dev
   ```
   You should see:
   ```
   VITE v5.0.8  ready in 500 ms
   
   ➜  Local:   http://localhost:5173/
   ```

### Step 5: Open the Application

1. **Open your browser** (Chrome, Safari, Firefox, etc.)
2. **Go to:** http://localhost:5173
3. **You should see the TRENIKO login page! 🎉**

---

## 🔐 Accounts

**Register a real account** from the sign-up screen — that is the supported way
to get started.

`schema.sql` seeds a `demo@treniko.com` account, and older copies of this README
published a password for it. That account is **deliberately disabled**: migration
`028_neutralize_demo_seed.sql` replaces its password hash with a random value
nobody holds, on both new and existing databases. A shared login with a
documented password on the application's own domain is not something to ship —
it is reachable through the password-reset flow by anyone who can receive mail
at that address.

---

## 📱 Using TRENIKO

### Login / Register
- **Login** with existing account or demo account
- **Register** to create a new trainer account (creates a new tenant automatically)

### Managing Clients
1. Click **Clients** in the navigation
2. Click **+ Add Client** to create a new client
3. Search clients using the search box
4. Click **Edit** to modify client details
5. Click **Deactivate** to soft-delete a client
6. Click **Delete** to permanently remove a client

### Managing Sessions
1. Click **Calendar** in the navigation
2. **Click on any time slot** to create a new session
3. **Click on an existing session** to edit or delete it
4. Switch between **Month / Week / Day** views using the buttons
5. Navigate dates using **Prev / Next / Today** buttons

---

## 🛠️ Development Commands

### Backend Commands
```bash
cd backend

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Create or upgrade the database schema (safe to re-run; never deletes data)
npm run db:migrate

# Show which migrations are applied and which are pending
npm run db:status

# Adopt an EXISTING database that predates migration tracking.
# Runs as a dry run first; only records a migration as applied after verifying
# its objects actually exist. Add -- --apply to write.
npm run db:baseline
npm run db:baseline -- --apply
```

> **Database setup, in one place.** `npm run db:migrate` is the only command
> needed to create a fresh database or upgrade an existing one. It applies
> `schema.sql` (the baseline) followed by every file in `backend/migrations/`
> in numeric order, inside one transaction each, recording progress in the
> `schema_migrations` table.
>
> `npm run init-db` is kept as an alias for `db:migrate`. The old
> `scripts/initDatabase.js` is deprecated and refuses to run: it applied
> `schema.sql` only, producing a database with 4 of the application's 35 tables.
>
> If a database already has application tables but no migration history,
> `db:migrate` will stop and tell you to run `db:baseline` first, rather than
> attempting to re-apply the baseline over live data.

### Frontend Commands
```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🐛 Troubleshooting

### Backend won't start
**Problem:** "Error: connect ECONNREFUSED"
**Solution:** Make sure PostgreSQL is running:
```bash
brew services start postgresql@16
```

**Problem:** "database 'treniko_db' does not exist"
**Solution:** Create the database:
```bash
createdb treniko_db
cd backend
npm run db:migrate
```

### Frontend won't start
**Problem:** "Cannot find module"
**Solution:** Reinstall dependencies:
```bash
cd frontend
rm -rf node_modules
npm install
```

### Can't log in
**Problem:** "Invalid email or password"
**Solution:** Make sure backend is running on port 3000:
```bash
# Check if backend is running
curl http://localhost:3000/health
```

### Calendar not loading
**Problem:** Sessions don't appear
**Solution:** 
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Make sure backend is running
4. Try refreshing the page (Cmd+R)

---

## 🎓 Learning Resources

### Technologies Used
- **Backend:**
  - Node.js - JavaScript runtime
  - Express - Web framework
  - PostgreSQL - Database
  - JWT - Authentication

- **Frontend:**
  - React - UI library
  - Vite - Build tool
  - TailwindCSS - Styling
  - FullCalendar - Calendar component

### Helpful Links
- [Node.js Docs](https://nodejs.org/docs)
- [React Docs](https://react.dev)
- [PostgreSQL Tutorial](https://www.postgresql.org/docs/tutorial/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

---

## 📧 Support

If you encounter any issues:
1. Check the Troubleshooting section above
2. Check the terminal for error messages
3. Copy the error message and send it back to me in Claude
4. I'll help you debug it!

---

## 🎉 Success Checklist

- [ ] Database created and initialized
- [ ] Backend server running on port 3000
- [ ] Frontend running on port 5173
- [ ] Can access http://localhost:5173 in browser
- [ ] Can log in with demo account
- [ ] Can add a client
- [ ] Can create a training session
- [ ] Calendar displays sessions correctly

**Once all checkboxes are ✅, you're fully set up!**

---

Built with ❤️ for trainers by Claude

---

## 🚢 Production Deployment

**Requirements**

- **Node.js 20 or newer.** Declared in `backend/package.json`; `node-cron@4`
  requires it. Deploying onto Node 18 will fail at install or at runtime.
- **A reverse proxy in front of the API.** The application runs with
  `trust proxy: 1`, so it reads the client address from the last
  `X-Forwarded-For` entry. That is safe when a proxy sets the header itself and
  unsafe when the API is exposed directly — a caller could then choose their own
  address and get a fresh rate-limit budget per request. Account lockout, the
  per-address password-reset limit and the per-user upload limit do not depend
  on the header, but the IP-keyed limits do.
- **Database TLS.** In production the connection verifies the server's
  certificate. Supply your provider's CA with `DB_SSL_CA_FILE` (or `DB_SSL_CA`).
  If the provider uses a private CA and you cannot supply it, set
  `DB_SSL_REJECT_UNAUTHORIZED=false` — this keeps the connection encrypted but
  stops authenticating the server, so anyone able to intercept it can read
  everything and capture the credentials. Prefer the CA.

**Deployment order — migrations before code, every time**

```bash
# 1. Back up the database first. Migrations are additive, but a backup is the
#    only thing that makes any of the following reversible.
pg_dump -Fc treniko_db > treniko_$(date +%F).dump

# 2. Install exactly the reviewed dependency tree (never `npm install` here).
cd backend  && npm ci
cd ../frontend && npm ci && npm run build

# 3. Apply migrations BEFORE starting the new code. Several controls fail
#    closed without their columns: authenticateToken returns 503 without
#    users.password_changed_at, and login fails without the 025 columns.
cd ../backend && npm run db:migrate

# 4. Confirm nothing is pending. Do not proceed if this is not 0.
npm run db:status        # expect: "N applied, 0 pending"

# 5. Only now restart the application.
pm2 restart treniko-api
```

Running new code against an un-migrated database is the one ordering that breaks
things: the application is written to fail closed rather than silently drop a
security control, so it will refuse requests rather than serve them unprotected.
