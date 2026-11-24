/* Velorex chat assistant (phase 1). Plan: docs/CHAT-ASSISTANT-PLAN.md.
   Fixed, approved replies only: no AI, no third-party script, no tracking.
   Shows live products from PRODUCTS, answers common questions by keyword,
   and hands anything else to WhatsApp with the chat so far pre-filled.
   The panel is built on first open, so page load is unchanged. */
(function () {
    'use strict';
    if (typeof document === 'undefined') return;

    const WA = () => (typeof storeWhatsAppNumber === 'function' ? storeWhatsAppNumber() : '917906027807');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const products = () => (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS) ? PRODUCTS : []);
    const amazon = p => (typeof amazonUrlFor === 'function' ? amazonUrlFor(p) : '');
    const productUrl = p => (typeof routeToPath === 'function' ? routeToPath('product-detail', { id: p.id }) : '/products');

    /* ───────── Approved answers ───────── */
    const ANSWERS = {
        buy: {
            text: 'There are two easy ways to buy:<br>• <b>Amazon</b>: tap “Buy on Amazon” on any product for Amazon delivery and returns.<br>• <b>WhatsApp</b>: message us on +91 79060 27807 and we share the price, payment and delivery details. Good for gifts and bulk orders.',
            chips: ['browse', 'whatsapp']
        },
        price: {
            text: 'Prices and offers are shown on each product’s Amazon page, so they are always current. For pieces not on Amazon, or bulk and gift orders, message us on WhatsApp for a quote.',
            chips: ['browse', 'whatsapp']
        },
        shipping: {
            text: 'We ship <b>pan-India</b> from our Meerut studio. Once dispatched, orders usually arrive in <b>4–7 business days</b>, depending on the location. International shipping is possible for some items on request. Amazon orders follow Amazon’s delivery date. <a href="/shipping">Shipping details</a>',
            chips: ['returns', 'whatsapp']
        },
        returns: {
            text: '<b>Amazon orders:</b> use Amazon’s return process.<br><b>Orders placed with us:</b> because every piece is handmade, we only take back items that arrive damaged. Send a photo or video on WhatsApp <b>within 48 hours of delivery</b> and we will replace it or refund you in full. Orders can be cancelled within 12 hours. <a href="/returns">Returns policy</a>',
            chips: ['shipping', 'whatsapp']
        },
        vijaysar: {
            text: '<b>Vijaysar glass, how to use</b><br>1. Fill it with drinking water at night.<br>2. Leave it 8–10 hours. The water turns light brown; that is the wood’s natural colour.<br>3. Drink it on an empty stomach in the morning.<br><br><b>First use:</b> rinse with plain water, fill it once and throw that water away. Start from the next fill.<br><b>Care:</b> plain water only (no soap or dishwasher), don’t keep water in it for over 12 hours, dry upside down in an airy place. Not for microwave, fridge or hot liquids.<br><b>Replace</b> after 30–90 days, depending on daily use. Stop using it if you see mould or cracks.<br><br><i>A traditional wellness product, not a medicine. Please talk to your doctor about any health condition.</i>',
            chips: ['vijaysarBuy', 'whatsapp']
        },
        health: {
            text: 'Vijaysar is traditionally used in Ayurveda, but it is <b>not a medicine</b> and we cannot give medical advice. If you have diabetes or any health condition, please speak to your doctor before using it.',
            chips: ['vijaysar', 'vijaysarBuy']
        },
        material: {
            text: 'Everything is made by hand in our Meerut studio: <b>sheesham and mango wood</b> serveware, <b>neem wood</b> combs, <b>Vijaysar heartwood</b> glasses and precision-cut <b>MDF racks</b>. No paints or chemicals on the wellness pieces.',
            chips: ['browse', 'whatsapp']
        },
        bulk: {
            text: 'Yes, we do <b>bulk, corporate and wedding gift orders</b>, including the Wellness Combo Kit in gift boxes. Tell us the product, quantity and date on WhatsApp and we will send a quote.',
            chips: ['whatsapp', 'browse']
        },
        contact: {
            text: '📍 Meerut, Uttar Pradesh 250002, India<br>📞 WhatsApp / call: <a href="tel:+917906027807">+91 79060 27807</a><br>✉️ <a href="mailto:velorexdesign@gmail.com">velorexdesign@gmail.com</a><br>🕙 Mon–Fri, 10am – 6pm IST',
            chips: ['whatsapp']
        },
        order: {
            text: 'For an <b>Amazon order</b>, open Your Orders in the Amazon app. For an order placed with us, I can check it now: tap <b>Track my order</b>.',
            chips: ['track', 'whatsapp']
        },
        hello: {
            text: 'Hello! 👋 How can I help you today?',
            chips: ['browse', 'find', 'vijaysar', 'buy', 'shipping', 'whatsapp']
        },
        thanks: { text: 'Happy to help! Anything else?', chips: ['browse', 'whatsapp'] }
    };

    /* Keyword map (English and common Hinglish). First match wins. */
    const INTENTS = [
        ['health', /\b(diabet|sugar level|bp\b|blood pressure|medicine|cure|treat|doctor|side ?effect|safe)/i],
        ['vijaysar', /\b(vijaysar|vijay sar|glass|tumbler|how to use|kaise use|istemal|soak|bhigo)/i],
        ['bulk', /\b(bulk|wholesale|corporate|gift(ing)?|wedding|shaadi|return gift|quantity|dozen)/i],
        ['price', /\b(price|cost|rate|kitn[ae]|kitne ka|daam|mrp|discount|offer|sale|coupon)/i],
        ['shipping', /\b(ship|deliver|courier|dispatch|kab tak|kab aayega|pincode|cod|cash on)/i],
        ['returns', /\b(return|refund|replace|exchange|wapas|damage|broken|tuta)/i],
        ['track', /\b(track|order status|where is my|kahan hai|my order|order no|order number|ORD-)/i],
        ['message', /\b(call me|call back|message|contact me|leave a|callback)\b/i],
        ['buy', /\b(buy|purchase|order kar|kharid|amazon|how to order|lena hai)/i],
        ['material', /\b(wood|material|sheesham|mango|neem|mdf|handmade|made of|quality)/i],
        ['contact', /\b(contact|address|phone|call|number|email|location|meerut|timing|hours)/i],
        ['thanks', /\b(thank|thanks|thx|dhanyavad|shukriya|ok bye|great)\b/i],
        ['hello', /^(hi|hii+|hello|hey|namaste|hlo|good (morning|evening))\b/i]
    ];

    const CHIPS = {
        browse: { label: '🛍️ Browse products', run: () => showCategories() },
        find: { label: '🔎 Find a product', run: () => { bot('Type what you are looking for, e.g. <i>rack</i>, <i>comb</i> or <i>gift</i>.'); focusInput(); } },
        vijaysar: { label: '🌿 Vijaysar glass help', run: () => answer('vijaysar') },
        vijaysarBuy: { label: '🛒 Vijaysar glass', run: () => showProducts(products().filter(p => /vijaysar/i.test(p.name || '') && !/combo/i.test(p.name || ''))) },
        buy: { label: '💳 How to buy', run: () => answer('buy') },
        shipping: { label: '🚚 Shipping', run: () => answer('shipping') },
        returns: { label: '↩️ Returns', run: () => answer('returns') },
        order: { label: '📦 My order', run: () => answer('order') },
        track: { label: '📦 Track my order', run: () => trackForm() },
        message: { label: '✉️ Leave a message', run: () => messageForm() },
        whatsapp: { label: '💬 Talk to us on WhatsApp', run: () => handoff() }
    };

    /* ───────── State and DOM ───────── */
    let built = false, els = {}, transcript = [];

    /* Answers edited in admin replace the built-in text (server cleans the HTML). */
    let overridesLoaded = false;
    function loadOverrides() {
        if (overridesLoaded) return;
        overridesLoaded = true;
        fetch('api/chat-replies.php', { credentials: 'same-origin' })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d && d.replies) Object.keys(d.replies).forEach(k => { if (ANSWERS[k]) ANSWERS[k].text = d.replies[k]; }); })
            .catch(() => { /* keep the built-in answers */ });
    }

    /* Anonymous stats: which topic matched, or the words when nothing did. */
    function track(topic, text) {
        try {
            const body = JSON.stringify({ topic, text: topic === 'unmatched' ? String(text || '').slice(0, 200) : '' });
            if (navigator.sendBeacon) navigator.sendBeacon('api/chat-event.php', new Blob([body], { type: 'application/json' }));
            else fetch('api/chat-event.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
        } catch (_) { /* stats are optional */ }
    }

    function build() {
        if (built) return;
        built = true;
        const panel = document.createElement('section');
        panel.className = 'vx-chat';
        panel.id = 'vxChat';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Velorex assistant');
        panel.hidden = true;
        panel.innerHTML = `
            <header class="vx-chat-head">
                <img src="images/brand/emblem.webp" width="38" height="38" alt="">
                <div><strong>Velorex assistant</strong><span><i class="vx-dot"></i> Replies instantly · WhatsApp for anything else</span></div>
                <button type="button" class="vx-chat-x" id="vxChatClose" aria-label="Close chat">&times;</button>
            </header>
            <div class="vx-chat-log" id="vxChatLog" aria-live="polite"></div>
            <div class="vx-chat-chips" id="vxChatChips"></div>
            <form class="vx-chat-form" id="vxChatForm" autocomplete="off">
                <input type="text" id="vxChatInput" maxlength="200" placeholder="Ask about products, delivery, Vijaysar…" aria-label="Type your question">
                <button type="submit" aria-label="Send"><i class="fas fa-paper-plane"></i></button>
            </form>`;
        document.body.appendChild(panel);
        els = { panel, log: panel.querySelector('#vxChatLog'), chips: panel.querySelector('#vxChatChips'), form: panel.querySelector('#vxChatForm'), input: panel.querySelector('#vxChatInput') };
        panel.querySelector('#vxChatClose').addEventListener('click', close);
        els.form.addEventListener('submit', e => { e.preventDefault(); const v = els.input.value.trim(); if (!v) return; els.input.value = ''; user(v); respond(v); });
        els.chips.addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (!b) return; const c = CHIPS[b.dataset.chip]; if (!c) return; track('chip_' + b.dataset.chip); user(c.label.replace(/^\S+\s/, '')); c.run(); });
        els.log.addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; user(b.textContent.trim()); showProducts(products().filter(p => p.cat === b.dataset.cat)); });
        panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        loadOverrides();
        greet();
    }

    function scroll() { els.log.scrollTop = els.log.scrollHeight; }
    function add(html, who) {
        const div = document.createElement('div');
        div.className = 'vx-msg vx-' + who;
        div.innerHTML = html;
        els.log.appendChild(div);
        scroll();
        return div;
    }
    function user(text) { transcript.push('Me: ' + text); add(esc(text), 'user'); }
    function bot(html, chips) {
        const typing = add('<span class="vx-typing"><i></i><i></i><i></i></span>', 'bot');
        setTimeout(() => {
            typing.innerHTML = html;
            if (!/<form/i.test(html)) transcript.push('Assistant: ' + typing.textContent.trim().replace(/\s+/g, ' ').slice(0, 160));
            setChips(chips || ['browse', 'whatsapp']);
            scroll();
        }, 450);
    }
    function setChips(keys) {
        els.chips.innerHTML = keys.filter(k => CHIPS[k]).map(k => `<button type="button" class="vx-chip" data-chip="${k}">${CHIPS[k].label}</button>`).join('');
    }
    function answer(key) { const a = ANSWERS[key]; bot(a.text, a.chips); }
    function focusInput() { setTimeout(() => els.input && els.input.focus(), 500); }

    function greet() {
        const hour = new Date().getHours();
        const hi = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        bot(`${hi}! 👋 I’m the Velorex assistant. I can show you products, explain the Vijaysar glass, track an order, and help with delivery and returns.`, ['browse', 'find', 'vijaysar', 'buy', 'track', 'shipping', 'whatsapp', 'message']);
    }

    function showCategories() {
        const cats = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).filter(c => products().some(p => p.cat === c.id));
        if (!cats.length) { bot('Products are still loading. Try again in a moment, or tap WhatsApp.'); return; }
        bot('Pick a collection:<div class="vx-cats">' + cats.map(c => `<button type="button" class="vx-cat" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('') + '</div>', ['find', 'whatsapp']);
    }

    function showProducts(list) {
        if (!list.length) { bot('I could not find that. Try another word, browse the collections, or ask us on WhatsApp.', ['browse', 'whatsapp']); return; }
        const cards = list.slice(0, 6).map(p => {
            const az = amazon(p);
            return `<div class="vx-prod">
                <a href="${esc(productUrl(p))}" class="vx-prod-img"><img src="${esc(p.img)}" alt="" loading="lazy"></a>
                <div class="vx-prod-body"><a href="${esc(productUrl(p))}" class="vx-prod-name">${esc(p.name)}</a>
                <div class="vx-prod-btns">${az ? `<a class="vx-btn vx-az" href="${esc(az)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-amazon"></i> Amazon</a>` : ''}
                <a class="vx-btn vx-wa" href="https://wa.me/${WA()}?text=${encodeURIComponent('Hi Velorex Design! I would like to order: ' + p.name)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Order</a></div></div></div>`;
        }).join('');
        bot(`Here ${list.length === 1 ? 'it is' : 'are ' + Math.min(list.length, 6) + ' pieces'}:<div class="vx-prods">${cards}</div>`, ['browse', 'find', 'whatsapp']);
    }

    function search(q) {
        const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/^(the|and|for|you|have|show|want|need|any|kya|hai|mujhe|chahiye)$/.test(w));
        if (!words.length) return [];
        return products().map(p => {
            const hay = `${p.name} ${p.desc || ''} ${p.cat}`.toLowerCase();
            const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0) + ((p.name || '').toLowerCase().includes(w) ? 2 : 0), 0);
            return { p, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.p);
    }

    function respond(text) {
        for (const [key, re] of INTENTS) {
            if (re.test(text)) {
                track(key);
                if (key === 'track') { trackForm(); return; }
                if (key === 'message') { messageForm(); return; }
                // "price of rack" style questions: answer and show the products too.
                const found = (key === 'price' || key === 'buy') ? search(text) : [];
                answer(key);
                if (found.length) setTimeout(() => showProducts(found), 600);
                return;
            }
        }
        const found = search(text);
        if (found.length) { track('product_search'); showProducts(found); return; }
        track('unmatched', text);
        bot('I’m not sure about that one. Tap <b>WhatsApp</b> and your question goes with it, or leave a message and we will reply.', ['whatsapp', 'message', 'browse']);
    }

    /* Inline forms inside the conversation. */
    function inlineForm(html, onSubmit) {
        bot(`<form class="vx-form">${html}<button type="submit" class="vx-btn vx-submit">Send</button></form>`, ['whatsapp']);
        setTimeout(() => {
            const forms = els.log.querySelectorAll('.vx-form');
            const f = forms[forms.length - 1];
            if (!f) return;
            const first = f.querySelector('input,textarea');
            if (first) first.focus();
            f.addEventListener('submit', async e => {
                e.preventDefault();
                const btn = f.querySelector('.vx-submit');
                btn.disabled = true; btn.textContent = 'Sending…';
                const ok = await onSubmit(new FormData(f), f);
                if (ok) { f.querySelectorAll('input,textarea,button').forEach(x => (x.disabled = true)); btn.textContent = 'Sent ✓'; }
                else { btn.disabled = false; btn.textContent = 'Send'; }
            });
        }, 520);
    }

    async function post(url, body) {
        try {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
            const data = await r.json().catch(() => ({}));
            return { ok: r.ok, status: r.status, data };
        } catch (_) { return { ok: false, status: 0, data: {} }; }
    }

    const STATUS_TEXT = {
        Pending: 'received and waiting to be packed', Processing: 'being made and packed', Shipped: 'on its way',
        Delivered: 'delivered', Cancelled: 'cancelled'
    };

    function trackForm() {
        inlineForm(`<label>Order number<input name="code" required maxlength="40" placeholder="ORD-…" autocapitalize="characters"></label>
            <label>Email or phone used on the order<input name="contact" required maxlength="150" inputmode="email"></label>`,
        async fd => {
            const r = await post('api/chat-order-status.php', { order_code: fd.get('code'), contact: fd.get('contact') });
            if (r.status === 429) { bot('Too many tries. Please wait a few minutes or ask us on WhatsApp.', ['whatsapp']); return true; }
            if (!r.ok) { bot('I could not check that right now. Please ask us on WhatsApp.', ['whatsapp']); return true; }
            if (!r.data.found) { bot('I could not find an order with those details. Check the order number and the email or phone you used, or ask us on WhatsApp.', ['track', 'whatsapp']); return false; }
            const d = r.data;
            bot(`Order <b>${esc(d.order_code)}</b> (placed ${esc(d.date)}) is <b>${esc(STATUS_TEXT[d.status] || d.status)}</b>.` +
                (d.tracking ? `<br>Tracking number: <b>${esc(d.tracking)}</b>` : '') +
                (d.status === 'Shipped' && !d.tracking ? '<br>The tracking number will appear here once the courier shares it.' : ''), ['whatsapp', 'browse']);
            return true;
        });
    }

    function messageForm() {
        inlineForm(`<label>Your name<input name="name" required maxlength="120" autocomplete="name"></label>
            <label>Phone or email<input name="contact" required maxlength="150" autocomplete="tel"></label>
            <label>Message<textarea name="message" required maxlength="1500" rows="3"></textarea></label>
            <input name="website" tabindex="-1" autocomplete="off" class="vx-hp" aria-hidden="true">`,
        async fd => {
            const r = await post('api/chat-message.php', { name: fd.get('name'), contact: fd.get('contact'), message: fd.get('message'), website: fd.get('website'), transcript: transcript.slice(-10).join('\n') });
            if (r.ok) { bot('Thank you! 🙏 Your message is with us. We reply within a working day (Mon–Fri, 10am – 6pm IST).', ['browse']); return true; }
            bot(esc((r.data && r.data.error) || 'Could not send that. Please use WhatsApp.'), ['whatsapp']);
            return r.status === 429;
        });
    }

    function handoff() {
        const n = WA();
        const recent = transcript.slice(-6).join('\n');
        const text = 'Hi Velorex Design! I was using the website assistant.' + (recent ? '\n\n' + recent : '');
        bot(`Opening WhatsApp… If it does not open, message us on <a href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer">+91 79060 27807</a>.`, ['browse']);
        window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }

    /* ───────── Open / close ───────── */
    let launcher = null;
    function open() {
        build();
        els.panel.hidden = false;
        requestAnimationFrame(() => els.panel.classList.add('is-open'));
        launcher && launcher.setAttribute('aria-expanded', 'true');
        launcher && launcher.classList.add('is-active');
        focusInput();
    }
    function close() {
        if (!built) return;
        els.panel.classList.remove('is-open');
        launcher && launcher.setAttribute('aria-expanded', 'false');
        launcher && launcher.classList.remove('is-active');
        setTimeout(() => { if (!els.panel.classList.contains('is-open')) els.panel.hidden = true; }, 250);
        launcher && launcher.focus();
    }

    function init() {
        launcher = document.createElement('button');
        launcher.type = 'button';
        launcher.className = 'vx-chat-launch';
        launcher.setAttribute('aria-label', 'Open the Velorex assistant');
        launcher.setAttribute('aria-expanded', 'false');
        launcher.innerHTML = '<i class="fas fa-comment-dots vx-ico-open"></i><i class="fas fa-xmark vx-ico-close"></i><span class="vx-launch-tip">Need help? Ask us</span>';
        launcher.addEventListener('click', () => (built && els.panel.classList.contains('is-open') ? close() : open()));
        document.body.appendChild(launcher);
        // Show the tooltip once per visit after a short delay.
        try {
            if (!sessionStorage.getItem('vx_chat_tip')) {
                sessionStorage.setItem('vx_chat_tip', '1');
                setTimeout(() => launcher.classList.add('show-tip'), 6000);
                setTimeout(() => launcher.classList.remove('show-tip'), 14000);
            }
        } catch (_) { /* storage blocked */ }
    }

    // The admin answer editor reads the built-in answers from here.
    window.VX_CHAT_DEFAULTS = Object.fromEntries(Object.entries(ANSWERS).map(([k, v]) => [k, v.text]));
    if (document.documentElement.hasAttribute('data-no-chat')) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
