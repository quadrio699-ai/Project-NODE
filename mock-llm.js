// mock-llm.js — a tiny fake model server for testing NODE's AI plumbing
// WITHOUT Ollama. It speaks the same OpenAI-compatible streaming format.
// It also deliberately wraps part of its reply in <think> tags, split across
// chunks, to prove ai.js strips them correctly.
//
//   node mock-llm.js            (listens on port 11500)
const http = require('http');

function start(port = 11500) {
    const calls = [];
    const server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/v1/models') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ data: [{ id: 'mock' }] }));
        }
        if (req.method === 'POST' && req.url === '/v1/chat/completions') {
            let body = '';
            req.on('data', d => (body += d));
            req.on('end', () => {
                const payload = JSON.parse(body);
                calls.push(payload);
                const user = payload.messages.find(m => m.role === 'user').content;
                const notes = (user.match(/^\[\d+\]/gm) || []).length;
                const truncate = /TRUNCATE/.test(user);
                const pieces = truncate
                    ? ['Linear independence refers to a set of vectors where the only solution']
                    : [
                        '<thi', 'nk>secret reasoning</th', 'ink>',
                        `\n\nMOCK ANSWER (notes used: ${notes}). `,
                        'Step 1: read the notes. ', 'Step 2: answer [1].',
                    ];
                res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                let i = 0;
                const tick = () => {
                    if (i >= pieces.length) {
                        res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: truncate ? 'length' : 'stop' }] })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        return res.end();
                    }
                    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: pieces[i++] } }] })}\n\n`);
                    setTimeout(tick, 5);
                };
                tick();
            });
            return;
        }
        res.writeHead(404); res.end();
    });
    return new Promise(resolve => server.listen(port, () => resolve({ server, calls })));
}

module.exports = { start };
if (require.main === module) start().then(() => console.log('Mock model server on http://127.0.0.1:11500/v1'));