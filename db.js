const { DatabaseSync } = require('node:sqlite');
const path = require('path');

// Node has SQLite built in since v22.13 — no separate package, no native
// compilation, nothing to install. One file on disk holds the whole
// database. This replaces database.json as things grow, since SQLite
// handles multiple things writing at once safely, where a single JSON
// file can get corrupted under concurrent writes.
const db = new DatabaseSync(path.join(__dirname, 'node.db'));

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

