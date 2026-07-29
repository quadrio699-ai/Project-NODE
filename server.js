const express = require('express');
const fs = require('fs');
const path = require('path');
const { signup, login, verifyToken, requireRole, getRecoveryQuestion, resetPassword } = require('./auth');
const app = express();

// On Railway, set DATA_DIR to your mounted volume path (e.g. /app/data)
// so this survives redeploys. Locally, it just defaults to this folder.
const DATA_DIR = process.env.DATA_DIR || '.';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'database.json');

app.use(express.json());
app.use(express.static('.'));
app.use('/lessons', express.static('lessons'));

// --- 0. AUTH ---
app.post('/api/signup', signup);
app.post('/api/login', login);
app.get('/api/recovery-question', getRecoveryQuestion);
app.post('/api/reset-password', resetPassword);

// Lets the frontend check "am I still logged in?" on page load,
// and confirms the role (student/teacher) for the logged-in account.
app.get('/api/me', verifyToken, (req, res) => {
    res.json({ user: req.user });
});

// Example of how future teacher-only routes get protected, e.g. an
// upload endpoint: app.post('/api/upload', verifyToken, requireRole('teacher'), ...)

// Load database or initialize if empty
let dataStore = { comments: [] };
if (fs.existsSync(DB_FILE)) {
    dataStore = JSON.parse(fs.readFileSync(DB_FILE));
}

// Track online users and their session start times
let activeSessions = {}; 

// --- 1. HEARTBEAT & SESSION TRACKING ---
// Fixes: Message history reset for new users and online student count
app.post('/api/heartbeat', (req, res) => {
    const { student, isNewLogin } = req.body;
    if (!student) return res.sendStatus(400);

    const now = new Date();
    
    // If it's a first load, we set the sessionStart to NOW
    // This ensures they don't see history from before they logged in
    if (isNewLogin || !activeSessions[student]) {
        activeSessions[student] = { 
            lastSeen: now, 
            sessionStart: now.toISOString() 
        };
    } else { 
        activeSessions[student].lastSeen = now; 
    }
    res.sendStatus(200);
});

// --- 2. DATA RETRIEVAL (FILES & MESSAGES) ---
// Fixes: Nested folders for Physics and hiding old history
app.get('/api/data', (req, res) => {
    const studentName = req.query.user;
    const now = Date.now();

    // Cleanup users inactive for > 10 seconds
    Object.keys(activeSessions).forEach(name => {
        if (now - new Date(activeSessions[name].lastSeen).getTime() > 10000) {
            delete activeSessions[name];
        }
    });

    const baseLessonsPath = path.join(__dirname, 'lessons');

    // --- RECURSIVE SCANNER ---
    // Walks the lessons/ tree to any depth, so it works whether folders
    // are shaped like Faculty/Department/Level/Course or just flat
    // subject folders. Each node is { folders: {name: node}, files: [name] }.
    function scanDir(dirPath) {
        const node = { folders: {}, files: [] };
        if (!fs.existsSync(dirPath)) return node;

        fs.readdirSync(dirPath).forEach(item => {
            // Skip hidden/system files (.DS_Store, etc.)
            if (item.startsWith('.')) return;
            const itemPath = path.join(dirPath, item);
            if (fs.lstatSync(itemPath).isDirectory()) {
                node.folders[item] = scanDir(itemPath);
            } else {
                node.files.push(item);
            }
        });
        return node;
    }

    const categorizedFiles = scanDir(baseLessonsPath).folders;

    // Filter Comments: Only show messages sent AFTER this user's current session began
    let filteredComments = dataStore.comments;
    if (studentName !== "Marvellous" && activeSessions[studentName]) {
        const threshold = new Date(activeSessions[studentName].sessionStart);
        filteredComments = dataStore.comments.filter(c => new Date(c.fullTimestamp) > threshold);
    }

    res.json({
        visitorCount: Object.keys(activeSessions).length,
        categorizedFiles: categorizedFiles,
        comments: filteredComments
    });
});

// --- 3. COMMENTING SYSTEM ---
app.post('/api/comment', (req, res) => {
    const { student, text } = req.body;
    if (!student || !text) return res.sendStatus(400);

    const newComment = {
        student,
        text,
        fullTimestamp: new Date().toISOString()
    };

    dataStore.comments.push(newComment);
    fs.writeFileSync(DB_FILE, JSON.stringify(dataStore, null, 2));
    res.json(newComment);
});

// --- 4. DOWNLOAD HANDLER ---
app.get('/api/download/*', (req, res) => {
    const relativePath = decodeURIComponent(req.params[0]); 
    const filePath = path.join(__dirname, 'lessons', relativePath);
    if (fs.existsSync(filePath)) {
        res.download(filePath, path.basename(filePath)); 
    } else {
        res.status(404).send('File not found');
    }
});

app.listen(80, () => console.log("NODE Server Running on Port 80"));
