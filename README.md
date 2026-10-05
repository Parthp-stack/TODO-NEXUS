# NEXUS – Daily Planner & Personal Activity History

**連環 // PLAN → DO → COMPLETE → RECORD → REMEMBER**

NEXUS is a production-ready, Japanese futuristic personal command center and permanent activity chronicle. It allows you to plan upcoming days, complete missions, record reflections on what you actually achieved, and look back at any previous day or month forever.

---

## ✦ Core Philosophy

- **Plan Your Day**: Set concrete missions with timeframes, categories, and priorities.
- **Do Your Work**: Focus on deep execution without distracting gimmicks.
- **Record What You Did**: Maintain a permanent, unalterable log distinguishing *what was planned* from *what was actually done*.
- **Remember Your Past**: Browse back through any previous month or date in history.
- **Zero Gamification**: **No XP, no levels, no milestones, no goals, no streaks, no productivity scoring**. Just pure, intentional clarity.

---

## ✦ Technology Stack

- **Frontend**: Semantic HTML5, Modular CSS3, Vanilla JavaScript (ES6+)
- **Cloud Database**: Supabase PostgreSQL
- **Client Bridge**: Supabase JS Client (`@supabase/supabase-js`)
- **Hosting**: Netlify (Static JAMstack architecture)
- **Local Cache & Offline Engine**: IndexedDB with `localStorage` fallback and Sync Queue
- **Audio & Visuals**: HTML5 Canvas particle physics, Web Audio API sound synthesis

---

## ✦ Features Overview

1. **Today Page**:
   - Current dynamic date display (e.g., `5 OCTOBER 2026`).
   - Planned missions with custom animated cyberpunk checkboxes.
   - Interactive priority glows (High, Medium, Low), time windows, and category badges.
   - Task completion toggles with timestamp preservation (`completed_at`).
   - Carry forward options: "Move to Tomorrow", "Move to Custom Date", "Keep", "Delete" (preserves original planned date).
   - Dedicated **WHAT I DID TODAY** daily reflection and notes journal with permanent cloud archiving.

2. **Upcoming Horizon**:
   - Seamless toggle between **5-Day View** and **7-Day View**.
   - Daily progress bars, task counts, and instant mission creation.

3. **Chrono Calendar**:
   - **Month View** & **Week View** with navigation.
   - Intelligent activity indicators:
     - 🟢 **Green**: All planned tasks completed.
     - 🟡 **Yellow**: In progress / partially completed.
     - 🔴 **Red**: Unfinished or overdue tasks.
     - ⚪ **Gray**: No planned missions.
     - 🟣 **Daily Record**: Written reflection recorded.
   - Interactive **Date Details** drill-down modal showing Planned vs Completed vs Reflection.

4. **Permanent Activity History (Planned vs Actual)**:
   - Dynamic month selector (October 2026, September 2026, August 2026...) going back indefinitely.
   - Side-by-side **Planned vs Actual** comparison:
     - **WHAT I PLANNED (計画)**: Scheduled tasks, priorities, times, and original planned dates.
     - **WHAT I ACTUALLY DID (実行・実績)**: Written reflection and completed tasks with timestamps.
   - Filters for Category, Priority, and Status.

5. **Global Search**:
   - Debounced search across task titles, descriptions, categories, daily reflections ("What I did"), and notes.
   - Multi-filter combinations: Category, Priority, Status, Date From / Date To.
   - Live result highlighting.

6. **Offline Support & Synchronization**:
   - Full offline support via IndexedDB.
   - Tasks, edits, completions, and daily notes save instantly offline.
   - Background queue synchronizes changes to Supabase when network connection returns.
   - Live status indicator: `● ONLINE` / `○ OFFLINE` / `SYNCING`.

7. **Japanese Futuristic UI**:
   - Cyberpunk VR HUD aesthetic with deep dark glassmorphism.
   - Canvas-based gentle Sakura blossom drift and glowing cyber dust.
   - Web Audio API synthesized sci-fi clicks, chimes, and completion chords.
   - 3D Holographic tilt effect on mission cards.
   - Theme options: *Cyberpunk Cyan*, *Sakura Neo Tokyo*, *Zen Obsidian Slate*, *Matrix Emerald*.
   - Accessibility mode with *Reduced Motion* support.

8. **Data Sovereignty & Backups**:
   - Complete JSON backup export.
   - Task CSV export for spreadsheets.
   - Safe JSON backup restore with preview confirmation and conflict avoidance.

---

## ✦ Directory Structure

```
nexus/
├── index.html              # Main HTML application shell
├── netlify.toml            # Netlify deployment configuration & security headers
├── README.md               # Documentation & setup guide
│
├── css/
│   ├── style.css           # Design tokens, cyber HUD layouts, cards, modals
│   ├── animations.css      # Keyframes, neon pulses, checkbox ripples, reduced motion
│   └── responsive.css      # Mobile HUD bottom bar, FAB, and touch optimizations
│
├── js/
│   ├── app.js              # Bootstrapper & demo seed data
│   ├── storage.js          # IndexedDB & LocalStorage offline cache + Sync Queue
│   ├── supabase.js         # Supabase client bridge & PostgreSQL CRUD operations
│   ├── offline.js          # Network monitors & automatic synchronization engine
│   ├── tasks.js            # Task CRUD, completion, and carry-forward logic
│   ├── calendar.js         # Month/Week calendar engine & Date Details modal
│   ├── history.js          # Multi-month archive browser & Planned vs Actual engine
│   ├── search.js           # Debounced global search & compound filters
│   └── ui.js               # Canvas particle physics, Web Audio, routing, themes
│
├── supabase/
│   └── schema.sql          # Complete PostgreSQL schema, indexes, triggers, and RLS
│
└── assets/
    └── icons/              # Custom SVG vectors & icons
```

---

## ✦ Supabase Database Setup

Your Supabase project is: **`https://supabase.com/dashboard/project/dhuhedcqqiwblzpdefgr`**

1. Open your Supabase project's SQL Editor:
   👉 **[Open SQL Editor](https://supabase.com/dashboard/project/dhuhedcqqiwblzpdefgr/sql/new)**
2. Copy the entire contents of [`supabase/schema.sql`](file:///C:/Users/parth/OneDrive/Documents/Whattodoweapp/supabase/schema.sql) and paste into the SQL Editor.
3. Click **RUN**. This creates:
   - `tasks` table with indexes on `planned_date`, `status`, and `category`.
   - `daily_records` table with unique constraint on `record_date`.
   - `categories` table with default categories (`Study`, `Coding`, `College`, `Project`, `Personal`, `Other`).
   - `settings` table.
   - Automatic `updated_at` trigger functions.
   - Row Level Security (RLS) policies allowing secure client operations.
4. Your application is already pre-configured to connect to:
   - **URL**: `https://dhuhedcqqiwblzpdefgr.supabase.co`
   - **Publishable Key**: `sb_publishable__ucc7YM0IHkAhwnpoziNbw_zF5ilfj_`

---

## ✦ Connecting the App to Supabase

1. Open NEXUS in your browser.
2. Navigate to **Settings** (`/settings` or click the gear icon in the sidebar/bottom nav).
3. Under **SUPABASE CLOUD SYNC**:
   - Paste your **Supabase Project URL**.
   - Paste your **Supabase Public Anon Key**.
4. Click **TEST & CONNECT DATABASE**.
5. Once connected, your local tasks and daily records will automatically synchronize with your PostgreSQL database in the cloud!

*Note: Even without configuring Supabase immediately, NEXUS works 100% locally using IndexedDB.*

---

## ✦ Netlify Deployment Guide

### Option 1: Git Integration (Recommended)
1. Push this repository to GitHub or GitLab.
2. Go to [Netlify](https://app.netlify.com) and select **Add new site** > **Import an existing project**.
3. Choose your repository.
4. Set **Publish directory** to `.` (root directory).
5. Click **Deploy Site**.

### Option 2: Netlify CLI
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Deploy static site
netlify deploy --prod --dir=.
```

The included [`netlify.toml`](file:///C:/Users/parth/OneDrive/Documents/Whattodoweapp/netlify.toml) automatically sets up SPA routing and optimal caching headers for your stylesheets and scripts.

---

## ✦ Keyboard Shortcuts

- `n`: Open New Task modal.
- `/`: Focus Global Search.
- `Escape`: Close any active modal.
