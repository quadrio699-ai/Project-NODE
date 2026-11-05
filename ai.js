// ai.js — NODE AI Tutor
//
// One module that does three jobs:
//   1. RETRIEVAL  — reads the markdown lessons under /lessons, cuts them into
//                   chunks, and finds the best chunks for a question (BM25
//                   keyword ranking; no extra model, no extra dependency).
//   2. GATEWAY    — sends the question + chunks to ANY OpenAI-compatible model
//                   server. Tier 1 = local Ollama. Tier 2 = a hosted API.
//                   The only difference between tiers is environment variables.
//   3. SAFETY     — login required, per-user rate limit, a queue so a small
//                   server isn't overwhelmed, an answer cache, and a usage log.
//
// No new npm packages. Uses Node's built-in fetch and the existing node:sqlite.
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
//   AI_STRICT           "true" = refuse when notes don't cover the question
//   AI_NO_THINK         force on/off Qwen3's "/no_think" switch (auto-on for qwen3 models)
//   AI_LOG_QUESTIONS    "false" = don't store question text in the usage log
//   AI_MIN_COVERAGE     how much of the question the notes must cover (default 0.5)

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

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
    strict: process.env.AI_STRICT === 'true',
    noThink: process.env.AI_NO_THINK ? process.env.AI_NO_THINK === 'true' : /qwen3/i.test(MODEL),
    logQuestions: process.env.AI_LOG_QUESTIONS !== 'false',
    minCoverage: parseFloat(process.env.AI_MIN_COVERAGE || '0.5'),
    debug: process.env.AI_DEBUG === 'true',
    cacheDays: 30,
    timeoutMs: 120000,
};

const LESSONS_DIR = path.join(__dirname, 'lessons');

// ---------------------------------------------------------------------------
// Tables: answer cache + usage log (lives in the same node.db as accounts)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_cache (
    key TEXT PRIMARY KEY,
    answer TEXT NOT NULL,
    sources TEXT NOT NULL,
    grounded INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ts INTEGER NOT NULL,
    question TEXT,
    course TEXT,
    grounded INTEGER,
    cached INTEGER,
    model TEXT,
    ms INTEGER,
    ok INTEGER NOT NULL DEFAULT 0,
    rating INTEGER
  );
`);

// ---------------------------------------------------------------------------
// 1. RETRIEVAL
// ---------------------------------------------------------------------------
const STOP = new Set((
    'a an the and or of to in on at for with by from is are was were be been being this that these those ' +
    'it its as if then than so such can could should would will shall may might do does did done have has ' +
    'had not no nor but into about over under between within without how what why when where which who ' +
    'whom whose explain give tell me my your our their please define find show i we you they he she'
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
        if (m) { flush(); heading = m[2].trim(); } else buf.push(line);
    }
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
const SYSTEM_GROUNDED =
    'You are NODE Tutor, a patient study helper for Nigerian university students. ' +
    'Answer using the COURSE NOTES provided and cite them like [1] or [2]. ' +
    'For problems, show clear steps and explain the reasoning. ' +
    'Be concise (under 200 words). If the notes do not fully answer the question, say what is missing.';

const SYSTEM_UNGROUNDED =
    'You are NODE Tutor, a patient study helper for Nigerian university students. ' +
    'No course notes matched this question. Answer briefly and carefully from general knowledge, ' +
    'and begin with: "Note: this is not from your NODE course notes." ' +
    'For problems, show clear steps. Be concise (under 200 words). If you are unsure, say so.';

function buildMessages(question, hits, grounded) {
    let user;
    if (grounded) {
        const notes = hits.map((h, i) => `[${i + 1}] ${h.course} - ${h.heading}\n${h.text}`).join('\n\n');
        user = `COURSE NOTES:\n${notes}\n\nSTUDENT QUESTION: ${question}`;
    } else {
        user = `STUDENT QUESTION: ${question}`;
    }
    // Qwen3 can "think" for hundreds of tokens before answering, which is far
    // too slow on a CPU. This soft switch turns that off.
    if (CFG.noThink) user += ' /no_think';
    return [
        { role: 'system', content: grounded ? SYSTEM_GROUNDED : SYSTEM_UNGROUNDED },
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
    const row = db.prepare('SELECT answer, sources, grounded, created_at FROM ai_cache WHERE key = ?').get(key);
    if (!row) return null;
    if (Date.now() - row.created_at > CFG.cacheDays * 86400000) return null;
    return { answer: row.answer, sources: JSON.parse(row.sources), grounded: !!row.grounded };
}
function setCache(key, answer, sources, grounded) {
    db.prepare('INSERT OR REPLACE INTO ai_cache (key, answer, sources, grounded, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(key, answer, JSON.stringify(sources), grounded ? 1 : 0, Date.now());
}

function startLog(userId, question, course, grounded) {
    const info = db.prepare(
        'INSERT INTO ai_log (user_id, ts, question, course, grounded, cached, model, ok) VALUES (?, ?, ?, ?, ?, 0, ?, 0)'
    ).run(userId ?? null, Date.now(), CFG.logQuestions ? question : null, course || null, grounded ? 1 : 0, CFG.model);
    return Number(info.lastInsertRowid);
}
function finishLog(id, { ok, cached, ms }) {
    db.prepare('UPDATE ai_log SET ok = ?, cached = ?, ms = ? WHERE id = ?').run(ok ? 1 : 0, cached ? 1 : 0, ms, id);
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

async function handleAsk(req, res) {
    if (!CFG.enabled) return res.status(503).json({ error: 'The AI tutor is switched off on this server.' });

    const question = String((req.body && req.body.question) || '').trim().slice(0, 500);
    const course = String((req.body && req.body.course) || '').slice(0, 200);
    const wantStream = !(req.body && req.body.stream === false);
    if (question.length < 3) return res.status(400).json({ error: 'Please type a question.' });
    if (!rateOk(req.user.id)) {
        return res.status(429).json({ error: 'You are asking very quickly. Wait a few seconds and try again.' });
    }

    const t0 = Date.now();
    const { hits, grounded, sig } = search(question, { course });
    const sources = grounded ? sourcesOf(hits) : [];
    const logId = startLog(req.user.id, question, course, grounded);

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
    const meta = cached => ({ sources, grounded, cached, logId });

    // Strict mode: never answer outside the course notes.
    if (CFG.strict && !grounded) {
        const msg = "I couldn't find this in the NODE course materials yet. Try rephrasing, or ask your lecturer to upload notes on this topic.";
        finishLog(logId, { ok: true, cached: false, ms: Date.now() - t0 });
        if (!wantStream) return res.json({ answer: msg, ...meta(false) });
        beginStream(meta(false));
        send({ type: 'token', text: msg });
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

        const { finishReason } = await streamCompletion(buildMessages(question, hits, grounded), ac.signal, d => {
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
            `${Date.now() - t0}ms, grounded=${grounded}${cutOff || !looksComplete ? ' (NOT cached: looks cut off)' : ''}`);
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
    // Public: is the tutor available? (lets the page hide the chat box if not)
    app.get('/api/ai/status', async (req, res) => {
        ensureIndex();
        res.json({
            enabled: CFG.enabled,
            online: CFG.enabled ? await modelServerOnline() : false,
            model: CFG.model,
            strict: CFG.strict,
            chunks: INDEX.chunks.length,
            courses: INDEX.courses,
        });
    });

    // Public: search INSIDE the lesson text (the existing /api/search only
    // looks at course names and tags). No model involved, so it works on
    // every tier, even a server with no AI at all.
    app.get('/api/ai/search', (req, res) => {
        const q = String(req.query.q || '').trim().slice(0, 200);
        if (!q) return res.status(400).json({ error: 'Missing ?q= search term' });
        const { hits } = search(q, { course: String(req.query.course || ''), k: 8 });
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

    app.post('/api/ai/feedback', verifyToken, (req, res) => {
        const logId = Number(req.body && req.body.logId);
        const rating = Number(req.body && req.body.rating);
        if (!Number.isInteger(logId) || (rating !== 1 && rating !== -1)) {
            return res.status(400).json({ error: 'logId and rating (1 or -1) are required' });
        }
        db.prepare('UPDATE ai_log SET rating = ? WHERE id = ? AND user_id = ?').run(rating, logId, req.user.id);
        res.json({ success: true });
    });

    // Teachers/admins: how is the tutor doing?
    app.get('/api/ai/stats', verifyToken, requireRole('teacher'), (req, res) => {
        const row = db.prepare(`
            SELECT COUNT(*) AS total,
                   SUM(cached) AS cached,
                   SUM(grounded) AS grounded,
                   SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
                   AVG(CASE WHEN cached = 0 AND ok = 1 THEN ms END) AS avg_ms,
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
    _internals: { tokenize, chunkMarkdown, search, ensureIndex, makeThinkFilter, buildMessages, CFG },
};
