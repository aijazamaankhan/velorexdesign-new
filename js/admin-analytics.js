/* Admin: Analytics & profit (P&L).
   Income  = website/WhatsApp orders that are not cancelled + ledger income
             (e.g. Amazon payouts).
   Costs   = cost of goods (item qty × the product's cost price) + shipping the
             shop paid nothing for is ignored + ledger expenses.
   Profit  = income − costs. Everything is worked out in the browser from data
   the admin already loads; the ledger lives in api/admin-ledger.php. */

const AN_CATEGORIES = {
    income: ['Amazon payout', 'WhatsApp / direct sale', 'Wholesale', 'Other income'],
    expense: ['Wood & materials', 'Packaging', 'Courier & shipping', 'Amazon fees', 'Ads & marketing', 'Labour', 'Tools & equipment', 'Rent & utilities', 'Other expense']
};
let anLedger = [];

const anMoney = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const anDate = s => { const t = Date.parse(String(s || '').replace(' ', 'T')); return isNaN(t) ? null : new Date(t); };

function anRange() {
    const v = document.getElementById('anPeriod').value;
    const now = new Date();
    if (v === 'all') return { from: new Date(2000, 0, 1), to: now, label: 'All time' };
    if (v === 'year') return { from: new Date(now.getFullYear(), 0, 1), to: now, label: String(now.getFullYear()) };
    const d = parseInt(v, 10) || 30;
    return { from: new Date(now.getTime() - d * 86400000), to: now, label: 'Last ' + d + ' days' };
}

function anCompute() {
    const { from, to } = anRange();
    const inRange = d => d && d >= from && d <= to;
    const costOf = id => { const p = products.find(x => String(x.id) === String(id)); return p && p.costPrice != null ? p.costPrice : null; };
    const months = {};
    const bucket = d => { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return months[k] || (months[k] = { inc: 0, out: 0 }); };

    let sales = 0, cogs = 0, orders = 0, missingCost = 0;
    const top = {};
    allOrders.forEach(o => {
        const d = anDate(o.createdAt);
        if (!inRange(d) || o.status === 'Cancelled') return;
        orders++;
        sales += Number(o.total) || 0;
        bucket(d).inc += Number(o.total) || 0;
        (o.items || []).forEach(it => {
            const qty = Number(it.quantity ?? it.qty) || 0;
            const line = Number(it.total_price) || qty * (Number(it.unit_price ?? it.price) || 0);
            const c = costOf(it.product_id);
            if (c == null) missingCost++; else { cogs += c * qty; bucket(d).out += c * qty; }
            const t = top[it.name] || (top[it.name] = { qty: 0, revenue: 0, cost: 0 });
            t.qty += qty; t.revenue += line; t.cost += (c || 0) * qty;
        });
    });

    let ledgerIn = 0, ledgerOut = 0;
    const cats = {};
    anLedger.forEach(e => {
        const d = anDate(e.entry_date);
        if (!inRange(d)) return;
        if (e.kind === 'income') { ledgerIn += e.amount; bucket(d).inc += e.amount; }
        else { ledgerOut += e.amount; bucket(d).out += e.amount; cats[e.category] = (cats[e.category] || 0) + e.amount; }
    });

    const income = sales + ledgerIn;
    const costs = cogs + ledgerOut;
    return { sales, ledgerIn, income, cogs, ledgerOut, costs, profit: income - costs, orders, missingCost, months, top, cats };
}

function anRender() {
    const r = anCompute();
    const margin = r.income > 0 ? Math.round(r.profit / r.income * 100) : 0;
    const kpi = (label, value, note, cls = '') => `<div class="an-kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
    document.getElementById('anKpis').innerHTML =
        kpi('Income', anMoney(r.income), `${anMoney(r.sales)} from ${r.orders} order${r.orders === 1 ? '' : 's'} + ${anMoney(r.ledgerIn)} ledger`) +
        kpi('Cost of goods', anMoney(r.cogs), r.missingCost ? `${r.missingCost} item line(s) have no cost price yet` : 'From product cost prices') +
        kpi('Expenses', anMoney(r.ledgerOut), 'From the ledger') +
        kpi('Net profit', anMoney(r.profit), `${margin}% margin`, r.profit >= 0 ? 'is-good' : 'is-bad');

    const keys = Object.keys(r.months).sort().slice(-12);
    const max = Math.max(1, ...keys.map(k => Math.max(r.months[k].inc, r.months[k].out)));
    document.getElementById('anChart').innerHTML = keys.length ? keys.map(k => {
        const m = r.months[k], net = m.inc - m.out;
        const label = new Date(k + '-01T00:00').toLocaleDateString('en-IN', { month: 'short' });
        return `<div class="an-col" title="${label}: income ${anMoney(m.inc)}, costs ${anMoney(m.out)}, profit ${anMoney(net)}">
            <div class="an-bars"><i class="b-in" style="height:${m.inc / max * 100}%"></i><i class="b-out" style="height:${m.out / max * 100}%"></i></div>
            <b class="${net >= 0 ? 'pos' : 'neg'}">${anMoney(net)}</b><span>${label}</span></div>`;
    }).join('') : '<p class="an-empty">No orders or ledger entries in this period yet.</p>';

    const tops = Object.entries(r.top).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
    document.getElementById('anTop').innerHTML = tops.length ? `<table><thead><tr><th>Product</th><th>Sold</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>${
        tops.map(([name, t]) => `<tr><td>${escapeHtml(name)}</td><td>${t.qty}</td><td>${anMoney(t.revenue)}</td><td>${anMoney(t.revenue - t.cost)}</td></tr>`).join('')
    }</tbody></table>` : '<p class="an-empty">No website orders in this period.</p>';

    const cats = Object.entries(r.cats).sort((a, b) => b[1] - a[1]);
    const catMax = Math.max(1, ...cats.map(c => c[1]));
    document.getElementById('anCats').innerHTML = cats.length ? cats.map(([c, v]) =>
        `<div class="an-cat"><div class="an-cat-row"><span>${escapeHtml(c)}</span><b>${anMoney(v)}</b></div><div class="an-cat-bar"><i style="width:${v / catMax * 100}%"></i></div></div>`).join('')
        : '<p class="an-empty">No expenses recorded in this period.</p>';

    const { from, to } = anRange();
    const rows = anLedger.filter(e => { const d = anDate(e.entry_date); return d && d >= from && d <= to; });
    document.getElementById('anLedger').innerHTML = rows.length ? `<table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody>${
        rows.map(e => `<tr><td>${escapeHtml(e.entry_date)}</td><td><span class="an-kind ${e.kind}">${e.kind === 'income' ? 'Income' : 'Expense'}</span></td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.note || '')}</td><td class="${e.kind === 'income' ? 'pos' : 'neg'}">${e.kind === 'income' ? '+' : '−'}${anMoney(e.amount)}</td><td><button type="button" class="btn btn-secondary an-del" data-id="${e.id}" title="Delete entry"><i class="fas fa-trash"></i></button></td></tr>`).join('')
    }</tbody></table>` : '<p class="an-empty">No ledger entries in this period. Add Amazon payouts and costs above.</p>';
}

async function loadAnalytics() {
    const res = await apiCall('api/admin-ledger.php');
    anLedger = res.ok && res.data ? (res.data.entries || []) : [];
    if (!res.ok) showToast(explainApiFailure(res, 'Could not load the ledger'), 'error');
    anRender();
}

function anSyncCats() {
    const kind = document.getElementById('lgKind').value;
    document.getElementById('lgCat').innerHTML = AN_CATEGORIES[kind].map(c => `<option>${c}</option>`).join('');
}

function anExport() {
    const r = anCompute();
    const { label } = anRange();
    const lines = [['Velorex Design profit and loss', label], [], ['Income (orders)', r.sales], ['Income (ledger)', r.ledgerIn], ['Cost of goods', r.cogs], ['Expenses (ledger)', r.ledgerOut], ['Net profit', r.profit], [], ['Date', 'Type', 'Category', 'Note', 'Amount']];
    anLedger.forEach(e => lines.push([e.entry_date, e.kind, e.category, e.note || '', e.amount]));
    const csv = lines.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'velorex-profit-loss.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    const period = document.getElementById('anPeriod');
    if (!period) return;
    period.addEventListener('change', anRender);
    document.getElementById('anExport').addEventListener('click', anExport);
    document.getElementById('lgKind').addEventListener('change', anSyncCats);
    document.getElementById('lgDate').value = new Date().toISOString().slice(0, 10);
    anSyncCats();
    document.getElementById('ledgerForm').addEventListener('submit', async e => {
        e.preventDefault();
        const body = { action: 'add', entry_date: document.getElementById('lgDate').value, kind: document.getElementById('lgKind').value,
            category: document.getElementById('lgCat').value, amount: document.getElementById('lgAmount').value, note: document.getElementById('lgNote').value.trim() };
        const res = await apiCall('api/admin-ledger.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { showToast(explainApiFailure(res, 'Could not save the entry'), 'error'); return; }
        showToast('Entry added', 'success');
        document.getElementById('lgAmount').value = '';
        document.getElementById('lgNote').value = '';
        loadAnalytics();
    });
    document.getElementById('anLedger').addEventListener('click', async e => {
        const b = e.target.closest('.an-del');
        if (!b || !confirm('Delete this ledger entry?')) return;
        const res = await apiCall('api/admin-ledger.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: b.dataset.id }) });
        if (!res.ok) { showToast(explainApiFailure(res, 'Could not delete'), 'error'); return; }
        loadAnalytics();
    });
});
