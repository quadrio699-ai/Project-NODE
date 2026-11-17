// test-ai.js — checks the whole AI pipeline end-to-end using a FAKE model.
//   node test-ai.js
// Needs no Ollama, no internet, and does not touch your real databases.
const os = require('os');
const fs = require('fs');
const path = require('path');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'node-ai-test-'));
process.env.DATA_DIR = DATA;
process.env.AI_BASE_URL = 'http://127.0.0.1:11500/v1';
process.env.AI_MODEL = 'qwen3:1.7b';
process.env.AI_RATE_PER_MIN = '6';

const express = require('express');
const mock = require('./mock-llm');
const ai = require('./ai');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log('  PASS', name); }
    else { fail++; console.log('  FAIL', name, extra); }
}

async function readSSE(resp) {
    const events = [];
    const text = await resp.text();
    for (const block of text.split('\n\n')) {
        if (block.startsWith('data: ')) events.push(JSON.parse(block.slice(6)));
    }
    return events;
}

(async () => {
    const { server: llm, calls } = await mock.start(11500);

    const app = express();
    app.use(express.json());
    // Stand-ins for the real login system: user id and role come from headers.
    const fakeAuth = (req, res, next) => {
        req.user = { id: Number(req.headers['x-test-user'] || 1), role: req.headers['x-test-role'] || 'student' };
        next();
    };
    const requireRole = role => (req, res, next) =>
        req.user.role === role ? next() : res.status(403).json({ error: 'Forbidden' });
    ai.mount(app, { verifyToken: fakeAuth, requireRole });
    const web = app.listen(0);
    const base = `http://127.0.0.1:${web.address().port}`;
    const post = (url, body, user = 1, role = 'student') => fetch(base + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user': String(user), 'x-test-role': role },
        body: JSON.stringify(body),
    });
    const get = (url, user = 1, role = 'student') => fetch(base + url, {
        headers: { 'x-test-user': String(user), 'x-test-role': role },
    });
    const db = ai._internals.aiDb;

    console.log('Unit checks');
    const { tokenize, chunkMarkdown, makeThinkFilter, search, scrubPII } = ai._internals;
    check('tokenizer drops stopwords and stems', tokenize('What are the matrices?').join(' ') === 'matrix');
    check('chunker respects max size', chunkMarkdown('# A\n' + 'word '.repeat(500), 300).every(c => c.text.length <= 300));
    const f = makeThinkFilter();
    const filtered = ['<thi', 'nk>hidden</th', 'ink>', 'shown'].map(p => f.push(p)).join('') + f.flush();
    check('think filter works across split chunks', filtered === 'shown', JSON.stringify(filtered));
    check('scrub removes emails', scrubPII('mail me at ada@example.com please').text === 'mail me at [removed] please');
    check('scrub removes Nigerian phone numbers', !/0801/.test(scrubPII('call 0801 234 5678 now').text) && !/8012345678/.test(scrubPII('+2348012345678').text));
    check('scrub removes long ID-like numbers', !/\d{10}/.test(scrubPII('my account is 0123456789').text));
    check('scrub removes "password is ..."', !/hunter2/.test(scrubPII('my password is hunter2').text));
    check('scrub leaves normal maths alone', scrubPII('factor 360 and 45, then solve x^2 = 49').scrubbed === false);

    console.log('Retrieval');
    const onTopic = search('What is a basis and dimension of a vector space?');
    check('on-topic question is grounded', onTopic.grounded && onTopic.hits.length > 0);
    check('top hit is Linear Algebra', onTopic.hits[0] && onTopic.hits[0].course === 'Linear Algebra');
    const offTopic = search('Why does horizontal velocity stay constant in projectile motion?');
    check('off-topic question is NOT grounded', !offTopic.grounded);

    console.log('Privacy by design');
    const src = fs.readFileSync(path.join(__dirname, 'ai.js'), 'utf8');
    check('ai.js never loads the accounts database module', !/require\(['"]\.\/db['"]\)/.test(src));
    check('AI data lives in its own file (ai.db)', fs.existsSync(path.join(DATA, 'ai.db')));
    check('accounts database (node.db) was never opened by the AI module', !fs.existsSync(path.join(DATA, 'node.db')));
    const cols = db.prepare('PRAGMA table_info(ai_log)').all().map(c => c.name).join(',');
    check('log has no user, name, email or question column', !/user|name|email|question/i.test(cols), cols);
    const cols2 = db.prepare('PRAGMA table_info(ai_reports)').all().map(c => c.name).join(',');
    check('reports have no user, name, email or question column', !/user|name|email|question/i.test(cols2), cols2);

    console.log('Endpoints');
    const status = await (await fetch(base + '/api/ai/status')).json();
    check('status reports online + chunks', status.online === true && status.chunks > 0, JSON.stringify(status));
    check('status publishes the privacy policy',
        status.policy && status.policy.studyAid && status.policy.onlyCourseMaterials &&
        status.policy.retentionDays === 30 && status.policy.linkedToAccounts === false &&
        status.policy.storesQuestions === false, JSON.stringify(status.policy));
    check('status says the model is local (not a cloud service)', status.policy.cloudModel === false);
    const sres = await (await fetch(base + '/api/ai/search?q=' + encodeURIComponent('linear independence'))).json();
    check('content search returns results', sres.count > 0 && sres.results[0].snippet.length > 0);

    // ---- user 1: normal flow
    let r = await post('/api/ai/ask', { question: 'What is a basis of a vector space?' }, 1);
    let ev = await readSSE(r);
    const meta = ev.find(e => e.type === 'meta');
    const answer = ev.filter(e => e.type === 'token').map(e => e.text).join('');
    check('stream has meta, tokens, done', meta && ev.some(e => e.type === 'token') && ev.at(-1).type === 'done');
    check('answer carries sources and a one-time ticket', meta.grounded && meta.sources.length > 0 && !meta.cached && /^[0-9a-f]{24}$/.test(meta.ticket));
    check('think text stripped from answer', !/secret|think/i.test(answer) && /MOCK ANSWER/.test(answer), answer);
    check('notes were sent to the model', /notes used: [1-9]/.test(answer), answer);
    check('prompt tells the model to use ONLY the notes', /ONLY from the COURSE NOTES/.test(calls.at(-1).messages[0].content));
    check('thinking switched off via reasoning_effort', calls.at(-1).reasoning_effort === 'none');
    check('output capped', calls.at(-1).max_tokens === 350);

    let before = calls.length;
    r = await post('/api/ai/ask', { question: 'what is a basis of a vector space' }, 1);
    ev = await readSSE(r);
    check('repeat question served from cache (no model call)', calls.length === before && ev.find(e => e.type === 'meta').cached === true);

    before = calls.length;
    r = await post('/api/ai/ask', { question: 'Why does horizontal velocity stay constant in projectile motion?', stream: false }, 1);
    const off = await r.json();
    check('question outside the notes is refused WITHOUT calling the model',
        calls.length === before && off.grounded === false && off.sources.length === 0 && /couldn't find this/i.test(off.answer));
    check('refusal still gives a ticket (so students can request the topic)', /^[0-9a-f]{24}$/.test(off.ticket));

    // ---- user 2: personal details + cut-off answers
    r = await post('/api/ai/ask', { question: 'What is a basis of a vector space? My number is 08012345678', stream: false }, 2);
    const pii = await r.json();
    check('personal details are flagged as removed', pii.scrubbed === true);
    check('phone number never reached the model', !/0801234|8012345678/.test(JSON.stringify(calls.at(-1))));
    const dbBytes = () => fs.readFileSync(path.join(DATA, 'ai.db')).toString('latin1');
    check('phone number never appears in the database file', !/0801234|8012345678/.test(dbBytes()));
    await post('/api/ai/ask', { question: 'What is linear independence and span and basis of a vector space? quokka', stream: false }, 2);
    check('question text is never written to the database file', !dbBytes().includes('quokka'));

    const callsBefore = calls.length;
    const cutQ = 'What is linear independence and span and basis of a vector space TRUNCATE';
    const tr = await (await post('/api/ai/ask', { question: cutQ, stream: false }, 2)).json();
    check('cut-off answer carries a notice', /cut short/.test(tr.answer), tr.answer);
    await (await post('/api/ai/ask', { question: cutQ, stream: false }, 2)).json();
    check('cut-off answer is NOT cached (model called twice)', calls.length === callsBefore + 2, String(calls.length - callsBefore));

    // ---- feedback uses the ticket, not an account
    await post('/api/ai/feedback', { logId: meta.logId, ticket: 'wrong-ticket', rating: 1 }, 1);
    check('feedback with a wrong ticket is ignored', db.prepare('SELECT rating FROM ai_log WHERE id = ?').get(meta.logId).rating === null);
    r = await post('/api/ai/feedback', { logId: meta.logId, ticket: meta.ticket, rating: 1 }, 1);
    check('feedback with the right ticket is accepted',
        (await r.json()).success === true && db.prepare('SELECT rating FROM ai_log WHERE id = ?').get(meta.logId).rating === 1);

    // ---- reports
    r = await post('/api/ai/report', { logId: meta.logId, ticket: 'nope', reason: 'wrong' }, 1);
    check('report with a wrong ticket is rejected', r.status === 404);
    r = await post('/api/ai/report', { logId: meta.logId, ticket: meta.ticket, reason: 'not-a-reason' }, 1);
    check('report with an invalid reason is rejected', r.status === 400);
    r = await post('/api/ai/report', {
        logId: meta.logId, ticket: meta.ticket, reason: 'wrong',
        note: 'This is wrong, email me at ada@example.com',
        answer: 'MOCK ANSWER', sources: ['Linear Algebra - 1. Vector Spaces'],
    }, 1);
    check('a valid report is accepted', (await r.json()).success === true);
    r = await post('/api/ai/report', { logId: meta.logId, ticket: meta.ticket, reason: 'wrong' }, 1);
    check('reporting the same answer twice is harmless', (await r.json()).success === true);
    r = await post('/api/ai/report', { logId: off.logId, ticket: off.ticket, reason: 'missing' }, 1);
    check('a missing-topic request without a topic name is rejected', r.status === 400);
    r = await post('/api/ai/report', { logId: off.logId, ticket: off.ticket, reason: 'missing', note: 'Projectile motion' }, 1);
    check('a refused question can be reported as a missing topic', (await r.json()).success === true);

    check('students cannot read reports', (await get('/api/ai/reports', 1, 'student')).status === 403);
    const list = await (await get('/api/ai/reports', 9, 'teacher')).json();
    check('lecturers can read reports', list.reports.length === 2 && list.reports.some(x => x.reason === 'wrong' && x.reasonLabel));
    check('reports contain no question text', list.reports.every(x => !('question' in x)));
    check('personal details in a report note are removed', !/ada@example/.test(JSON.stringify(list)), JSON.stringify(list.reports[0]));
    check('reports tell lecturers how long they are kept', list.retentionDays === 30);
    const rid = list.reports.find(x => x.reason === 'wrong').id;
    await post('/api/ai/reports/' + rid + '/resolve', {}, 9, 'teacher');
    const list2 = await (await get('/api/ai/reports', 9, 'teacher')).json();
    check('lecturers can mark a report resolved', list2.reports.find(x => x.id === rid).resolved === true);

    const gaps = await (await get('/api/ai/gaps', 9, 'teacher')).json();
    check('lecturers see topics students requested', gaps.requests.some(g => /projectile/i.test(g.topic)), JSON.stringify(gaps));
    check('lecturers see how many questions matched no notes', gaps.unanswered >= 1, JSON.stringify(gaps));
    check('students cannot read the gaps list', (await get('/api/ai/gaps', 1, 'student')).status === 403);

    const stats = await (await get('/api/ai/stats', 9, 'teacher')).json();
    check('stats count requests, cache hit and thumbs-up', stats.total >= 5 && stats.cached >= 1 && stats.thumbs_up === 1, JSON.stringify(stats));
    check('students cannot read stats', (await get('/api/ai/stats', 1, 'student')).status === 403);

    // ---- retention
    const old = Date.now() - 31 * 86400000;
    db.prepare('INSERT INTO ai_log (ts, course, ok, ticket) VALUES (?, ?, 1, ?)').run(old, 'old-course', 'old');
    db.prepare('INSERT INTO ai_reports (ts, log_id, reason, note) VALUES (?, ?, ?, ?)').run(old, 99999, 'wrong', 'old report');
    ai._internals.purgeOld();
    check('logs older than 30 days are deleted', !db.prepare("SELECT 1 FROM ai_log WHERE course = 'old-course'").get());
    check('reports older than 30 days are deleted', !db.prepare("SELECT 1 FROM ai_reports WHERE note = 'old report'").get());
    check('recent logs are kept', !!db.prepare('SELECT 1 FROM ai_log WHERE id = ?').get(meta.logId));

    // ---- limits and failure modes
    r = await post('/api/ai/ask', { question: 'hi' }, 3);
    check('too-short question rejected', r.status === 400);
    let limited = false;
    for (let i = 0; i < 8; i++) {
        r = await post('/api/ai/ask', { question: 'rate limit probe number ' + i, stream: false }, 4);
        if (r.status === 429) { limited = true; break; }
    }
    check('rate limit kicks in', limited);

    llm.close();
    const down = await post('/api/ai/ask', { question: 'What is a basis of a vector space and its dimension?', stream: false }, 5);
    const downBody = await down.json();
    check('model server down gives a clean 503', down.status === 503 && /offline/i.test(downBody.error), down.status + ' ' + JSON.stringify(downBody));

    // ---- an older database that stored questions gets cleaned on start-up
    console.log('Upgrade from the earlier version');
    const { DatabaseSync } = require('node:sqlite');
    const { spawnSync } = require('child_process');
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-ai-old-'));
    const od = new DatabaseSync(path.join(oldDir, 'ai.db'));
    od.exec(`CREATE TABLE ai_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, question TEXT, course TEXT, grounded INTEGER, cached INTEGER, model TEXT, ms INTEGER, ok INTEGER NOT NULL DEFAULT 0, rating INTEGER, ticket TEXT);
             CREATE TABLE ai_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, log_id INTEGER UNIQUE, reason TEXT NOT NULL, note TEXT, question TEXT, answer TEXT, sources TEXT, resolved INTEGER NOT NULL DEFAULT 0);`);
    od.prepare('INSERT INTO ai_log (ts, question, ok) VALUES (?, ?, 1)').run(Date.now(), 'SECRET OLD QUESTION about zebras');
    od.prepare('INSERT INTO ai_reports (ts, log_id, reason, question) VALUES (?, 1, ?, ?)').run(Date.now(), 'wrong', 'SECRET OLD REPORT QUESTION');
    od.close();
    spawnSync(process.execPath, ['-e', "require('./ai')"], { cwd: __dirname, env: { ...process.env, DATA_DIR: oldDir } });
    const od2 = new DatabaseSync(path.join(oldDir, 'ai.db'));
    const c1 = od2.prepare('PRAGMA table_info(ai_log)').all().map(c => c.name);
    const c2 = od2.prepare('PRAGMA table_info(ai_reports)').all().map(c => c.name);
    od2.close();
    const oldBytes = fs.readFileSync(path.join(oldDir, 'ai.db')).toString('latin1');
    check('old question columns are removed on start-up', !c1.includes('question') && !c2.includes('question'), c1 + ' | ' + c2);
    check('old question text is erased from the file itself', !oldBytes.includes('SECRET OLD'));

    console.log(`\n${pass} passed, ${fail} failed`);
    web.close();
    process.exit(fail ? 1 : 0);
})();
