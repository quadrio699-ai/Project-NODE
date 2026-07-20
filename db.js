const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Node has SQLite built in since v22.13 — no separate package, no native
// compilation, nothing to install. One file on disk holds the whole
// database. This replaces database.json as things grow, since SQLite
// handles multiple things writing at once safely, where a single JSON
// file can get corrupted under concurrent writes.
// On Railway, set DATA_DIR to your mounted volume path (e.g. /app/data)
// so accounts survive redeploys. Locally, it just defaults to this folder.
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'node.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    recovery_question TEXT NOT NULL,
    recovery_answer_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;

