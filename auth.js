const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Set a real JWT_SECRET as an environment variable in production (Railway
// -> Variables tab). This fallback is only here so it doesn't crash locally.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set — using an insecure default. Set it in your environment before going live.');
}

const TOKEN_EXPIRY = '30d';

// Recovery answers are normalized (trimmed + lowercased) before hashing,
// so small differences like "Football" vs "football" don't lock someone out.
function normalizeAnswer(answer) {
    return answer.trim().toLowerCase();
}

// --- SIGN UP ---
// Every new account is created as a 'student' by default. There is no
// "pick your own role" option on purpose — otherwise any student could
// tick "teacher" and get upload access. Teacher accounts are promoted
// manually (see README) by whoever runs the server.
function signup(req, res) {
    const { name, password, recoveryQuestion, recoveryAnswer } = req.body;

    if (!name || !password) {
        return res.status(400).json({ error: 'Name and password are required' });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    if (!recoveryQuestion || !recoveryAnswer || !recoveryAnswer.trim()) {
        return res.status(400).json({ error: 'Please choose a recovery question and answer' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
    if (existing) {
        return res.status(409).json({ error: 'That name is already taken' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const recovery_answer_hash = bcrypt.hashSync(normalizeAnswer(recoveryAnswer), 10);

    const info = db.prepare(
        'INSERT INTO users (name, password_hash, role, recovery_question, recovery_answer_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(name, password_hash, 'student', recoveryQuestion, recovery_answer_hash);

    const user = { id: info.lastInsertRowid, name, role: 'student' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.json({ token, user });
}

// --- LOG IN ---
function login(req, res) {
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).json({ error: 'Name and password are required' });
    }

    const row = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!row) {
        return res.status(401).json({ error: 'Invalid name or password' });
    }

    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid name or password' });
    }

    const user = { id: row.id, name: row.name, role: row.role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.json({ token, user });
}

// --- MIDDLEWARE: attach req.user if a valid token is sent ---
function verifyToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired, please log in again' });
    }
}

// --- MIDDLEWARE: only let a specific role through (use after verifyToken) ---
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: 'You do not have access to this' });
        }
        next();
    };
}

// --- FORGOT PASSWORD: STEP 1 ---
// Look up which question this account needs answered. Deliberately vague
// on "not found" so this can't be used to fish for which names have
// accounts.
function getRecoveryQuestion(req, res) {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const row = db.prepare('SELECT recovery_question FROM users WHERE name = ?').get(name);
    if (!row) {
        return res.status(404).json({ error: 'No account found with that name' });
    }
    res.json({ question: row.recovery_question });
}

// --- FORGOT PASSWORD: STEP 2 ---
function resetPassword(req, res) {
    const { name, recoveryAnswer, newPassword } = req.body;

    if (!name || !recoveryAnswer || !newPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const row = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!row) {
        return res.status(404).json({ error: 'No account found with that name' });
    }

    const validAnswer = bcrypt.compareSync(normalizeAnswer(recoveryAnswer), row.recovery_answer_hash);
    if (!validAnswer) {
        return res.status(401).json({ error: 'That answer doesn\'t match' });
    }

    const password_hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE name = ?').run(password_hash, name);

    res.json({ success: true });
}

module.exports = { signup, login, verifyToken, requireRole, getRecoveryQuestion, resetPassword };
