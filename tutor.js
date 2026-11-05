/* tutor.js — the NODE Tutor chat box for the student dashboard.
 *
 * Self-contained: it builds its own card, styles and behaviour, and slots
 * itself into #app-content on dashboard.html. The card stays hidden unless
 * the server reports that the AI tutor is switched on AND its model is
 * reachable (so on Render, with no model, students never see a dead box).
 *
 * Talks to the endpoints in ai.js:
 *   GET  /api/ai/status     is the tutor available?
 *   POST /api/ai/ask        streams the answer (server-sent events)
 *   POST /api/ai/feedback   thumbs up / down
 *
 * Written without newer syntax (no ?. or ??) so it also runs on older
 * Android phones.
 */
(function () {
    'use strict';

    var app = document.getElementById('app-content');
    if (!app) return;

    // ---------- styles ----------
    var css =
        '#node-tutor .nt-sub{margin:0 0 10px;color:#555;font-size:13px}' +
        '#node-tutor #nt-log{max-height:420px;overflow-y:auto;margin-bottom:10px}' +
        '#node-tutor .nt-row{display:flex;gap:8px;align-items:flex-end}' +
        '#node-tutor textarea{flex:1;padding:10px;border-radius:12px;border:1px solid #ddd;font:inherit;resize:none}' +
        '#node-tutor .nt-q{background:#e7f3ff;padding:10px 12px;border-radius:12px;margin:8px 0 8px 24px;white-space:pre-wrap;overflow-wrap:anywhere}' +
        '#node-tutor .nt-a{background:#f8f9fa;border-left:4px solid #0084ff;padding:10px 12px;border-radius:12px;margin:8px 24px 8px 0}' +
        '#node-tutor .nt-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}' +
        '#node-tutor .nt-text a{color:#0084ff;font-weight:bold;text-decoration:none}' +
        '#node-tutor .nt-text code{background:#eef0f2;padding:1px 4px;border-radius:4px}' +
        '#node-tutor .nt-wait{color:#888;font-style:italic}' +
        '#node-tutor .nt-badge{display:inline-block;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;margin-bottom:6px}' +
        '#node-tutor .nt-badge.ok{background:#e3f6dd;color:#2c7a1a}' +
        '#node-tutor .nt-badge.gen{background:#fff3d6;color:#8a6100}' +
        '#node-tutor .nt-src{font-size:12px;margin-top:8px;color:#555}' +
        '#node-tutor .nt-src a{color:#0084ff;text-decoration:none}' +
        '#node-tutor .nt-fb{font-size:12px;margin-top:6px;color:#777}' +
        '#node-tutor .nt-fb button{background:none;border:1px solid #ddd;border-radius:8px;padding:2px 8px;cursor:pointer;margin-left:4px}' +
        '#node-tutor .nt-err{color:#f02849;font-size:13px}' +
        '#node-tutor .nt-hint{font-size:11px;color:#999;margin-top:8px}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ---------- markup ----------
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'node-tutor';
    card.style.display = 'none';
    card.innerHTML =
        '<h3>NODE Tutor</h3>' +
        '<p class="nt-sub">Ask about your course notes. Answers point to the notes they came from.</p>' +
        '<div id="nt-log" aria-live="polite"></div>' +
        '<div class="nt-row">' +
        '<textarea id="nt-input" rows="2" maxlength="500" placeholder="Ask a question, e.g. What is a basis of a vector space?"></textarea>' +
        '<button id="nt-send" class="btn view-btn" style="padding:12px 16px">Ask</button>' +
        '</div>' +
        '<div class="nt-hint">The tutor can make mistakes. Check important answers against the linked notes.</div>';

    var firstCard = app.querySelector('.card');
    if (firstCard && firstCard.parentNode === app) firstCard.parentNode.insertBefore(card, firstCard.nextSibling);
    else app.appendChild(card);

    var log = card.querySelector('#nt-log');
    var input = card.querySelector('#nt-input');
    var sendBtn = card.querySelector('#nt-send');

    // ---------- helpers ----------
    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Escape first, then add light formatting, then turn [1] into a link.
    function renderAnswer(text, sources) {
        var h = esc(text);
        h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        h = h.replace(/\[(\d+)\]/g, function (m, n) {
            var s = sources[Number(n) - 1];
            return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">[' + n + ']</a>' : m;
        });
        return h;
    }

    function scrollDown() { log.scrollTop = log.scrollHeight; }

    function authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('node_token') || '')
        };
    }

    // ---------- availability ----------
    function setAvailable(yes) { card.style.display = yes ? 'block' : 'none'; }
    function checkStatus() {
        fetch('/api/ai/status')
            .then(function (r) { return r.json(); })
            .then(function (s) { setAvailable(!!(s && s.enabled && s.online)); })
            .catch(function () { setAvailable(false); });
    }
    checkStatus();
    setInterval(checkStatus, 60000);

    // ---------- asking ----------
    var busy = false;
    var controller = null;

    function setBusy(on) {
        busy = on;
        input.disabled = on;
        sendBtn.textContent = on ? 'Stop' : 'Ask';
    }

    function addQuestion(text) {
        var q = document.createElement('div');
        q.className = 'nt-q';
        q.textContent = text;
        log.appendChild(q);
    }

    function addAnswerShell() {
        var a = document.createElement('div');
        a.className = 'nt-a';
        a.innerHTML = '<div class="nt-badge-slot"></div><div class="nt-text nt-wait">Thinking\u2026</div>' +
            '<div class="nt-extra"></div>';
        log.appendChild(a);
        scrollDown();
        return a;
    }

    function handleEvent(ev, state) {
        if (ev.type === 'meta') {
            state.sources = ev.sources || [];
            state.logId = ev.logId;
            state.grounded = !!ev.grounded;
            state.el.querySelector('.nt-badge-slot').innerHTML = state.grounded
                ? '<span class="nt-badge ok">\uD83D\uDCD8 From your course notes</span>'
                : '<span class="nt-badge gen">\u26A0\uFE0F General knowledge \u2014 not from your notes</span>';
        } else if (ev.type === 'token') {
            state.text += ev.text;
            var t = state.el.querySelector('.nt-text');
            t.classList.remove('nt-wait');
            t.innerHTML = renderAnswer(state.text, state.sources);
            scrollDown();
        } else if (ev.type === 'error') {
            state.failed = ev.error;
        }
    }

    function finish(state) {
        var extra = state.el.querySelector('.nt-extra');
        var t = state.el.querySelector('.nt-text');
        if (state.failed) {
            if (!state.text) t.remove();
            extra.insertAdjacentHTML('beforeend', '<div class="nt-err">' + esc(state.failed) + '</div>');
            return;
        }
        if (!state.text) { t.textContent = 'No answer came back. Please try again.'; return; }
        if (state.sources.length) {
            var links = state.sources.map(function (s) {
                return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">[' + s.n + '] ' +
                    esc(s.course) + ' \u2014 ' + esc(s.heading) + '</a>';
            }).join('<br>');
            extra.insertAdjacentHTML('beforeend', '<div class="nt-src">Sources:<br>' + links + '</div>');
        }
        if (state.logId) {
            var fb = document.createElement('div');
            fb.className = 'nt-fb';
            fb.innerHTML = 'Was this helpful? <button data-r="1" aria-label="Helpful">\uD83D\uDC4D</button>' +
                '<button data-r="-1" aria-label="Not helpful">\uD83D\uDC4E</button>';
            fb.addEventListener('click', function (e) {
                var r = e.target && e.target.getAttribute && e.target.getAttribute('data-r');
                if (!r) return;
                fetch('/api/ai/feedback', {
                    method: 'POST', headers: authHeaders(),
                    body: JSON.stringify({ logId: state.logId, rating: Number(r) })
                }).catch(function () { });
                fb.textContent = 'Thanks for the feedback!';
            });
            extra.appendChild(fb);
        }
    }

    async function ask(question) {
        var state = { text: '', sources: [], logId: null, grounded: false, failed: null, el: null };
        addQuestion(question);
        state.el = addAnswerShell();
        setBusy(true);
        controller = new AbortController();
        var waited = 0;
        var timer = setInterval(function () {
            waited++;
            var t = state.el.querySelector('.nt-wait');
            if (t) t.textContent = 'Thinking\u2026 ' + waited + 's';
        }, 1000);

        try {
            var res = await fetch('/api/ai/ask', {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ question: question }), signal: controller.signal
            });
            if (!res.ok) {
                var msg = 'The AI tutor is unavailable right now.';
                if (res.status === 401 || res.status === 403) msg = 'Your session has expired. Please log in again.';
                else { try { var j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { } }
                throw new Error(msg);
            }

            if (res.body && res.body.getReader) {
                var reader = res.body.getReader();
                var dec = new TextDecoder();
                var buf = '';
                for (;;) {
                    var chunk = await reader.read();
                    if (chunk.done) break;
                    buf += dec.decode(chunk.value, { stream: true });
                    var idx;
                    while ((idx = buf.indexOf('\n\n')) >= 0) {
                        var block = buf.slice(0, idx);
                        buf = buf.slice(idx + 2);
                        if (block.indexOf('data: ') === 0) handleEvent(JSON.parse(block.slice(6)), state);
                    }
                }
            } else {
                // Older browser without streaming: read everything, then show it.
                var all = await res.text();
                all.split('\n\n').forEach(function (block) {
                    if (block.indexOf('data: ') === 0) handleEvent(JSON.parse(block.slice(6)), state);
                });
            }
        } catch (e) {
            if (e && e.name === 'AbortError') state.failed = state.text ? 'Stopped.' : 'Stopped before an answer came back.';
            else if (e instanceof TypeError) state.failed = 'Could not reach the server. Check your connection to NODE.';
            else state.failed = (e && e.message) || 'Something went wrong.';
        } finally {
            clearInterval(timer);
            controller = null;
            setBusy(false);
            finish(state);
            scrollDown();
            input.focus();
        }
    }

    function submit() {
        if (busy) { if (controller) controller.abort(); return; }
        var q = input.value.trim();
        if (q.length < 3) return;
        input.value = '';
        ask(q);
    }

    sendBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
})();
