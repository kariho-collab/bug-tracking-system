# Bug Tracking System (Milestones 3 & 4)

## Stack
- Node.js + Express (backend + server-rendered frontend via EJS)
- better-sqlite3 (SQLite database)
- bcryptjs for password hashing
- express-session for session-based auth

## Setup
```
npm install
node db/seed.js      # creates and seeds db/bugtracker.db
node server.js        # starts the app on http://localhost:3000
```
Seeded login: alex@axiomlabs.dev / Passw0rd! (administrator)

## Pages (frontend)
/login, /register, /dashboard, /report-bug, /bugs, /bugs/:id, /reports, /users (admin only)

## JSON API (unchanged, still available)
- POST /api/register, /api/login, /api/logout
- POST/GET /api/bugs, GET /api/bugs/:id
- PATCH /api/bugs/:id/status, /api/bugs/:id/assign
- POST /api/bugs/:id/comments
- GET /api/reports/summary
- GET/POST/PATCH/DELETE /api/users (admin only)

## Known limitation (Chapter Three, section 3.6)
Duplicate detection only matches titles that are identical (case-insensitive).
Near-duplicate wording is not yet caught.
