'use strict';

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
    zip: v => /^[0-9A-Za-z\- ]{4,12}$/.test(String(v || '').trim()),
    positiveNumber: v => {
        const n = parseFloat(v);
        return !isNaN(n) && isFinite(n) && n >= 0;
    }
};

function validateForm(rules) {
    for (const r of rules) {
        if (!r.test(r.value)) return r.message;
    }
    return null;
}

/* ──────────────────────────────────────────────────────────────
   DATA
   ────────────────────────────────────────────────────────────── */

let PRODUCTS = [];

const DEFAULT_CATS = [
    { id: 'wood',         name: 'Wood Items',    icon: 'fas fa-tree',      image: 'cat-wood.png' },
    { id: 'resin',        name: 'Resin Art',     icon: 'fas fa-tint',      image: 'cat-resin.png' },
    { id: 'soap',         name: 'Handmade Soap', icon: 'fas fa-soap',      image: 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?auto=format&fit=crop&q=80' },
    { id: 'candle',       name: 'Candles',       icon: 'fas fa-fire-alt',  image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80' },
    { id: 'raw_material', name: 'Raw Materials', icon: 'fas fa-box',       image: 'cat-raw.png' }
];
const DEFAULT_CAT_FALLBACK_ICON = 'fas fa-tag';
const DEFAULT_CAT_FALLBACK_IMAGE = 'https://placehold.co/400x300/1a0a2e/ffd700?text=New+Category';

function getCategories() {
    const custom = JSON.parse(localStorage.getItem('velorex_store_categories')) || [];
    const merged = DEFAULT_CATS.map(d => {
        const override = custom.find(c => c.id === d.id) || {};
        return {
            ...d,
            icon:  override.icon  || d.icon,
            image: override.image || d.image
        };
    });
    const extras = custom
        .filter(c => !c.isDefault && !DEFAULT_CATS.some(d => d.id === c.id))
        .map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon || DEFAULT_CAT_FALLBACK_ICON,
            image: c.image || DEFAULT_CAT_FALLBACK_IMAGE
        }));
    return [...merged, ...extras];
}
let CATEGORIES = getCategories();
function getCatName(id) {
    const c = CATEGORIES.find(x => x.id === id);
    return c ? c.name : id;
}

async function loadProducts() {
    try {
        const response = await fetch('api/get-products.php', { credentials: 'include' });
        const json = await response.json();
        PRODUCTS = (json.products || []).map(p => {
            const imagesArr = Array.isArray(p.images) ? p.images : [];
            const cover = imagesArr[0] || p.image_url || p.img || '';
            return {
                id: p.id,
                name: p.name,
                price: parseFloat(p.price) || 0,
                img: cover,
                images: imagesArr.length ? imagesArr : (cover ? [cover] : []),
                cat: p.category,
                desc: p.description || '',
                stock: parseInt(p.stock, 10) || 0,
                featured: p.featured === '1' || p.featured === 1 || p.featured === true
            };
        });

        const currentHash = window.location.hash || '#home';
        if (currentHash.startsWith('#products')) {
            const query = currentHash.split('?')[1] || '';
            const cat = new URLSearchParams(query).get('cat');
            app.renderProducts(cat);
        } else if (currentHash.startsWith('#product-detail')) {
            const query = currentHash.split('?')[1] || '';
            const id = new URLSearchParams(query).get('id');
            app.renderProductDetail(id);
        }
    } catch (error) {
        console.error('Failed to load products:', error);
    }
}

const SERVICES_DATA = [
    {
        id: 'branding', name: 'Logo & Branding', icon: 'fas fa-vector-square',
        desc: 'Custom logo design, brand guidelines, and complete identity packages tailored to your vision.',
        startingAt: 2999,
        packages: [
            { name: 'Basic',    price: 2999,  badge: null,           features: ['1 Logo Concept', '2 Revisions', 'PNG & JPG Files', '48h Delivery'] },
            { name: 'Standard', price: 5999,  badge: 'Most Popular', features: ['3 Logo Concepts', '5 Revisions', 'All Formats (AI, SVG, PNG)', 'Brand Color Palette', '3 Day Delivery'] },
            { name: 'Premium',  price: 9999,  badge: null,           features: ['5 Logo Concepts', 'Unlimited Revisions', 'Complete Brand Guidelines', 'Business Card Design', 'Social Media Kit', '5 Day Delivery'] }
        ]
    },
    {
        id: 'uiux', name: 'UI/UX Design', icon: 'fas fa-laptop-code',
        desc: 'Modern, responsive website and mobile app interface designs with full Figma source handoff.',
        startingAt: 5999,
        packages: [
            { name: 'Landing Page', price: 5999,  badge: null,           features: ['1 Page Design', 'Mobile Responsive', '2 Revisions', 'Figma File', '5 Day Delivery'] },
            { name: 'Website',      price: 12999, badge: 'Most Popular', features: ['Up to 5 Pages', 'Mobile Responsive', '5 Revisions', 'Figma Source File', 'Prototype Included', '7 Day Delivery'] },
            { name: 'Full App UI',  price: 24999, badge: null,           features: ['Complete App Flow', 'iOS & Android Screens', 'Unlimited Revisions', 'Design System', 'Developer Handoff', '14 Day Delivery'] }
        ]
    },
    {
        id: 'social', name: 'Social Media Kits', icon: 'fas fa-share-alt',
        desc: 'Engaging post templates, story banners, and ad creatives for Instagram, Facebook, and more.',
        startingAt: 1499,
        packages: [
            { name: 'Starter Kit', price: 1499, badge: null,         features: ['10 Post Templates', 'Instagram & Facebook', '2 Revisions', 'Editable PSD Files', '3 Day Delivery'] },
            { name: 'Growth Kit',  price: 2999, badge: 'Best Value', features: ['25 Post Templates', 'Story Templates Included', '4 Revisions', 'Brand-Matched Design', 'Canva & PSD Files', '5 Day Delivery'] },
            { name: 'Pro Kit',     price: 5499, badge: null,         features: ['50 Post Templates', 'All Platforms', 'Unlimited Revisions', 'Monthly Content Calendar', 'Reel Thumbnails', '7 Day Delivery'] }
        ]
    },
    {
        id: 'packaging', name: 'Packaging Design', icon: 'fas fa-box-open',
        desc: 'Eye-catching product packaging and label designs ready for print, with full dieline files.',
        startingAt: 3499,
        packages: [
            { name: 'Label Design',    price: 3499,  badge: null,           features: ['1 Label Design', 'Print-Ready Files', '2 Revisions', '48h Delivery'] },
            { name: 'Box Design',      price: 6999,  badge: 'Most Popular', features: ['1 Box/Package Design', 'Dieline Included', '4 Revisions', 'Print-Ready Files', '3 Day Delivery'] },
            { name: 'Full Packaging',  price: 12999, badge: null,           features: ['Complete Packaging Suite', 'Labels + Box + Insert', 'Unlimited Revisions', '3D Mockup Preview', 'Print-Ready Files', '7 Day Delivery'] }
        ]
    }
];

async function apiCall(url, options = {}) {
    let response;
    try {
        response = await fetch(url, { credentials: 'include', ...options });
    } catch (networkErr) {
        return { ok: false, status: 0, data: null, networkError: true };
    }
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    return { ok: response.ok, status: response.status, data, networkError: false };
}

/* ──────────────────────────────────────────────────────────────
   APP
   ────────────────────────────────────────────────────────────── */

const app = {
    cart: JSON.parse(localStorage.getItem('velorex_design_cart')) || [],
    userProfile: JSON.parse(localStorage.getItem('velorex_design_profile')) || { name: '', email: '', phone: '', addresses: [] },
    currentUser: JSON.parse(localStorage.getItem('velorex_design_user')) || null,

    init() {
        this.updateCartBadge();
        this.updateAuthNav();
        this.restoreSession();
        this.renderNavCategories();
        this.renderFooterCategories();
        loadProducts();
        this.handleRoute();
        window.addEventListener('hashchange', () => this.handleRoute());

        window.addEventListener('storage', (e) => {
            if (e.key === 'velorex_store_categories') {
                CATEGORIES = getCategories();
                this.renderNavCategories();
                this.renderFooterCategories();
                if ((window.location.hash || '#home').startsWith('#home')) this.renderHome();
            }
        });

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.split('?')[0] || '#home';
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === hash) link.classList.add('active');
            });
        });

        const savedTheme = localStorage.getItem('velorex_design_theme') || 'dark';
        if (savedTheme === 'light') this.setTheme('light');

        this.applyStoreSettings();

        window.addEventListener('scroll', () => {
            const btn = document.getElementById('backToTop');
            if (btn) {
                if (window.scrollY > 300) btn.classList.add('visible');
                else btn.classList.remove('visible');
            }
        });
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        this.setTheme(current === 'light' ? 'dark' : 'light');
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('velorex_design_theme', theme);
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        }
    },

    applyStoreSettings() {
        const s = JSON.parse(localStorage.getItem('velorex_store_settings')) || {};
        const addr  = document.getElementById('contactAddress');
        const phone = document.getElementById('contactPhone');
        const email = document.getElementById('contactEmail');
        const waLink = document.getElementById('servicesWaLink');
        if (addr && s.address) {
            addr.replaceChildren();
            String(s.address).split(/\n/).forEach((line, i, arr) => {
                addr.appendChild(document.createTextNode(line));
                if (i < arr.length - 1) addr.appendChild(document.createElement('br'));
            });
        }
        if (phone && s.phone) {
            phone.replaceChildren(document.createTextNode(s.phone), document.createElement('br'), document.createTextNode('(Mon-Sat, 10am - 6pm IST)'));
        }
        if (email && s.email) email.textContent = s.email;
        if (waLink && s.whatsapp) {
            const cleaned = String(s.whatsapp).replace(/\D/g, '');
            waLink.href = `https://wa.me/${encodeURIComponent(cleaned)}?text=Hi%20Velorex%20Design,%20I%20am%20interested%20in%20your%20graphic%20design%20services.`;
        }
    },

    navigate(view, params = {}) {
        let hash = '#' + view;
        if (Object.keys(params).length > 0) {
            const qs = new URLSearchParams(params).toString();
            hash += '?' + qs;
        }
        window.location.hash = hash;
    },

    handleRoute() {
        const fullHash = window.location.hash || '#home';
        const [hashStr, qs] = fullHash.split('?');
        const view = hashStr.replace('#', '');
        const params = new URLSearchParams(qs);

        const appRoot = document.getElementById('app');
        const template = document.getElementById('tpl-' + view);

        if (template) {
            appRoot.innerHTML = '<div class="view active">' + template.innerHTML + '</div>';
            window.scrollTo(0, 0);

            if (view === 'home') this.renderHome();
            if (view === 'products') {
                if (PRODUCTS.length === 0) {
                    loadProducts().then(() => this.renderProducts(params.get('cat')));
                } else {
                    this.renderProducts(params.get('cat'));
                }
            }
            if (view === 'product-detail') {
                if (PRODUCTS.length === 0) {
                    loadProducts().then(() => this.renderProductDetail(params.get('id')));
                } else {
                    this.renderProductDetail(params.get('id'));
                }
            }
            if (view === 'cart') this.renderCart();
            if (view === 'profile') {
                if (!this.currentUser) {
                    this.navigate('auth');
                    return;
                }
                this.renderProfile();
            }
            if (view === 'auth') {
                if (this.currentUser) {
                    this.navigate('profile');
                    return;
                }
            }
            if (view === 'services') this.renderServices();
            if (view === 'contact' || view === 'services') this.applyStoreSettings();

            const navLinks = document.getElementById('navLinks');
            if (navLinks) navLinks.classList.remove('show');
        } else {
            this.navigate('home');
        }
    },

    updateAuthNav() {
        const profileLink = document.querySelector('a[href="#profile"]');
        if (profileLink) {
            if (this.currentUser) {
                const firstName = String(this.currentUser.name || '').split(' ')[0] || 'Account';
                profileLink.replaceChildren();
                const icon = document.createElement('i');
                icon.className = 'fas fa-user';
                profileLink.appendChild(icon);
                profileLink.appendChild(document.createTextNode(' ' + firstName));
                profileLink.setAttribute('href', '#profile');
            } else {
                profileLink.replaceChildren();
                const icon = document.createElement('i');
                icon.className = 'fas fa-sign-in-alt';
                profileLink.appendChild(icon);
                profileLink.appendChild(document.createTextNode(' Login/Join'));
                profileLink.setAttribute('href', '#auth');
            }
        }
        this.loadNotifications();
    },

    loadNotifications() {
        const bell = document.getElementById('notifBell');
        const badge = document.getElementById('notifCount');
        if (!bell || !badge) return;
        if (!this.currentUser) { bell.style.display = 'none'; return; }
        const notifs = JSON.parse(localStorage.getItem(`velorex_notifications_${this.currentUser.id}`)) || [];
        const unread = notifs.filter(n => !n.read).length;
        bell.style.display = 'flex';
        if (unread > 0) {
            badge.style.display = 'flex';
            badge.textContent = unread > 9 ? '9+' : unread;
        } else {
            badge.style.display = 'none';
        }
    },

    markNotificationsRead() {
        if (!this.currentUser) return;
        const key = `velorex_notifications_${this.currentUser.id}`;
        const notifs = JSON.parse(localStorage.getItem(key)) || [];
        notifs.forEach(n => n.read = true);
        localStorage.setItem(key, JSON.stringify(notifs));
        const badge = document.getElementById('notifCount');
        if (badge) badge.style.display = 'none';
    },

    renderNotifications() {
        if (!this.currentUser) return '';
        const notifs = JSON.parse(localStorage.getItem(`velorex_notifications_${this.currentUser.id}`)) || [];
        if (notifs.length === 0) return '';
        return `
            <div style="margin-bottom:2rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                    <h4 style="font-size:1rem;">Notifications</h4>
                    <button type="button" class="btn btn-secondary" style="padding:0.3rem 0.8rem; font-size:0.78rem;" data-action="clear-notifs"><i class="fas fa-times"></i> Clear All</button>
                </div>
                ${notifs.slice(0, 10).map(n => {
                    const iconCls = n.status === 'Shipped' ? 'fa-truck'
                        : n.status === 'Delivered' ? 'fa-check-circle'
                        : n.status === 'Cancelled' ? 'fa-times-circle' : 'fa-box-open';
                    return `
                    <div class="notif-banner ${n.read ? 'read' : 'unread'}">
                        ${!n.read ? '<div class="notif-dot"></div>' : ''}
                        <i class="notif-icon fas ${escapeAttr(iconCls)}"></i>
                        <div style="flex:1;">
                            <div>${escapeHtml(n.message)}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">${escapeHtml(n.timestamp)}</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    },

    clearNotifications() {
        if (!this.currentUser) return;
        localStorage.removeItem(`velorex_notifications_${this.currentUser.id}`);
        this.renderProfile();
        this.loadNotifications();
    },

    explainApiFailure(res, fallback) {
        if (res.networkError) return 'Server unreachable. The site needs PHP to be running (Hostinger / XAMPP / Laragon).';
        if (res.status === 405 || res.status === 501) return 'The host is not running PHP — accounts can only be used on a real PHP server.';
        if (res.data && res.data.error) return res.data.error;
        return fallback || ('Request failed (status ' + res.status + ')');
    },

    setCurrentUser(user) {
        this.currentUser = user;
        if (user) {
            localStorage.setItem('velorex_design_user', JSON.stringify(user));
            this.userProfile.name = user.name || '';
            this.userProfile.email = user.email || '';
            this.userProfile.phone = user.phone || '';
            this.saveProfileData();
        } else {
            localStorage.removeItem('velorex_design_user');
        }
        this.updateAuthNav();
    },

    async restoreSession() {
        const res = await apiCall('api/customer-session.php');
        if (res.ok && res.data && res.data.authenticated) {
            this.setCurrentUser(res.data.user);
            if (window.location.hash.startsWith('#profile')) this.renderProfile();
        } else if (res.ok && res.data && res.data.authenticated === false) {
            if (this.currentUser) this.setCurrentUser(null);
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPass').value;

        const err = validateForm([
            { test: VALIDATORS.required, value: name,  message: 'Please enter your full name' },
            { test: v => VALIDATORS.maxLength(v, 120), value: name, message: 'Name is too long' },
            { test: VALIDATORS.email,    value: email, message: 'Please enter a valid email address' },
            { test: v => VALIDATORS.minLength(v, 6),  value: pass, message: 'Password must be at least 6 characters' },
            { test: v => VALIDATORS.maxLength(v, 200),value: pass, message: 'Password is too long' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        const res = await apiCall('api/customer-register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password: pass })
        });

        if (res.ok && res.data && res.data.success) {
            this.setCurrentUser(res.data.user);
            this.navigate('profile');
            this.showToast(`Welcome to Velorex Design, ${res.data.user.name}!`, 'success');
            return;
        }
        this.showToast(this.explainApiFailure(res, 'Could not create account'), 'error');
    },

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value;

        const err = validateForm([
            { test: VALIDATORS.email,    value: email, message: 'Please enter a valid email address' },
            { test: VALIDATORS.required, value: pass,  message: 'Please enter your password' },
            { test: v => VALIDATORS.maxLength(v, 200), value: pass, message: 'Password is too long' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        const res = await apiCall('api/customer-login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });

        if (res.ok && res.data && res.data.success) {
            this.setCurrentUser(res.data.user);
            this.navigate('profile');
            this.showToast(`Welcome back, ${res.data.user.name}!`, 'success');
            return;
        }
        this.showToast(this.explainApiFailure(res, 'Login failed'), 'error');
    },

    async handleLogout() {
        await apiCall('api/customer-logout.php', { method: 'POST' });
        this.setCurrentUser(null);
        this.userProfile = { name: '', email: '', phone: '', addresses: [] };
        this.saveProfileData();
        this.navigate('home');
        this.showToast('You have been logged out.', 'info');
    },

    createProductCard(product) {
        const img = escapeAttr(safeUrl(product.img));
        const name = escapeHtml(product.name);
        const cat = escapeHtml(getCatName(product.cat));
        return `
            <div class="product-card">
                <div class="product-img" data-action="open-product" data-id="${escapeAttr(product.id)}" style="cursor:pointer;">
                    <img src="${img}" alt="${escapeAttr(product.name)}">
                    ${product.featured ? '<span class="product-badge">Featured</span>' : ''}
                </div>
                <div class="product-info">
                    <div class="product-cat">${cat}</div>
                    <h3 class="product-title" data-action="open-product" data-id="${escapeAttr(product.id)}">${name}</h3>
                    <div class="product-price">₹${Number(product.price || 0).toLocaleString()}</div>
                    <button type="button" class="btn btn-primary btn-block" data-action="add-to-cart" data-id="${escapeAttr(product.id)}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
    },

    renderHome() {
        this.renderHomeCategories();
        const grid = document.getElementById('homeFeaturedGrid');
        if (!grid) return;
        let featured = PRODUCTS.filter(p => p.featured);
        if (featured.length === 0) featured = PRODUCTS.slice(0, 3);
        else featured = featured.slice(0, 3);
        if (featured.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:2rem; grid-column:1/-1;">No products yet. Add some from the admin panel.</p>`;
        } else {
            grid.innerHTML = featured.map(p => this.createProductCard(p)).join('');
        }
    },

    renderNavCategories() {
        const dd = document.getElementById('navCategoryDropdown');
        if (!dd) return;
        CATEGORIES = getCategories();
        dd.innerHTML =
            `<a href="#products" class="dropdown-item"><i class="fas fa-th-large text-gradient"></i> All Products</a>` +
            CATEGORIES.map(c =>
                `<a href="#products?cat=${encodeURIComponent(c.id)}" class="dropdown-item"><i class="${escapeAttr(c.icon || DEFAULT_CAT_FALLBACK_ICON)} text-gradient"></i> ${escapeHtml(c.name)}</a>`
            ).join('');
    },

    renderFooterCategories() {
        const ul = document.getElementById('footerShopLinks');
        if (!ul) return;
        CATEGORIES = getCategories();
        const catLinks = CATEGORIES.map(c =>
            `<li><a href="#products?cat=${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a></li>`
        ).join('');
        ul.innerHTML =
            `<li><a href="#products">All Products</a></li>` +
            catLinks +
            `<li><a href="#services">Design Services</a></li>`;
    },

    renderHomeCategories() {
        const grid = document.getElementById('homeCategoryGrid');
        if (!grid) return;
        CATEGORIES = getCategories();
        grid.innerHTML = CATEGORIES.map(c => {
            const img = escapeAttr(safeUrl(c.image) || DEFAULT_CAT_FALLBACK_IMAGE);
            return `
                <div class="category-card" data-action="open-category" data-cat="${escapeAttr(c.id)}" style="cursor:pointer;">
                    <img src="${img}" alt="${escapeAttr(c.name)}" data-fallback="${escapeAttr(DEFAULT_CAT_FALLBACK_IMAGE)}" style="width: 100%; height: 200px; object-fit: cover;">
                    <div class="category-overlay">
                        <h3>${escapeHtml(c.name)}</h3>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderServices() {
        const typesGrid = document.getElementById('servicesTypeGrid');
        if (!typesGrid) return;
        this._selectedService = null;
        this._selectedPkg = null;
        typesGrid.innerHTML = SERVICES_DATA.map(s => `
            <div class="service-card service-type-card" id="svc-${escapeAttr(s.id)}" data-action="select-service" data-svc="${escapeAttr(s.id)}">
                <div class="service-icon"><i class="${escapeAttr(s.icon)}"></i></div>
                <div style="flex:1;">
                    <h3>${escapeHtml(s.name)}</h3>
                    <p style="color:var(--text-muted); margin-top:0.5rem; font-size:0.9rem;">${escapeHtml(s.desc)}</p>
                    <p style="color:var(--accent); margin-top:0.8rem; font-weight:700; font-size:0.95rem;">Starting at ₹${s.startingAt.toLocaleString()}</p>
                    <div class="select-hint"><i class="fas fa-hand-pointer"></i> Click to see packages</div>
                </div>
            </div>
        `).join('');
        const dp = document.getElementById('serviceDetailPanel');
        const pb = document.getElementById('servicesProceedBar');
        if (dp) dp.style.display = 'none';
        if (pb) pb.style.display = 'none';
    },

    selectServiceType(id) {
        const svc = SERVICES_DATA.find(s => s.id === id);
        if (!svc) return;
        document.querySelectorAll('.service-type-card').forEach(c => c.classList.remove('active'));
        const card = document.getElementById('svc-' + id);
        if (card) card.classList.add('active');
        this._selectedService = id;
        this._selectedPkg = null;
        const dp = document.getElementById('serviceDetailPanel');
        const pb = document.getElementById('servicesProceedBar');
        dp.style.display = 'block';
        dp.innerHTML = `
            <div class="service-detail-panel">
                <div style="margin-bottom:1.8rem;">
                    <h3 style="font-family:var(--font-display); font-size:1.55rem;">
                        ${escapeHtml(svc.name)} &mdash; <span class="text-gradient">Choose a Package</span>
                    </h3>
                    <p style="color:var(--text-muted); margin-top:0.4rem;">Select the package that fits your needs, then proceed.</p>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1.5rem;">
                    ${svc.packages.map((pkg, i) => `
                        <div class="pkg-card" id="pkg-${escapeAttr(id)}-${i}" data-action="select-package" data-svc="${escapeAttr(id)}" data-idx="${i}">
                            ${pkg.badge ? `<div class="pkg-badge">${escapeHtml(pkg.badge)}</div>` : ''}
                            <div class="pkg-name">${escapeHtml(pkg.name)}</div>
                            <div class="pkg-price">₹${pkg.price.toLocaleString()}</div>
                            <ul class="pkg-features">
                                ${pkg.features.map(f => `<li><i class="fas fa-check-circle"></i>${escapeHtml(f)}</li>`).join('')}
                            </ul>
                            <button type="button" class="pkg-select-btn">${escapeHtml(pkg.badge ? pkg.badge + ' — Select' : 'Select Package')}</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        if (pb) pb.style.display = 'none';
        dp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    selectPackage(serviceId, pkgIdx) {
        document.querySelectorAll(`[id^="pkg-${serviceId}-"]`).forEach(c => c.classList.remove('selected'));
        const selected = document.getElementById(`pkg-${serviceId}-${pkgIdx}`);
        if (selected) selected.classList.add('selected');
        this._selectedPkg = pkgIdx;
        const svc = SERVICES_DATA.find(s => s.id === serviceId);
        const pkg = svc.packages[pkgIdx];
        const pb = document.getElementById('servicesProceedBar');
        pb.style.display = 'block';
        pb.innerHTML = `
            <div class="proceed-bar">
                <div>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.2rem; text-transform:uppercase; letter-spacing:1px;">Your Selection</div>
                    <div style="font-weight:700; font-size:1.05rem;">${escapeHtml(svc.name)} &mdash; ${escapeHtml(pkg.name)} Package</div>
                    <div style="color:var(--accent); font-weight:700; font-size:1.25rem; margin-top:0.15rem;">₹${pkg.price.toLocaleString()}</div>
                </div>
                <button type="button" class="btn btn-primary" style="white-space:nowrap; padding:0.9rem 1.8rem;" data-action="proceed-service" data-svc="${escapeAttr(serviceId)}" data-idx="${pkgIdx}">
                    <i class="fab fa-whatsapp"></i>&nbsp; Proceed to Order
                </button>
            </div>
        `;
        pb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    proceedService(serviceId, pkgIdx) {
        const svc = SERVICES_DATA.find(s => s.id === serviceId);
        const pkg = svc.packages[pkgIdx];
        const storeSettings = JSON.parse(localStorage.getItem('velorex_store_settings')) || {};
        const waNumber = String(storeSettings.whatsapp || '').replace(/\D/g, '');
        if (!waNumber) { this.showToast('WhatsApp number not configured by admin.', 'error'); return; }
        const features = pkg.features.map(f => '• ' + f).join('\n');
        const text = `Hi Velorex Design! I would like to order the following service:\n\n*Service:* ${svc.name}\n*Package:* ${pkg.name}\n*Price:* ₹${pkg.price.toLocaleString()}\n\n*What's included:*\n${features}\n\nPlease let me know the next steps!`;
        window.open(`https://wa.me/${encodeURIComponent(waNumber)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    },

    renderProducts(catFilter = 'all') {
        const grid = document.getElementById('productsGrid');
        const noProd = document.getElementById('noProducts');
        const title = document.getElementById('catalogTitle');
        const select = document.getElementById('catFilter');

        CATEGORIES = getCategories();
        if (select) {
            const current = catFilter || 'all';
            select.replaceChildren();
            const allOpt = document.createElement('option');
            allOpt.value = 'all';
            allOpt.textContent = 'All Categories';
            if (current === 'all') allOpt.selected = true;
            select.appendChild(allOpt);
            CATEGORIES.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                if (c.id === current) opt.selected = true;
                select.appendChild(opt);
            });
        }

        let filtered = PRODUCTS;
        if (catFilter && catFilter !== 'all') {
            filtered = PRODUCTS.filter(p => p.cat === catFilter);
            title.innerHTML = `${escapeHtml(getCatName(catFilter))} <span class="text-gradient">Collection</span>`;
        } else {
            title.innerHTML = `Our <span class="text-gradient">Catalog</span>`;
        }

        const bc = document.getElementById('bc-products');
        if (bc) {
            let bcHtml = `<li class="breadcrumb-item"><a href="#home">Home</a></li>`;
            bcHtml += `<li class="breadcrumb-item"><a href="#products">Catalog</a></li>`;
            if (catFilter && catFilter !== 'all') {
                bcHtml += `<li class="breadcrumb-item active">${escapeHtml(getCatName(catFilter))}</li>`;
            }
            bc.innerHTML = bcHtml;
        }

        if (filtered.length > 0) {
            grid.style.display = 'grid';
            noProd.style.display = 'none';
            grid.innerHTML = filtered.map(p => this.createProductCard(p)).join('');
        } else {
            grid.style.display = 'none';
            noProd.style.display = 'block';
        }
    },

    filterProducts() {
        const val = document.getElementById('catFilter').value;
        this.navigate('products', { cat: val });
    },

    renderProductDetail(id) {
        const product = PRODUCTS.find(p => String(p.id) === String(id));
        const container = document.getElementById('productDetailContent');
        if (!container) return;

        if (!product) {
            container.innerHTML = `<h2>Product not found.</h2>`;
            return;
        }

        const bc = document.getElementById('bc-detail');
        if (bc) {
            bc.innerHTML = `
                <li class="breadcrumb-item"><a href="#home">Home</a></li>
                <li class="breadcrumb-item"><a href="#products">Catalog</a></li>
                <li class="breadcrumb-item"><a href="#products?cat=${encodeURIComponent(product.cat)}">
                    ${escapeHtml(getCatName(product.cat))}
                </a></li>
                <li class="breadcrumb-item active">${escapeHtml(product.name)}</li>
            `;
        }

        const gallery = (product.images && product.images.length ? product.images : [product.img]).filter(Boolean);
        this._detailGallery = gallery;
        const thumbsHtml = gallery.length > 1 ? `
            <div class="detail-thumbs" style="display:flex; gap:0.6rem; margin-top:0.9rem; flex-wrap:wrap;">
                ${gallery.map((src, i) => `
                    <div data-action="select-detail-img" data-idx="${i}" id="detail-thumb-${i}" style="width:74px; height:74px; border-radius:8px; overflow:hidden; cursor:pointer; border:2px solid ${i === 0 ? 'var(--secondary)' : 'var(--border)'}; transition:border-color 0.2s; background:#000;">
                        <img src="${escapeAttr(safeUrl(src))}" data-broken-opacity="1" style="width:100%; height:100%; object-fit:cover;" alt="">
                    </div>
                `).join('')}
            </div>` : '';

        container.innerHTML = `
            <div class="detail-img">
                <img id="detailMainImage" src="${escapeAttr(safeUrl(gallery[0] || ''))}" alt="${escapeAttr(product.name)}">
                ${thumbsHtml}
            </div>
            <div class="detail-info">
                <div style="color: var(--secondary); font-weight: bold; text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 2px;">
                    ${escapeHtml(getCatName(product.cat))} Collection
                </div>
                <h1>${escapeHtml(product.name)}</h1>
                <div class="detail-price">₹${Number(product.price || 0).toLocaleString()}</div>
                <p class="detail-desc">${escapeHtml(product.desc)}</p>

                <div style="background: var(--surface); border: 1px solid var(--border); padding: 1.5rem; border-radius: var(--radius); margin-bottom: 2rem;">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <i class="fas fa-check-circle text-gold"></i> <span>100% Handcrafted</span>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <i class="fas fa-truck text-gold"></i> <span>Ships in 3-5 business days</span>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <i class="fas fa-shield-alt text-gold"></i> <span>Secure checkout</span>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button type="button" class="btn btn-primary" style="flex: 2;" data-action="add-to-cart" data-id="${escapeAttr(product.id)}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
    },

    selectDetailImage(i) {
        if (!Array.isArray(this._detailGallery) || !this._detailGallery[i]) return;
        const main = document.getElementById('detailMainImage');
        if (main) main.src = safeUrl(this._detailGallery[i]);
        this._detailGallery.forEach((_, idx) => {
            const t = document.getElementById('detail-thumb-' + idx);
            if (t) t.style.borderColor = idx === i ? 'var(--secondary)' : 'var(--border)';
        });
    },

    addToCart(id) {
        const product = PRODUCTS.find(p => String(p.id) === String(id));
        if (!product) return;

        const existing = this.cart.find(item => String(item.id) === String(id));
        if (existing) {
            existing.qty += 1;
        } else {
            this.cart.push({ ...product, qty: 1 });
        }

        this.saveCart();
        this.showToast(`Added ${product.name} to cart!`);
        if (window.location.hash.includes('cart')) this.renderCart();
    },

    updateQty(id, change) {
        const item = this.cart.find(i => String(i.id) === String(id));
        if (item) {
            item.qty += Number(change) || 0;
            if (item.qty <= 0) {
                this.cart = this.cart.filter(i => String(i.id) !== String(id));
            }
            this.saveCart();
            this.renderCart();
        }
    },

    saveCart() {
        localStorage.setItem('velorex_design_cart', JSON.stringify(this.cart));
        this.updateCartBadge();
    },

    updateCartBadge() {
        const count = this.cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
        const badge = document.getElementById('cartCount');
        if (!badge) return;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    },

    renderCart() {
        const container = document.getElementById('cartContent');
        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem; background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <i class="fas fa-shopping-cart" style="font-size: 4rem; color: var(--border); margin-bottom: 1.5rem;"></i>
                    <h2>Your cart is empty</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem;">Looks like you haven't added anything yet.</p>
                    <button type="button" class="btn btn-primary" data-action="goto-products">Continue Shopping</button>
                </div>
            `;
            return;
        }

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const shipping = subtotal > 999 ? 0 : 99;
        const total = subtotal + shipping;

        const itemsHtml = this.cart.map(item => `
            <div class="cart-item">
                <img src="${escapeAttr(safeUrl(item.img))}" alt="${escapeAttr(item.name)}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">₹${Number(item.price || 0).toLocaleString()}</div>
                </div>
                <div class="qty-control">
                    <button type="button" class="qty-btn" data-action="qty" data-id="${escapeAttr(item.id)}" data-delta="-1">-</button>
                    <span>${parseInt(item.qty, 10) || 0}</span>
                    <button type="button" class="qty-btn" data-action="qty" data-id="${escapeAttr(item.id)}" data-delta="1">+</button>
                </div>
                <div class="cart-remove" data-action="qty" data-id="${escapeAttr(item.id)}" data-delta="${-item.qty}">
                    <i class="fas fa-trash"></i>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="cart-items">${itemsHtml}</div>
            <div class="cart-summary">
                <h3 style="margin-bottom: 1.5rem;">Order Summary</h3>
                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>₹${subtotal.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                    <span>Shipping ${shipping === 0 ? '(Free)' : ''}</span>
                    <span>₹${shipping}</span>
                </div>
                <div class="summary-total">
                    <span>Total</span>
                    <span class="text-gradient">₹${total.toLocaleString()}</span>
                </div>

                <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border);">
                    <h4 style="margin-bottom: 1rem;">Checkout via WhatsApp</h4>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">We currently process secure payments manually via WhatsApp to ensure product customization and availability.</p>
                    <button type="button" class="btn btn-primary btn-block" data-action="checkout">
                        <i class="fab fa-whatsapp"></i> Proceed to Order
                    </button>
                </div>
            </div>
        `;
    },

    checkout() {
        if (this.cart.length === 0) return;

        const p = this.userProfile || {};
        const defaultAddr = (p.addresses && p.addresses.length > 0)
            ? (p.addresses.find(a => a.isDefault) || p.addresses[0])
            : null;

        document.getElementById('coName').value = (defaultAddr && defaultAddr.fullName) || p.name || '';
        document.getElementById('coEmail').value = p.email || '';
        document.getElementById('coPhone').value = (defaultAddr && defaultAddr.phone) || p.phone || '';

        const streetParts = defaultAddr ? [defaultAddr.street, defaultAddr.line2, defaultAddr.landmark ? ('Landmark: ' + defaultAddr.landmark) : ''].filter(Boolean) : [];
        document.getElementById('coStreet').value = streetParts.join(', ');
        const cityParts = defaultAddr ? [defaultAddr.city, defaultAddr.state].filter(Boolean) : [];
        document.getElementById('coCity').value = cityParts.join(', ');
        document.getElementById('coZip').value = defaultAddr ? (defaultAddr.zip || '') : '';

        const modal = document.getElementById('checkoutModal');
        modal.classList.add('open');
    },

    closeCheckoutModal() {
        const modal = document.getElementById('checkoutModal');
        if (modal) modal.classList.remove('open');
    },

    async submitCheckout() {
        if (this.cart.length === 0) {
            this.closeCheckoutModal();
            return;
        }

        const name = document.getElementById('coName').value.trim();
        const email = document.getElementById('coEmail').value.trim();
        const phone = document.getElementById('coPhone').value.trim();
        const street = document.getElementById('coStreet').value.trim();
        const city = document.getElementById('coCity').value.trim();
        const zip = document.getElementById('coZip').value.trim();

        const err = validateForm([
            { test: VALIDATORS.required, value: name,   message: 'Please enter your full name' },
            { test: v => VALIDATORS.maxLength(v, 120),  value: name, message: 'Name is too long' },
            { test: VALIDATORS.email,    value: email,  message: 'Please enter a valid email address' },
            { test: VALIDATORS.phone,    value: phone,  message: 'Please enter a valid mobile number' },
            { test: VALIDATORS.required, value: street, message: 'Please enter your street address' },
            { test: v => VALIDATORS.maxLength(v, 400),  value: street, message: 'Address is too long' },
            { test: VALIDATORS.required, value: city,   message: 'Please enter your city' },
            { test: VALIDATORS.zip,      value: zip,    message: 'Please enter a valid ZIP / postal code' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        let text = "Hi Velorex Design! I would like to place an order for:\n\n";
        let subtotal = 0;
        const items = this.cart.map(item => {
            subtotal += item.price * item.qty;
            text += `- ${item.qty}x ${item.name} (₹${item.price * item.qty})\n`;
            return {
                product_id: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price
            };
        });

        const shipping = subtotal > 999 ? 0 : 99;
        const total = subtotal + shipping;
        text += `\nSubtotal: ₹${subtotal}\nShipping: ₹${shipping}\n*Total: ₹${total}*\n\nCustomer: ${name}\nMobile: ${phone}\nEmail: ${email}\nShipping Address: ${street}, ${city} ${zip}\n\nPlease let me know the payment details.`;

        const payload = {
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            address: { street, city, zip },
            total: total,
            items: items
        };

        const submitBtn = document.getElementById('coSubmitBtn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing order…';

        try {
            const response = await fetch('api/create-order.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data || !data.success) {
                const msg = (data && data.error) || 'Unable to save order';
                throw new Error(msg);
            }

            const orderCode = data.order_code;
            const serverTotal = typeof data.total_amount === 'number' ? data.total_amount : total;

            const orderRecord = {
                id: orderCode,
                date: new Date().toLocaleDateString(),
                createdAt: new Date().toISOString(),
                items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
                total: serverTotal,
                status: 'Pending',
                userId: this.currentUser?.id || 'guest',
                userName: name,
                userEmail: email,
                userPhone: phone,
                address: { street, city, zip },
                trackingNumber: '',
                adminNote: '',
                statusHistory: [{ status: 'Pending', timestamp: new Date().toLocaleString() }]
            };

            const allOrders = JSON.parse(localStorage.getItem('velorex_design_all_orders')) || [];
            allOrders.unshift(orderRecord);
            localStorage.setItem('velorex_design_all_orders', JSON.stringify(allOrders));

            loadProducts();

            const storeSettings = JSON.parse(localStorage.getItem('velorex_store_settings')) || {};
            const waNumber = String(storeSettings.whatsapp || '').replace(/\D/g, '');
            const finalText = text + `\n\n*Order Reference:* ${orderCode}`;
            if (waNumber) {
                window.open(`https://wa.me/${encodeURIComponent(waNumber)}?text=${encodeURIComponent(finalText)}`, '_blank', 'noopener,noreferrer');
            }

            this.cart = [];
            this.saveCart();
            this.closeCheckoutModal();
            this.renderCart();
            if (waNumber) {
                this.showToast(`Order placed! Reference: ${orderCode}`, 'success');
            } else {
                this.showToast(`Order placed (ref ${orderCode}). Admin hasn't set a WhatsApp number — please contact the store directly.`, 'info');
            }
        } catch (error) {
            this.showToast(error.message || 'Could not place order', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    },

    async renderProfile() {
        document.getElementById('profName').value = this.userProfile.name || '';
        document.getElementById('profEmail').value = this.userProfile.email || '';
        document.getElementById('profPhone').value = this.userProfile.phone || '';

        if (this.currentUser) {
            const res = await apiCall('api/customer-addresses.php');
            if (res.ok && res.data && Array.isArray(res.data.addresses)) {
                this.userProfile.addresses = res.data.addresses;
                this.saveProfileData();
            }
        }
        this.renderAddresses();

        const ordersHeader = document.querySelector('#tab-orders h3');
        if (ordersHeader) {
            const notifHtml = this.renderNotifications();
            const existing = document.getElementById('notifBannerArea');
            if (existing) existing.remove();
            if (notifHtml) {
                const div = document.createElement('div');
                div.id = 'notifBannerArea';
                div.innerHTML = notifHtml;
                ordersHeader.insertAdjacentElement('afterend', div);
            }
        }
        const ordersContainer = document.getElementById('orderHistoryContent');

        let myOrders = [];
        if (this.currentUser) {
            const ordersRes = await apiCall('api/customer-orders.php');
            if (ordersRes.ok && ordersRes.data && Array.isArray(ordersRes.data.orders)) {
                myOrders = ordersRes.data.orders;
            }
        } else {
            const localAll = JSON.parse(localStorage.getItem('velorex_design_all_orders')) || [];
            const userId = this.currentUser?.id || null;
            myOrders = userId ? localAll.filter(o => o.userId === userId) : [];
        }

        this.markNotificationsRead();

        if (myOrders.length === 0) {
            ordersContainer.innerHTML = `
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                    <i class="fas fa-box-open" style="font-size:3rem; opacity:0.3; margin-bottom:1rem; display:block;"></i>
                    <p>You haven't placed any orders yet.</p>
                    <button type="button" class="btn btn-primary" style="margin-top:1.5rem;" data-action="goto-products"><i class="fas fa-shopping-bag"></i> Browse Products</button>
                </div>`;
        } else {
            const statusSteps = ['Pending', 'Processing', 'Shipped', 'Delivered'];
            const statusPill = s => `<span class="order-status-pill pill-${escapeAttr(String(s).toLowerCase())}">${escapeHtml(s)}</span>`;
            ordersContainer.innerHTML = myOrders.map(o => {
                const idx = statusSteps.indexOf(o.status);
                const currentIndex = idx === -1 ? 0 : idx;
                const progressWidth = ['0%', '33%', '66%', '100%'][currentIndex] || '0%';
                const cancelled = o.status === 'Cancelled';
                return `
                <div class="order-card" style="${cancelled ? 'opacity:0.65;' : ''}">
                    <div class="order-header">
                        <div>
                            <div style="font-weight:bold; font-size:1.1rem;">${escapeHtml(o.id)}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(o.date)}</div>
                        </div>
                        <div style="text-align:right;">
                            ${statusPill(o.status)}
                            <div style="font-weight:bold; margin-top:5px;">₹${Number(o.total || 0).toLocaleString()}</div>
                            ${o.trackingNumber ? `<div style="margin-top:5px; font-size:0.78rem; color:var(--text-muted);">Tracking: <strong style="color:var(--text);">${escapeHtml(o.trackingNumber)}</strong></div>` : ''}
                        </div>
                    </div>
                    <div class="order-items">
                        <h5 style="margin-bottom:0.5rem; font-size:0.9rem;">Items:</h5>
                        ${(o.items || []).map(item => `<div style="font-size:0.9rem; color:var(--text-muted);">• ${parseInt(item.qty, 10) || 0}× ${escapeHtml(item.name)} — ₹${((parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 0)).toLocaleString()}</div>`).join('')}
                    </div>
                    ${o.adminNote ? `<div style="margin-top:1rem; padding:0.75rem 1rem; background:rgba(255,107,53,0.07); border-left:3px solid var(--secondary); border-radius:6px; font-size:0.85rem; color:var(--text-muted);"><i class="fas fa-comment-dots" style="color:var(--secondary); margin-right:6px;"></i>${escapeHtml(o.adminNote)}</div>` : ''}
                    ${cancelled ? '' : `
                    <div class="order-tracking" style="margin-top:1.5rem;">
                        <div class="tracking-progress" style="width:${progressWidth};"></div>
                        ${statusSteps.map((s, i) => `
                            <div class="tracking-step ${currentIndex >= i ? 'completed' : ''}">
                                <div class="tracking-icon"><i class="fas ${['fa-clipboard-list','fa-box-open','fa-truck','fa-home'][i]}" style="font-size:0.8rem;"></i></div>
                                <div style="font-size:0.75rem; font-weight:bold;">${escapeHtml(s)}</div>
                            </div>`).join('')}
                    </div>`}
                </div>`;
            }).join('');
        }
    },

    async saveProfile() {
        const name = document.getElementById('profName').value.trim();
        const email = document.getElementById('profEmail').value.trim();
        const phone = document.getElementById('profPhone').value.trim();

        const err = validateForm([
            { test: VALIDATORS.required, value: name,  message: 'Please enter your full name' },
            { test: v => VALIDATORS.maxLength(v, 120), value: name, message: 'Name is too long' },
            { test: VALIDATORS.email,    value: email, message: 'Please enter a valid email address' },
            { test: VALIDATORS.phone,    value: phone, message: 'Please enter a valid phone number' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        if (this.currentUser) {
            const res = await apiCall('api/customer-profile.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone })
            });
            if (res.ok && res.data && res.data.success) {
                this.setCurrentUser(res.data.user);
                this.showToast('Personal info updated successfully!', 'success');
                return;
            }
            this.showToast(this.explainApiFailure(res, 'Could not save profile'), 'error');
            return;
        }
        this.userProfile.name = name;
        this.userProfile.email = email;
        this.userProfile.phone = phone;
        this.saveProfileData();
        this.showToast('Personal info saved locally. Sign in to sync across devices.', 'info');
    },

    renderAddresses() {
        const container = document.getElementById('addressListContainer');
        if (!container) return;
        const addresses = this.userProfile.addresses || [];

        if (addresses.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No addresses saved.</p>`;
            return;
        }

        container.innerHTML = addresses.map(addr => {
            const label = addr.title || 'Address';
            const line2 = addr.line2 ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.2rem;">${escapeHtml(addr.line2)}</p>` : '';
            const landmark = addr.landmark ? `<p style="color: var(--text-muted); font-size: 0.85rem; font-style:italic; margin-bottom: 0.2rem;">${escapeHtml(addr.landmark)}</p>` : '';
            const cityLine = [addr.city, addr.state].filter(Boolean).join(', ');
            const zipCountry = [addr.zip, addr.country].filter(Boolean).join(' • ');
            const contact = (addr.fullName || addr.phone)
                ? `<p style="color: var(--text-muted); font-size: 0.8rem; margin-top:0.5rem;">${escapeHtml(addr.fullName || '')}${addr.phone ? ' · ' + escapeHtml(addr.phone) : ''}</p>`
                : '';
            const aid = escapeAttr(addr.id);
            return `
                <div class="address-card ${addr.isDefault ? 'default' : ''}">
                    ${addr.isDefault ? '<span class="address-badge">Default</span>' : ''}
                    <h4 style="margin-bottom: 0.5rem;">${escapeHtml(label)}</h4>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.2rem;">${escapeHtml(addr.street || '')}</p>
                    ${line2}
                    ${landmark}
                    <p style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(cityLine)}</p>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(zipCountry)}</p>
                    ${contact}
                    <div class="address-actions">
                        <span class="address-btn" data-action="edit-address" data-id="${aid}"><i class="fas fa-edit"></i> Edit</span>
                        <span class="address-btn" data-action="delete-address" data-id="${aid}"><i class="fas fa-trash"></i> Delete</span>
                        ${!addr.isDefault ? `<span class="address-btn" style="margin-left:auto" data-action="default-address" data-id="${aid}">Set Default</span>` : ''}
                    </div>
                </div>`;
        }).join('');
    },

    showAddressForm(id = null) {
        const modal = document.getElementById('addressModal');
        const titleEl = document.getElementById('addrModalTitle');

        const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v == null ? '' : v; };

        if (id) {
            const addr = (this.userProfile.addresses || []).find(a => String(a.id) === String(id));
            if (!addr) return;
            if (titleEl) titleEl.textContent = 'Edit Address';
            setVal('addrId', addr.id);
            setVal('addrCountry', addr.country || 'India');
            setVal('addrFullName', addr.fullName || this.userProfile.name || '');
            setVal('addrPhone', addr.phone || this.userProfile.phone || '');
            setVal('addrStreet', addr.street);
            setVal('addrLine2', addr.line2);
            setVal('addrLandmark', addr.landmark);
            setVal('addrCity', addr.city);
            setVal('addrState', addr.state || '');
            setVal('addrZip', addr.zip);
            setVal('addrTitle', addr.title);
        } else {
            if (titleEl) titleEl.textContent = 'Add Address';
            setVal('addrId', '');
            setVal('addrCountry', 'India');
            setVal('addrFullName', this.userProfile.name || '');
            setVal('addrPhone', this.userProfile.phone || '');
            setVal('addrStreet', '');
            setVal('addrLine2', '');
            setVal('addrLandmark', '');
            setVal('addrCity', '');
            setVal('addrState', '');
            setVal('addrZip', '');
            setVal('addrTitle', '');
        }
        if (modal) modal.classList.add('open');
    },

    hideAddressForm() {
        const modal = document.getElementById('addressModal');
        if (modal) modal.classList.remove('open');
    },

    async saveAddress() {
        const idVal = document.getElementById('addrId').value;
        const payload = {
            action: idVal ? 'update' : 'add',
            country: document.getElementById('addrCountry').value.trim() || 'India',
            fullName: document.getElementById('addrFullName').value.trim(),
            phone: document.getElementById('addrPhone').value.trim(),
            street: document.getElementById('addrStreet').value.trim(),
            line2: document.getElementById('addrLine2').value.trim(),
            landmark: document.getElementById('addrLandmark').value.trim(),
            city: document.getElementById('addrCity').value.trim(),
            state: document.getElementById('addrState').value.trim(),
            zip: document.getElementById('addrZip').value.trim(),
            title: document.getElementById('addrTitle').value.trim() || 'Address'
        };
        if (idVal) payload.id = parseInt(idVal);

        const err = validateForm([
            { test: VALIDATORS.required, value: payload.fullName, message: 'Please enter the recipient name' },
            { test: v => VALIDATORS.maxLength(v, 120), value: payload.fullName, message: 'Name is too long' },
            { test: VALIDATORS.phone,    value: payload.phone,  message: 'Please enter a valid phone number' },
            { test: VALIDATORS.required, value: payload.street, message: 'Please enter the street address' },
            { test: v => VALIDATORS.maxLength(v, 200), value: payload.street, message: 'Street address is too long' },
            { test: v => VALIDATORS.maxLength(v, 200), value: payload.line2,  message: 'Address line 2 is too long' },
            { test: VALIDATORS.required, value: payload.city,   message: 'Please enter the city' },
            { test: VALIDATORS.required, value: payload.state,  message: 'Please pick a state' },
            { test: VALIDATORS.zip,      value: payload.zip,    message: 'Please enter a valid postal code' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        if (this.currentUser) {
            const res = await apiCall('api/customer-addresses.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok && res.data && res.data.success) {
                this.userProfile.addresses = res.data.addresses || [];
                this.saveProfileData();
                this.hideAddressForm();
                this.renderAddresses();
                this.showToast('Address saved!', 'success');
                return;
            }
            this.showToast(this.explainApiFailure(res, 'Could not save address'), 'error');
            return;
        }

        if (!this.userProfile.addresses) this.userProfile.addresses = [];
        const newAddr = {
            id: idVal ? parseInt(idVal) : Date.now(),
            title: payload.title,
            fullName: payload.fullName,
            phone: payload.phone,
            country: payload.country,
            street: payload.street,
            line2: payload.line2,
            landmark: payload.landmark,
            city: payload.city,
            state: payload.state,
            zip: payload.zip,
            isDefault: this.userProfile.addresses.length === 0
        };
        if (idVal) {
            const idx = this.userProfile.addresses.findIndex(a => a.id === parseInt(idVal));
            if (idx >= 0) {
                newAddr.isDefault = this.userProfile.addresses[idx].isDefault;
                this.userProfile.addresses[idx] = newAddr;
            }
        } else {
            this.userProfile.addresses.push(newAddr);
        }
        this.saveProfileData();
        this.hideAddressForm();
        this.renderAddresses();
        this.showToast('Address saved!', 'success');
    },

    async deleteAddress(id) {
        if (!confirm('Delete this address?')) return;

        if (this.currentUser) {
            const res = await apiCall('api/customer-addresses.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: parseInt(id, 10) })
            });
            if (res.ok && res.data && res.data.success) {
                this.userProfile.addresses = res.data.addresses || [];
                this.saveProfileData();
                this.renderAddresses();
                return;
            }
            this.showToast(this.explainApiFailure(res, 'Could not delete address'), 'error');
            return;
        }

        this.userProfile.addresses = (this.userProfile.addresses || []).filter(a => String(a.id) !== String(id));
        if (this.userProfile.addresses.length > 0 && !this.userProfile.addresses.find(a => a.isDefault)) {
            this.userProfile.addresses[0].isDefault = true;
        }
        this.saveProfileData();
        this.renderAddresses();
    },

    async setDefaultAddress(id) {
        if (this.currentUser) {
            const res = await apiCall('api/customer-addresses.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_default', id: parseInt(id, 10) })
            });
            if (res.ok && res.data && res.data.success) {
                this.userProfile.addresses = res.data.addresses || [];
                this.saveProfileData();
                this.renderAddresses();
                return;
            }
            this.showToast(this.explainApiFailure(res, 'Could not update default'), 'error');
            return;
        }

        (this.userProfile.addresses || []).forEach(a => a.isDefault = (String(a.id) === String(id)));
        this.saveProfileData();
        this.renderAddresses();
    },

    saveProfileData() {
        localStorage.setItem('velorex_design_profile', JSON.stringify(this.userProfile));
    },

    switchProfileTab(tabId, el) {
        document.querySelectorAll('.profile-menu-item').forEach(e => e.classList.remove('active'));
        if (el) el.classList.add('active');

        document.querySelectorAll('.profile-section').forEach(e => e.classList.remove('active'));
        const section = document.getElementById('tab-' + tabId);
        if (section) section.classList.add('active');
    },

    submitContact() {
        const name = document.getElementById('contactName').value.trim();
        const emailEl = document.getElementById('contactEmailField');
        const email = emailEl ? emailEl.value.trim() : '';
        const subj = document.getElementById('contactSubject').value;
        const message = document.getElementById('contactMessage').value.trim();

        const err = validateForm([
            { test: VALIDATORS.required, value: name,    message: 'Please enter your name' },
            { test: v => VALIDATORS.maxLength(v, 120),   value: name, message: 'Name is too long' },
            { test: VALIDATORS.email,    value: email,   message: 'Please enter a valid email' },
            { test: VALIDATORS.required, value: message, message: 'Please enter a message' },
            { test: v => VALIDATORS.maxLength(v, 2000),  value: message, message: 'Message is too long' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        this.showToast(`Thanks ${name}! Your inquiry about '${subj}' has been sent.`, 'success');

        document.getElementById('contactName').value = '';
        if (emailEl) emailEl.value = '';
        document.getElementById('contactMessage').value = '';
    },

    showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        const icon = document.createElement('i');
        icon.className = 'fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle');
        icon.style.color = 'var(--' + (type === 'success' ? 'success' : 'secondary') + ')';
        icon.style.marginRight = '10px';
        toast.appendChild(icon);
        toast.appendChild(document.createTextNode(' ' + String(msg)));
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showAuthForm(which) {
        const login = document.getElementById('loginForm');
        const reg = document.getElementById('registerForm');
        if (which === 'register') {
            if (login) login.style.display = 'none';
            if (reg) reg.style.display = 'block';
        } else {
            if (login) login.style.display = 'block';
            if (reg) reg.style.display = 'none';
        }
    },

    subscribeNewsletter(e) {
        e.preventDefault();
        const input = e.target.querySelector('input[type="email"]');
        if (input && !VALIDATORS.email(input.value.trim())) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }
        this.showToast('Subscribed successfully!', 'success');
        if (input) input.value = '';
    }
};

/* ──────────────────────────────────────────────────────────────
   EVENT DELEGATION (CSP-friendly wiring)
   ────────────────────────────────────────────────────────────── */

const ACTION_HANDLERS = {
    'nav-home':            () => app.navigate('home'),
    'nav-profile':         () => app.navigate('profile'),
    'nav-cart':            () => app.navigate('cart'),
    'nav-toggle':          () => { const n = document.getElementById('navLinks'); if (n) n.classList.toggle('show'); },
    'back-to-top':         () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    'toggle-theme':        () => app.toggleTheme(),
    'goto-products':       () => app.navigate('products'),
    'goto-services':       () => app.navigate('services'),
    'open-product':        (e, el) => app.navigate('product-detail', { id: el.dataset.id }),
    'open-category':       (e, el) => app.navigate('products', { cat: el.dataset.cat }),
    'add-to-cart':         (e, el) => app.addToCart(el.dataset.id),
    'qty':                 (e, el) => app.updateQty(el.dataset.id, parseInt(el.dataset.delta, 10)),
    'checkout':            () => app.checkout(),
    'close-checkout':      () => app.closeCheckoutModal(),
    'close-addr-modal':    () => app.hideAddressForm(),
    'edit-address':        (e, el) => app.showAddressForm(el.dataset.id),
    'delete-address':      (e, el) => app.deleteAddress(el.dataset.id),
    'default-address':     (e, el) => app.setDefaultAddress(el.dataset.id),
    'show-addr-form':      () => app.showAddressForm(),
    'logout':              () => app.handleLogout(),
    'profile-tab':         (e, el) => app.switchProfileTab(el.dataset.tab, el),
    'select-service':      (e, el) => app.selectServiceType(el.dataset.svc),
    'select-package':      (e, el) => app.selectPackage(el.dataset.svc, parseInt(el.dataset.idx, 10)),
    'proceed-service':     (e, el) => app.proceedService(el.dataset.svc, parseInt(el.dataset.idx, 10)),
    'select-detail-img':   (e, el) => app.selectDetailImage(parseInt(el.dataset.idx, 10)),
    'show-register':       () => app.showAuthForm('register'),
    'show-login':          () => app.showAuthForm('login'),
    'faq-toggle':          (e, el) => el.classList.toggle('active'),
    'clear-notifs':        () => app.clearNotifications()
};

function wireDelegatedEvents() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        const tag = trigger.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        const handler = ACTION_HANDLERS[trigger.dataset.action];
        if (handler) {
            if (trigger.tagName === 'A' && (trigger.getAttribute('href') || '').startsWith('#')) {
                // Allow hash navigation to set window.location.hash; do not preventDefault
            }
            handler(e, trigger);
        }
    });

    document.addEventListener('change', (e) => {
        const trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        if (trigger.dataset.action === 'cat-filter') app.filterProducts();
    });

    document.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-action]');
        if (!form) return;
        const action = form.dataset.action;
        e.preventDefault();
        if (action === 'login')           app.handleLogin(e);
        else if (action === 'register')   app.handleRegister(e);
        else if (action === 'save-profile') app.saveProfile();
        else if (action === 'save-address') app.saveAddress();
        else if (action === 'submit-checkout') app.submitCheckout();
        else if (action === 'submit-contact')  app.submitContact();
        else if (action === 'subscribe-newsletter') app.subscribeNewsletter(e);
    });

    // Broken-image fallback (replaces inline onerror)
    document.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG') {
            const fb = t.dataset.fallback;
            if (fb && t.src !== fb) {
                t.src = fb;
            } else if (t.dataset.brokenOpacity === '1') {
                t.style.opacity = '0.3';
            }
        }
    }, true);
}

document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    wireDelegatedEvents();
    app.init();
});
