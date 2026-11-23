/* Admin: Coupons and Loyalty points tabs.
   Loaded after admin.js; uses its apiCall, escapeHtml, escapeAttr, showToast
   and ACTION_HANDLERS. All amounts are whole rupees. */

let mktCoupons = [];

function mktMoney(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

function mktCouponSummary(c) {
    if (c.type === 'free_shipping') return 'Free shipping';
    if (c.type === 'percent') return c.value + '% off' + (c.max_discount ? ' (max ' + mktMoney(c.max_discount) + ')' : '');
    return mktMoney(c.value) + ' off';
}

function mktCouponState(c) {
    const now = Date.now();
    if (!c.active) return ['Off', '#94a3b8'];
    if (c.expires_at && new Date(c.expires_at.replace(' ', 'T')).getTime() < now) return ['Expired', '#ef4444'];
    if (c.starts_at && new Date(c.starts_at.replace(' ', 'T')).getTime() > now) return ['Scheduled', '#f59e0b'];
    if (c.usage_limit !== null && c.used_count >= c.usage_limit) return ['Used up', '#ef4444'];
    return ['Live', '#10b981'];
}

async function loadCoupons() {
    const box = document.getElementById('couponList');
    if (!box) return;
    box.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';
    const res = await apiCall('api/admin-coupons.php');
    if (!res.ok || !res.data) { box.innerHTML = '<p style="color:#ef4444">' + escapeHtml(explainApiFailure(res, 'Could not load coupons')) + '</p>'; return; }
    mktCoupons = res.data.coupons || [];
    if (!mktCoupons.length) {
        box.innerHTML = '<p style="color:var(--text-muted); padding:2rem; text-align:center;">No coupons yet. Create your first one above, for example WELCOME10 for 10% off.</p>';
        return;
    }
    box.innerHTML = `<div style="overflow-x:auto"><table><thead><tr>
        <th>Code</th><th>Offer</th><th>Min order</th><th>Used</th><th>Valid</th><th>Status</th><th></th></tr></thead><tbody>
        ${mktCoupons.map(c => {
            const [state, color] = mktCouponState(c);
            const used = c.used_count + (c.usage_limit !== null ? ' / ' + c.usage_limit : '');
            const valid = (c.starts_at ? c.starts_at.slice(0, 10) : 'now') + ' → ' + (c.expires_at ? c.expires_at.slice(0, 10) : 'no end');
            return `<tr>
                <td><strong style="font-family:monospace; letter-spacing:.5px">${escapeHtml(c.code)}</strong>${c.note ? `<div style="font-size:.75rem;color:var(--text-muted)">${escapeHtml(c.note)}</div>` : ''}</td>
                <td>${escapeHtml(mktCouponSummary(c))}${c.per_customer_limit ? `<div style="font-size:.75rem;color:var(--text-muted)">${c.per_customer_limit}× per customer</div>` : ''}</td>
                <td>${c.min_order ? mktMoney(c.min_order) : '–'}</td>
                <td>${escapeHtml(used)}<div style="font-size:.75rem;color:var(--text-muted)">${mktMoney(c.total_discount)} given</div></td>
                <td style="font-size:.8rem">${escapeHtml(valid)}</td>
                <td><span style="color:${color}; font-weight:700">${state}</span></td>
                <td style="white-space:nowrap">
                    <button type="button" class="btn btn-secondary" data-action="mkt-edit-coupon" data-id="${escapeAttr(c.id)}" style="padding:4px 10px;font-size:.75rem"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-secondary" data-action="mkt-toggle-coupon" data-id="${escapeAttr(c.id)}" style="padding:4px 10px;font-size:.75rem">${c.active ? 'Turn off' : 'Turn on'}</button>
                    <button type="button" class="btn btn-secondary" data-action="mkt-delete-coupon" data-id="${escapeAttr(c.id)}" style="padding:4px 10px;font-size:.75rem;color:#ef4444;border-color:#ef4444"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        }).join('')}</tbody></table></div>`;
}

function mktFillCouponForm(c) {
    const f = document.getElementById('couponForm');
    f.reset();
    document.getElementById('cpId').value = c ? c.id : '';
    if (c) {
        document.getElementById('cpCode').value = c.code;
        document.getElementById('cpType').value = c.type;
        document.getElementById('cpValue').value = c.type === 'free_shipping' ? '' : c.value;
        document.getElementById('cpMin').value = c.min_order || '';
        document.getElementById('cpMax').value = c.max_discount ?? '';
        document.getElementById('cpLimit').value = c.usage_limit ?? '';
        document.getElementById('cpPer').value = c.per_customer_limit ?? '';
        document.getElementById('cpStart').value = c.starts_at ? c.starts_at.slice(0, 16).replace(' ', 'T') : '';
        document.getElementById('cpEnd').value = c.expires_at ? c.expires_at.slice(0, 16).replace(' ', 'T') : '';
        document.getElementById('cpNote').value = c.note || '';
        document.getElementById('cpActive').checked = !!c.active;
    } else {
        document.getElementById('cpActive').checked = true;
    }
    document.getElementById('couponFormTitle').textContent = c ? 'Edit coupon ' + c.code : 'New coupon';
    mktSyncCouponType();
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mktSyncCouponType() {
    const t = document.getElementById('cpType').value;
    document.getElementById('cpValueWrap').style.display = t === 'free_shipping' ? 'none' : '';
    document.getElementById('cpMaxWrap').style.display = t === 'percent' ? '' : 'none';
    document.getElementById('cpValueLabel').textContent = t === 'percent' ? 'Percent off (1–90)' : 'Rupees off';
}

async function mktSaveCoupon(e) {
    e.preventDefault();
    const v = id => document.getElementById(id).value.trim();
    const body = {
        action: 'save', id: v('cpId') || 0, code: v('cpCode'), type: v('cpType'), value: v('cpValue') || 0,
        min_order: v('cpMin') || 0, max_discount: v('cpMax'), usage_limit: v('cpLimit'), per_customer_limit: v('cpPer'),
        starts_at: v('cpStart'), expires_at: v('cpEnd'), note: v('cpNote'), active: document.getElementById('cpActive').checked
    };
    const res = await apiCall('api/admin-coupons.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { showToast(explainApiFailure(res, 'Could not save coupon'), 'error'); return; }
    showToast('Coupon saved', 'success');
    mktFillCouponForm(null);
    loadCoupons();
}

async function mktCouponAction(action, id) {
    if (action === 'delete' && !confirm('Delete this coupon? Orders that used it keep their discount.')) return;
    const res = await apiCall('api/admin-coupons.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) });
    if (!res.ok) { showToast(explainApiFailure(res, 'Action failed'), 'error'); return; }
    loadCoupons();
}

/* ───────────── Loyalty ───────────── */

async function loadLoyalty() {
    const res = await apiCall('api/admin-loyalty.php');
    const box = document.getElementById('loyaltyMembers');
    if (!res.ok || !res.data) { box.innerHTML = '<p style="color:#ef4444">' + escapeHtml(explainApiFailure(res, 'Could not load loyalty data')) + '</p>'; return; }
    const { config: c, members, totals } = res.data;
    const set = (id, val) => { document.getElementById(id).value = val; };
    document.getElementById('lyEnabled').checked = !!c.enabled;
    set('lyEarn', c.earnPercent); set('lyPpr', c.pointsPerRupee); set('lyMaxPct', c.maxRedeemPercent);
    set('lyMin', c.minRedeemPoints); set('lyBonus', c.signupBonus); set('lyExpiry', c.expiryMonths);
    mktLoyaltyPreview();
    document.getElementById('loyaltyTotals').innerHTML = `
        <div class="stat-card"><div class="stat-label">Points issued</div><div class="stat-value">${totals.issued.toLocaleString('en-IN')}</div></div>
        <div class="stat-card"><div class="stat-label">Points redeemed</div><div class="stat-value">${totals.redeemed.toLocaleString('en-IN')}</div></div>
        <div class="stat-card"><div class="stat-label">Outstanding</div><div class="stat-value">${totals.outstanding.toLocaleString('en-IN')}</div>
          <div class="stat-trend">${mktMoney(Math.floor(totals.outstanding / Math.max(1, c.pointsPerRupee)))} of discounts owed</div></div>`;
    box.innerHTML = members.length ? `<div style="overflow-x:auto"><table><thead><tr><th>Customer</th><th>Email</th><th>Balance</th><th>Last activity</th></tr></thead><tbody>
        ${members.map(m => `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.email || '')}</td><td><strong>${m.balance.toLocaleString('en-IN')}</strong></td><td>${escapeHtml((m.last_activity || '').slice(0, 10))}</td></tr>`).join('')}
        </tbody></table></div>` : '<p style="color:var(--text-muted)">No members with points yet.</p>';
}

function mktLoyaltyPreview() {
    const n = id => Number(document.getElementById(id).value) || 0;
    const earn = n('lyEarn'), ppr = Math.max(1, n('lyPpr')), maxPct = n('lyMaxPct');
    const pts = Math.floor(1000 * earn / 100 * ppr);
    document.getElementById('lyPreview').textContent =
        `Example: a ₹1,000 order earns ${pts} points (worth ${mktMoney(Math.floor(pts / ppr))}) once delivered. ` +
        `Customers can pay up to ${maxPct}% of an order with points, need at least ${n('lyMin')} points to start, ` +
        (n('lyExpiry') ? `and points expire after ${n('lyExpiry')} months without activity.` : 'and points never expire.');
}

async function mktSaveLoyalty(e) {
    e.preventDefault();
    const n = id => document.getElementById(id).value;
    const config = { enabled: document.getElementById('lyEnabled').checked, earnPercent: n('lyEarn'), pointsPerRupee: n('lyPpr'),
        maxRedeemPercent: n('lyMaxPct'), minRedeemPoints: n('lyMin'), signupBonus: n('lyBonus'), expiryMonths: n('lyExpiry') };
    const res = await apiCall('api/admin-loyalty.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-config', config }) });
    if (!res.ok) { showToast(explainApiFailure(res, 'Could not save settings'), 'error'); return; }
    showToast(config.enabled ? 'Loyalty programme saved and live' : 'Loyalty settings saved (programme is off)', 'success');
    loadLoyalty();
}

async function mktAdjustPoints(e) {
    e.preventDefault();
    const body = { action: 'adjust', email: document.getElementById('lyAdjEmail').value.trim(),
        points: document.getElementById('lyAdjPoints').value, note: document.getElementById('lyAdjNote').value.trim() };
    const res = await apiCall('api/admin-loyalty.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { showToast(explainApiFailure(res, 'Could not adjust points'), 'error'); return; }
    showToast('Done. New balance: ' + res.data.balance + ' points', 'success');
    document.getElementById('loyaltyAdjustForm').reset();
    loadLoyalty();
}

/* ───────────── Wiring ───────────── */

Object.assign(ACTION_HANDLERS, {
    'mkt-new-coupon':    () => mktFillCouponForm(null),
    'mkt-edit-coupon':   (e, el) => mktFillCouponForm(mktCoupons.find(c => String(c.id) === el.dataset.id)),
    'mkt-toggle-coupon': (e, el) => mktCouponAction('toggle', el.dataset.id),
    'mkt-delete-coupon': (e, el) => mktCouponAction('delete', el.dataset.id)
});

document.addEventListener('DOMContentLoaded', () => {
    const cf = document.getElementById('couponForm');
    if (cf) cf.addEventListener('submit', mktSaveCoupon);
    const ct = document.getElementById('cpType');
    if (ct) ct.addEventListener('change', mktSyncCouponType);
    const lf = document.getElementById('loyaltyForm');
    if (lf) { lf.addEventListener('submit', mktSaveLoyalty); lf.addEventListener('input', mktLoyaltyPreview); }
    const af = document.getElementById('loyaltyAdjustForm');
    if (af) af.addEventListener('submit', mktAdjustPoints);
});

/* Phone layout for every admin table: copy each column heading onto its cells
   (data-label) so CSS can show rows as labelled cards on small screens. */
(function () {
    const label = (root) => {
        (root.querySelectorAll ? root : document).querySelectorAll('table').forEach(t => {
            const heads = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
            if (!heads.length) return;
            t.classList.add('has-card-rows');
            t.querySelectorAll('tbody tr').forEach(tr => {
                Array.from(tr.children).forEach((td, i) => {
                    if (td.tagName === 'TD' && !td.hasAttribute('data-label') && heads[i] !== undefined) td.setAttribute('data-label', heads[i]);
                });
            });
        });
    };
    const start = () => {
        const app = document.getElementById('adminApp');
        if (!app) return;
        label(app);
        let queued = false;
        new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; label(app); });
        }).observe(app, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
