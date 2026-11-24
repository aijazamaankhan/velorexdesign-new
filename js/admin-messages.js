/* Admin: Messages inbox for the chat assistant's "Leave a message" form. */
let msgList = [];

function msgWaLink(contact, name) {
    const d = String(contact || '').replace(/\D/g, '');
    if (d.length < 10) return '';
    const n = d.length === 10 ? '91' + d : d;
    return `https://wa.me/${n}?text=${encodeURIComponent('Hi ' + (name || '') + ', this is Velorex Design replying to your message on our website.')}`;
}

async function loadMessages() {
    const box = document.getElementById('msgList');
    if (!box) return;
    const res = await apiCall('api/admin-chat.php');
    if (!res.ok || !res.data) { box.innerHTML = '<p class="an-empty">' + escapeHtml(explainApiFailure(res, 'Could not load messages')) + '</p>'; return; }
    msgList = res.data.messages || [];
    setMsgBadge(res.data.unread || 0);
    renderAnswers(res.data.replies || {});
    renderStats(res.data.topics || [], res.data.unmatched || []);
    if (!msgList.length) { box.innerHTML = '<p class="an-empty">No messages yet. Messages left in the website chat appear here.</p>'; return; }
    box.innerHTML = msgList.map(m => {
        const wa = msgWaLink(m.contact, m.name);
        const isMail = /@/.test(m.contact);
        const when = new Date(String(m.created_at).replace(' ', 'T')).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
        return `<article class="msg-card ${m.status === 'new' ? 'is-new' : ''}">
            <header><div><strong>${escapeHtml(m.name)}</strong><span>${escapeHtml(m.contact)} · ${escapeHtml(when)}</span></div>
                ${m.status === 'new' ? '<span class="msg-pill">New</span>' : '<span class="msg-pill done">Done</span>'}</header>
            <p class="msg-body">${escapeHtml(m.message)}</p>
            ${m.transcript ? `<details class="msg-trans"><summary>Chat before the message</summary><pre>${escapeHtml(m.transcript)}</pre></details>` : ''}
            <div class="msg-actions">
                ${wa ? `<a class="btn btn-secondary msg-wa" href="${escapeAttr(wa)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Reply on WhatsApp</a>` : ''}
                ${isMail ? `<a class="btn btn-secondary" href="mailto:${escapeAttr(m.contact)}?subject=${encodeURIComponent('Your message to Velorex Design')}"><i class="fas fa-envelope"></i> Reply by email</a>` : ''}
                <button type="button" class="btn btn-secondary" data-msg="${m.status === 'new' ? 'done' : 'reopen'}" data-id="${m.id}">${m.status === 'new' ? '<i class="fas fa-check"></i> Mark done' : '<i class="fas fa-rotate-left"></i> Reopen'}</button>
                <button type="button" class="btn btn-secondary msg-del" data-msg="delete" data-id="${m.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div></article>`;
    }).join('');
}

function setMsgBadge(n) {
    const b = document.getElementById('msgBadge');
    if (!b) return;
    b.textContent = n;
    b.hidden = !n;
}

document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('msgList');
    if (!box) return;
    box.addEventListener('click', async e => {
        const b = e.target.closest('[data-msg]');
        if (!b) return;
        if (b.dataset.msg === 'delete' && !confirm('Delete this message?')) return;
        const res = await apiCall('api/admin-chat.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: b.dataset.msg, id: b.dataset.id }) });
        if (!res.ok) { showToast(explainApiFailure(res, 'Action failed'), 'error'); return; }
        loadMessages();
    });
    // Show the unread count soon after login, without opening the tab.
    setTimeout(() => { if (document.getElementById('adminApp')?.style.display === 'block') loadMessages(); }, 2500);
});

/* ───────── Chat answers editor ───────── */
const ANSWER_LABELS = {
    buy: 'How to buy', price: 'Prices and offers', shipping: 'Shipping and delivery', returns: 'Returns and refunds',
    vijaysar: 'Vijaysar glass: how to use', health: 'Health questions (keep: not a medicine)', material: 'Materials and making',
    bulk: 'Bulk and gift orders', contact: 'Contact details', order: 'My order'
};
const htmlToEdit = h => String(h || '').replace(/<br\s*\/?>(\n)?/gi, '\n');

function renderAnswers(saved) {
    const box = document.getElementById('answerList');
    if (!box) return;
    const defaults = window.VX_CHAT_DEFAULTS || {};
    box.innerHTML = Object.keys(ANSWER_LABELS).map(k => {
        const custom = saved[k];
        const text = custom ? custom.html : (defaults[k] || '');
        return `<div class="answer-card" data-key="${k}">
            <div class="answer-head"><strong>${escapeHtml(ANSWER_LABELS[k])}</strong>${custom ? '<span class="msg-pill">Edited</span>' : '<span class="msg-pill done">Built-in</span>'}</div>
            <textarea class="form-control" rows="6" maxlength="4000">${escapeHtml(htmlToEdit(text))}</textarea>
            <div class="answer-actions">
                <button type="button" class="btn btn-primary" data-answer="save"><i class="fas fa-save"></i> Save</button>
                ${custom ? '<button type="button" class="btn btn-secondary" data-answer="reset"><i class="fas fa-rotate-left"></i> Use built-in</button>' : ''}
            </div></div>`;
    }).join('');
}

/* ───────── What people ask ───────── */
const TOPIC_LABELS = {
    buy: 'How to buy', price: 'Prices', shipping: 'Shipping', returns: 'Returns', vijaysar: 'Vijaysar glass', health: 'Health questions',
    material: 'Materials', bulk: 'Bulk and gifts', contact: 'Contact', track: 'Order tracking', message: 'Leave a message',
    hello: 'Greetings', thanks: 'Thanks', product_search: 'Product search', unmatched: 'Not answered'
};
function topicName(t) {
    if (t.startsWith('chip_')) return 'Button: ' + (TOPIC_LABELS[t.slice(5)] || t.slice(5));
    return TOPIC_LABELS[t] || t;
}
function renderStats(topics, unmatched) {
    const tb = document.getElementById('chatTopics');
    const ub = document.getElementById('chatUnmatched');
    if (!tb || !ub) return;
    const max = Math.max(1, ...topics.map(t => t.n));
    tb.innerHTML = topics.length ? topics.map(t => `<div class="an-cat"><div class="an-cat-row"><span>${escapeHtml(topicName(t.topic))}</span><b>${t.n}</b></div><div class="an-cat-bar"><i style="width:${t.n / max * 100}%"></i></div></div>`).join('')
        : '<p class="an-empty">No chat activity in the last 30 days yet.</p>';
    ub.innerHTML = unmatched.length ? '<ul class="unmatched">' + unmatched.map(u => `<li><span>${escapeHtml(u.text)}</span><b>${u.n}×</b></li>`).join('') + '</ul>'
        : '<p class="an-empty">Nothing unanswered. 🎉</p>';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-chat-pane]').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('[data-chat-pane]').forEach(b => b.classList.toggle('is-active', b === btn));
        document.querySelectorAll('.chat-pane').forEach(p => { p.hidden = p.id !== 'pane-' + btn.dataset.chatPane; });
    }));
    const list = document.getElementById('answerList');
    if (list) list.addEventListener('click', async e => {
        const b = e.target.closest('[data-answer]');
        if (!b) return;
        const card = b.closest('.answer-card');
        const key = card.dataset.key;
        const body = b.dataset.answer === 'save'
            ? { action: 'save-reply', key, html: card.querySelector('textarea').value }
            : { action: 'reset-reply', key };
        const res = await apiCall('api/admin-chat.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { showToast(explainApiFailure(res, 'Could not save'), 'error'); return; }
        showToast(b.dataset.answer === 'save' ? 'Answer saved. It shows on the site within 5 minutes.' : 'Back to the built-in answer', 'success');
        loadMessages();
    });
});
