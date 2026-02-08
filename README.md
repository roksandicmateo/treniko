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

5. **Initialize the database:**
   ```bash
   npm run init-db
   ```
   You should see "✅ Database initialization complete!"

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

## 🔐 Demo Account

Use these credentials to test:
- **Email:** demo@treniko.com
- **Password:** password123

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

# Reinitialize database (⚠️ WARNING: This deletes all data!)
npm run init-db
```

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
npm run init-db
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
