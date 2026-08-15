const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const multer = require('multer');
const { marked } = require('marked');
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

// --- FACULTY/DEPARTMENT LOOKUP (for upload autocomplete) ---
// Reads real folder names directly off disk, not the metadata catalog —
// this way a faculty/department with no course content yet (still just
// an empty scaffolded folder) still shows up as a valid, existing name
// to autocomplete against, instead of only ones with _meta.json files.
function listSubfolders(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath)
        .filter(item => !item.startsWith('.') && fs.lstatSync(path.join(dirPath, item)).isDirectory())
        .sort();
}

app.get('/api/faculties', (req, res) => {
    res.json({ faculties: listSubfolders(path.join(__dirname, 'lessons')) });
});

app.get('/api/departments', (req, res) => {
    const faculty = req.query.faculty;
    if (!faculty) return res.status(400).json({ error: 'Missing ?faculty=' });
    res.json({ departments: listSubfolders(path.join(__dirname, 'lessons', faculty)) });
});

// --- TEACHER UPLOADS ---
// The route the comment above used to just describe as an example.
// Only accounts promoted to role='teacher' (see README's "Making
// someone a teacher") can reach this. 15MB cap keeps it in line with
// the same "no heavy files" ethos as organize-ocw.js — this is meant
// for lecture notes/slides, not lecture recordings.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.post('/api/upload', verifyToken, requireRole('teacher'), upload.single('file'), (req, res) => {
    try {
        const { faculty, department, level, courseTitle, courseCode, topicTags } = req.body;
        if (!faculty || !department || !level || !courseTitle) {
            return res.status(400).json({ error: 'faculty, department, level, and courseTitle are all required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file was uploaded' });
        }

        const courseDir = path.join(__dirname, 'lessons', faculty, department, level, courseTitle);
        fs.mkdirSync(courseDir, { recursive: true });

        // A leftover .gitkeep placeholder is no longer needed once real
        // content lands in this folder.
        const gitkeepPath = path.join(courseDir, '.gitkeep');
        if (fs.existsSync(gitkeepPath)) fs.unlinkSync(gitkeepPath);

        const destFilePath = path.join(courseDir, req.file.originalname);
        fs.writeFileSync(destFilePath, req.file.buffer);

        // Create _meta.json if this is a brand-new course folder, or
        // merge new tags into an existing one — never overwrite
        // cross-listing/canonical info that might already be set up.
        const metaPath = path.join(courseDir, '_meta.json');
        let meta;
        if (fs.existsSync(metaPath)) {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } else {
            meta = {
                courseCode: courseCode || null,
                courseTitle, faculty, department, level,
                topicTags: [], crossListedWith: [], sharedWith: [], prerequisites: [],
                isCanonical: true, canonicalPath: null
            };
        }
        if (topicTags) {
            const newTags = topicTags.split(',').map(t => t.trim().toLowerCase().replace(/-/g, ' ')).filter(Boolean);
            meta.topicTags = [...new Set([...(meta.topicTags || []), ...newTags])];
        }
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        res.json({ success: true, path: `${faculty}/${department}/${level}/${courseTitle}`, fileName: req.file.originalname });
    } catch (e) {
        res.status(500).json({ error: 'Upload failed', details: e.message });
    }
});

// Catches multer errors (e.g. file too large) with a clean JSON
// response instead of a raw stack trace.
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (15MB max)' : err.message });
    }
    next(err);
});

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
            // Skip hidden/system files (.DS_Store, etc.) and _meta.json,
            // which is internal-only metadata (see METADATA_SCHEMA.md) —
            // not something a student should see in the file browser.
            if (item.startsWith('.') || item === '_meta.json') return;
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

// --- 5. METADATA CATALOG ---
// Walks lessons/ collecting every _meta.json into one flat list. This is
// the layer both the future QR offline-broadcast system and the LASU
// Connect "Learning Materials" pull will read from — a student's
// faculty/department/level (plus topicTags) determines what's relevant
// to them, without needing to know the folder structure at all.
//
// Non-canonical entries (isCanonical: false — a department's pointer to
// another department's shared content) get resolved here: their
// "files" list is filled in from the canonical folder, so a consumer of
// this endpoint never has to chase canonicalPath references themselves.
function buildCatalog(dirPath, relPath = '') {
    let entries = [];
    if (!fs.existsSync(dirPath)) return entries;

    const metaPath = path.join(dirPath, '_meta.json');
    if (fs.existsSync(metaPath)) {
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const files = fs.readdirSync(dirPath)
                .filter(f => f !== '_meta.json' && !f.startsWith('.') &&
                    fs.lstatSync(path.join(dirPath, f)).isFile());
            entries.push({ ...meta, path: relPath, files });
        } catch (e) {
            console.warn(`Bad _meta.json at ${metaPath}:`, e.message);
        }
        // A course folder is a leaf for cataloging purposes — don't
        // recurse further even if it somehow has subfolders.
        return entries;
    }

    fs.readdirSync(dirPath).forEach(item => {
        if (item.startsWith('.')) return;
        const itemPath = path.join(dirPath, item);
        if (fs.lstatSync(itemPath).isDirectory()) {
            const childRel = relPath ? `${relPath}/${item}` : item;
            entries = entries.concat(buildCatalog(itemPath, childRel));
        }
    });
    return entries;
}

// Resolve non-canonical entries' file lists against their canonical
// counterpart, so a consumer gets: their own variation files PLUS the
// canonical files, without extra lookups.
function resolveCatalog(entries) {
    const byPath = {};
    entries.forEach(e => { byPath[e.path] = e; });

    return entries.map(e => {
        if (e.isCanonical || !e.canonicalPath) return e;
        const canonical = byPath[e.canonicalPath];
        if (!canonical) return e;
        return {
            ...e,
            files: [...canonical.files, ...e.files],
            canonicalTopicTags: canonical.topicTags
        };
    });
}

app.get('/api/catalog', (req, res) => {
    const baseLessonsPath = path.join(__dirname, 'lessons');
    const raw = buildCatalog(baseLessonsPath);
    const catalog = resolveCatalog(raw);

    // Optional filtering — a caller (LASU Connect, or a future QR
    // broadcaster) can pass ?faculty=&department=&level=&tag= to get
    // just what's relevant to one student, instead of the whole catalog.
    const { faculty, department, level, tag } = req.query;
    let filtered = catalog;
    if (faculty) filtered = filtered.filter(e => e.faculty === faculty);
    if (department) filtered = filtered.filter(e => e.department === department);
    if (level) filtered = filtered.filter(e => e.level === level);
    if (tag) filtered = filtered.filter(e => (e.topicTags || []).includes(tag));

    res.json({ count: filtered.length, courses: filtered });
});

// --- 6. FUZZY / ALIAS-AWARE SEARCH ---
// Handles "Maths" finding "Mathematics", "compsci" finding "Computer
// Science", and plain typos ("mathamatics") — across faculty,
// department, courseTitle, and topicTags. Not specific to any one
// field name, so it works the same way for anything searched.

// Common abbreviations/nicknames -> the canonical word they should
// resolve to. This list can just keep growing as new mismatches show up
// — it doesn't need to be exhaustive on day one.
const SEARCH_ALIASES = {
    'maths': 'mathematics', 'math': 'mathematics', 'mathematic': 'mathematics',
    'compsci': 'computer science', 'cs': 'computer science', 'comp sci': 'computer science',
    'eng': 'engineering',
    'mgt': 'management', 'mgmt': 'management',
    'econs': 'economics', 'econ': 'economics',
    'stats': 'statistics', 'stat': 'statistics',
    'poli sci': 'political science', 'polsci': 'political science',
    'psych': 'psychology',
    'bio': 'biology', 'biochem': 'biochemistry',
    'chem': 'chemistry',
    'phy': 'physics', 'phys': 'physics',
    'ict': 'information and communication technology',
    'pmt': 'project management technology',
    'ee': 'electronic and computer engineering', 'ece': 'electronic and computer engineering',
    'sst': 'science and technology education',
};

// Basic text normalization shared by every search: lowercase, trim,
// collapse extra whitespace, strip punctuation. This alone fixes most
// "user typed it slightly differently" cases before fuzzy matching even
// has to run.
function normalize(str) {
    return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');
}

// Resolves a normalized query through the alias map. Checked as a whole
// phrase first ("comp sci" -> "computer science"), then per-word, so
// multi-word queries still get partial alias resolution.
function resolveAliases(normalized) {
    if (SEARCH_ALIASES[normalized]) return SEARCH_ALIASES[normalized];
    return normalized
        .split(' ')
        .map(word => SEARCH_ALIASES[word] || word)
        .join(' ');
}

// Standard Levenshtein edit distance — counts the minimum number of
// single-character insertions/deletions/substitutions to turn one
// string into another. Used to catch typos an alias map won't cover.
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

// A search term "matches" a candidate field if: it's an exact
// substring match after normalization (handles "Maths" -> "mathematics"
// via alias, and partial typing like "comp" -> "computer science"), OR
// its edit distance is small relative to the candidate's length (catches
// typos like "mathamatics"). The distance threshold scales with word
// length so short words aren't matched too loosely.
function fuzzyMatch(query, candidate) {
    const normQuery = resolveAliases(normalize(query));
    const normCandidate = normalize(candidate);
    if (!normQuery || !normCandidate) return false;

    if (normCandidate.includes(normQuery) || normQuery.includes(normCandidate)) {
        return true;
    }

    // Compare word-by-word too, so "math" fuzzy-matches the word
    // "mathematics" inside a longer candidate like "Faculty of Mathematics".
    const candidateWords = normCandidate.split(' ');
    return candidateWords.some(word => {
        const threshold = Math.max(1, Math.floor(Math.max(word.length, normQuery.length) * 0.3));
        return levenshtein(normQuery, word) <= threshold;
    });
}

// --- 7. PRINT / SAVE-AS-PDF VIEW ---
// Converts a .md file to clean, styled HTML on the fly — nothing is
// stored, so this doesn't add any extra file size to the lessons/
// folder or the offline broadcast. The student uses their browser's
// native "Print -> Save as PDF" on the result, which needs no extra
// backend dependency (no headless Chromium, no PhantomJS).
app.get('/api/view/*', (req, res) => {
    const relPath = req.params[0];
    const filePath = path.join(__dirname, 'lessons', relPath);

    // Guard against path traversal (../../etc)
    if (!filePath.startsWith(path.join(__dirname, 'lessons'))) {
        return res.status(400).send('Invalid path');
    }
    if (!fs.existsSync(filePath) || !filePath.endsWith('.md')) {
        return res.status(404).send('File not found or not a markdown file');
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const bodyHtml = marked.parse(raw);
    const title = path.basename(relPath, '.md');

    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
  h1, h2, h3 { font-family: Arial, sans-serif; color: #006633; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f4f4f4; }
  code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
  .print-hint { background: #FFD700; padding: 10px 16px; border-radius: 6px; margin-bottom: 24px; font-family: Arial, sans-serif; font-size: 14px; }
  @media print { .print-hint { display: none; } }
</style>
</head>
<body>
  <div class="print-hint">Use your browser's Print option (Ctrl/Cmd+P) and choose "Save as PDF" to download this as a PDF.</div>
  ${bodyHtml}
</body>
</html>`);
});

app.get('/api/search', (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Missing ?q= search term' });

    const baseLessonsPath = path.join(__dirname, 'lessons');
    const catalog = resolveCatalog(buildCatalog(baseLessonsPath));

    const results = catalog.filter(entry => {
        const searchableFields = [
            entry.faculty,
            entry.department,
            entry.courseTitle,
            entry.courseCode,
            ...(entry.topicTags || [])
        ];
        return searchableFields.some(field => field && fuzzyMatch(q, field));
    });

    res.json({ query: q, count: results.length, courses: results });
});

// --- 8. AUTO-CONNECT QR (Tier 1: on-campus, near a fixed access point) ---
// Detects this server's own LAN IP address and turns it into a QR code,
// so nobody has to type an IP address by hand — point a phone camera at
// a screen showing /connect and it opens the site directly. Meant to be
// displayed at student union offices, e-boards, or any other fixed
// on-campus access point.
function getLanIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}

app.get('/api/connect-qr', async (req, res) => {
    const ip = getLanIp();
    if (!ip) return res.status(500).json({ error: 'Could not detect a LAN IP address on this server' });

    const url = `http://${ip}`;
    try {
        const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
        res.json({ url, qrDataUrl });
    } catch (e) {
        res.status(500).json({ error: 'QR generation failed', details: e.message });
    }
});

// A simple, large-print page meant to be left open on a shared screen
// (SU office monitor, e-board) — shows the QR plus the URL as text, in
// case someone would rather type it than scan.
app.get('/connect', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Connect to Project-NODE</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background: #0a0a0a; color: #fff; }
  h1 { color: #006633; }
  img { margin: 30px 0; border-radius: 12px; background: #fff; padding: 16px; }
  .url { font-size: 20px; color: #FFD700; word-break: break-all; }
  .hint { color: #999; margin-top: 20px; }
  .updated { color: #555; font-size: 13px; margin-top: 10px; }
</style>
</head>
<body>
  <h1>Scan to Connect — Project-NODE</h1>
  <img id="qr" src="" alt="Loading QR..." width="300" height="300">
  <div class="url" id="url">Detecting...</div>
  <div class="hint">Point your phone's camera at the QR code above, or type the address into your browser.</div>
  <div class="updated" id="updated"></div>
  <script>
    // Meant to be left open indefinitely on a shared screen, so this
    // re-fetches the QR every hour — catches the rare case where the
    // network reassigns this device a new IP address (Wi-Fi reconnect,
    // router restart) without anyone needing to notice or reload by hand.
    function refreshQr() {
      fetch('/api/connect-qr')
        .then(r => r.json())
        .then(data => {
          document.getElementById('qr').src = data.qrDataUrl;
          document.getElementById('url').innerText = data.url;
          document.getElementById('updated').innerText = 'Last checked: ' + new Date().toLocaleTimeString();
        })
        .catch(() => {
          document.getElementById('url').innerText = 'Could not detect connection info. Check the server console.';
        });
    }
    refreshQr();
    setInterval(refreshQr, 60 * 60 * 1000); // every hour
  </script>
</body>
</html>`);
});

// --- 10. QR OFFLINE BROADCAST (Tier 3: peer-to-peer, no network at all) ---
// Chunks a real file from lessons/ into base64 pieces and generates one
// QR code image per chunk, server-side. Same protocol validated in the
// standalone proof-of-concept: "NODE|fileId|index|total|chunkData".
// The receiving device never talks to this server — it just scans the
// QR sequence directly off another phone's screen (see /qr-scan below).
const crypto = require('crypto');

app.get('/api/qr-broadcast/*', async (req, res) => {
    const relPath = req.params[0];
    const filePath = path.join(__dirname, 'lessons', relPath);

    if (!filePath.startsWith(path.join(__dirname, 'lessons'))) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Chunk size in base64 characters per QR frame. 300 keeps QR
    // density low enough to scan reliably while animating (validated
    // in testing — higher values pack more per frame but produce
    // denser, harder-to-scan codes).
    const chunkSize = Math.min(Math.max(parseInt(req.query.chunkSize) || 300, 100), 1000);

    const fileBytes = fs.readFileSync(filePath);
    const b64 = fileBytes.toString('base64');
    const fileId = crypto.createHash('md5').update(relPath).digest('hex').slice(0, 8);

    const chunks = [];
    for (let i = 0; i < b64.length; i += chunkSize) chunks.push(b64.slice(i, i + chunkSize));
    const total = chunks.length;

    try {
        const frames = await Promise.all(chunks.map((chunk, idx) => {
            const payload = `NODE|${fileId}|${idx}|${total}|${chunk}`;
            return QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
        }));
        res.json({ fileId, fileName: path.basename(relPath), totalFrames: total, frames });
    } catch (e) {
        res.status(500).json({ error: 'QR generation failed', details: e.message });
    }
});

// Broadcasting device: cycles through the QR frame sequence on screen.
app.get('/qr-broadcast', (req, res) => {
    const filePath = req.query.path || '';
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Broadcasting — Project-NODE</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 30px 20px; background: #0a0a0a; color: #fff; }
  h1 { color: #006633; font-size: 18px; }
  img { margin: 20px 0; border-radius: 12px; background: #fff; padding: 12px; width: 300px; height: 300px; }
  .status { color: #FFD700; font-size: 16px; margin-top: 10px; }
  .controls { margin-top: 20px; }
  select, button { padding: 8px 14px; border-radius: 8px; border: none; margin: 0 6px; font-size: 14px; }
  button { background: #006633; color: #fff; cursor: pointer; }
  .hint { color: #999; font-size: 13px; margin-top: 20px; max-width: 400px; margin-left: auto; margin-right: auto; }
</style>
</head>
<body>
  <h1 id="fileName">Loading file...</h1>
  <img id="qrFrame" src="" alt="QR frame">
  <div class="status" id="status">Frame 0 / 0</div>
  <div class="controls">
    <label>Speed:
      <select id="fps">
        <option value="500">Slow (2 fps)</option>
        <option value="250" selected>Normal (4 fps)</option>
        <option value="150">Fast (~7 fps)</option>
      </select>
    </label>
    <button onclick="toggleLoop()" id="loopBtn">Loop: On</button>
  </div>
  <div class="hint">Point another device's camera at this screen using the Scan page. The sequence loops continuously so a receiver can join anytime and just wait for it to cycle back around.</div>
  <script>
    let frames = [];
    let currentFrame = 0;
    let intervalId = null;
    let looping = true;

    function toggleLoop() {
      looping = !looping;
      document.getElementById('loopBtn').innerText = 'Loop: ' + (looping ? 'On' : 'Off');
    }

    function showFrame() {
      if (frames.length === 0) return;
      document.getElementById('qrFrame').src = frames[currentFrame];
      document.getElementById('status').innerText = 'Frame ' + (currentFrame + 1) + ' / ' + frames.length;
      currentFrame++;
      if (currentFrame >= frames.length) {
        currentFrame = 0;
        if (!looping) clearInterval(intervalId);
      }
    }

    function startLoop() {
      clearInterval(intervalId);
      const fps = document.getElementById('fps').value;
      intervalId = setInterval(showFrame, parseInt(fps));
    }

    document.getElementById('fps').addEventListener('change', startLoop);

    fetch('/api/qr-broadcast/${encodeURIComponent(filePath).replace(/%2F/g, '/')}')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          document.getElementById('fileName').innerText = 'Error: ' + data.error;
          return;
        }
        frames = data.frames;
        document.getElementById('fileName').innerText = data.fileName + ' (' + data.totalFrames + ' frames)';
        startLoop();
      })
      .catch(() => {
        document.getElementById('fileName').innerText = 'Failed to load broadcast data.';
      });
  </script>
</body>
</html>`);
});

// Receiving device: camera scan + reconstruction. Uses jsQR (loaded
// from CDN — this runs on the student's own device, which has normal
// internet access even though this server's sandbox doesn't).
app.get('/qr-scan', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scan — Project-NODE</title>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #0a0a0a; color: #fff; margin: 0; }
  h1 { color: #006633; font-size: 18px; }
  video, canvas { width: 100%; max-width: 400px; border-radius: 12px; }
  canvas { display: none; }
  .status { color: #FFD700; font-size: 16px; margin: 15px 0; }
  .progress-bar { background: #333; border-radius: 20px; height: 20px; max-width: 400px; margin: 10px auto; overflow: hidden; }
  .progress-fill { background: #006633; height: 100%; width: 0%; transition: width 0.2s; }
  button { padding: 10px 20px; border-radius: 8px; border: none; background: #006633; color: #fff; font-size: 14px; cursor: pointer; margin-top: 15px; }
  .hint { color: #999; font-size: 13px; margin-top: 15px; max-width: 400px; margin-left: auto; margin-right: auto; }
</style>
</head>
<body>
  <h1>Scan QR Sequence</h1>
  <video id="video" playsinline></video>
  <canvas id="canvas"></canvas>
  <div class="status" id="status">Point camera at the broadcasting screen</div>
  <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
  <button id="downloadBtn" style="display:none;" onclick="downloadFile()">Save File</button>
  <div class="hint">Received frames are kept even out of order — the sequence loops on the broadcaster, so just wait if you missed one.</div>
  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let received = {};
    let expectedTotal = null;
    let fileId = null;
    let fileName = 'received-file';
    let reconstructedBlob = null;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();
        requestAnimationFrame(scanLoop);
      } catch (e) {
        document.getElementById('status').innerText = 'Camera access failed: ' + e.message;
      }
    }

    function scanLoop() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) handlePayload(code.data);
      }
      if (!reconstructedBlob) requestAnimationFrame(scanLoop);
    }

    function handlePayload(payload) {
      const parts = payload.split('|');
      if (parts.length < 5 || parts[0] !== 'NODE') return;
      const [, fid, idxStr, totalStr, ...chunkParts] = parts;
      const chunkData = chunkParts.join('|');
      const idx = parseInt(idxStr);
      const total = parseInt(totalStr);

      if (fileId === null) { fileId = fid; expectedTotal = total; }
      if (fid !== fileId) return; // ignore frames from a different broadcast

      received[idx] = chunkData;
      updateProgress();

      if (Object.keys(received).length === expectedTotal) {
        finishReconstruction();
      }
    }

    function updateProgress() {
      const count = Object.keys(received).length;
      const pct = expectedTotal ? Math.round((count / expectedTotal) * 100) : 0;
      document.getElementById('status').innerText = 'Received ' + count + ' / ' + (expectedTotal || '?') + ' frames';
      document.getElementById('progressFill').style.width = pct + '%';
    }

    function finishReconstruction() {
      const orderedChunks = [];
      for (let i = 0; i < expectedTotal; i++) orderedChunks.push(received[i]);
      const b64 = orderedChunks.join('');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      reconstructedBlob = new Blob([bytes]);
      document.getElementById('status').innerText = 'Complete! ' + expectedTotal + ' frames received.';
      document.getElementById('downloadBtn').style.display = 'inline-block';
      video.srcObject.getTracks().forEach(t => t.stop());
    }

    function downloadFile() {
      const url = URL.createObjectURL(reconstructedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'received-file';
      a.click();
    }

    startCamera();
  </script>
</body>
</html>`);
});


// When this server is the "flagship device" (a screen at an SU office,
// e-board, etc.), starting it should be the entire setup step — no
// typing a URL, no finding an IP. This opens the /connect QR page in
// the default browser automatically. Skipped on a real deployment
// (Railway, or anywhere with no display) since there's nothing to open
// a browser window on — set AUTO_OPEN=false to opt out anywhere else.
function autoOpenConnectPage() {
    if (process.env.RAILWAY_ENVIRONMENT || process.env.AUTO_OPEN === 'false') return;

    const url = 'http://localhost/connect';
    const platform = process.platform;
    const cmd = platform === 'win32' ? `start ${url}`
        : platform === 'darwin' ? `open ${url}`
        : `xdg-open ${url}`;

    require('child_process').exec(cmd, (err) => {
        if (err) console.log(`Could not auto-open browser — visit ${url} manually.`);
    });
}

// Most hosting platforms (Render, Railway, etc.) assign their own port
// via a PORT environment variable and expect the app to listen on it —
// hardcoding 80 would break deployment there. Locally/on a LAN, no
// PORT variable is set, so this still defaults to 80 exactly as
// before — nothing changes for kiosk mode, /connect, or any existing
// local setup instructions.
const PORT = process.env.PORT || 80;

app.listen(PORT, () => {
    console.log(`NODE Server Running on Port ${PORT}`);
    autoOpenConnectPage();
});
