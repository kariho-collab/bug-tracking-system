-- Bug Tracking System Database Schema
-- Matches the ERD in Chapter Two, section 2.4.1

CREATE TABLE IF NOT EXISTS users (
    user_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'developer'
);

CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS statuses (
    status_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bugs (
    bug_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    date_reported TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at   TEXT,
    priority      TEXT NOT NULL,
    category_id   INTEGER NOT NULL REFERENCES categories(category_id),
    status_id     INTEGER NOT NULL REFERENCES statuses(status_id),
    reported_by   INTEGER NOT NULL REFERENCES users(user_id),
    assigned_to   INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    bug_id       INTEGER NOT NULL REFERENCES bugs(bug_id),
    user_id      INTEGER NOT NULL REFERENCES users(user_id),
    comment_text TEXT NOT NULL,
    timestamp    TEXT NOT NULL DEFAULT (datetime('now'))
);
