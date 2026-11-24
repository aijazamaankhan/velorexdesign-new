/* Admin: printable bill (A4) and shipping address label (4x6 in / A6).
   Modelled on velorexmusic.com's invoice.js and shipping-label.js.

   Both open a light, print-first page in a new window; the browser's print
   dialog prints it or saves it as a PDF. No PDF library is needed.

   Admin only: these pages carry the customer's name, address and phone and
   are built from orders already loaded behind the admin login. There is no
   public URL that renders them. The site's CSP blocks inline scripts, so the
   print and close buttons are wired from here, not with onclick attributes. */

const VX_SHOP = {
    name: 'Velorex Design',
    tagline: 'Handmade wood, wellness and storage',
    address: ['Meerut, Uttar Pradesh 250002', 'India'],
    email: 'velorexdesign@gmail.com',
    web: 'velorexdesign.com',
    socials: [
        { key: 'youtube', label: 'YouTube' },
        { key: 'instagram', label: 'Instagram' }
    ]
};

function vxEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function vxMoney(n) { return '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function vxDate(o) {
    const t = o.createdAt ? Date.parse(String(o.createdAt).replace(' ', 'T')) : NaN;
    return isNaN(t) ? (o.date || '') : new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function vxAddressLines(o) {
    const a = o.address || {};
    return String(a.street || '').split(/,\s*/).concat([[a.city].filter(Boolean).join(''), a.zip ? 'PIN ' + a.zip : ''])
        .map(s => s.trim()).filter(Boolean);
}
function vxItems(o) {
    return (o.items || []).map(it => {
        const qty = Number(it.quantity ?? it.qty) || 0;
        const price = Number(it.unit_price ?? it.price) || 0;
        const line = Number(it.total_price) || price * qty;
        return { name: String(it.name || ''), qty, price, line };
    });
}

function vxOpen(html, title, setup) {
    const w = window.open('', '_blank');
    if (!w) { showToast('Allow pop-ups for this site to print', 'error'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title;
    const wire = () => {
        const p = w.document.getElementById('vxPrint');
        const c = w.document.getElementById('vxClose');
        if (p) p.addEventListener('click', () => w.print());
        if (c) c.addEventListener('click', () => w.close());
        if (setup) setup(w);
    };
    if (w.document.readyState === 'complete') wire(); else w.addEventListener('load', wire);
}

const VX_BAR_CSS = '.bar{max-width:210mm;margin:16px auto 0;display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap}'
    + '.bar button,.bar select{font:inherit;font-size:13px;font-weight:700;padding:9px 16px;border-radius:8px;border:1px solid #d5d5dc;background:#fff;cursor:pointer}'
    + '.bar .primary{background:#ff5a1f;border-color:#ff5a1f;color:#fff}'
    + '@media print{.bar{display:none}}';

/* ───────────── Bill (A4) ───────────── */
function printOrderBill(orderId) {
    const o = allOrders.find(x => String(x.id) === String(orderId));
    if (!o) return;
    const origin = window.location.origin;
    const items = vxItems(o);
    const subtotal = o.subtotal != null ? Number(o.subtotal) : items.reduce((s, i) => s + i.line, 0);
    const shipping = o.shipping != null ? Number(o.shipping) : Math.max(0, (Number(o.total) || 0) - subtotal + (o.discount || 0));
    const discount = Number(o.discount) || 0;
    const total = Number(o.total) || (subtotal - discount + shipping);
    const addr = vxAddressLines(o).map(l => '<div>' + vxEsc(l) + '</div>').join('');

    const rows = items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${vxEsc(it.name)}</td><td class="c">${it.qty}</td><td class="r">${vxMoney(it.price)}</td><td class="r">${vxMoney(it.line)}</td></tr>`).join('');
    const totals = `<tr class="ts"><td colspan="4" class="r">Subtotal</td><td class="r">${vxMoney(subtotal)}</td></tr>`
        + (discount ? `<tr class="ts"><td colspan="4" class="r">Discount${o.couponCode ? ' (' + vxEsc(o.couponCode) + ')' : ''}</td><td class="r">−${vxMoney(discount)}</td></tr>` : '')
        + `<tr class="ts"><td colspan="4" class="r">Shipping</td><td class="r">${shipping > 0 ? vxMoney(shipping) : 'Free'}</td></tr>`
        + `<tr class="tt"><td colspan="4" class="r">Total</td><td class="r">${vxMoney(total)}</td></tr>`;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bill</title><style>
@page{size:A4;margin:12mm}*{box-sizing:border-box}
body{margin:0;font-family:"Helvetica Neue",Arial,sans-serif;color:#15111f;background:#efeef3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;min-height:297mm;margin:16px auto;padding:14mm;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.14)}
.head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:14px;border-bottom:3px solid #ff5a1f}
.head img{height:64px;width:auto}
.head-meta{text-align:right;font-size:9.5px;letter-spacing:.14em;line-height:1.9;font-weight:700;text-transform:uppercase}
.head-meta span{display:block;color:#ff5a1f}
.row{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:20px 0 16px;flex-wrap:wrap}
h1{margin:0;font-size:30px;letter-spacing:.02em}
.row p{margin:4px 0 0;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#666}
.meta{display:flex;border:1px solid #e6e6ea;border-radius:10px;overflow:hidden}
.meta div{padding:9px 14px;border-right:1px solid #e6e6ea}.meta div:last-child{border-right:0}
.k{font-size:7.5px;letter-spacing:.14em;text-transform:uppercase;color:#888;font-weight:700}
.v{font-size:11.5px;font-weight:700;margin-top:3px}
.cust{background:#fff4ee;border-radius:10px;padding:14px 16px;margin-bottom:20px}
.cust h2{margin:0 0 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ff5a1f}
.cr{display:flex;gap:14px;margin-bottom:6px;font-size:12.5px}.cr .k{width:74px;flex:0 0 74px;padding-top:3px}.cr .vv{font-weight:700;line-height:1.55}
table{width:100%;border-collapse:collapse;font-size:12.5px}
thead th{background:#1a0a2e;color:#fff;text-align:left;padding:10px 12px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase}
.c{text-align:center}.r{text-align:right}
tbody td{padding:11px 12px;border-bottom:1px solid #ececf0}
tr.ts td{background:#fafafc;font-size:12px;color:#444}
tr.tt td{background:#f4f4f7;font-weight:800;font-size:14px}tr.tt td:last-child{background:#ff5a1f;color:#fff}
.thanks{margin:26px 0 20px;padding-top:18px;border-top:1px solid #ececf0;display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap}
.big{font-size:26px;font-weight:800;color:#ff5a1f}.thanks p{margin:6px 0 0;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#666}
.qrs{display:flex;gap:10px}.qr{text-align:center}.qr img{width:22mm;height:22mm;display:block;border:1px solid #ececf0;border-radius:4px}.qr span{font-size:8.5px;font-weight:700}
.foot{background:#f4f4f7;border-radius:10px;padding:16px 18px;display:flex;gap:26px;flex-wrap:wrap}.foot h3{margin:0;font-size:15px}
.strip{margin-top:14px;text-align:center;font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:#888}
${VX_BAR_CSS}
@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:auto;min-height:0;padding:0}}
</style></head><body>
<div class="bar"><button type="button" id="vxClose">Close</button><button type="button" class="primary" id="vxPrint">Print / Save as PDF</button></div>
<div class="sheet">
  <div class="head"><img src="${origin}/images/brand/logo-on-light.png" alt="Velorex Design"><div class="head-meta">Handmade in India<br>Wood · Wellness · Storage<span>${vxEsc(VX_SHOP.web)}</span></div></div>
  <div class="row"><div><h1>BILL</h1><p>Thank you for your order</p></div>
    <div class="meta"><div><div class="k">Order no.</div><div class="v">${vxEsc(o.id)}</div></div><div><div class="k">Date</div><div class="v">${vxEsc(vxDate(o))}</div></div><div><div class="k">Status</div><div class="v">${vxEsc(o.status)}</div></div></div></div>
  <div class="cust"><h2>Customer details</h2>
    <div class="cr"><div class="k">Name</div><div class="vv">${vxEsc(o.userName)}</div></div>
    ${addr ? `<div class="cr"><div class="k">Address</div><div class="vv">${addr}</div></div>` : ''}
    ${o.userPhone ? `<div class="cr"><div class="k">Phone</div><div class="vv">${vxEsc(o.userPhone)}</div></div>` : ''}
    ${o.orderEmail ? `<div class="cr"><div class="k">Email</div><div class="vv">${vxEsc(o.orderEmail)}</div></div>` : ''}</div>
  <table><thead><tr><th class="c">#</th><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>${rows}${totals}</tbody></table>
  <div class="thanks"><div><div class="big">Thank you!</div><p>For supporting handmade work from Meerut</p></div>
    <div><div class="k" style="text-align:right;margin-bottom:6px">Follow us — scan with your phone</div><div class="qrs">${VX_SHOP.socials.map(s => `<div class="qr"><img src="${origin}/images/social/qr-${s.key}.svg" alt="${s.label} QR code"><span>${s.label}</span></div>`).join('')}</div></div></div>
  <div class="foot"><div><h3>${vxEsc(VX_SHOP.name)}</h3><div class="k">${vxEsc(VX_SHOP.tagline)}</div></div>
    <div><div class="k">Email us</div><div class="v">${vxEsc(VX_SHOP.email)}</div></div>
    <div><div class="k">Our studio</div><div class="v">${VX_SHOP.address.map(vxEsc).join('<br>')}</div></div></div>
  <div class="strip">Velorex Design · Made by hand in India</div>
</div></body></html>`;
    vxOpen(html, 'Bill ' + o.id + ' · Velorex Design');
}

/* ───────────── Address label (4x6 in thermal, or A6) ───────────── */
function printOrderLabel(orderId) {
    const o = allOrders.find(x => String(x.id) === String(orderId));
    if (!o) return;
    const origin = window.location.origin;
    const a = o.address || {};
    const street = String(a.street || '').split(/,\s*/).filter(Boolean).map(vxEsc).join('<br>');
    const items = vxItems(o);
    const count = items.reduce((s, i) => s + i.qty, 0);

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Label</title><style id="vxPage">@page{size:100mm 150mm;margin:0}</style><style>
*{box-sizing:border-box}body{margin:0;background:#efeef3;font-family:"Helvetica Neue",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.label{width:100mm;height:150mm;margin:16px auto;padding:5mm;background:#fff;border:1.5px dashed #999;display:flex;flex-direction:column;gap:3mm;overflow:hidden}
body.a6 .label{width:105mm;height:148mm}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:2mm}
.top img{height:11mm;width:auto}.oid{text-align:right;font-size:8pt;line-height:1.3}.oid b{display:block;font-size:12pt}
.k{font-size:7pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#444}
.to{border:2.5px solid #000;border-radius:2mm;padding:3mm}
.name{font-size:15pt;font-weight:800;margin:1mm 0 1.5mm;line-height:1.15;word-break:break-word}
.addr{font-size:10.5pt;line-height:1.35;word-break:break-word}
.city{font-size:11pt;font-weight:700;margin-top:1mm}
.pin{margin-top:2mm;font-size:20pt;font-weight:900;letter-spacing:.12em}
.ph{margin-top:1mm;font-size:12pt;font-weight:800}
.handle{text-align:center;font-size:10pt;font-weight:900;letter-spacing:.06em;padding:2mm;border:2px solid #000;border-radius:1.5mm}
.items{flex:1;min-height:0;overflow:hidden}.items table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:1mm}
.items td{padding:.8mm 0;border-bottom:.5px solid #ccc;vertical-align:top}.items td.q{width:9mm;font-weight:800}.items td.t{width:5mm;text-align:right}
.from{border-top:2px solid #000;padding-top:2mm;font-size:8.5pt;line-height:1.35;display:flex;justify-content:space-between;align-items:flex-end;gap:2mm}
.from b{font-size:9.5pt}.qrs{display:flex;gap:1.5mm}.qrs img{width:13mm;height:13mm;display:block}
${VX_BAR_CSS}
@media print{body{background:#fff}.label{margin:0;border:0}}
</style></head><body>
<div class="bar"><label style="font-size:13px;font-weight:700">Paper <select id="vxSize"><option value="4x6">4 × 6 in (thermal)</option><option value="a6">A6</option></select></label><button type="button" id="vxClose">Close</button><button type="button" class="primary" id="vxPrint">Print label</button></div>
<div class="label">
  <div class="top"><img src="${origin}/images/brand/logo-on-light.png" alt="Velorex Design"><div class="oid">Order<b>${vxEsc(o.id)}</b>${vxEsc(vxDate(o))}</div></div>
  <div class="to"><div class="k">Ship to</div>
    <div class="name">${vxEsc(o.userName)}</div>
    <div class="addr">${street || '&nbsp;'}</div>
    ${a.city ? `<div class="city">${vxEsc(a.city)}</div>` : ''}
    ${a.zip ? `<div class="pin">${vxEsc(a.zip)}</div>` : ''}
    ${o.userPhone ? `<div class="ph">☎ ${vxEsc(o.userPhone)}</div>` : ''}</div>
  <div class="handle">HANDLE WITH CARE · HANDMADE WOOD</div>
  <div class="items"><div class="k">Packed items (${count})</div><table>${items.map(i => `<tr><td class="q">${i.qty} ×</td><td>${vxEsc(i.name)}</td><td class="t">☐</td></tr>`).join('')}</table></div>
  <div class="from"><div><div class="k">From</div><b>${vxEsc(VX_SHOP.name)}</b><br>${VX_SHOP.address.map(vxEsc).join(', ')}<br>${vxEsc(VX_SHOP.email)}</div>
    <div class="qrs">${VX_SHOP.socials.map(s => `<img src="${origin}/images/social/qr-${s.key}.svg" alt="">`).join('')}</div></div>
</div></body></html>`;
    vxOpen(html, 'Label ' + o.id + ' · Velorex Design', (w) => {
        const sel = w.document.getElementById('vxSize');
        if (!sel) return;
        sel.addEventListener('change', () => {
            const a6 = sel.value === 'a6';
            w.document.body.classList.toggle('a6', a6);
            w.document.getElementById('vxPage').textContent = '@page{size:' + (a6 ? 'A6' : '100mm 150mm') + ';margin:0}';
        });
    });
}

Object.assign(ACTION_HANDLERS, {
    'print-bill':  (e, el) => { e && e.stopPropagation && e.stopPropagation(); printOrderBill(el.dataset.id); },
    'print-label': (e, el) => { e && e.stopPropagation && e.stopPropagation(); printOrderLabel(el.dataset.id); }
});
