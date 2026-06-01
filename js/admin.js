'use strict';

let products = [];
let allOrders = [];
let categories = [];
let currentImages = [];
const ADMIN_BUILD = 'v5-secure';
console.log('Velorex admin build', ADMIN_BUILD);

/* ──────────────────────────────────────────────────────────────
   SECURITY HELPERS
   ────────────────────────────────────────────────────────────── */

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"'`=\/]/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;', '`': '&#96;',
        '=': '&#61;', '/': '&#47;'
    }[ch]));
}

function escapeAttr(str) {
    return escapeHtml(str);
}

function safeUrl(url) {
    const s = String(url == null ? '' : url).trim();
    if (!s) return '';
    if (/^\s*javascript:/i.test(s) || /^\s*data:(?!image\/)/i.test(s) || /^\s*vbscript:/i.test(s)) {
        return '';
    }
    return s;
}

const VALIDATORS = {
    required: v => String(v == null ? '' : v).trim().length > 0,
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()),
    minLength: (v, n) => String(v || '').length >= n,
    maxLength: (v, n) => String(v || '').length <= n,
    digits: v => /^\d+$/.test(String(v || '').trim()),
    phone: v => /^[0-9+\-\s()]{7,20}$/.test(String(v || '').trim()),
    positiveNumber: v => {
        const n = parseFloat(v);
        return !isNaN(n) && isFinite(n) && n >= 0;
    },
    url: v => {
        const s = String(v || '').trim();
        if (!s) return true;
        try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
        catch (_) { return false; }
    }
};

/* ──────────────────────────────────────────────────────────────
   API helpers
   ────────────────────────────────────────────────────────────── */

async function apiCall(url, options = {}) {
    let response;
    try {
        response = await fetch(url, { credentials: 'include', ...options });
    } catch (networkErr) {
        return { ok: false, status: 0, data: null, raw: '', networkError: true };
    }
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    return { ok: response.ok, status: response.status, data, raw, networkError: false };
}

function explainApiFailure(res, fallback) {
    if (res.networkError) return 'Server unreachable. Run the site via a PHP server (XAMPP / Laragon / php -S / Hostinger) — Live Server and file:// will not work.';
    if (res.data && res.data.error) {
        return res.data.detail ? `${res.data.error} — ${res.data.detail}` : res.data.error;
    }
    if (res.status === 405 || res.status === 501) {
        return 'HTTP ' + res.status + ' — the host is NOT running PHP. VS Code Live Server, python http.server, and similar static servers do not execute .php files. Open the site through XAMPP / Laragon / "php -S localhost:8000" / Hostinger.';
    }
    if (res.status === 401) return 'Invalid username or password.';
    if (res.status === 404) return 'Endpoint not found — make sure the api/ folder was uploaded next to admin.html.';
    if (res.raw && res.raw.trim().startsWith('<')) return 'The server returned HTML instead of JSON — PHP is probably not executing. Open the site through a PHP server (XAMPP / Laragon / "php -S" / Hostinger).';
    if (!res.raw) return 'Server returned an empty response (status ' + res.status + ') — check api/error.log for a PHP fatal.';
    return fallback || ('Unexpected response (status ' + res.status + ')');
}

const DEFAULT_CATEGORIES = [
    { id: 'wood',         name: 'Wood Items',      isDefault: true },
    { id: 'resin',        name: 'Resin Art',       isDefault: true },
    { id: 'soap',         name: 'Handmade Soap',   isDefault: true },
    { id: 'candle',       name: 'Candles',         isDefault: true },
    { id: 'raw_material', name: 'Raw Materials',   isDefault: true }
];

/* ──────────────────────────────────────────────────────────────
   AUTH
   ────────────────────────────────────────────────────────────── */

async function checkAuth() {
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;

    if (!VALIDATORS.required(user) || !VALIDATORS.required(pass)) {
        showToast('Please enter username and password', 'error');
        return;
    }
    if (!VALIDATORS.maxLength(user, 100) || !VALIDATORS.maxLength(pass, 200)) {
        showToast('Credentials are too long', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('email', user);
    formData.append('password', pass);

    const res = await apiCall('api/login.php', { method: 'POST', body: formData });

    if (res.ok && res.data && res.data.success) {
        localStorage.setItem('velorex_admin_logged', 'true');
        localStorage.setItem('velorex_admin_email', res.data.admin.email);
        showToast('Login successful', 'success');
        setTimeout(() => showApp(), 400);
        return;
    }

    if (res.networkError) {
        if (user === 'owner' && pass === 'owner123') {
            localStorage.setItem('velorex_admin_logged', 'true');
            localStorage.setItem('velorex_admin_email', user);
            showToast('Server unreachable — offline preview only (writes will fail)', 'info');
            setTimeout(() => showApp(), 400);
        } else {
            showToast('Server unreachable. Default credentials are owner / owner123.', 'error');
        }
        return;
    }

    showToast(explainApiFailure(res, 'Login failed'), 'error');
}

async function checkSession() {
    const res = await apiCall('api/session-check.php');
    if (res.ok && res.data && res.data.authenticated) {
        localStorage.setItem('velorex_admin_logged', 'true');
        showApp();
    } else {
        localStorage.removeItem('velorex_admin_logged');
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'light' ? 'dark' : 'light');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('velorex_design_theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

async function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';

    const savedTheme = localStorage.getItem('velorex_design_theme') || 'dark';
    setTheme(savedTheme);

    await loadData();
    loadCategories();
    loadSettings();
    render();
}

async function loadSettings() {
    const s = JSON.parse(localStorage.getItem('velorex_store_settings')) || {};
    document.getElementById('settingsStoreName').value = s.storeName || '';
    document.getElementById('settingsWhatsapp').value = s.whatsapp || '';
    document.getElementById('settingsPhone').value = s.phone || '';
    document.getElementById('settingsEmail').value = s.email || '';
    document.getElementById('settingsAddress').value = s.address || '';
}

async function loadData() {
    try {
        const [productsRes, ordersRes] = await Promise.all([
            apiCall('api/get-products.php'),
            apiCall('api/get-orders.php')
        ]);

        if (productsRes.networkError && ordersRes.networkError) {
            showToast('Server unreachable — admin panel is in offline preview mode. Run the site through PHP for live data.', 'info');
        }

        if (productsRes.ok && productsRes.data) {
            const json = productsRes.data;
            products = (json.products || []).map(p => {
                const imagesArr = Array.isArray(p.images) ? p.images : [];
                const cover = imagesArr[0] || p.image_url || p.img || '';
                return {
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price),
                    stock: parseInt(p.stock, 10) || 0,
                    cat: p.category,
                    img: cover,
                    images: imagesArr.length ? imagesArr : (cover ? [cover] : []),
                    desc: p.description || p.desc || '',
                    featured: p.featured === '1' || p.featured === 1 || p.featured === true
                };
            });
        }

        if (ordersRes.ok && ordersRes.data) {
            const json = ordersRes.data;
            allOrders = (json.orders || []).map(o => ({
                id: o.id,
                total: parseFloat(o.total) || 0,
                status: o.status || 'Pending',
                items: o.items || [],
                userName: o.customer_name || 'Guest',
                userEmail: o.customer_email || '',
                userPhone: o.customer_phone || '',
                address: {
                    street: o.shipping_address || '',
                    city: o.shipping_city || '',
                    zip: o.shipping_zip || ''
                },
                trackingNumber: o.tracking_number || '',
                adminNote: o.admin_note || '',
                statusHistory: o.status_history || [],
                createdAt: o.created_at || null,
                date: o.created_at ? new Date(o.created_at).toLocaleDateString() : ''
            }));
        }
    } catch (error) {
        console.error('Load data failed', error);
        showToast('Could not load data from server', 'error');
    }
}

function logout() {
    fetch('api/logout.php', { credentials: 'include' })
        .finally(() => {
            localStorage.removeItem('velorex_admin_logged');
            window.location.reload();
        });
}

async function saveSettings() {
    const whatsapp = document.getElementById('settingsWhatsapp').value.replace(/\D/g, '');
    const email = document.getElementById('settingsEmail').value.trim();
    if (email && !VALIDATORS.email(email)) {
        showToast('Please enter a valid contact email', 'error');
        return;
    }
    const s = {
        storeName: document.getElementById('settingsStoreName').value.trim(),
        whatsapp,
        phone: document.getElementById('settingsPhone').value.trim(),
        email,
        address: document.getElementById('settingsAddress').value.trim()
    };
    localStorage.setItem('velorex_store_settings', JSON.stringify(s));
    showToast('Settings saved successfully', 'success');
}

async function updateAdminCredentials() {
    const currentPass = document.getElementById('adminCurrentPass').value;
    const newEmail = document.getElementById('adminNewEmail').value.trim();
    const newPass = document.getElementById('adminNewPass').value;
    const newPassConfirm = document.getElementById('adminNewPassConfirm').value;

    if (!VALIDATORS.required(currentPass)) {
        showToast('Enter your current password to confirm changes', 'error');
        return;
    }
    if (!newEmail && !newPass) {
        showToast('Enter a new username or password', 'error');
        return;
    }
    if (newEmail && !VALIDATORS.maxLength(newEmail, 120)) {
        showToast('New username is too long (max 120 chars)', 'error');
        return;
    }
    if (newPass && newPass !== newPassConfirm) {
        showToast('New password and confirmation do not match', 'error');
        return;
    }
    if (newPass && !VALIDATORS.minLength(newPass, 6)) {
        showToast('New password must be at least 6 characters', 'error');
        return;
    }
    if (newPass && !VALIDATORS.maxLength(newPass, 200)) {
        showToast('Password is too long', 'error');
        return;
    }

    const payload = { current_password: currentPass };
    if (newEmail) payload.new_email = newEmail;
    if (newPass) payload.new_password = newPass;

    const res = await apiCall('api/update-admin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok && res.data && res.data.success) {
        document.getElementById('adminCurrentPass').value = '';
        document.getElementById('adminNewEmail').value = '';
        document.getElementById('adminNewPass').value = '';
        document.getElementById('adminNewPassConfirm').value = '';
        if (newEmail && res.data.admin) {
            localStorage.setItem('velorex_admin_email', res.data.admin.email);
        }
        showToast('Admin account updated. Use the new credentials next time you log in.', 'success');
    } else {
        showToast(explainApiFailure(res, 'Unable to update admin account'), 'error');
    }
}

/* ──────────────────────────────────────────────────────────────
   PRODUCTS
   ────────────────────────────────────────────────────────────── */

async function saveProduct(e) {
    e.preventDefault();
    const editId = document.getElementById('editingId').value;

    const name = document.getElementById('pName').value.trim();
    const price = document.getElementById('pPrice').value;
    const stock = document.getElementById('pStock').value;
    const category = document.getElementById('pCat').value;

    if (!VALIDATORS.required(name)) {
        showToast('Product title is required', 'error');
        return;
    }
    if (!VALIDATORS.maxLength(name, 200)) {
        showToast('Product title is too long (max 200 chars)', 'error');
        return;
    }
    if (!VALIDATORS.positiveNumber(price) || parseFloat(price) <= 0) {
        showToast('Price must be a positive number', 'error');
        return;
    }
    if (!VALIDATORS.positiveNumber(stock)) {
        showToast('Stock must be a non-negative number', 'error');
        return;
    }
    if (!VALIDATORS.required(category)) {
        showToast('Please pick a category', 'error');
        return;
    }

    if (currentImages.length === 0) {
        showToast('Please add at least one product image', 'error');
        return;
    }

    const hasOfflinePreview = currentImages.some(u => typeof u === 'string' && u.startsWith('data:'));
    if (hasOfflinePreview) {
        showToast('One or more images are offline previews. Run the site with PHP and re-upload, or paste real image URLs.', 'error');
        return;
    }

    const cover = currentImages[0];
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('price', price);
    formData.append('stock', stock);
    formData.append('image_url', cover);
    formData.append('images', JSON.stringify(currentImages));
    formData.append('description', document.getElementById('pDesc').value.trim());
    formData.append('featured', document.getElementById('pFeatured').checked ? '1' : '0');

    const endpoint = editId ? 'api/update-product.php' : 'api/add-product.php';
    if (editId) formData.append('id', editId);

    let response;
    try {
        response = await fetch(endpoint, { method: 'POST', body: formData, credentials: 'include' });
    } catch (networkErr) {
        showToast('Server unreachable — products can only be saved when the site is running with PHP.', 'error');
        return;
    }

    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}

    if (response.ok && json && json.success) {
        showToast(editId ? 'Product updated successfully' : 'Product listed successfully', 'success');
        hideModal();
        await loadData();
        render();
        return;
    }
    if (json && json.error) {
        showToast(json.error, 'error');
    } else {
        showToast('Save failed (status ' + response.status + ') — check that api/add-product.php is reachable via PHP.', 'error');
    }
}

async function loadCategories() {
    const custom = JSON.parse(localStorage.getItem('velorex_store_categories')) || [];
    categories = [...DEFAULT_CATEGORIES, ...custom.filter(c => !c.isDefault)];
    populateCategoryDropdowns();
}

function populateCategoryDropdowns() {
    const pCat = document.getElementById('pCat');
    const catFilter = document.getElementById('categoryFilter');
    if (pCat) {
        pCat.replaceChildren(...categories.map(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            return opt;
        }));
    }
    if (catFilter) {
        const opts = [Object.assign(document.createElement('option'), { value: 'all', textContent: 'All Categories' })];
        categories.forEach(c => {
            const o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.name;
            opts.push(o);
        });
        catFilter.replaceChildren(...opts);
    }
}

function getCatName(id) {
    const c = categories.find(x => x.id === id);
    return c ? c.name : id;
}

async function saveCategory() {
    const nameEl  = document.getElementById('newCatName');
    const iconEl  = document.getElementById('newCatIcon');
    const imageEl = document.getElementById('newCatImage');
    const name  = (nameEl.value  || '').trim();
    const icon  = (iconEl  ? iconEl.value  : '').trim();
    const image = (imageEl ? imageEl.value : '').trim();
    if (!VALIDATORS.required(name)) { showToast('Enter a category name', 'error'); return; }
    if (!VALIDATORS.maxLength(name, 60)) { showToast('Category name too long (max 60)', 'error'); return; }
    if (image && !VALIDATORS.url(image) && !/^[\w\-./]+$/.test(image)) {
        showToast('Image must be a valid URL or local file name', 'error');
        return;
    }
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!id) { showToast('Category name must contain letters or numbers', 'error'); return; }
    if (categories.find(c => c.id === id)) { showToast('Category already exists', 'error'); return; }
    const custom = JSON.parse(localStorage.getItem('velorex_store_categories')) || [];
    const entry = { id, name, isDefault: false };
    if (icon)  entry.icon  = icon;
    if (image) entry.image = image;
    custom.push(entry);
    localStorage.setItem('velorex_store_categories', JSON.stringify(custom));
    nameEl.value = '';
    if (iconEl)  iconEl.value  = '';
    if (imageEl) imageEl.value = '';
    await loadCategories();
    renderCategories();
    showToast(`Category "${name}" added`, 'success');
}

function deleteCategory(id) {
    if (!confirm('Remove this category? Products using it will keep their category ID.')) return;
    let custom = JSON.parse(localStorage.getItem('velorex_store_categories')) || [];
    custom = custom.filter(c => c.id !== id);
    localStorage.setItem('velorex_store_categories', JSON.stringify(custom));
    loadCategories();
    renderCategories();
    showToast('Category removed', 'info');
}

function renderCategories() {
    const list = document.getElementById('categoriesList');
    if (!list) return;
    list.innerHTML = categories.map(c => {
        const safeImg = safeUrl(c.image);
        const thumb = safeImg
            ? `<img src="${escapeAttr(safeImg)}" alt="" style="width:38px; height:38px; border-radius:8px; object-fit:cover; flex:none;">`
            : `<div style="width:38px; height:38px; border-radius:8px; background:var(--surface2); display:flex; align-items:center; justify-content:center; color:var(--text-muted); flex:none;"><i class="${escapeAttr(c.icon || 'fas fa-tag')}"></i></div>`;
        return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.9rem 1.1rem; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.85rem;">
                ${thumb}
                <div>
                    <span style="font-weight:600;">${escapeHtml(c.name)}</span>
                    <span style="font-size:0.73rem; color:var(--text-muted); margin-left:0.6rem;">/ ${escapeHtml(c.id)}</span>
                    ${c.isDefault ? '<span style="font-size:0.68rem; background:rgba(255,107,53,0.12); color:var(--secondary); padding:2px 8px; border-radius:10px; margin-left:0.5rem; font-weight:600;">Default</span>' : ''}
                </div>
            </div>
            ${c.isDefault ? '' : `<button type="button" data-action="delete-category" data-id="${escapeAttr(c.id)}" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:0.82rem; padding:0.3rem 0.6rem;"><i class="fas fa-trash"></i></button>`}
        </div>`;
    }).join('');
}

/* ──────────────────────────────────────────────────────────────
   FEATURED
   ────────────────────────────────────────────────────────────── */

async function toggleFeatured(id) {
    const p = products.find(x => x.id.toString() === id.toString());
    if (!p) return;
    const newFeatured = p.featured ? 0 : 1;
    const formData = new FormData();
    formData.append('id', p.id);
    formData.append('featured', newFeatured);

    const res = await apiCall('api/update-product.php', { method: 'POST', body: formData });
    if (res.ok && res.data && res.data.success) {
        showToast(newFeatured ? 'Added to Featured Creations' : 'Removed from Featured Creations', 'success');
        await loadData();
        renderFeatured();
        render();
    } else {
        showToast(explainApiFailure(res, 'Unable to update featured status'), 'error');
    }
}

function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    if (products.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem; grid-column:1/-1;">No products yet. Add some from the Inventory tab first.</p>';
        return;
    }
    grid.innerHTML = products.map(p => {
        const img = escapeAttr(safeUrl(p.img));
        return `
            <div style="background:var(--surface); border:2px solid ${p.featured ? 'var(--secondary)' : 'var(--border)'}; border-radius:16px; overflow:hidden; transition:all 0.2s;">
                <div style="position:relative;">
                    <img src="${img}" data-fallback="https://placehold.co/200x160?text=No+Image" style="width:100%; height:150px; object-fit:cover; display:block;">
                    <button type="button" data-action="toggle-featured" data-id="${escapeAttr(p.id)}" title="${escapeAttr(p.featured ? 'Remove from Featured' : 'Add to Featured')}"
                        style="position:absolute; top:8px; right:8px; width:34px; height:34px; border-radius:50%; border:none; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; transition:all 0.2s;
                        background:${p.featured ? 'var(--secondary)' : 'rgba(0,0,0,0.55)'}; color:${p.featured ? '#fff' : '#aaa'};">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                <div style="padding:0.85rem;">
                    <div style="font-weight:600; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:0.2rem;">${escapeHtml(p.name)}</div>
                    <div style="color:var(--text-muted); font-size:0.75rem; margin-bottom:0.4rem;">${escapeHtml(getCatName(p.cat))}</div>
                    <div style="color:var(--accent); font-weight:700; font-size:0.9rem;">₹${p.price.toLocaleString()}</div>
                    ${p.featured ? '<div style="margin-top:0.4rem; font-size:0.72rem; color:var(--secondary); font-weight:700;"><i class="fas fa-star"></i> Featured</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

/* ──────────────────────────────────────────────────────────────
   INVENTORY render
   ────────────────────────────────────────────────────────────── */

function render() {
    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statOrders').textContent = allOrders.filter(o => o.status === 'Pending').length;
    const revenue = allOrders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('statRevenue').textContent = `₹${revenue.toLocaleString()}`;

    const invQuery = document.getElementById('inventorySearch').value.toLowerCase();
    const catFilter = document.getElementById('categoryFilter').value;

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(invQuery) || p.cat.toLowerCase().includes(invQuery);
        const matchesCat = catFilter === 'all' || p.cat === catFilter;
        return matchesSearch && matchesCat;
    });

    const pList = document.getElementById('productList');
    pList.innerHTML = filteredProducts.map(p => {
        const img = escapeAttr(safeUrl(p.img));
        return `
            <tr>
                <td>
                    <div class="prod-cell">
                        <img src="${img}" class="prod-img" alt="">
                        <div style="font-weight: 600;">${escapeHtml(p.name)}</div>
                    </div>
                </td>
                <td><span style="color: var(--text-muted); text-transform: capitalize;">${escapeHtml((p.cat || '').replace('_', ' '))}</span></td>
                <td>₹${p.price.toLocaleString()}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" min="0" value="${escapeAttr(p.stock || 0)}" data-action="update-stock" data-id="${escapeAttr(p.id)}" style="width: 60px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: #fff; padding: 4px; border-radius: 4px;">
                    </div>
                </td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="btn btn-secondary" data-action="edit-product" data-id="${escapeAttr(p.id)}" style="padding: 4px 10px; font-size: 0.75rem;"><i class="fas fa-edit"></i> Edit</button>
                        <button type="button" class="btn btn-secondary" data-action="delete-product" data-id="${escapeAttr(p.id)}" style="color: #ef4444; border-color: #ef4444; padding: 4px 10px; font-size: 0.75rem;">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderOrders();
}

function switchTab(tab, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(tab + '-tab').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    const titles = { inventory: 'Inventory Management', orders: 'Orders Tracking', customers: 'Customer Management', featured: 'Featured Creations', categories: 'Category Management', analytics: 'Sales Insights', settings: 'Store Settings' };
    document.getElementById('tabTitle').textContent = titles[tab] || tab;
    if (tab === 'orders') { currentOrderFilter = 'all'; document.querySelectorAll('.order-chip').forEach((c,i) => c.classList.toggle('active', i===0)); renderOrders(); }
    if (tab === 'customers') loadCustomers();
    if (tab === 'featured') { loadData(); renderFeatured(); }
    if (tab === 'categories') renderCategories();
}

function showModal(edit = false) {
    if (!edit) {
        document.getElementById('productForm').reset();
        document.getElementById('editingId').value = '';
        document.getElementById('modalTitle').textContent = 'Add Premium Item';
        document.getElementById('submitBtn').textContent = 'Create Listing';
        currentImages = [];
        renderImagesGallery();
    }
    document.getElementById('productModal').style.display = 'flex';
}
function hideModal() { document.getElementById('productModal').style.display = 'none'; }

/* ──────────────────────────────────────────────────────────────
   BULK UPLOAD
   ────────────────────────────────────────────────────────────── */

let bulkRows = [];

function showBulkModal() {
    resetBulkModal();
    document.getElementById('bulkModal').style.display = 'flex';
}
function hideBulkModal() {
    document.getElementById('bulkModal').style.display = 'none';
}
function resetBulkModal() {
    bulkRows = [];
    document.getElementById('bulkFileInput').value = '';
    document.getElementById('bulkStep1').style.display = '';
    document.getElementById('bulkStep2').style.display = 'none';
    document.getElementById('bulkSubmitBtn').style.display = 'none';
    document.getElementById('bulkPreview').innerHTML = '';
    document.getElementById('bulkSummary').textContent = '';
}

function downloadBulkTemplate() {
    const sampleCat = (categories[0] && categories[0].id) || 'wood';
    const header = 'name,category,price,stock,image_url,description,featured';
    const example = [
        `"Walnut Serving Board",${sampleCat},1499,10,https://example.com/board.jpg,"Hand-finished walnut, food-safe oil",1`,
        `"Resin Coaster Set",resin,799,25,https://example.com/coasters.jpg,"Set of 4 ocean-blue coasters",0`
    ].join('\n');
    const csv = header + '\n' + example + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'velorex_bulk_upload_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.some(c => c !== '')) rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
    }
    if (field !== '' || row.length) {
        row.push(field);
        if (row.some(c => c !== '')) rows.push(row);
    }
    return rows;
}

function handleBulkFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('CSV file too large (max 5MB)', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const rows = parseCsv(String(reader.result || ''));
            if (rows.length < 2) {
                showToast('CSV must have a header row and at least one product row', 'error');
                return;
            }
            const header = rows[0].map(h => h.trim().toLowerCase());
            const required = ['name', 'category', 'price'];
            const missing = required.filter(c => !header.includes(c));
            if (missing.length) {
                showToast('CSV is missing required column(s): ' + missing.join(', '), 'error');
                return;
            }
            const idx = name => header.indexOf(name);
            const validCatIds = new Set(categories.map(c => c.id));

            bulkRows = rows.slice(1).map(r => {
                const get = c => (idx(c) >= 0 ? (r[idx(c)] || '').trim() : '');
                const name        = get('name');
                const category    = get('category');
                const priceRaw    = get('price');
                const stockRaw    = get('stock');
                const image_url   = get('image_url');
                const description = get('description');
                const featRaw     = get('featured').toLowerCase();
                const price = parseFloat(priceRaw);
                const stock = stockRaw === '' ? 10 : parseInt(stockRaw, 10);
                const featured = ['1', 'true', 'yes', 'y'].includes(featRaw) ? 1 : 0;
                const errors = [];
                if (!name) errors.push('name is empty');
                if (name.length > 200) errors.push('name too long');
                if (!category) errors.push('category is empty');
                else if (!validCatIds.has(category)) errors.push(`unknown category "${category}"`);
                if (!priceRaw || isNaN(price) || price <= 0) errors.push('price must be > 0');
                if (stockRaw !== '' && (isNaN(stock) || stock < 0)) errors.push('stock must be a non-negative number');
                if (image_url && !VALIDATORS.url(image_url)) errors.push('image_url must be http(s)');
                return {
                    data: { name, category, price, stock, image_url, description, featured },
                    valid: errors.length === 0,
                    errors,
                    status: 'pending'
                };
            });

            renderBulkPreview();
            document.getElementById('bulkStep1').style.display = 'none';
            document.getElementById('bulkStep2').style.display = '';
            const validCount = bulkRows.filter(r => r.valid).length;
            document.getElementById('bulkSubmitBtn').style.display = validCount > 0 ? '' : 'none';
            document.getElementById('bulkSubmitBtn').textContent = `Upload ${validCount} product${validCount === 1 ? '' : 's'}`;
        } catch (err) {
            showToast('Could not parse CSV: ' + err.message, 'error');
        }
    };
    reader.onerror = () => showToast('Could not read the selected file', 'error');
    reader.readAsText(file);
}

function renderBulkPreview() {
    const tbody = document.getElementById('bulkPreview');
    const total = bulkRows.length;
    const ok    = bulkRows.filter(r => r.valid).length;
    const bad   = total - ok;
    const done  = bulkRows.filter(r => r.status === 'success').length;
    const fail  = bulkRows.filter(r => r.status === 'error').length;
    document.getElementById('bulkSummary').innerHTML =
        `${total} rows — <span style="color:var(--success);">${ok} ready</span>` +
        (bad ? `, <span style="color:var(--danger);">${bad} invalid</span>` : '') +
        (done ? `, <span style="color:var(--success);">${done} uploaded</span>` : '') +
        (fail ? `, <span style="color:var(--danger);">${fail} failed</span>` : '');
    tbody.innerHTML = bulkRows.map((r, i) => {
        let badge;
        if (r.status === 'success')    badge = '<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Uploaded</span>';
        else if (r.status === 'error') badge = `<span style="color:var(--danger);" title="${escapeAttr(r.errors[0] || 'failed')}"><i class="fas fa-times-circle"></i> ${escapeHtml(r.errors[0] || 'failed')}</span>`;
        else if (r.status === 'uploading') badge = '<span style="color:var(--accent);"><i class="fas fa-spinner fa-spin"></i> Uploading…</span>';
        else if (!r.valid)             badge = `<span style="color:var(--danger);"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(r.errors.join('; '))}</span>`;
        else                           badge = '<span style="color:var(--text-muted);">Ready</span>';
        const rowBg = !r.valid ? 'background:rgba(239,68,68,0.06);' : (r.status === 'success' ? 'background:rgba(16,185,129,0.06);' : '');
        return `
            <tr style="border-top:1px solid var(--border); ${rowBg}">
                <td style="padding:0.55rem; color:var(--text-muted);">${i + 1}</td>
                <td style="padding:0.55rem;">${escapeHtml((r.data.name || '').slice(0, 60)) || '<em style="color:var(--text-muted);">(empty)</em>'}</td>
                <td style="padding:0.55rem;">${escapeHtml(r.data.category || '—')}</td>
                <td style="padding:0.55rem;">₹${isFinite(r.data.price) ? r.data.price : '—'}</td>
                <td style="padding:0.55rem;">${escapeHtml(String(r.data.stock))}</td>
                <td style="padding:0.55rem;">${badge}</td>
            </tr>`;
    }).join('');
}

async function submitBulkUpload() {
    const ready = bulkRows.filter(r => r.valid && r.status !== 'success');
    if (!ready.length) { showToast('Nothing to upload', 'info'); return; }
    const btn = document.getElementById('bulkSubmitBtn');
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;

    let success = 0, fail = 0;
    for (const r of ready) {
        r.status = 'uploading';
        renderBulkPreview();
        btn.textContent = `Uploading… ${success + fail + 1} / ${ready.length}`;

        const fd = new FormData();
        fd.append('name', r.data.name);
        fd.append('category', r.data.category);
        fd.append('price', r.data.price);
        fd.append('stock', r.data.stock);
        fd.append('image_url', r.data.image_url || '');
        fd.append('images', JSON.stringify(r.data.image_url ? [r.data.image_url] : []));
        fd.append('description', r.data.description || '');
        fd.append('featured', r.data.featured ? '1' : '0');

        const res = await apiCall('api/add-product.php', { method: 'POST', body: fd });
        if (res.ok && res.data && res.data.success) {
            r.status = 'success';
            success++;
        } else {
            r.status = 'error';
            r.errors = [explainApiFailure(res, 'Upload failed')];
            fail++;
        }
    }

    renderBulkPreview();
    btn.disabled = false;
    btn.textContent = fail ? `Retry ${fail} failed` : 'Done';
    if (fail === 0) btn.style.display = 'none';
    showToast(`Bulk upload complete — ${success} added, ${fail} failed`, fail ? 'error' : 'success');
    await loadData();
    render();
}

/* ──────────────────────────────────────────────────────────────
   CUSTOMERS
   ────────────────────────────────────────────────────────────── */

let customers = [];

async function loadCustomers() {
    const tbody = document.getElementById('customerList');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading customers…</td></tr>';
    const res = await apiCall('api/get-customers.php');
    if (!res.ok || !res.data || !Array.isArray(res.data.customers)) {
        customers = [];
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--danger);">${escapeHtml(explainApiFailure(res, 'Failed to load customers'))}</td></tr>`;
        return;
    }
    customers = res.data.customers;
    renderCustomers();
}

function renderCustomers() {
    const tbody = document.getElementById('customerList');
    if (!tbody) return;
    const q = (document.getElementById('customerSearch').value || '').trim().toLowerCase();
    const filtered = !q ? customers : customers.filter(c =>
        (c.name  || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">${customers.length === 0 ? 'No customers yet.' : 'No customers match this search.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(c => `
        <tr>
            <td>
                <div style="font-weight:600;">${escapeHtml(c.name || 'Guest')}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">#${escapeHtml(String(c.id))}</div>
            </td>
            <td>${c.email ? escapeHtml(c.email) : '<span style="color:var(--text-muted);">—</span>'}</td>
            <td>${c.phone ? escapeHtml(c.phone) : '<span style="color:var(--text-muted);">—</span>'}</td>
            <td>${c.has_account
                ? '<span style="font-size:0.72rem; background:rgba(0,212,170,0.12); color:var(--success); padding:2px 8px; border-radius:10px; font-weight:600;">Registered</span>'
                : '<span style="font-size:0.72rem; background:rgba(152,144,176,0.12); color:var(--text-muted); padding:2px 8px; border-radius:10px; font-weight:600;">Guest</span>'}</td>
            <td style="text-align:right;">${escapeHtml(String(c.orders_count || 0))}</td>
            <td style="text-align:right;">₹${Number(c.total_spent || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
            <td style="white-space:nowrap;">${escapeHtml(formatDate(c.created_at))}</td>
            <td style="text-align:center; white-space:nowrap;">
                <button type="button" class="btn btn-secondary" data-action="open-customer" data-id="${escapeAttr(c.id)}" style="padding:0.35rem 0.7rem; font-size:0.78rem;">
                    <i class="fas fa-eye"></i> View / Edit
                </button>
            </td>
        </tr>
    `).join('');
}

function formatDate(s) {
    if (!s) return '—';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function openCustomerModal(id) {
    const modal = document.getElementById('customerModal');
    document.getElementById('custEditingId').value = id;
    document.getElementById('custName').value = '';
    document.getElementById('custEmail').value = '';
    document.getElementById('custPhone').value = '';
    document.getElementById('custNewPassword').value = '';
    document.getElementById('custAddresses').innerHTML = '<p style="color:var(--text-muted);">Loading…</p>';
    document.getElementById('custOrders').innerHTML = '<p style="color:var(--text-muted);">Loading…</p>';
    document.getElementById('customerModalTitle').textContent = 'Customer';
    document.getElementById('customerModalSubtitle').textContent = '';
    modal.style.display = 'flex';

    const res = await apiCall('api/get-customer.php?id=' + encodeURIComponent(id));
    if (!res.ok || !res.data || !res.data.customer) {
        showToast(explainApiFailure(res, 'Failed to load customer'), 'error');
        hideCustomerModal();
        return;
    }
    const c = res.data.customer;
    document.getElementById('custName').value  = c.name  || '';
    document.getElementById('custEmail').value = c.email || '';
    document.getElementById('custPhone').value = c.phone || '';
    document.getElementById('customerModalTitle').textContent = c.name || 'Customer';
    document.getElementById('customerModalSubtitle').innerHTML =
        `#${escapeHtml(String(c.id))} · ${c.has_account ? 'Registered account' : 'Guest record'} · Joined ${escapeHtml(formatDate(c.created_at))} · ` +
        `<strong style="color:var(--text);">${res.data.orders.length} order${res.data.orders.length === 1 ? '' : 's'}</strong> · ` +
        `Total spent <strong style="color:var(--text);">₹${Number(res.data.total_spent || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>`;

    const addrEl = document.getElementById('custAddresses');
    if (!res.data.addresses.length) {
        addrEl.innerHTML = '<p style="color:var(--text-muted);">No saved addresses.</p>';
    } else {
        addrEl.innerHTML = res.data.addresses.map(a => {
            const parts = [a.full_name, a.street, a.line2, a.landmark, [a.city, a.state, a.zip].filter(Boolean).join(' '), a.country].filter(Boolean);
            return `
                <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:0.75rem 0.9rem; margin-bottom:0.5rem;">
                    <div style="font-weight:600; display:flex; align-items:center; gap:0.5rem;">${escapeHtml(a.title || 'Address')}${a.is_default ? '<span style="font-size:0.66rem; background:rgba(255,107,53,0.12); color:var(--secondary); padding:2px 6px; border-radius:8px;">Default</span>' : ''}</div>
                    ${a.phone ? `<div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(a.phone)}</div>` : ''}
                    <div style="font-size:0.82rem; margin-top:0.25rem;">${parts.map(escapeHtml).join('<br>')}</div>
                </div>`;
        }).join('');
    }

    const ordEl = document.getElementById('custOrders');
    if (!res.data.orders.length) {
        ordEl.innerHTML = '<p style="color:var(--text-muted);">No orders yet.</p>';
    } else {
        ordEl.innerHTML = res.data.orders.map(o => `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:0.65rem 0.9rem; margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                <div>
                    <div style="font-weight:600;">${escapeHtml(o.order_code)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(formatDate(o.created_at))} · ${escapeHtml(o.status)}</div>
                </div>
                <div style="font-weight:600;">₹${Number(o.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
            </div>`).join('');
    }
}

function hideCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
}

async function saveCustomer() {
    const id = parseInt(document.getElementById('custEditingId').value, 10);
    if (!id) return;
    const name = document.getElementById('custName').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    if (email && !VALIDATORS.email(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    if (phone && !VALIDATORS.phone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    const payload = { id, name, email, phone };
    const newPassword = document.getElementById('custNewPassword').value;
    if (newPassword) {
        if (!VALIDATORS.minLength(newPassword, 6)) {
            showToast('New password must be at least 6 characters', 'error');
            return;
        }
        payload.new_password = newPassword;
    }

    const btn = document.getElementById('custSaveBtn');
    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const res = await apiCall('api/admin-update-customer.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    btn.disabled = false;
    btn.innerHTML = originalLabel;

    if (res.ok && res.data && res.data.success) {
        showToast(res.data.password_reset ? 'Customer updated · password reset' : 'Customer updated', 'success');
        document.getElementById('custNewPassword').value = '';
        await loadCustomers();
        hideCustomerModal();
        return;
    }
    showToast(explainApiFailure(res, 'Failed to update customer'), 'error');
}

async function deleteCustomer() {
    const id = parseInt(document.getElementById('custEditingId').value, 10);
    if (!id) return;
    const name = document.getElementById('custName').value.trim() || ('customer #' + id);
    if (!confirm(`Permanently delete ${name}?\n\nTheir saved addresses will be removed.\nPast orders will stay (marked as Guest).`)) return;

    const res = await apiCall('api/admin-delete-customer.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (res.ok && res.data && res.data.success) {
        showToast('Customer deleted', 'success');
        hideCustomerModal();
        await loadCustomers();
        return;
    }
    showToast(explainApiFailure(res, 'Failed to delete customer'), 'error');
}

function editProduct(id) {
    const p = products.find(x => x.id.toString() === id.toString());
    if (!p) return;

    document.getElementById('editingId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pCat').value = p.cat;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pStock').value = p.stock || 0;
    document.getElementById('pImg').value = p.img;
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pFeatured').checked = p.featured || false;

    currentImages = Array.isArray(p.images) && p.images.length ? [...p.images] : (p.img ? [p.img] : []);
    renderImagesGallery();

    document.getElementById('modalTitle').textContent = 'Edit Premium Item';
    document.getElementById('submitBtn').textContent = 'Update Changes';
    showModal(true);
}

function renderImagesGallery() {
    const g = document.getElementById('pImagesGallery');
    if (!g) return;
    const coverHidden = document.getElementById('pImg');
    if (coverHidden) coverHidden.value = currentImages[0] || '';
    if (currentImages.length === 0) {
        g.innerHTML = '<div style="color:var(--text-muted); font-size:0.82rem; padding:0.4rem 0.6rem;">No images yet — paste a URL below or click Upload.</div>';
        return;
    }
    g.innerHTML = currentImages.map((url, i) => {
        const safe = escapeAttr(safeUrl(url));
        return `
            <div style="position:relative; width:96px; height:96px; border-radius:8px; overflow:hidden; border:2px solid ${i === 0 ? 'var(--secondary)' : 'var(--border)'}; background:#000;">
                <img src="${safe}" data-broken-style="1" style="width:100%; height:100%; object-fit:cover; display:block;" alt="">
                ${i === 0 ? '<div style="position:absolute; top:2px; left:2px; background:var(--secondary); color:#fff; font-size:0.62rem; padding:2px 6px; border-radius:4px; font-weight:700; letter-spacing:0.5px;">COVER</div>' : ''}
                <button type="button" data-action="remove-image" data-index="${i}" title="Remove" style="position:absolute; top:2px; right:2px; width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.75); color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
                    <i class="fas fa-times"></i>
                </button>
                ${i > 0 ? `<button type="button" data-action="make-cover" data-index="${i}" title="Make cover" style="position:absolute; bottom:2px; left:2px; background:rgba(255,107,53,0.9); color:#fff; border:none; padding:3px 7px; font-size:0.7rem; border-radius:4px; cursor:pointer; font-weight:700;">★</button>` : ''}
            </div>
        `;
    }).join('');
}

function removeImage(i) {
    currentImages.splice(i, 1);
    renderImagesGallery();
}

function makeImageCover(i) {
    if (i <= 0 || i >= currentImages.length) return;
    const [picked] = currentImages.splice(i, 1);
    currentImages.unshift(picked);
    renderImagesGallery();
}

function addImageFromUrl() {
    const input = document.getElementById('pImgUrlInput');
    const url = (input.value || '').trim();
    if (!url) {
        showToast('Paste an image URL first', 'error');
        return;
    }
    if (!VALIDATORS.url(url)) {
        showToast('Image URL must start with http:// or https://', 'error');
        return;
    }
    currentImages.push(url);
    input.value = '';
    renderImagesGallery();
}

async function updateStock(id, val) {
    const stockValue = parseInt(val, 10);
    if (Number.isNaN(stockValue) || stockValue < 0) {
        showToast('Stock must be a non-negative number', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('id', id);
    formData.append('stock', stockValue);

    const res = await apiCall('api/update-product.php', { method: 'POST', body: formData });
    if (res.ok && res.data && res.data.success) {
        showToast('Stock updated', 'success');
        await loadData();
        render();
    } else {
        showToast(explainApiFailure(res, 'Unable to update stock'), 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm("Remove this listing?")) return;
    const formData = new FormData();
    formData.append('id', id);

    const res = await apiCall('api/delete-product.php', { method: 'POST', body: formData });
    if (res.ok && res.data && res.data.success) {
        showToast('Product removed', 'success');
        await loadData();
        render();
    } else {
        showToast(explainApiFailure(res, 'Could not delete product'), 'error');
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(file.name + ' could not be read'));
        reader.readAsDataURL(file);
    });
}

async function offlinePreviewFallback(files, reasonToast) {
    try {
        const dataUrls = await Promise.all(files.map(readFileAsDataURL));
        currentImages.push(...dataUrls);
        renderImagesGallery();
        if (reasonToast) showToast(reasonToast, 'info');
    } catch (e) {
        showToast('Could not read files: ' + e.message, 'error');
    }
}

async function uploadProductImages(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const tooBig = files.find(f => f.size > 8 * 1024 * 1024);
    if (tooBig) {
        showToast(`"${tooBig.name}" exceeds the 8MB image limit`, 'error');
        return;
    }
    const wrongType = files.find(f => !/^image\//.test(f.type));
    if (wrongType) {
        showToast(`"${wrongType.name}" is not an image`, 'error');
        return;
    }

    const formData = new FormData();
    files.forEach(f => formData.append('image[]', f));

    let response;
    try {
        response = await fetch('api/upload-image.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
    } catch (networkErr) {
        await offlinePreviewFallback(files, 'Server unreachable — images stored as offline previews. Real uploads will work once you deploy with PHP.');
        return;
    }

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}

    if (response.ok && data && data.success && Array.isArray(data.image_urls) && data.image_urls.length) {
        currentImages.push(...data.image_urls);
        renderImagesGallery();
        showToast(`${data.image_urls.length} image(s) uploaded`, 'success');
        if (Array.isArray(data.skipped) && data.skipped.length) {
            showToast('Skipped: ' + data.skipped.join(', '), 'info');
        }
        return;
    }

    if (response.status === 401) {
        showToast('Not logged in to the server. Log in with owner / owner123 against api/login.php to upload files.', 'error');
        return;
    }

    if (data && data.error) {
        showToast('Upload failed: ' + data.error, 'error');
        return;
    }

    const hint = response.status === 404
        ? 'No PHP server at api/upload-image.php — offline preview only.'
        : 'Server returned an unexpected response (status ' + response.status + ') — offline preview only.';
    await offlinePreviewFallback(files, hint);
}

/* ──────────────────────────────────────────────────────────────
   ORDERS
   ────────────────────────────────────────────────────────────── */

let currentOrderFilter = 'all';
let expandedOrderId = null;

function setOrderFilter(filter, el) {
    currentOrderFilter = filter;
    document.querySelectorAll('.order-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderOrders();
}

function renderOrders() {
    const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const chipAll = document.getElementById('chip-all');
    if (chipAll) chipAll.textContent = allOrders.length;
    statuses.forEach(s => {
        const el = document.getElementById('chip-' + s.toLowerCase());
        if (el) el.textContent = allOrders.filter(o => o.status === s).length;
    });

    const orderSearchEl = document.getElementById('orderSearch');
    const query = (orderSearchEl && orderSearchEl.value ? orderSearchEl.value : '').toLowerCase();
    let filtered = allOrders.filter(o => {
        const matchFilter = currentOrderFilter === 'all' || o.status === currentOrderFilter;
        const matchQuery = !query ||
            o.id.toString().toLowerCase().includes(query) ||
            (o.userName || '').toLowerCase().includes(query) ||
            (o.userEmail || '').toLowerCase().includes(query) ||
            o.status.toLowerCase().includes(query);
        return matchFilter && matchQuery;
    });

    filtered = filtered.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    const oList = document.getElementById('orderList');
    if (!oList) return;
    if (filtered.length === 0) {
        oList.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:2rem; margin-bottom:1rem; display:block; opacity:0.3;"></i>No orders found.</td></tr>`;
        return;
    }

    oList.innerHTML = filtered.map(o => {
        const itemsSummary = (o.items || []).slice(0, 2).map(i => `${parseInt(i.qty, 10) || 0}× ${escapeHtml(i.name)}`).join(', ') + ((o.items || []).length > 2 ? ` +${o.items.length - 2} more` : '');
        const isExpanded = expandedOrderId === o.id.toString();
        const expandHtml = isExpanded ? buildExpandRow(o) : '';
        const statusKey = (o.status || 'pending').toLowerCase();
        return `
            <tr data-action="expand-order" data-id="${escapeAttr(o.id)}" style="cursor:pointer;">
                <td style="text-align:center; color:var(--text-muted);">
                    <i class="fas fa-chevron-${isExpanded ? 'up' : 'down'}" style="font-size:0.75rem; transition:transform 0.2s;"></i>
                </td>
                <td style="font-weight:700; color:var(--secondary); white-space:nowrap;">${escapeHtml(String(o.id))}</td>
                <td style="white-space:nowrap; font-size:0.85rem;">${escapeHtml(o.date)}</td>
                <td>
                    <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(o.userName || 'Guest')}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(o.userEmail || '')}</div>
                </td>
                <td style="font-size:0.82rem; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${itemsSummary || '—'}</td>
                <td style="font-weight:700;">₹${o.total.toLocaleString()}</td>
                <td data-stop-propagation="1">
                    <select data-action="order-status" data-id="${escapeAttr(o.id)}"
                        class="status-badge status-${escapeAttr(statusKey)}"
                        style="background:none; border:1px solid currentColor; cursor:pointer; outline:none; border-radius:20px; padding:4px 10px; font-size:0.75rem; font-weight:600;">
                        <option value="Pending"    ${o.status==='Pending'    ? 'selected':''}>Pending</option>
                        <option value="Processing" ${o.status==='Processing' ? 'selected':''}>Processing</option>
                        <option value="Shipped"    ${o.status==='Shipped'    ? 'selected':''}>Shipped</option>
                        <option value="Delivered"  ${o.status==='Delivered'  ? 'selected':''}>Delivered</option>
                        <option value="Cancelled"  ${o.status==='Cancelled'  ? 'selected':''}>Cancelled</option>
                    </select>
                </td>
                <td data-stop-propagation="1" style="text-align:center;">
                    <button type="button" data-action="delete-order" data-id="${escapeAttr(o.id)}" title="Delete order"
                        style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.95rem; padding:0.35rem 0.55rem; border-radius:6px; transition:background 0.15s;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
            ${expandHtml}
        `;
    }).join('');
}

function buildExpandRow(o) {
    const items = (o.items || []).map(i =>
        `<div style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
            <span>${parseInt(i.qty, 10) || 0}× ${escapeHtml(i.name)}</span>
            <span style="color:var(--accent); font-weight:600;">₹${((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0)).toLocaleString()}</span>
        </div>`
    ).join('');

    const addr = o.address ? escapeHtml(`${o.address.street || ''}, ${o.address.city || ''} ${o.address.zip || ''}`.trim().replace(/^,\s*/, '')) : 'Not provided';

    const history = (o.statusHistory || []).slice().reverse().map(h => {
        const k = (h.status || '').toLowerCase();
        return `<div style="font-size:0.8rem; padding:0.3rem 0; border-bottom:1px solid rgba(255,255,255,0.04);">
            <span class="status-badge status-${escapeAttr(k)}" style="font-size:0.7rem;">${escapeHtml(h.status)}</span>
            <span style="color:var(--text-muted); margin-left:0.5rem;">${escapeHtml(h.timestamp)}</span>
            ${h.note ? `<div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">${escapeHtml(h.note)}</div>` : ''}
        </div>`;
    }).join('');

    return `
        <tr id="expand-${escapeAttr(o.id)}">
            <td colspan="8" style="padding:0 1rem 1rem 3rem; border-top:none;">
                <div class="expand-row-content">
                    <div class="expand-detail-grid">
                        <div>
                            <div class="expand-section-title"><i class="fas fa-box" style="margin-right:4px;"></i>Order Items</div>
                            ${items || '<p style="color:var(--text-muted); font-size:0.85rem;">No items</p>'}
                            <div style="margin-top:0.75rem; font-weight:700; font-size:0.9rem; text-align:right;">Total: ₹${o.total.toLocaleString()}</div>
                        </div>
                        <div>
                            <div class="expand-section-title"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>Shipping Details</div>
                            <div style="font-size:0.85rem; line-height:1.7;">
                                <div style="font-weight:600;">${escapeHtml(o.userName || 'Guest')}</div>
                                <div style="color:var(--text-muted);">${escapeHtml(o.userPhone || '')}</div>
                                <div style="color:var(--text-muted);">${escapeHtml(o.userEmail || '')}</div>
                                <div style="color:var(--text-muted); margin-top:0.3rem;">${addr}</div>
                            </div>
                            <div class="expand-section-title" style="margin-top:1rem;"><i class="fas fa-truck" style="margin-right:4px;"></i>Tracking Number</div>
                            <div class="tracking-input-row" data-stop-propagation="1">
                                <input type="text" id="track-${escapeAttr(o.id)}" class="form-control" value="${escapeAttr(o.trackingNumber || '')}" placeholder="e.g. DTDC123456789" style="margin-bottom:0; font-size:0.85rem;">
                                <button type="button" class="btn btn-secondary" data-action="save-tracking" data-id="${escapeAttr(o.id)}" style="white-space:nowrap; padding:0.4rem 0.8rem; font-size:0.8rem;"><i class="fas fa-save"></i></button>
                            </div>
                        </div>
                        <div data-stop-propagation="1">
                            <div class="expand-section-title"><i class="fas fa-history" style="margin-right:4px;"></i>Status History</div>
                            ${history || '<p style="color:var(--text-muted); font-size:0.82rem;">No history yet.</p>'}
                            <div class="expand-section-title" style="margin-top:1rem;"><i class="fas fa-sticky-note" style="margin-right:4px;"></i>Admin Note (visible to customer)</div>
                            <textarea id="note-${escapeAttr(o.id)}" class="form-control" style="min-height:70px; font-size:0.82rem; resize:vertical;" placeholder="e.g. Dispatched via DTDC, expect delivery in 3-5 days">${escapeHtml(o.adminNote || '')}</textarea>
                            <button type="button" class="btn btn-secondary" data-action="save-note" data-id="${escapeAttr(o.id)}" style="margin-top:0.5rem; font-size:0.8rem; padding:0.4rem 1rem;"><i class="fas fa-save"></i> Save Note</button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
}

function expandOrder(id) {
    expandedOrderId = expandedOrderId === id.toString() ? null : id.toString();
    renderOrders();
    if (expandedOrderId) {
        const el = document.getElementById('expand-' + expandedOrderId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

async function updateOrderStatus(id, status) {
    const res = await apiCall('api/update-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_code: id, status })
    });
    if (res.ok && res.data && res.data.success) {
        showToast(`Order ${id} → ${status}`, 'success');
        await loadData();
        render();
    } else {
        showToast(explainApiFailure(res, 'Unable to update order'), 'error');
    }
}

async function saveTrackingInfo(id) {
    const trackingEl = document.getElementById('track-' + id);
    if (!trackingEl) return;
    const trackingValue = trackingEl.value.trim();
    if (trackingValue.length > 100) {
        showToast('Tracking number is too long', 'error');
        return;
    }
    const res = await apiCall('api/update-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_code: id, tracking_number: trackingValue })
    });
    if (res.ok && res.data && res.data.success) {
        showToast('Tracking number saved', 'success');
        await loadData();
        renderOrders();
    } else {
        showToast(explainApiFailure(res, 'Unable to save tracking info'), 'error');
    }
}

function clearOrderFilters() {
    const searchEl = document.getElementById('orderSearch');
    if (searchEl) searchEl.value = '';
    currentOrderFilter = 'all';
    document.querySelectorAll('.order-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
    renderOrders();
}

async function deleteOrder(id) {
    if (!confirm(`Delete order ${id}? This cannot be undone.`)) return;
    const res = await apiCall('api/delete-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_code: id })
    });
    if (res.ok && res.data && res.data.success) {
        showToast(`Order ${id} deleted`, 'success');
        if (expandedOrderId === id.toString()) expandedOrderId = null;
        await loadData();
        render();
    } else {
        showToast(explainApiFailure(res, 'Unable to delete order'), 'error');
    }
}

async function saveAdminNote(id) {
    const noteEl = document.getElementById('note-' + id);
    if (!noteEl) return;
    const note = noteEl.value.trim();
    if (note.length > 1000) {
        showToast('Note is too long (max 1000 chars)', 'error');
        return;
    }
    const res = await apiCall('api/update-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_code: id, admin_note: note })
    });
    if (res.ok && res.data && res.data.success) {
        showToast('Note saved & customer notified', 'success');
        await loadData();
        renderOrders();
    } else {
        showToast(explainApiFailure(res, 'Unable to save note'), 'error');
    }
}

function exportData() {
    showToast('Export is not yet implemented in this build', 'info');
}

/* ──────────────────────────────────────────────────────────────
   TOAST
   ────────────────────────────────────────────────────────────── */

function showToast(msg, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = document.createElement('i');
    icon.className = 'fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle');
    icon.style.marginRight = '10px';
    toast.appendChild(icon);
    toast.appendChild(document.createTextNode(' ' + String(msg)));
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ──────────────────────────────────────────────────────────────
   EVENT DELEGATION (CSP-friendly wiring)
   ────────────────────────────────────────────────────────────── */

const ACTION_HANDLERS = {
    'admin-login':       () => checkAuth(),
    'logout':            (e, el) => { e && e.preventDefault && e.preventDefault(); logout(); },
    'toggle-theme':      () => toggleTheme(),
    'export':            () => exportData(),
    'show-bulk':         () => showBulkModal(),
    'show-add-product':  () => showModal(),
    'save-settings':     () => saveSettings(),
    'update-admin-cred': () => updateAdminCredentials(),
    'save-category':     () => saveCategory(),
    'download-bulk-tpl': () => downloadBulkTemplate(),
    'pick-bulk-file':    () => document.getElementById('bulkFileInput').click(),
    'reset-bulk':        () => resetBulkModal(),
    'hide-bulk':         () => hideBulkModal(),
    'submit-bulk':       () => submitBulkUpload(),
    'hide-modal':        () => hideModal(),
    'pick-img-file':     () => document.getElementById('pImgFile').click(),
    'add-image-url':     () => addImageFromUrl(),
    'hide-customer':     () => hideCustomerModal(),
    'save-customer':     () => saveCustomer(),
    'delete-customer':   () => deleteCustomer(),
    'load-customers':    () => loadCustomers(),
    'render-orders':     () => renderOrders(),
    'clear-order-filters': () => clearOrderFilters(),
    'delete-category':   (e, el) => deleteCategory(el.dataset.id),
    'toggle-featured':   (e, el) => toggleFeatured(el.dataset.id),
    'edit-product':      (e, el) => editProduct(el.dataset.id),
    'delete-product':    (e, el) => deleteProduct(el.dataset.id),
    'remove-image':      (e, el) => removeImage(parseInt(el.dataset.index, 10)),
    'make-cover':        (e, el) => makeImageCover(parseInt(el.dataset.index, 10)),
    'open-customer':     (e, el) => openCustomerModal(el.dataset.id),
    'expand-order':      (e, el) => expandOrder(el.dataset.id),
    'delete-order':      (e, el) => deleteOrder(el.dataset.id),
    'save-tracking':     (e, el) => saveTrackingInfo(el.dataset.id),
    'save-note':         (e, el) => saveAdminNote(el.dataset.id),
    'set-tab':           (e, el) => { e && e.preventDefault && e.preventDefault(); switchTab(el.dataset.tab, el); },
    'set-order-filter':  (e, el) => setOrderFilter(el.dataset.filter, el)
};

function wireUpDelegatedEvents() {
    document.addEventListener('click', (e) => {
        const stopEl = e.target.closest('[data-stop-propagation="1"]');
        const trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        if (trigger.tagName === 'SELECT' || trigger.tagName === 'INPUT' || trigger.tagName === 'TEXTAREA') return;
        // If the trigger is a <form> and the click came from a submit control,
        // let the native submit event handle it (avoids double-firing + page reload).
        if (trigger.tagName === 'FORM') {
            const btn = e.target.closest('button, input[type="submit"]');
            if (btn && (btn.type === 'submit' || btn.tagName === 'BUTTON' && !btn.type)) return;
        }
        const handler = ACTION_HANDLERS[trigger.dataset.action];
        if (handler) {
            if (stopEl && stopEl !== trigger && !trigger.contains(stopEl) && stopEl.contains(trigger)) {
                e.stopPropagation();
            }
            handler(e, trigger);
        }
    });

    document.addEventListener('change', (e) => {
        const trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        const action = trigger.dataset.action;
        if (action === 'update-stock') {
            updateStock(trigger.dataset.id, trigger.value);
        } else if (action === 'order-status') {
            updateOrderStatus(trigger.dataset.id, trigger.value);
        } else if (action === 'category-filter') {
            render();
        } else if (action === 'upload-images') {
            uploadProductImages(e);
        } else if (action === 'pick-bulk') {
            handleBulkFile(e);
        }
    });

    document.addEventListener('input', (e) => {
        const trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        const action = trigger.dataset.action;
        if (action === 'inventory-search') render();
        else if (action === 'order-search') renderOrders();
        else if (action === 'customer-search') renderCustomers();
    });

    document.addEventListener('submit', (e) => {
        const trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        const action = trigger.dataset.action;
        if (action === 'save-product') {
            saveProduct(e);
        } else if (action === 'admin-login') {
            e.preventDefault();
            checkAuth();
        }
    });

    // Image error fallback (replaces inline onerror="...")
    document.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG') {
            const fb = t.dataset.fallback;
            if (fb && t.src !== fb) {
                t.src = fb;
            } else if (t.dataset.brokenStyle === '1') {
                t.style.opacity = '0.25';
                t.alt = 'broken';
            }
        }
    }, true);

    // Stop-propagation handler for table cells that wrap interactive elements
    document.addEventListener('click', (e) => {
        const stop = e.target.closest('[data-stop-propagation="1"]');
        if (stop && !e.target.closest('[data-action="expand-order"]')) {
            // already handled by select/button; just guard the row click
        }
    }, false);
}

document.addEventListener('DOMContentLoaded', () => {
    wireUpDelegatedEvents();
    checkSession();
});
