/* tutor.js — the NODE Tutor chat box for the student dashboard.
 *
 * Self-contained: it builds its own card, styles and behaviour, and slots
 * itself into #app-content on dashboard.html. The card stays hidden unless
 * the server reports that the AI tutor is switched on AND its model is
 * reachable (so on Render, with no model, students never see a dead box).
 *
 * What the card always shows:
 *   - a notice: study aid, not an authority; answers only from stored course
 *     materials; do not type personal details; how long questions are kept
 *   - the course notes each answer came from, as links
 *   - a way to report a wrong answer, or request a topic the notes lack
 *   - for lecturers only: the reports, and topics students asked about that
 *     the notes do not cover
 *
 * Endpoints (see ai.js):
 *   GET  /api/ai/status     is the tutor available? what is the privacy policy?
 *   POST /api/ai/ask        streams the answer (server-sent events)
 *   POST /api/ai/feedback   helpful / not helpful
 *   POST /api/ai/report     report a problem / request a topic
 *   GET  /api/ai/reports, POST /api/ai/reports/:id/resolve, GET /api/ai/gaps   (lecturers)
 *
 * Written without newer syntax (no ?. or ??) so it also runs on older
 * Android phones.
 */
(function () {
    'use strict';

    var app = document.getElementById('app-content');
    if (!app) return;

    var policy = { storesQuestions: false, retentionDays: 30 };
    var reasons = {
        wrong: 'Wrong or misleading answer',
        mismatch: "Doesn't match the notes",
        unsafe: 'Offensive or unsafe',
        missing: 'Topic is missing from the notes',
        other: 'Other'
    };

    // ---------- styles ----------
    var css =
        '#node-tutor .nt-notice{background:#f1f6fd;border:1px solid #cfe0f7;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13px;line-height:1.5;color:#33415c}' +
        '#node-tutor .nt-notice p{margin:0 0 6px}#node-tutor .nt-notice p:last-child{margin:0}' +
        '#node-tutor #nt-log{max-height:420px;overflow-y:auto;margin-bottom:10px}' +
        '#node-tutor .nt-row{display:flex;gap:8px;align-items:flex-end}' +
        '#node-tutor textarea{flex:1;padding:10px;border-radius:12px;border:1px solid #ddd;font:inherit;resize:none}' +
        '#node-tutor .nt-q{background:#e7f3ff;padding:10px 12px;border-radius:12px;margin:8px 0 8px 24px;white-space:pre-wrap;overflow-wrap:anywhere}' +
        '#node-tutor .nt-a{background:#f8f9fa;border-left:4px solid #0084ff;padding:10px 12px;border-radius:12px;margin:8px 24px 8px 0}' +
        '#node-tutor .nt-a.nt-refused{border-left-color:#d9a400}' +
        '#node-tutor .nt-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}' +
        '#node-tutor .nt-text a{color:#0084ff;font-weight:bold;text-decoration:none}' +
        '#node-tutor .nt-text code{background:#eef0f2;padding:1px 4px;border-radius:4px}' +
        '#node-tutor .nt-wait{color:#888;font-style:italic}' +
        '#node-tutor .nt-badge{display:inline-block;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;margin-bottom:6px}' +
        '#node-tutor .nt-badge.ok{background:#e3f6dd;color:#2c7a1a}' +
        '#node-tutor .nt-badge.gen{background:#fff3d6;color:#8a6100}' +
        '#node-tutor .nt-scrub{font-size:12px;color:#8a6100;margin:0 0 6px}' +
        '#node-tutor .nt-src{font-size:12px;margin-top:8px;color:#555}' +
        '#node-tutor .nt-src a{color:#0084ff;text-decoration:none}' +
        '#node-tutor .nt-foot{font-size:11px;color:#888;margin-top:8px}' +
        '#node-tutor .nt-actions{font-size:12px;margin-top:4px;color:#777}' +
        '#node-tutor .nt-actions button,#node-tutor .nt-tools button.nt-link{background:none;border:1px solid #ddd;border-radius:8px;padding:3px 9px;cursor:pointer;margin:2px 4px 2px 0;font:inherit;font-size:12px;color:#444}' +
        '#node-tutor .nt-report{margin-top:8px;padding:10px;border:1px solid #ddd;border-radius:10px;background:#fff;font-size:13px}' +
        '#node-tutor .nt-report label{display:block;margin:3px 0}' +
        '#node-tutor .nt-report textarea{width:100%;box-sizing:border-box;margin-top:6px;font-size:13px}' +
        '#node-tutor .nt-err{color:#f02849;font-size:13px}' +
        '#node-tutor .nt-hint{font-size:11px;color:#777;margin-top:8px}' +
        '#node-tutor .nt-tools{margin-top:12px;padding-top:10px;border-top:1px solid #eee;font-size:13px}' +
        '#node-tutor .nt-item{border:1px solid #eee;border-radius:10px;padding:8px 10px;margin:6px 0;background:#fff;overflow-wrap:anywhere}' +
        '#node-tutor .nt-item small{color:#777}';
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
        '<div class="nt-notice" id="nt-notice"></div>' +
        '<div id="nt-log" aria-live="polite"></div>' +
        '<div class="nt-row">' +
        '<textarea id="nt-input" rows="2" maxlength="500" placeholder="Ask about your course notes, e.g. What is a basis of a vector space?"></textarea>' +
        '<button id="nt-send" class="btn view-btn" style="padding:12px 16px">Ask</button>' +
        '</div>' +
        '<div class="nt-hint">Please don\u2019t type personal details such as your phone number, email, matric number or passwords.</div>' +
        '<div class="nt-tools" id="nt-tools" style="display:none">' +
        '<strong>Lecturer tools</strong><br>' +
        '<button class="nt-link" id="nt-load-reports">Student reports</button>' +
        '<button class="nt-link" id="nt-load-gaps">Topics missing from the notes</button>' +
        '<div id="nt-tools-out"></div>' +
        '</div>';

    var firstCard = app.querySelector('.card');
    if (firstCard && firstCard.parentNode === app) firstCard.parentNode.insertBefore(card, firstCard.nextSibling);
    else app.appendChild(card);

    var log = card.querySelector('#nt-log');
    var input = card.querySelector('#nt-input');
    var sendBtn = card.querySelector('#nt-send');
    var noticeEl = card.querySelector('#nt-notice');
    var toolsEl = card.querySelector('#nt-tools');
    var toolsOut = card.querySelector('#nt-tools-out');

    function renderNotice() {
        var keep = 'Your questions are not stored. If you send a report, only the answer shown and what you type in the report ' +
            'are kept for ' + policy.retentionDays + ' days, without your name or account.';
        noticeEl.innerHTML =
            '<p><strong>A study aid, not an authority.</strong> NODE Tutor answers only from the course materials stored on this server, ' +
            'and it can still make mistakes. Check the linked notes and ask your lecturer if you are unsure.</p>' +
            '<p>It cannot see your account or any personal information. ' + keep + ' ' +
            (policy.cloudModel ? 'On this online version, your question is sent to a cloud AI service so it can be answered. ' : '') +
            'If an answer looks wrong, use <em>Report a problem</em> under it.</p>';
    }
    renderNotice();

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
    function token() { return localStorage.getItem('node_token') || ''; }
    function authHeaders() {
        return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() };
    }

    // ---------- availability + role ----------
    var isTeacher = false;
    function setAvailable(yes) { card.style.display = yes ? 'block' : 'none'; }

    function checkRole() {
        if (!token()) { isTeacher = false; toolsEl.style.display = 'none'; return; }
        fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token() } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                isTeacher = !!(j && j.user && j.user.role === 'teacher');
                toolsEl.style.display = isTeacher ? 'block' : 'none';
            })
            .catch(function () { });
    }

    function checkStatus() {
        fetch('/api/ai/status')
            .then(function (r) { return r.json(); })
            .then(function (s) {
                if (s && s.policy) { policy = s.policy; renderNotice(); }
                if (s && s.reasons) reasons = s.reasons;
                var up = !!(s && s.enabled && s.online);
                setAvailable(up);
                if (up) checkRole();
            })
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
        a.innerHTML = '<div class="nt-badge-slot"></div><div class="nt-text nt-wait">Looking through the notes\u2026</div>' +
            '<div class="nt-extra"></div>';
        log.appendChild(a);
        scrollDown();
        return a;
    }

    function handleEvent(ev, state) {
        if (ev.type === 'meta') {
            state.sources = ev.sources || [];
            state.logId = ev.logId;
            state.ticket = ev.ticket;
            state.grounded = !!ev.grounded;
            var badge = state.grounded
                ? '<span class="nt-badge ok">Based on your course notes</span>'
                : '<span class="nt-badge gen">Not found in the course notes</span>';
            if (ev.scrubbed) badge += '<div class="nt-scrub">We removed what looked like personal details from your question.</div>';
            state.el.querySelector('.nt-badge-slot').innerHTML = badge;
            if (!state.grounded) state.el.className = 'nt-a nt-refused';
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

    // ---------- report a problem ----------
    function openReport(state, presetReason) {
        var extra = state.el.querySelector('.nt-extra');
        var old = extra.querySelector('.nt-report');
        if (old) { old.remove(); return; }
        var box = document.createElement('div');
        box.className = 'nt-report';
        var opts = Object.keys(reasons).map(function (k) {
            return '<label><input type="radio" name="nt-r-' + state.logId + '" value="' + esc(k) + '"' +
                (k === presetReason ? ' checked' : '') + '> ' + esc(reasons[k]) + '</label>';
        }).join('');
        box.innerHTML =
            '<strong>' + (presetReason === 'missing' ? 'Request this topic' : 'Report a problem') + '</strong>' + opts +
            '<textarea rows="2" maxlength="300"></textarea>' +
            '<div class="nt-foot">This sends the answer shown here and your note to your lecturers. Your question is not sent. ' +
            'It is not linked to your account. Please don\u2019t include personal details.</div>' +
            '<button class="btn view-btn" data-act="send" style="margin-top:8px;padding:6px 12px">Send</button> ' +
            '<button class="nt-link" data-act="cancel" style="margin-top:8px">Cancel</button>';
        var noteBox = box.querySelector('textarea');
        function updatePlaceholder() {
            var p = box.querySelector('input[type=radio]:checked');
            noteBox.placeholder = (p && p.value === 'missing')
                ? 'Which topic is missing? (required)'
                : 'Tell your lecturers what is wrong (optional)';
        }
        updatePlaceholder();
        box.addEventListener('change', updatePlaceholder);
        box.addEventListener('click', function (e) {
            var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'cancel') { box.remove(); return; }
            if (act !== 'send') return;
            var picked = box.querySelector('input[type=radio]:checked');
            if (!picked) { alert('Please pick a reason.'); return; }
            if (picked.value === 'missing' && noteBox.value.trim().length < 3) { alert('Please say which topic is missing.'); return; }
            var labels = state.sources.map(function (s) { return s.course + ' - ' + s.heading; });
            fetch('/api/ai/report', {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({
                    logId: state.logId, ticket: state.ticket, reason: picked.value,
                    note: noteBox.value, answer: state.text, sources: labels
                })
            }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
                .then(function (res) {
                    box.innerHTML = res.ok
                        ? 'Thank you. Your lecturers can now see this report.'
                        : '<span class="nt-err">' + esc(res.j.error || 'Could not send the report.') + '</span>';
                })
                .catch(function () { box.innerHTML = '<span class="nt-err">Could not reach the server. Try again.</span>'; });
        });
        extra.appendChild(box);
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
        if (!state.logId) return;

        var actions = document.createElement('div');
        actions.className = 'nt-actions';
        if (state.grounded) {
            actions.innerHTML =
                '<div class="nt-foot">Study aid, not an authority. Check the linked notes.</div>' +
                'Was this helpful? <button data-act="up">Helpful</button><button data-act="down">Not helpful</button>' +
                '<button data-act="report">Report a problem</button>';
        } else {
            actions.innerHTML = '<button data-act="request">Request this topic</button>';
        }
        actions.addEventListener('click', function (e) {
            var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
            if (!act) return;
            if (act === 'up' || act === 'down') {
                fetch('/api/ai/feedback', {
                    method: 'POST', headers: authHeaders(),
                    body: JSON.stringify({ logId: state.logId, ticket: state.ticket, rating: act === 'up' ? 1 : -1 })
                }).catch(function () { });
                var wrap = e.target.parentNode;
                wrap.querySelectorAll('button[data-act=up],button[data-act=down]').forEach(function (b) { b.remove(); });
                wrap.insertAdjacentHTML('afterbegin', '<span>Thanks for the feedback. </span>');
            } else if (act === 'report') openReport(state, null);
            else if (act === 'request') openReport(state, 'missing');
        });
        extra.appendChild(actions);
    }

    async function ask(question) {
        var state = { question: question, text: '', sources: [], logId: null, ticket: null, grounded: false, failed: null, el: null };
        addQuestion(question);
        state.el = addAnswerShell();
        setBusy(true);
        controller = new AbortController();
        var waited = 0;
        var timer = setInterval(function () {
            waited++;
            var t = state.el.querySelector('.nt-wait');
            if (t) t.textContent = 'Looking through the notes\u2026 ' + waited + 's';
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

    // ---------- lecturer tools ----------
    function when(ts) { return new Date(ts).toLocaleDateString(); }

    card.querySelector('#nt-load-reports').addEventListener('click', function () {
        toolsOut.textContent = 'Loading\u2026';
        fetch('/api/ai/reports', { headers: authHeaders() })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j.reports) { toolsOut.textContent = j.error || 'Could not load reports.'; return; }
                if (!j.reports.length) { toolsOut.textContent = 'No reports.'; return; }
                toolsOut.innerHTML = '<div class="nt-foot">Reports are deleted after ' + j.retentionDays + ' days. They are not linked to any account.</div>' +
                    j.reports.map(function (r) {
                        return '<div class="nt-item"><strong>' + esc(r.reasonLabel) + '</strong> <small>' + when(r.ts) +
                            (r.resolved ? ' \u00B7 resolved' : '') + '</small><br>' +
                            (r.answer ? '<small>Answer shown:</small> ' + esc(String(r.answer).slice(0, 300)) + '<br>' : '') +
                            (r.sources && r.sources.length ? '<small>Sources:</small> ' + esc(r.sources.join('; ')) + '<br>' : '') +
                            (r.note ? '<small>Note:</small> ' + esc(r.note) + '<br>' : '') +
                            (r.resolved ? '' : '<button class="nt-link" data-resolve="' + r.id + '">Mark resolved</button>') + '</div>';
                    }).join('');
            })
            .catch(function () { toolsOut.textContent = 'Could not load reports.'; });
    });

    toolsOut.addEventListener('click', function (e) {
        var id = e.target && e.target.getAttribute && e.target.getAttribute('data-resolve');
        if (!id) return;
        fetch('/api/ai/reports/' + id + '/resolve', { method: 'POST', headers: authHeaders(), body: '{}' })
            .then(function () { e.target.parentNode.querySelector('small').insertAdjacentHTML('afterend', ' <small>\u00B7 resolved</small>'); e.target.remove(); })
            .catch(function () { });
    });

    card.querySelector('#nt-load-gaps').addEventListener('click', function () {
        toolsOut.textContent = 'Loading\u2026';
        fetch('/api/ai/gaps', { headers: authHeaders() })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j.requests) { toolsOut.textContent = j.error || 'Could not load.'; return; }
                var html = '<div class="nt-foot">Questions are never stored, so this uses counts and the topics students chose to request. ' +
                    'Kept for ' + j.retentionDays + ' days.</div>' +
                    '<div class="nt-item"><strong>' + j.unanswered + '</strong> question' + (j.unanswered === 1 ? '' : 's') +
                    ' had no matching notes.</div>';
                if (!j.requests.length) html += '<div class="nt-item">No topic requests yet.</div>';
                else html += j.requests.map(function (g) {
                    return '<div class="nt-item">' + esc(g.topic) + ' <small>requested ' + g.requested + (g.requested === 1 ? ' time' : ' times') + '</small></div>';
                }).join('');
                toolsOut.innerHTML = html;
            })
            .catch(function () { toolsOut.textContent = 'Could not load.'; });
    });
})();
