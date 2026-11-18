// ai.js — NODE AI Tutor (a study aid, limited to the stored course materials)
//
// One module that does three jobs:
//   1. RETRIEVAL  — reads the markdown lessons under /lessons, cuts them into
//                   chunks, and finds the best chunks for a question (BM25
//                   keyword ranking; no extra model, no extra dependency).
//   2. GATEWAY    — sends the question + chunks to ANY OpenAI-compatible model
//                   server. Tier 1 = local Ollama. Tier 2 = a hosted API.
//   3. SAFETY     — login required, per-user rate limit, queue, answer cache.
//
// PRIVACY AND SCOPE (what this module guarantees):
//   * It answers ONLY from the lesson files. If the notes do not cover a
//     question it says so and does not call the model at all.
//   * It has NO access to the accounts database. It never requires db.js and
//     keeps its own data in a separate file (ai.db). The model only ever
//     receives the student's question plus text passages from /lessons.
//   * Questions are NEVER stored. They live in memory only long enough to be
//     answered. The log keeps no question text, only counts (answered or not,
//     how long it took, helpful / not helpful).
//   * Nothing it stores is linked to an account: no user id, name or email.
//   * Questions are scrubbed of obvious personal details (emails, phone
//     numbers, long ID-like numbers, "password is ...") before they are
//     searched or sent to the model.
//   * If a student chooses to send a report, only the answer shown and what
//     they type in the report form are kept. Logs, reports and cached
//     answers are deleted after AI_LOG_DAYS (30).
//
// No new npm packages. Uses Node's built-in fetch and node:sqlite.
//
// ENVIRONMENT VARIABLES (all optional — defaults suit a local Ollama):
//   AI_BASE_URL         default http://127.0.0.1:11434/v1   (Ollama's OpenAI-compatible API)
//   AI_MODEL            default qwen3:1.7b
//   AI_API_KEY          only needed for hosted APIs (Tier 2)
//   AI_ENABLED          "false" switches the tutor off completely
//   AI_MAX_CONCURRENT   answers generated at once            (default 2)
//   AI_MAX_QUEUE        people allowed to wait in line       (default 8)
//   AI_MAX_OUTPUT_TOKENS  cap on answer length               (default 350)
//   AI_CONTEXT_CHUNKS   lesson chunks sent with a question   (default 2)
//   AI_CHUNK_MAX_CHARS  max size of one chunk                (default 800)
//   AI_RATE_PER_MIN     questions per user per minute        (default 6)
//   AI_LOG_DAYS         days to keep logs, reports, cached answers (default 30)
//   AI_NO_THINK         force on/off Qwen3's thinking switch (auto-on for qwen3 models)
//   AI_MIN_COVERAGE     how much of the question the notes must cover (default 0.5)

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function int(v, d) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
}

const MODEL = process.env.AI_MODEL || 'qwen3:1.7b';
const CFG = {
    baseUrl: (process.env.AI_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, ''),
    model: MODEL,
    apiKey: process.env.AI_API_KEY || '',
    enabled: process.env.AI_ENABLED !== 'false',
    maxConcurrent: Math.max(1, int(process.env.AI_MAX_CONCURRENT, 2)),
    maxQueue: Math.max(0, int(process.env.AI_MAX_QUEUE, 8)),
    maxOutputTokens: int(process.env.AI_MAX_OUTPUT_TOKENS, 350),
    contextChunks: Math.max(1, int(process.env.AI_CONTEXT_CHUNKS, 2)),
    chunkMaxChars: Math.max(200, int(process.env.AI_CHUNK_MAX_CHARS, 800)),
    perUserPerMinute: Math.max(1, int(process.env.AI_RATE_PER_MIN, 6)),
    noThink: process.env.AI_NO_THINK ? process.env.AI_NO_THINK === 'true' : /qwen3/i.test(MODEL),
    retentionDays: Math.max(1, int(process.env.AI_LOG_DAYS, 30)),
    minCoverage: parseFloat(process.env.AI_MIN_COVERAGE || '0.5'),
    debug: process.env.AI_DEBUG === 'true',
    cacheDays: 30,
    timeoutMs: 120000,
};

const LESSONS_DIR = path.join(__dirname, 'lessons');

// Is the model on this machine / local network, or a cloud service? Students
// are told which, because a cloud model means their question leaves the server.
const CLOUD_MODEL = (() => {
    try {
        const h = new URL(CFG.baseUrl).hostname;
        return !(h === 'localhost' || h === '[::1]' || /^127\./.test(h) || /^10\./.test(h) ||
            /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h));
    } catch { return true; }
})();

// ---------------------------------------------------------------------------
// Own database file. Deliberately NOT node.db: the AI module cannot read
// accounts because it never opens the accounts database.
// ---------------------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const aiDb = new DatabaseSync(path.join(DATA_DIR, 'ai.db'));
aiDb.exec(`
  CREATE TABLE IF NOT EXISTS ai_cache (
    key TEXT PRIMARY KEY,
    answer TEXT NOT NULL,
    sources TEXT NOT NULL,
    grounded INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    course TEXT,
    grounded INTEGER,
    cached INTEGER,
    model TEXT,
    ms INTEGER,
    ok INTEGER NOT NULL DEFAULT 0,
    rating INTEGER,
    ticket TEXT
  );
  CREATE TABLE IF NOT EXISTS ai_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    log_id INTEGER UNIQUE,
    reason TEXT NOT NULL,
    note TEXT,
    answer TEXT,
    sources TEXT,
    resolved INTEGER NOT NULL DEFAULT 0
  );
`);

// Older versions stored question text. Remove those columns, then VACUUM so
// the old text is physically erased from the file, not just hidden.
(function dropStoredQuestions() {
    let dropped = false;
    for (const table of ['ai_log', 'ai_reports']) {
        const cols = aiDb.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        if (cols.includes('question')) { aiDb.exec(`ALTER TABLE ${table} DROP COLUMN question`); dropped = true; }
    }
    if (dropped) { aiDb.exec('VACUUM'); console.log('🧹 AI database: removed stored question text'); }
})();

// Retention: logs, reports and cached answers are deleted after AI_LOG_DAYS (default 30).
function purgeOld() {
    const logCut = Date.now() - CFG.retentionDays * 86400000;
    aiDb.prepare('DELETE FROM ai_log WHERE ts < ?').run(logCut);
    aiDb.prepare('DELETE FROM ai_reports WHERE ts < ?').run(logCut);
    aiDb.prepare('DELETE FROM ai_cache WHERE created_at < ?').run(Date.now() - CFG.cacheDays * 86400000);
}
purgeOld();
setInterval(purgeOld, 6 * 3600 * 1000).unref();

// Removes obvious personal details from anything a student types, BEFORE it is
// searched, sent to a model, or stored. Not perfect — the on-screen notice
// tells students not to type personal details in the first place.
const PII_PATTERNS = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,                       // email addresses
    /(?:\+?234|\b0)[\s-]?[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g,      // Nigerian phone numbers
    /\b\d{10,}\b/g,                                                   // long ID / account-like numbers
    /\b(?:password|passcode|pin)\s*(?:is|=|:)\s*\S+/gi,              // "my password is ..."
];
function scrubPII(text) {
    let out = String(text || '');
    let hit = false;
    for (const re of PII_PATTERNS) out = out.replace(re, () => { hit = true; return '[removed]'; });
    return { text: out, scrubbed: hit };
}

// ---------------------------------------------------------------------------
// 1. RETRIEVAL
// ---------------------------------------------------------------------------
const STOP = new Set((
    'a an the and or of to in on at for with by from is are was were be been being this that these those ' +
    'it its as if then than so such can could should would will shall may might do does did done have has ' +
    'had not no nor but into about over under between within without how what why when where which who ' +
    'whom whose explain give tell me my your our their please define find show i we you they he she removed'
).split(' '));

const IRREGULAR = {
    matrices: 'matrix', indices: 'index', vertices: 'vertex', analyses: 'analysis',
    hypotheses: 'hypothesis', bases: 'basis', axes: 'axis',
};

function stem(w) {
    if (IRREGULAR[w]) return IRREGULAR[w];
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('sses')) return w.slice(0, -2);
    if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
    if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
    if (/(s|x|z|ch|sh)es$/.test(w) && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
}

function tokenize(text) {
    const words = String(text || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .match(/[a-z0-9]+/g) || [];
    return words.filter(w => !STOP.has(w)).map(stem);
}

// Cut a markdown file into chunks: one per heading section, and long sections
// are split again on paragraph boundaries so no chunk exceeds maxChars.
function chunkMarkdown(md, maxChars) {
    const sections = [];
    let heading = '';
    let buf = [];
    const flush = () => {
        const t = buf.join('\n').trim();
        if (t) sections.push({ heading, text: t });
        buf = [];
    };
    for (const line of md.split(/\r?\n/)) {
        const m = /^(#{1,4})\s+(.*)$/.exec(line);
      if (m) { flush(); heading = m[2].replace(/[*_`]/g, '').trim(); } else buf.push(line);
    flush();
    const out = [];
    for (const s of sections) {
        if (s.text.length <= maxChars) { out.push(s); continue; }
        let cur = '';
        for (const p of s.text.split(/\n\s*\n/)) {
            if (cur && cur.length + p.length + 2 > maxChars) {
                out.push({ heading: s.heading, text: cur });
                cur = '';
            }
            if (p.length > maxChars) {
                for (let i = 0; i < p.length; i += maxChars) {
                    out.push({ heading: s.heading, text: p.slice(i, i + maxChars) });
                }
            } else {
                cur = cur ? cur + '\n\n' + p : p;
            }
        }
        if (cur) out.push({ heading: s.heading, text: cur });
    }
    return out;
}

function safeReaddir(dir) {
    try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

// A "course folder" is any folder containing _meta.json (same rule server.js uses).
function walkCourses(dir, rel, acc) {
    const entries = safeReaddir(dir);
    if (entries.some(e => e.isFile() && e.name === '_meta.json')) {
        acc.push({ dir, rel });
        return acc;
    }
    for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.')) {
            walkCourses(path.join(dir, e.name), rel ? rel + '/' + e.name : e.name, acc);
        }
    }
    return acc;
}

const K1 = 1.4;
const B = 0.75;
let INDEX = { sig: '', chunks: [], df: new Map(), avgLen: 1, checkedAt: 0, courses: 0 };

// Rebuilds only when a lesson file or _meta.json actually changed. The check
// itself is throttled to once per 30 s, so teacher uploads show up quickly
// without re-scanning the disk on every question.
function ensureIndex(force) {
    const now = Date.now();
    if (!force && INDEX.checkedAt && now - INDEX.checkedAt < 30000) return;
    INDEX.checkedAt = now;

    const courses = walkCourses(LESSONS_DIR, '', []);
    const files = [];
    const sigParts = [];
    for (const c of courses) {
        const metaPath = path.join(c.dir, '_meta.json');
        try {
            const st = fs.statSync(metaPath);
            sigParts.push(`${c.rel}/_meta.json:${st.size}:${Math.floor(st.mtimeMs)}`);
        } catch { /* ignore */ }
        for (const f of safeReaddir(c.dir)) {
            if (!f.isFile() || f.name.startsWith('.') || !/\.md$/i.test(f.name)) continue;
            const full = path.join(c.dir, f.name);
            try {
                const st = fs.statSync(full);
                sigParts.push(`${c.rel}/${f.name}:${st.size}:${Math.floor(st.mtimeMs)}`);
                files.push({ course: c, name: f.name, full });
            } catch { /* file vanished mid-scan */ }
        }
    }
    sigParts.sort();
    const sig = crypto.createHash('sha1').update(sigParts.join('|')).digest('hex').slice(0, 12);
    if (sig === INDEX.sig) return;

    const metaCache = new Map();
    const chunks = [];
    for (const f of files) {
        let meta = metaCache.get(f.course.rel);
        if (!meta) {
            try { meta = JSON.parse(fs.readFileSync(path.join(f.course.dir, '_meta.json'), 'utf8')); }
            catch { meta = {}; }
            metaCache.set(f.course.rel, meta);
        }
        let md;
        try { md = fs.readFileSync(f.full, 'utf8'); } catch { continue; }
        const courseTitle = meta.courseTitle || path.basename(f.course.dir);
        const tagText = (meta.topicTags || []).join(' ');
        const relPath = `${f.course.rel}/${f.name}`;
        for (const part of chunkMarkdown(md, CFG.chunkMaxChars)) {
            const tokens = tokenize(`${courseTitle} ${tagText} ${part.heading} ${part.text}`);
            const tf = new Map();
            for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
            chunks.push({
                id: chunks.length,
                course: courseTitle,
                coursePath: f.course.rel,
                faculty: meta.faculty || '',
                department: meta.department || '',
                level: meta.level || '',
                file: f.name,
                relPath,
                url: '/api/view/' + relPath.split('/').map(encodeURIComponent).join('/'),
                heading: part.heading || courseTitle,
                text: part.text,
                tf,
                len: tokens.length || 1,
            });
        }
    }

    const df = new Map();
    let totalLen = 0;
    for (const c of chunks) {
        totalLen += c.len;
        for (const t of c.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
    INDEX = {
        sig, chunks, df,
        avgLen: chunks.length ? totalLen / chunks.length : 1,
        checkedAt: now,
        courses: courses.length,
    };
    console.log(`🧠 AI index built: ${chunks.length} chunks from ${files.length} files in ${courses.length} courses`);
}

// BM25 ranking, plus a "coverage" number: what share of the question's
// (rarity-weighted) words appear in the best chunk. Words that appear nowhere
// in the lessons count as the rarest of all, so a question about something the
// notes never mention gets LOW coverage even if one common word matches.
function search(query, { course = '', k = CFG.contextChunks } = {}) {
    ensureIndex();
    const N = INDEX.chunks.length;
    const qTerms = [...new Set(tokenize(query))];
    if (!N || !qTerms.length) return { hits: [], grounded: false, sig: INDEX.sig };

    const idf = t => {
        const df = INDEX.df.get(t) || 0;
        return Math.log(1 + (N - df + 0.5) / (df + 0.5));
    };
    const totalIdf = qTerms.reduce((s, t) => s + idf(t), 0);
    const courseKey = String(course || '').toLowerCase();

    const scored = [];
    for (const c of INDEX.chunks) {
        if (courseKey && c.coursePath.toLowerCase() !== courseKey && c.course.toLowerCase() !== courseKey) continue;
        let score = 0;
        let matchedIdf = 0;
        for (const t of qTerms) {
            const tf = c.tf.get(t);
            if (!tf) continue;
            const w = idf(t);
            score += w * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * c.len / INDEX.avgLen));
            matchedIdf += w;
        }
        if (score > 0) scored.push({ chunk: c, score, coverage: matchedIdf / totalIdf });
    }
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, k).filter(s => s.score >= scored[0].score * 0.35);
    const grounded = top.length > 0 && top[0].coverage >= CFG.minCoverage;
    return {
        hits: top.map(s => ({ ...s.chunk, score: s.score, coverage: s.coverage })),
        grounded,
        sig: INDEX.sig,
    };
}


// ---------------------------------------------------------------------------
// 2. PROMPTS + GATEWAY
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT =
    'You are NODE Tutor, a study aid for university students. ' +
    'Answer ONLY from the COURSE NOTES provided. Do not use outside knowledge. ' +
    'Cite the notes you use like [1] or [2]. ' +
    'If the notes do not contain the answer, reply exactly: "The course notes I have do not cover this." ' +
    'For problems, show clear steps using only what the notes explain. Be concise (under 200 words).';

const NO_NOTES_MSG =
    "I couldn't find this in the NODE course materials yet. Try rephrasing your question. " +
    'If the topic should be covered, tap "Request this topic" so your lecturers know.';

function buildMessages(question, hits) {
    const notes = hits.map((h, i) => `[${i + 1}] ${h.course} - ${h.heading}\n${h.text}`).join('\n\n');
    let user = `COURSE NOTES:\n${notes}\n\nSTUDENT QUESTION: ${question}`;
    // Qwen3 can "think" for hundreds of tokens before answering, which is far
    // too slow on a CPU. This soft switch turns that off.
    if (CFG.noThink) user += ' /no_think';
    return [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
    ];
}

// Removes <think>...</think> blocks from a token stream, even when a tag is
// split across two chunks. Needed because some servers put the model's
// private reasoning inside the normal content.
function makeThinkFilter() {
    const OPEN = '<think>';
    const CLOSE = '</think>';
    let inThink = false;
    let pending = '';
    const partial = (s, tag) => {
        for (let k = Math.min(tag.length - 1, s.length); k > 0; k--) {
            if (s.endsWith(tag.slice(0, k))) return k;
        }
        return 0;
    };
    return {
        push(text) {
            pending += text;
            let out = '';
            for (;;) {
                if (inThink) {
                    const end = pending.indexOf(CLOSE);
                    if (end === -1) { pending = pending.slice(-(CLOSE.length - 1)); return out; }
                    pending = pending.slice(end + CLOSE.length);
                    inThink = false;
                } else {
                    const start = pending.indexOf(OPEN);
                    if (start === -1) {
                        const hold = partial(pending, OPEN);
                        out += pending.slice(0, pending.length - hold);
                        pending = pending.slice(pending.length - hold);
                        return out;
                    }
                    out += pending.slice(0, start);
                    pending = pending.slice(start + OPEN.length);
                    inThink = true;
                }
            }
        },
        flush() {
            const rest = inThink ? '' : pending;
            pending = '';
            return rest;
        },
    };
}

// Streams a chat completion from any OpenAI-compatible server.
async function streamCompletion(messages, signal, onDelta) {
    const headers = { 'Content-Type': 'application/json' };
    if (CFG.apiKey) headers.Authorization = 'Bearer ' + CFG.apiKey;
    const resp = await fetch(CFG.baseUrl + '/chat/completions', {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
            model: CFG.model,
            messages,
            stream: true,
            max_tokens: CFG.maxOutputTokens,
            temperature: 0.3,
            // Ollama's OpenAI-compatible API only switches thinking off when it
            // receives this field. Without it, Qwen3 spends every token
            // "thinking" and returns an empty answer.
            ...(CFG.noThink ? { reasoning_effort: 'none' } : {}),
        }),
    });
    if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        const err = new Error(`Model server replied ${resp.status}: ${t.slice(0, 200)}`);
        err.upstream = true;
        throw err;
    }
    const decoder = new TextDecoder();
    let buf = '';
    let finishReason = null;
    let seen = 0;
    for await (const chunk of resp.body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') return { finishReason };
            try {
                const choice = JSON.parse(data).choices?.[0];
                if (CFG.debug && seen++ < 12) console.log('AI raw chunk:', data.slice(0, 300));
                if (choice?.finish_reason) finishReason = choice.finish_reason;
                const delta = choice?.delta?.content;
                if (delta) onDelta(delta);
            } catch { /* partial or non-JSON line — skip */ }
        }
    }
    return { finishReason };
}

// ---------------------------------------------------------------------------
// 3. SAFETY: queue, rate limit, cache, log
// ---------------------------------------------------------------------------
let active = 0;
const waiters = [];
function acquire() {
    return new Promise((resolve, reject) => {
        if (active < CFG.maxConcurrent) { active++; return resolve(); }
        if (waiters.length >= CFG.maxQueue) {
            return reject(Object.assign(new Error('busy'), { code: 'BUSY' }));
        }
        waiters.push(resolve);
    });
}
function release() {
    const next = waiters.shift();
    if (next) next(); else active--;
}

const rateBuckets = new Map();
function rateOk(userId) {
    const now = Date.now();
    const recent = (rateBuckets.get(userId) || []).filter(t => now - t < 60000);
    if (recent.length >= CFG.perUserPerMinute) { rateBuckets.set(userId, recent); return false; }
    recent.push(now);
    rateBuckets.set(userId, recent);
    return true;
}
setInterval(() => {
    const now = Date.now();
    for (const [id, arr] of rateBuckets) {
        if (!arr.some(t => now - t < 60000)) rateBuckets.delete(id);
    }
}, 5 * 60 * 1000).unref();

function normalizeQuestion(q) {
    return q.toLowerCase().replace(/\s+/g, ' ').replace(/[?!.\s]+$/, '').trim();
}
function cacheKey(question, course, grounded, sig) {
    return crypto.createHash('sha256')
        .update(['v2', normalizeQuestion(question), course, CFG.model, grounded ? 'g' : 'u', sig].join('|'))
        .digest('hex');
}
function getCache(key) {
    const row = aiDb.prepare('SELECT answer, sources, grounded, created_at FROM ai_cache WHERE key = ?').get(key);
    if (!row) return null;
    if (Date.now() - row.created_at > CFG.cacheDays * 86400000) return null;
    return { answer: row.answer, sources: JSON.parse(row.sources), grounded: !!row.grounded };
}
function setCache(key, answer, sources, grounded) {
    aiDb.prepare('INSERT OR REPLACE INTO ai_cache (key, answer, sources, grounded, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(key, answer, JSON.stringify(sources), grounded ? 1 : 0, Date.now());
}

// The log holds NO account information. A random one-time "ticket" is handed
// to the browser so it can rate or report its own answer without the server
// ever knowing who asked.
function startLog(course, grounded) {
    const ticket = crypto.randomBytes(12).toString('hex');
    const info = aiDb.prepare(
        'INSERT INTO ai_log (ts, course, grounded, cached, model, ok, ticket) VALUES (?, ?, ?, 0, ?, 0, ?)'
    ).run(Date.now(), course || null, grounded ? 1 : 0, CFG.model, ticket);
    return { logId: Number(info.lastInsertRowid), ticket };
}
function finishLog(id, { ok, cached, ms }) {
    aiDb.prepare('UPDATE ai_log SET ok = ?, cached = ?, ms = ? WHERE id = ?').run(ok ? 1 : 0, cached ? 1 : 0, ms, id);
}

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------
let onlineCache = { at: 0, ok: false };
async function modelServerOnline() {
    if (Date.now() - onlineCache.at < 15000) return onlineCache.ok;
    let ok = false;
    try {
        const headers = CFG.apiKey ? { Authorization: 'Bearer ' + CFG.apiKey } : {};
        const r = await fetch(CFG.baseUrl + '/models', { headers, signal: AbortSignal.timeout(2000) });
        ok = r.ok;
    } catch { ok = false; }
    onlineCache = { at: Date.now(), ok };
    return ok;
}

function sourcesOf(hits) {
    return hits.map((h, i) => ({ n: i + 1, course: h.course, heading: h.heading, url: h.url }));
}

const REPORT_REASONS = {
    wrong: 'Wrong or misleading answer',
    mismatch: "Doesn't match the notes",
    unsafe: 'Offensive or unsafe',
    missing: 'Topic is missing from the notes',
    other: 'Other',
};

async function handleAsk(req, res) {
    if (!CFG.enabled) return res.status(503).json({ error: 'The AI tutor is switched off on this server.' });

    const raw = String((req.body && req.body.question) || '').trim().slice(0, 500);
    const { text: question, scrubbed } = scrubPII(raw);
    const course = String((req.body && req.body.course) || '').slice(0, 200);
    const wantStream = !(req.body && req.body.stream === false);
    if (question.length < 3) return res.status(400).json({ error: 'Please type a question.' });
    // The user id is used ONLY as an in-memory rate-limit key. It is never stored.
    if (!rateOk(req.user.id)) {
        return res.status(429).json({ error: 'You are asking very quickly. Wait a few seconds and try again.' });
    }

    const t0 = Date.now();
    const { hits, grounded, sig } = search(question, { course });
    const sources = grounded ? sourcesOf(hits) : [];
    const { logId, ticket } = startLog(course, grounded);

    let streamStarted = false;
    const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const beginStream = meta => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        streamStarted = true;
        send({ type: 'meta', ...meta });
    };
    const meta = cached => ({ sources, grounded, cached, logId, ticket, scrubbed });

    // Answers come ONLY from the course notes. No matching notes = no model call.
    if (!grounded) {
        finishLog(logId, { ok: true, cached: false, ms: Date.now() - t0 });
        if (!wantStream) return res.json({ answer: NO_NOTES_MSG, ...meta(false) });
        beginStream(meta(false));
        send({ type: 'token', text: NO_NOTES_MSG });
        send({ type: 'done', ms: Date.now() - t0 });
        return res.end();
    }

    // Cache: repeated questions cost nothing.
    const key = cacheKey(question, course, grounded, sig);
    const cached = getCache(key);
    if (cached) {
        finishLog(logId, { ok: true, cached: true, ms: Date.now() - t0 });
        if (!wantStream) return res.json({ answer: cached.answer, ...meta(true) });
        beginStream(meta(true));
        send({ type: 'token', text: cached.answer });
        send({ type: 'done', ms: Date.now() - t0 });
        return res.end();
    }

    // Wait for a free generation slot (or be told the server is busy).
    try {
        await acquire();
    } catch {
        finishLog(logId, { ok: false, cached: false, ms: Date.now() - t0 });
        return res.status(503).json({ error: 'The AI tutor is busy right now. Please try again in a minute.' });
    }

    const ac = new AbortController();
    let finished = false;
    res.on('close', () => { if (!finished) ac.abort(); });
    const timer = setTimeout(() => ac.abort(), CFG.timeoutMs);

    try {
        if (ac.signal.aborted) return; // student left while waiting in line
        if (wantStream) beginStream(meta(false));

        const filter = makeThinkFilter();
        let answer = '';
        const emit = text => {
            if (!answer) text = text.replace(/^\s+/, '');
            if (!text) return;
            answer += text;
            if (wantStream) send({ type: 'token', text });
        };

        const { finishReason } = await streamCompletion(buildMessages(question, hits), ac.signal, d => {
            const t = filter.push(d);
            if (t) emit(t);
        });
        const tail = filter.flush();
        if (tail) emit(tail);

        answer = answer.trim();
        if (!answer) throw new Error('The model returned an empty answer.');

        // Only remember answers that look finished. A cut-off answer must not
        // be served to every future student who asks the same thing.
        const cutOff = finishReason === 'length';
        const looksComplete = /[.!?)\]`"'*\d]\s*$/.test(answer);
        console.log(`🤖 AI answered: ${answer.split(/\s+/).length} words, finish=${finishReason}, ` +
            `${Date.now() - t0}ms${cutOff || !looksComplete ? ' (NOT cached: looks cut off)' : ''}`);
        if (cutOff) {
            const note = '\n\n(This answer was cut short. Ask about one specific part to get more detail.)';
            answer += note;
            if (wantStream) send({ type: 'token', text: note });
        }
        if (!cutOff && looksComplete) setCache(key, answer, sources, grounded);
        finishLog(logId, { ok: true, cached: false, ms: Date.now() - t0 });
        finished = true;
        if (wantStream) { send({ type: 'done', ms: Date.now() - t0 }); res.end(); }
        else res.json({ answer, ...meta(false) });
    } catch (e) {
        finishLog(logId, { ok: false, cached: false, ms: Date.now() - t0 });
        if (ac.signal.aborted && res.destroyed) { finished = true; return; } // client disconnected
        const offline = e.name === 'TypeError' || /fetch failed|ECONNREFUSED/i.test(String(e.cause || e.message));
        const userMsg = ac.signal.aborted
            ? 'The AI tutor took too long to answer. Please try a shorter question.'
            : offline
                ? 'The AI tutor is offline on this server right now.'
                : 'The AI tutor hit a problem. Please try again.';
        console.warn('AI error:', e.message, e.cause ? `(${e.cause.code || e.cause})` : '');
        finished = true;
        if (streamStarted) { send({ type: 'error', error: userMsg }); res.end(); }
        else res.status(offline ? 503 : 502).json({ error: userMsg });
    } finally {
        clearTimeout(timer);
        release();
    }
}

function mount(app, { verifyToken, requireRole }) {
    // Public: is the tutor available, and what is its privacy policy?
    app.get('/api/ai/status', async (req, res) => {
        ensureIndex();
        res.json({
            enabled: CFG.enabled,
            online: CFG.enabled ? await modelServerOnline() : false,
            model: CFG.model,
            chunks: INDEX.chunks.length,
            courses: INDEX.courses,
            policy: {
                studyAid: true,
                onlyCourseMaterials: true,
                storesQuestions: false,
                retentionDays: CFG.retentionDays,
                linkedToAccounts: false,
                cloudModel: CLOUD_MODEL,
            },
            reasons: REPORT_REASONS,
        });
    });

    // Public: search INSIDE the lesson text (the existing /api/search only
    // looks at course names and tags). No model involved.
    app.get('/api/ai/search', (req, res) => {
        const q = String(req.query.q || '').trim().slice(0, 200);
        if (!q) return res.status(400).json({ error: 'Missing ?q= search term' });
        const { hits } = search(scrubPII(q).text, { course: String(req.query.course || ''), k: 8 });
        res.json({
            query: q,
            count: hits.length,
            results: hits.map(h => ({
                course: h.course, heading: h.heading, url: h.url,
                snippet: h.text.replace(/\s+/g, ' ').slice(0, 220),
            })),
        });
    });

    app.post('/api/ai/ask', verifyToken, handleAsk);

    // Thumbs up / down. The ticket proves the browser owns that answer,
    // without the server knowing who the student is.
    app.post('/api/ai/feedback', verifyToken, (req, res) => {
        const logId = Number(req.body && req.body.logId);
        const ticket = String((req.body && req.body.ticket) || '');
        const rating = Number(req.body && req.body.rating);
        if (!Number.isInteger(logId) || !ticket || (rating !== 1 && rating !== -1)) {
            return res.status(400).json({ error: 'logId, ticket and rating (1 or -1) are required' });
        }
        aiDb.prepare('UPDATE ai_log SET rating = ? WHERE id = ? AND ticket = ?').run(rating, logId, ticket);
        res.json({ success: true });
    });

    // Students report a wrong answer, or request a missing topic. Only the
    // answer on screen and what the student types in the form are kept (the
    // question itself is never sent). Shown to lecturers, deleted after the
    // retention period, not linked to any account.
    app.post('/api/ai/report', verifyToken, (req, res) => {
        const b = req.body || {};
        const logId = Number(b.logId);
        const reason = String(b.reason || '');
        if (!Number.isInteger(logId) || !REPORT_REASONS[reason]) {
            return res.status(400).json({ error: 'A valid answer and reason are required.' });
        }
        if (!rateOk('report:' + req.user.id)) {
            return res.status(429).json({ error: 'Too many reports. Please wait a minute.' });
        }
        const row = aiDb.prepare('SELECT id FROM ai_log WHERE id = ? AND ticket = ?').get(logId, String(b.ticket || ''));
        if (!row) {
            return res.status(404).json({ error: 'We could not match this report to an answer. Ask again, then report from the new answer.' });
        }
        const clean = (v, n) => scrubPII(String(v || '').slice(0, n)).text;
        const note = clean(b.note, 300).trim();
        if (reason === 'missing' && note.length < 3) {
            return res.status(400).json({ error: 'Please say which topic is missing.' });
        }
        const sources = Array.isArray(b.sources) ? b.sources.slice(0, 3).map(s => clean(s, 200)) : [];
        try {
            aiDb.prepare(
                'INSERT INTO ai_reports (ts, log_id, reason, note, answer, sources) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(Date.now(), logId, reason, note, clean(b.answer, 3000), JSON.stringify(sources));
        } catch (e) {
            if (/UNIQUE/i.test(String(e.message))) return res.json({ success: true, duplicate: true });
            throw e;
        }
        res.json({ success: true });
    });

    // Lecturers: read and close reports.
    app.get('/api/ai/reports', verifyToken, requireRole('teacher'), (req, res) => {
        const rows = aiDb.prepare(
            'SELECT id, ts, reason, note, answer, sources, resolved FROM ai_reports ORDER BY resolved ASC, ts DESC LIMIT 100'
        ).all();
        res.json({
            retentionDays: CFG.retentionDays,
            reports: rows.map(r => ({
                ...r,
                reasonLabel: REPORT_REASONS[r.reason] || r.reason,
                sources: JSON.parse(r.sources || '[]'),
                resolved: !!r.resolved,
            })),
        });
    });
    app.post('/api/ai/reports/:id/resolve', verifyToken, requireRole('teacher'), (req, res) => {
        aiDb.prepare('UPDATE ai_reports SET resolved = 1 WHERE id = ?').run(Number(req.params.id));
        res.json({ success: true });
    });

    // Lecturers: which topics are missing from the notes? Questions are never
    // stored, so this is built from (a) a count of questions that matched no
    // notes and (b) the topics students chose to request.
    app.get('/api/ai/gaps', verifyToken, requireRole('teacher'), (req, res) => {
        const unanswered = aiDb.prepare('SELECT COUNT(*) AS n FROM ai_log WHERE grounded = 0').get().n;
        const requests = aiDb.prepare(`
            SELECT lower(trim(note)) AS topic, COUNT(*) AS requested, MAX(ts) AS last_requested
            FROM ai_reports WHERE reason = 'missing' AND note IS NOT NULL AND trim(note) != ''
            GROUP BY lower(trim(note)) ORDER BY requested DESC, last_requested DESC LIMIT 30`).all();
        res.json({ retentionDays: CFG.retentionDays, unanswered, requests });
    });

    // Lecturers: how is the tutor doing?
    app.get('/api/ai/stats', verifyToken, requireRole('teacher'), (req, res) => {
        const row = aiDb.prepare(`
            SELECT COUNT(*) AS total,
                   SUM(cached) AS cached,
                   SUM(grounded) AS grounded,
                   SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
                   AVG(CASE WHEN cached = 0 AND ok = 1 AND grounded = 1 THEN ms END) AS avg_ms,
                   SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS thumbs_up,
                   SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS thumbs_down
            FROM ai_log`).get();
        res.json({ ...row, queueWaiting: waiters.length, generating: active });
    });

    ensureIndex(true);
    console.log(`🤖 AI tutor ${CFG.enabled ? 'ready' : 'OFF'} (model: ${CFG.model}, server: ${CFG.baseUrl})`);
}

module.exports = {
    mount,
    _internals: { tokenize, chunkMarkdown, search, ensureIndex, makeThinkFilter, buildMessages, scrubPII, purgeOld, CFG, aiDb },
};
