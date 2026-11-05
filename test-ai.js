// test-ai.js — checks the whole AI pipeline end-to-end using a FAKE model.
//   node test-ai.js
// Needs no Ollama, no internet, and does not touch your real node.db.
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'node-ai-test-'));
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
    const fakeAuth = (req, res, next) => { req.user = { id: Number(req.headers['x-test-user'] || 1), name: 'tester', role: 'teacher' }; next(); };
    ai.mount(app, { verifyToken: fakeAuth, requireRole: () => (q, s, n) => n() });
    const web = app.listen(0);
    const base = `http://127.0.0.1:${web.address().port}`;
    const post = (url, body, user = 1) => fetch(base + url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': String(user) }, body: JSON.stringify(body),
    });

    console.log('Unit checks');
    const { tokenize, chunkMarkdown, makeThinkFilter, search } = ai._internals;
    check('tokenizer drops stopwords and stems', tokenize('What are the matrices?').join(' ') === 'matrix');
    check('chunker respects max size', chunkMarkdown('# A\n' + 'word '.repeat(500), 300).every(c => c.text.length <= 300));
    const f = makeThinkFilter();
    const filtered = ['<thi', 'nk>hidden</th', 'ink>', 'shown'].map(p => f.push(p)).join('') + f.flush();
    check('think filter works across split chunks', filtered === 'shown', JSON.stringify(filtered));

    console.log('Retrieval');
    const onTopic = search('What is a basis and dimension of a vector space?');
    check('on-topic question is grounded', onTopic.grounded && onTopic.hits.length > 0);
    check('top hit is Linear Algebra', onTopic.hits[0] && onTopic.hits[0].course === 'Linear Algebra', onTopic.hits[0] && onTopic.hits[0].course);
    const offTopic = search('Why does horizontal velocity stay constant in projectile motion?');
    check('off-topic question is NOT grounded', !offTopic.grounded, JSON.stringify(offTopic.hits.map(h => [h.course, h.coverage])));

    console.log('Endpoints');
    const status = await (await fetch(base + '/api/ai/status')).json();
    check('status reports online + chunks', status.online === true && status.chunks > 0, JSON.stringify(status));
    const sres = await (await fetch(base + '/api/ai/search?q=' + encodeURIComponent('linear independence'))).json();
    check('content search returns results', sres.count > 0 && sres.results[0].snippet.length > 0);

    let r = await post('/api/ai/ask', { question: 'What is a basis of a vector space?' });
    let ev = await readSSE(r);
    const meta = ev.find(e => e.type === 'meta');
    const answer = ev.filter(e => e.type === 'token').map(e => e.text).join('');
    check('stream has meta, tokens, done', meta && ev.some(e => e.type === 'token') && ev.at(-1).type === 'done');
    check('grounded answer carries sources', meta.grounded && meta.sources.length > 0 && !meta.cached);
    check('think text stripped from answer', !/secret|think/i.test(answer) && /MOCK ANSWER/.test(answer), answer);
    check('notes were sent to the model', /notes used: [1-9]/.test(answer), answer);
    check('/no_think added for qwen3', calls.at(-1).messages[1].content.endsWith('/no_think'));
    check('output capped', calls.at(-1).max_tokens === 350);
    check('thinking switched off via reasoning_effort', calls.at(-1).reasoning_effort === 'none');

    const before = calls.length;
    r = await post('/api/ai/ask', { question: 'what is a basis of a vector space' });
    ev = await readSSE(r);
    check('repeat question served from cache (no model call)', calls.length === before && ev.find(e => e.type === 'meta').cached === true);

    r = await post('/api/ai/ask', { question: 'Why does horizontal velocity stay constant in projectile motion?', stream: false });
    const j = await r.json();
    check('ungrounded question uses general-knowledge prompt', calls.at(-1).messages[0].content.includes('No course notes matched') && j.grounded === false && j.sources.length === 0);

    const callsBefore = calls.length;
    let tr = await (await post('/api/ai/ask', { question: 'TRUNCATE explain linear independence', stream: false })).json();
    check('cut-off answer carries a notice', /cut short/.test(tr.answer), tr.answer);
    await (await post('/api/ai/ask', { question: 'TRUNCATE explain linear independence', stream: false })).json();
    check('cut-off answer is NOT cached (model called twice)', calls.length === callsBefore + 2, String(calls.length - callsBefore));

    r = await post('/api/ai/feedback', { logId: meta.logId, rating: 1 });
    check('feedback accepted', (await r.json()).success === true);
    const stats = await (await fetch(base + '/api/ai/stats')).json();
    check('stats counts requests, cache hit and thumbs-up', stats.total >= 3 && stats.cached >= 1 && stats.thumbs_up === 1, JSON.stringify(stats));

    r = await post('/api/ai/ask', { question: 'hi' });
    check('too-short question rejected', r.status === 400);

    let limited = false;
    for (let i = 0; i < 8; i++) {
        r = await post('/api/ai/ask', { question: 'rate limit probe number ' + i, stream: false });
        if (r.status === 429) { limited = true; break; }
    }
    check('rate limit kicks in', limited);

    llm.close();
    const down = await post('/api/ai/ask', { question: 'Explain eigenvalues and eigenvectors please', stream: false }, 2);
    const downBody = await down.json();
    check('model server down gives a clean 503', down.status === 503 && /offline/i.test(downBody.error), down.status + ' ' + JSON.stringify(downBody));

    console.log(`\n${pass} passed, ${fail} failed`);
    web.close();
    process.exit(fail ? 1 : 0);
})();