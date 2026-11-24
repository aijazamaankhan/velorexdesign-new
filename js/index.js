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

/* ──────────────────────────────────────────────────────────────
   ROUTING: real URLs (/product/5-name, /category/wood, /about …)
   so each page can be indexed and shared on its own. The server
   (seo-render.php) answers the same addresses with the page already
   filled in; this code then takes over without reloading.
   slugify() and routeToPath() must match api/seo-lib.php.
   ────────────────────────────────────────────────────────────── */

const ROUTE_PAGES = ['products', 'wellness', 'services', 'cart', 'profile', 'about', 'contact', 'terms', 'privacy', 'faq', 'shipping', 'returns', 'process', 'auth'];

function slugify(text) {
    let s = String(text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (s.length > 60) s = s.slice(0, 60).replace(/-+$/, '');
    return s;
}

function routeToPath(view, params = {}) {
    const p = Object.assign({}, params);
    let path;
    if (!view || view === 'home') {
        path = '/';
    } else if (view === 'product-detail') {
        const id = String(p.id == null ? '' : p.id);
        delete p.id;
        const product = PRODUCTS.find(x => String(x.id) === id);
        // Database products have numeric ids and get a readable slug. The built-in
        // starter products have text ids and are addressed by that id alone.
        const slug = /^\d+$/.test(id) && product ? slugify(product.name) : '';
        path = '/product/' + encodeURIComponent(id) + (slug ? '-' + slug : '');
    } else if (view === 'products' && p.cat && p.cat !== 'all') {
        path = '/category/' + encodeURIComponent(p.cat);
        delete p.cat;
    } else {
        if (view === 'products') delete p.cat;
        path = '/' + view;
    }
    const qs = new URLSearchParams(p).toString();
    return path + (qs ? '?' + qs : '');
}

// Reads the current address into { view, params }. Unknown addresses give view '' .
function parseLocation(loc = window.location) {
    const params = new URLSearchParams(loc.search);
    const path = decodeURIComponent(loc.pathname).replace(/\/+$/, '') || '/';
    let m;
    if (path === '/' || path === '/index.html') return { view: 'home', params };
    if ((m = path.match(/^\/product\/(\d+)(?:-.*)?$/))) { params.set('id', m[1]); return { view: 'product-detail', params }; }
    if ((m = path.match(/^\/product\/(.+)$/)))            { params.set('id', m[1]); return { view: 'product-detail', params }; }
    if ((m = path.match(/^\/category\/([^/]+)$/)))        { params.set('cat', m[1]); return { view: 'products', params }; }
    if ((m = path.match(/^\/([a-z-]+)$/)) && ROUTE_PAGES.includes(m[1])) return { view: m[1], params };
    return { view: '', params };
}

// Turns an old-style "#view?x=1" reference into its real path ('' if it is not one).
function hashToPath(hash) {
    const m = String(hash || '').match(/^#([a-z-]+)(?:\?(.*))?$/);
    if (!m) return '';
    const view = m[1];
    if (view !== 'home' && view !== 'product-detail' && !ROUTE_PAGES.includes(view)) return '';
    return routeToPath(view, Object.fromEntries(new URLSearchParams(m[2] || '')));
}

// Links in the page are written as "#view" for brevity. Give each its real
// address so search engines can follow it and "open in new tab" works.
function upgradeLinks(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('a[href^="#"]').forEach(a => {
        const path = hashToPath(a.getAttribute('href'));
        if (path) a.setAttribute('href', path);
    });
}

function initRouting() {
    // Old bookmarks and shared links (/#product-detail?id=5) move to the real address.
    if (window.location.hash) {
        const path = hashToPath(window.location.hash);
        if (path) history.replaceState(null, '', path);
    }

    upgradeLinks(document);
    new MutationObserver(muts => {
        muts.forEach(m => m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches && n.matches('a[href^="#"]')) upgradeLinks(n.parentNode);
            else upgradeLinks(n);
        }));
    }).observe(document.body, { childList: true, subtree: true });

    // Follow internal links without reloading the page.
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
        const raw = a.getAttribute('href');
        if (raw === '#') { e.preventDefault(); return; }       // placeholder links go nowhere
        let url;
        try { url = new URL(a.href, window.location.href); } catch (_) { return; }
        if (url.origin !== window.location.origin) return;
        if (raw.startsWith('#')) {
            const path = hashToPath(raw);
            if (!path) return;
            url = new URL(path, window.location.origin);
        }
        if (!parseLocation(url).view) return;                   // a real file such as /admin.html
        e.preventDefault();
        const next = url.pathname + url.search;
        if (next !== window.location.pathname + window.location.search) history.pushState(null, '', next);
        app.handleRoute();
    });

    window.addEventListener('popstate', () => app.handleRoute());
}

/* ──────────────────────────────────────────────────────────────
   SEO: page title, description, canonical URL and structured data.
   Search engines read these to decide what the page is about and
   how to show it in results.
   ────────────────────────────────────────────────────────────── */

const SEO_DEFAULT = {
    title: 'Velorex Design | Handcrafted Wood, Resin Art & Wellness',
    description: 'Handcrafted sheesham wood serveware, MDF racks and shelves, resin art and Ayurvedic wellness products such as the Vijaysar wood glass. Made by hand in India, shipped India-wide.'
};
const VIJAYSAR_OG_IMAGE = 'images/products/vijaysar/og-vijaysar.jpg';

/* Store WhatsApp number in international format, digits only (e.g. 919876543210).
   Every visitor uses this; the admin panel setting, if saved, overrides it.
   Leave empty to hide the WhatsApp order buttons. */
const STORE_WHATSAPP_DEFAULT = '917906027807'; // +91 79060 27807

function storeWhatsAppNumber() {
    let saved = '';
    try { saved = (JSON.parse(localStorage.getItem('velorex_store_settings')) || {}).whatsapp || ''; } catch (e) { /* ignore */ }
    return String(saved || STORE_WHATSAPP_DEFAULT).replace(/\D/g, '');
}

function whatsAppOrderUrl(product) {
    const n = storeWhatsAppNumber();
    if (!n || !product) return '';
    const link = window.location.origin + routeToPath('product-detail', { id: product.id });
    const text = `Hi Velorex Design! I would like to order:

*${product.name}*

${link}

Please share the price, payment and delivery details.`;
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/* Amazon listings, matched by product name so database rows pick them up too. */
const AMAZON_LINKS = [
    { match: /combo/i, url: 'https://www.amazon.in/dp/B0H1KJ7Z8F' },
    { match: /vijaysar/i, url: 'https://www.amazon.in/dp/B0H3QK8K7S' },
    { match: /neem.*comb/i, url: 'https://www.amazon.in/dp/B0H8NDDTVH' },
    { match: /compact 2-tier spice rack/i, url: 'https://www.amazon.in/dp/B0GXJ42Y4S' },
    { match: /multipurpose 2-tier/i, url: 'https://www.amazon.in/dp/B0HK2CY3C6' },
    { match: /mango.*tray/i, url: 'https://www.amazon.in/dp/B0HHFSJTH9' }
];
const STORE_EMAIL = 'velorexdesign@gmail.com';
const WA_DISPLAY = '+91 79060 27807';

/** The only way to buy on this site: Amazon, or an enquiry for unlisted items. */
function buyButtonHtml(product, extraClass = '') {
    const amazon = amazonUrlFor(product);
    if (amazon) {
        return `<a class="btn btn-amazon ${extraClass}" href="${escapeAttr(amazon)}" target="_blank" rel="noopener noreferrer sponsored"><i class="fab fa-amazon"></i> Buy on Amazon</a>`;
    }
    const wa = whatsAppOrderUrl(product);
    if (wa) {
        return `<a class="btn btn-whatsapp ${extraClass}" href="${escapeAttr(wa)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Order on WhatsApp</a>`;
    }
    const mail = `mailto:${STORE_EMAIL}?subject=${encodeURIComponent('Enquiry: ' + (product.name || 'Velorex product'))}`;
    return `<a class="btn btn-secondary ${extraClass}" href="${escapeAttr(mail)}"><i class="fas fa-envelope"></i> Ask about this</a>`;
}

/* Hero campaign banners. Each one can point at a product (by name match), the
   Amazon store, WhatsApp or a page. Edit here to change the home carousel. */
const HERO_PROMOS = [
    {
        key: 'vijaysar', eyebrow: 'Ayurvedic wellness', icon: 'fas fa-leaf',
        title: 'Fill it at night.<br><span class="text-gradient">Drink it at dawn.</span>',
        desc: 'The Vijaysar heartwood glass, hand-turned in Meerut. Natural wood, no polish, packed in a Velorex gift box.',
        bg: 'images/products/vijaysar/banner.webp', art: 'images/products/vijaysar/box-front.webp',
        product: /vijaysar/i, badge: 'Bestseller'
    },
    {
        key: 'combo', eyebrow: 'Gift set', icon: 'fas fa-gift',
        title: 'Natural Wellness <span class="text-gradient">Combo Kit</span>',
        desc: 'Vijaysar glass, neem wood comb and acupressure stick in one box. A thoughtful gift for parents and grandparents.',
        bg: 'images/products/combo/combo-kit.webp', art: 'images/products/combo/combo-kit.webp',
        product: /combo/i, badge: '3 in 1'
    },
    {
        key: 'racks', eyebrow: 'Kitchen & home storage', icon: 'fas fa-layer-group',
        title: 'Racks that <span class="text-gradient">clear the counter</span>',
        desc: 'Compact spice racks, two-tier organisers and a four-tier wall rack, precision-cut and hand-finished.',
        bg: 'images/products/rack-4tier-1.webp', art: 'images/products/rack-2tier-14-1.webp',
        category: 'rack', badge: '3 sizes'
    },
    {
        key: 'buy', eyebrow: 'Two easy ways to buy', icon: 'fas fa-bag-shopping',
        title: 'Buy on <span class="text-gradient">Amazon</span> or order on WhatsApp',
        desc: 'Amazon delivery and returns, or message us directly at +91 79060 27807 for gifting and bulk orders.',
        bg: 'images/hero.webp', art: 'images/products/combo/leaflet-more-from-velorex.webp',
        buy: true, badge: 'Fast replies'
    }
];

const BADGES = {
    bestseller: { label: 'Bestseller', icon: 'fas fa-fire' },
    new: { label: 'New', icon: 'fas fa-star' },
    limited: { label: 'Limited stock', icon: 'fas fa-hourglass-half' },
    gift: { label: 'Gift idea', icon: 'fas fa-gift' }
};
function productBadgeHtml(p) {
    const b = BADGES[p.badge];
    if (b) return `<span class="product-badge badge-${p.badge}"><i class="${b.icon}"></i> ${b.label}</span>`;
    return p.featured ? '<span class="product-badge">Featured</span>' : '';
}

function amazonUrlFor(product) {
    // A link set in admin wins; the name table below covers built-in products.
    if (product && /^https:\/\/([a-z0-9-]+\.)*(amazon\.in|amzn\.in|amzn\.to)\//i.test(product.amazonUrl || '')) return product.amazonUrl;
    const hit = AMAZON_LINKS.find(l => l.match.test(String((product && product.name) || '')));
    return hit ? hit.url : '';
}

const SEO_VIEWS = {
    home:     SEO_DEFAULT,
    products: { title: 'Shop All Handcrafted Products | Velorex Design', description: 'Browse every Velorex Design product: wood serveware, MDF racks and shelves, resin art, handmade soap, candles and wellness pieces. Buy on Amazon.' },
    wellness: { title: 'Velorex Wellness | Vijaysar Glass, Neem Comb & Acupressure', description: 'Traditional Ayurvedic wood products made by hand: Vijaysar wood glass, neem wood comb and acupressure tools. 100% natural, no paint or polish.', image: VIJAYSAR_OG_IMAGE },
    services: { title: 'Graphic Design Services | Velorex Design', description: 'Logo, branding, social media and print design from Velorex Design. Pick a package and message us on WhatsApp.' },
    about:    { title: 'About Us | Velorex Design', description: 'Velorex Design is an Indian workshop making handcrafted wood items, resin art and wellness products.' },
    process:  { title: 'How We Make It | Velorex Design', description: 'How Velorex Design products go from raw wood and resin to a finished, hand-checked piece.' },
    contact:  { title: 'Contact Us | Velorex Design', description: 'Questions about an order or a custom piece? Contact Velorex Design by WhatsApp, phone or email.' },
    faq:      { title: 'FAQ | Velorex Design', description: 'Answers about ordering, payment, shipping, returns and custom work at Velorex Design.' },
    shipping: { title: 'Shipping & Delivery | Velorex Design', description: 'Delivery times and shipping charges for Velorex Design orders across India. Free shipping above ₹999.' },
    returns:  { title: 'Returns & Refunds | Velorex Design', description: 'When and how Velorex Design accepts returns and issues refunds.' },
    terms:    { title: 'Terms & Conditions | Velorex Design', description: 'Terms that apply when you buy from Velorex Design.' },
    privacy:  { title: 'Privacy Policy | Velorex Design', description: 'What personal information Velorex Design collects and how it is used.' }
};

function setSeo({ title, description, image, noindex } = {}) {
    const t = title || SEO_DEFAULT.title;
    const d = String(description || SEO_DEFAULT.description).replace(/\s+/g, ' ').trim().slice(0, 300);
    document.title = t;
    const set = (id, attr, value) => { const el = document.getElementById(id); if (el) el.setAttribute(attr, value); };
    const origin = window.location.origin;
    const pageUrl = origin + window.location.pathname;
    set('metaDescription', 'content', d);
    set('ogTitle', 'content', t);
    set('ogDescription', 'content', d);
    set('canonicalLink', 'href', pageUrl);
    set('ogUrl', 'content', pageUrl);
    set('ogImage', 'content', new URL(image || 'hero.png', window.location.origin + '/').href);
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute('content', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
}

// Adds or replaces one block of schema.org data in the page head.
function setStructuredData(id, data) {
    let el = document.getElementById(id);
    if (!data) { if (el) el.remove(); return; }
    if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = id;
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
}

function productSchema(p) {
    const pageUrl = window.location.origin + '/';
    return {
        '@type': 'Product',
        name: p.name,
        description: String(p.desc || '').slice(0, 500),
        image: (p.images && p.images.length ? p.images : [p.img]).filter(Boolean).map(u => new URL(u, pageUrl).href),
        category: getCatName(p.cat),
        brand: { '@type': 'Brand', name: 'Velorex Design' }
    };
}

// Shop-wide data: who the shop is, plus the product list once it has loaded.
function setShopStructuredData() {
    const pageUrl = window.location.origin + '/';
    setStructuredData('ldShop', {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'OnlineStore',
                '@id': pageUrl + '#store',
                name: 'Velorex Design',
                url: pageUrl,
                logo: new URL('favicon.svg', pageUrl).href,
                image: new URL('hero.png', pageUrl).href,
                description: SEO_DEFAULT.description,
                areaServed: 'IN',
                sameAs: ['https://www.youtube.com/@sahacraft', 'https://www.instagram.com/velorexdesign_saha_craft/', 'https://www.amazon.in/l/27943762031?me=A23A7Y0AFUIEBT']
            },
            { '@type': 'WebSite', '@id': pageUrl + '#website', name: 'Velorex Design', url: pageUrl, publisher: { '@id': pageUrl + '#store' } }
        ]
    });
    setStructuredData('ldProducts', PRODUCTS.length ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Velorex Design products',
        itemListElement: PRODUCTS.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: productSchema(p) }))
    } : null);
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
    { id: 'wood',         name: 'Wood Items',    icon: 'fas fa-tree',      image: 'images/categories/wood.webp' },
    { id: 'rack',         name: 'MDF Racks & Shelves', icon: 'fas fa-layer-group', image: 'images/products/rack-4tier-1.jpg' },
    { id: 'wellness',     name: 'Wellness',      icon: 'fas fa-leaf',      image: 'images/products/combo/category-wellness.webp' },
    { id: 'resin',        name: 'Resin Art',     icon: 'fas fa-tint',      image: 'images/categories/resin.webp' },
    { id: 'soap',         name: 'Handmade Soap', icon: 'fas fa-soap',      image: 'images/categories/soap.svg' },
    { id: 'candle',       name: 'Candles',       icon: 'fas fa-fire-alt',  image: 'images/categories/candle.webp' },
    { id: 'raw_material', name: 'Raw Materials', icon: 'fas fa-box',       image: 'images/categories/raw.webp' }
];
const DEFAULT_CAT_FALLBACK_ICON = 'fas fa-tag';
const DEFAULT_CAT_FALLBACK_IMAGE = 'https://placehold.co/400x300/1a0a2e/ffd700?text=New+Category';

/* Built-in starter products for the Wellness page. Shown only while the DB has
   no products in the 'wellness' category; real admin/DB products replace them.
   Swap the `img` paths for real photos (e.g. images/neem-comb.png) anytime. */
const STATIC_WELLNESS_PRODUCTS = [
    {
        id: 'w-vijaysar',
        name: 'Vijaysar Wood Wellness Glass',
        tagline: 'Fill it at night, drink it at dawn — the Ayurvedic wooden tumbler that infuses your water while you sleep.',
        price: 399,
        img: 'vijaysar-glass.png',
        images: ['vijaysar-glass.png', 'images/products/vijaysar/box-front.webp', 'images/products/vijaysar/box-open.webp', 'images/products/vijaysar/box-side.webp', 'images/products/vijaysar/box-back.webp', 'images/products/vijaysar/infographic.webp', 'images/products/vijaysar/leaflet-how-to-use.webp', 'vijaysar-glass-2.png'],
        cat: 'wellness',
        desc: 'A traditional Ayurvedic tumbler hand-turned from the heartwood of the Vijaysar tree (Pterocarpus marsupium, the Indian Kino tree). Fill it with drinking water at night and let it sit for 8–10 hours; by morning the water turns light brown as the wood’s natural bioactive compounds infuse into it. Drink on an empty stomach to support healthy metabolism and blood sugar balance. 100% natural wood — no paints, chemicals or polishes. Replace after 30 to 90 days, depending on how often you use it. (Traditional wellness product, not a medicine.)',
        stock: 50,
        featured: false,
        extra: 'vijaysar'
    },
    {
        id: 'w-neem-comb',
        name: 'Neem Wood Comb',
        tagline: 'Anti-bacterial neem wood that calms the scalp and tames frizz — no plastic, no static.',
        price: 169,
        img: 'neem-comb.png',
        images: ['neem-comb.png', 'neem-comb-detailes.png'],
        cat: 'wellness',
        desc: 'Hand-finished comb made from anti-bacterial neem wood. Helps reduce dandruff, soothes an itchy scalp, controls frizz and distributes natural oils through the hair — a chemical-free, static-free alternative to plastic combs.',
        stock: 100,
        featured: false,
        extra: 'neem'
    },
    {
        id: 'w-acupressure',
        name: 'Acupressure Wooden Stick',
        tagline: 'A pocket-sized wooden tool for pressure points — ease knots and tension wherever you are.',
        price: 149,
        img: 'acupressure-stick.png',
        images: ['acupressure-stick.png'],
        cat: 'wellness',
        desc: 'Hand-held wooden acupressure tool used to stimulate pressure points across the hands, feet and body. Helps ease muscle tension, improve circulation and support everyday relaxation. Crafted from smooth, untreated natural wood.',
        stock: 100,
        featured: false,
        extra: 'acupressure'
    },
    {
        id: 'w-combo-kit',
        name: 'Natural Wellness Combo Kit',
        tagline: 'The Vijaysar glass, neem comb and acupressure stick together, a complete daily ritual and an easy gift.',
        price: 499,
        img: 'images/products/combo/combo-kit.webp',
        images: ['images/products/combo/combo-kit.webp', 'images/products/combo/glass.webp', 'images/products/combo/comb.webp', 'images/products/combo/stick.webp', 'images/products/combo/leaflet-more-from-velorex.webp'],
        cat: 'wellness',
        desc: 'A 3-piece set of traditional wood wellness tools: a Vijaysar wooden glass (Pterocarpus marsupium) for overnight infused water, a neem wood comb that detangles gently and reduces static, and a ridged wooden acupressure stick for pressure points on the scalp and body. Made in India by Velorex Design.',
        stock: 50,
        featured: false,
        extra: 'combo'
    }
];

/* Starter catalog prices (₹). The tray and 2-tier racks match their Amazon.in
   listings; the 4-tier rack has no Amazon listing yet. */
const PLACEHOLDER_PRICES = {
    'wd-mango-tray':  649,
    'rk-4tier-24':   1299,
    'rk-2tier-14':    589,
    'rk-2tier-8':     439
};

/* Built-in starter products for the main catalog, grouped by type: the Sheesham
   wood tray sits in 'wood', the three MDF racks in 'rack'. Shown until matching
   DB products exist (see catalog-seed.sql to make them buyable end-to-end). */
const STATIC_CATALOG_PRODUCTS = [
    {
        id: 'wd-mango-tray',
        name: 'Mango-Shaped Sheesham Wood Tray',
        tagline: 'Hand-carved solid Sheesham in a mango silhouette — three screw-in legs turn a platter into a serving stand.',
        price: PLACEHOLDER_PRICES['wd-mango-tray'],
        img: 'images/products/mango-tray-1.jpg',
        images: [
            'images/products/mango-tray-1.jpg',
            'images/products/mango-tray-2.jpg',
            'images/products/mango-tray-3.jpg',
            'images/products/mango-tray-4.jpg'
        ],
        cat: 'wood',
        desc: 'A hand-carved serving tray in solid Sheesham (Indian rosewood), shaped like a mango / paisley motif. Concentric hand-cut grooves ripple out from a deep scooped well, and the whole edge is finished with a scalloped, hand-chiselled border. Three turned legs screw in and out, so the same piece works as a footed serving stand, a flat platter or a wall display piece. Natural wood grain and tone vary from piece to piece — no two trays are identical.',
        stock: 25,
        featured: false,
        extra: 'mango-tray'
    },
    {
        id: 'rk-4tier-24',
        name: 'Velorex 4-Tier Wall Mounted Rack — 24" × 24"',
        tagline: 'Four tiers, 24 inches square — up to 32 spice jars off the counter and onto the wall.',
        price: PLACEHOLDER_PRICES['rk-4tier-24'],
        img: 'images/products/rack-4tier-1.jpg',
        images: [
            'images/products/rack-4tier-1.jpg',
            'images/products/rack-4tier-2.jpg',
            'images/products/rack-4tier-3.jpg',
            'images/products/rack-4tier-4.jpg'
        ],
        cat: 'rack',
        desc: 'A four-tier wall mounted rack in dark walnut-finish engineered wood (MDF), 24 inches wide by 24 inches tall with a 4 inch deep shelf. Holds 24–32 standard spice jars in the kitchen, or works just as well as a display shelf for books, toys, collectibles and plants. Ships flat as six pre-drilled boards and assembles in minutes.',
        stock: 30,
        featured: false,
        extra: 'rack-4tier'
    },
    {
        id: 'rk-2tier-14',
        name: 'Velorex Multipurpose 2-Tier Organizer Rack — 14" × 14"',
        tagline: 'Deep 6-inch tiers with brass fittings — tall bottles, spice jars or a full row of CDs.',
        price: PLACEHOLDER_PRICES['rk-2tier-14'],
        img: 'images/products/rack-2tier-14-1.jpg',
        images: [
            'images/products/rack-2tier-14-1.jpg',
            'images/products/rack-2tier-14-2.jpg',
            'images/products/rack-2tier-14-3.jpg',
            'images/products/rack-2tier-14-4.jpg',
            'images/products/rack-2tier-14-5.jpg',
            'images/products/rack-2tier-14-6.jpg'
        ],
        cat: 'rack',
        desc: 'A two-tier organizer rack in dark walnut-finish engineered wood (MDF), 14 inches wide by 14 inches tall with deep 6 inch trays and brass connector hardware. The extra depth takes tall spice jars, oil and sauce bottles, tea and coffee tins — or a full row of CDs, DVDs and Blu-ray cases. Sits on a counter or desk, or mounts on a wall.',
        stock: 40,
        featured: false,
        extra: 'rack-2tier-14'
    },
    {
        id: 'rk-2tier-8',
        name: 'Velorex Compact 2-Tier Spice Rack — 14" × 8"',
        tagline: 'The compact one: 14 by 8 inches of everyday spices, on the counter or inside the cabinet.',
        price: PLACEHOLDER_PRICES['rk-2tier-8'],
        img: 'images/products/rack-2tier-8-1.jpg',
        images: [
            'images/products/rack-2tier-8-1.jpg',
            'images/products/rack-2tier-8-2.jpg',
            'images/products/rack-2tier-8-3.jpg',
            'images/products/rack-2tier-8-4.jpg'
        ],
        cat: 'rack',
        desc: 'The compact two-tier rack in the same dark walnut-finish engineered wood (MDF) — 14 inches wide, 8 inches tall, 4 inches deep. Sized for a countertop, a kitchen shelf or inside a cabinet, it keeps six to twelve everyday spice jars in easy reach without taking over the worktop. Four flat boards, assembled in minutes.',
        stock: 50,
        featured: false,
        extra: 'rack-2tier-8'
    }
];

/* Rich "deep-dive" content shown on a product's detail page, keyed by a slug.
   Add an entry here to give any product its own write-up. Optional fields:
   `icon` (badge icon), `specs`, `stepsHeading`, `benefitsHeading`. */
const PRODUCT_DETAILS = {
    vijaysar: {
        badge: 'Natural · Ayurvedic · Chemical-Free',
        introHeading: 'Heartwood of the Indian Kino Tree',
        introText: 'Hand-turned from the heartwood of the Vijaysar tree (<em>Pterocarpus marsupium</em>, the Indian Kino tree), this wooden glass is a time-honoured Ayurvedic vessel. It is used as a holistic, chemical-free way to support healthy metabolic function and help manage blood sugar levels.',
        points: [
            '100% natural wood',
            'Traditionally used to balance blood sugar &amp; aid digestion',
            'Simple overnight ritual — just water and time'
        ],
        specs: [
            { label: 'Material', value: 'Vijaysar heartwood (Pterocarpus marsupium)' },
            { label: 'Sourcing', value: 'Heartwood from the forests of South India' },
            { label: 'Capacity', value: '90 ml' },
            { label: 'Finish', value: 'Natural wood, no paint, chemicals or polish' },
            { label: 'Use', value: 'Soak drinking water 8 to 10 hours, drink in the morning' },
            { label: 'Replace', value: 'After 90, 45 or 30 days if used 1, 2 or 3 times a day' },
            { label: 'Packaging', value: 'Velorex printed gift box' },
            { label: 'Made in', value: 'India, hand-turned' }
        ],
        steps: [
            { icon: 'fas fa-fill-drip', img: 'images/products/vijaysar/step-fill.webp', title: 'Fill', text: 'Rinse the glass well before first use. Fill the wooden glass with drinking water at night and let it sit for <strong>8 to 10 hours</strong>.' },
            { icon: 'fas fa-mug-hot', img: 'images/products/vijaysar/step-soak.webp', title: 'Soak', text: 'By morning the water turns a <strong>light brown</strong> colour as the wood\'s natural bioactive compounds infuse into it.' },
            { icon: 'fas fa-sun', img: 'images/products/vijaysar/step-drink.webp', title: 'Drink', text: 'Drink the infused water on an <strong>empty stomach</strong> first thing in the morning.' }
        ],
        benefits: [
            { icon: 'fas fa-seedling', title: 'Wellness Support', text: 'Widely used in Ayurveda to help balance blood sugar, aid digestion and detoxify the body.' },
            { icon: 'fas fa-tree', title: 'Natural Material', text: 'Made from 100% natural wood without any artificial paints, chemicals or polishes.' },
            { icon: 'fas fa-hourglass-half', title: 'Lifespan', text: 'The leaching properties of the wood gradually diminish with regular use over time.' },
            { icon: 'fas fa-calendar-alt', title: 'Replace Regularly', text: 'Replace after <strong>30 to 90 days</strong>, depending on how often you use it (see the schedule above).' }
        ],
        firstUse: 'rinse with plain water, fill it once and throw that water away. Start from the next fill.',
        care: [
            'Rinse with plain water only',
            'No soap, detergent or dishwasher',
            'Don’t keep water in it for over 12 hours',
            'Dry upside down in an airy place',
            'Not for microwave, fridge or hot liquids'
        ],
        goodToKnow: [
            'Brown water is the wood’s natural colour',
            'The colour gets lighter as the glass ages',
            'Use one glass per person',
            'Store dry, away from damp and sunlight',
            'Stop using if you see mould or cracks'
        ],
        replaceSchedule: [
            { days: 90, use: '1 time daily' },
            { days: 45, use: '2 times daily' },
            { days: 30, use: '3 times daily' }
        ],
        disclaimer: 'Traditional Ayurvedic wellness product, not a medicine. If you have diabetes or take medication, ask your doctor before use.'
    },
    neem: {
        badge: 'Natural · Ayurvedic · Plastic-Free',
        introHeading: 'Crafted from Pure Neem Wood',
        introText: 'Carved from solid neem wood (<em>Azadirachta indica</em>), a wood prized in Ayurveda for its natural anti-bacterial and anti-fungal properties. Unlike plastic combs, a neem comb glides through hair without creating static and helps spread the scalp\'s natural oils for healthier, shinier hair.',
        points: [
            '100% natural neem wood — no plastic',
            'Anti-bacterial &amp; anti-fungal — soothes the scalp',
            'Reduces dandruff, frizz and static'
        ],
        specs: [
            { label: 'Material', value: 'Natural neem wood, smooth polished finish' },
            { label: 'Teeth', value: 'Fine, rounded teeth, gentle on the scalp' },
            { label: 'Use', value: 'Hair, beard and moustache' },
            { label: 'Hair types', value: 'Straight, wavy, curly and coily; fine to thick' },
            { label: 'Weight', value: '40 g, slim enough for a pocket or bag' },
            { label: 'Made in', value: 'India' }
        ],
        steps: [
            { icon: 'fas fa-wind', title: 'Detangle', text: 'Start at the ends and work upward in small sections to gently remove knots.' },
            { icon: 'fas fa-arrows-down-to-line', title: 'Comb Daily', text: 'Run it through your hair <strong>2–3 times a day</strong> to spread natural oils from root to tip.' },
            { icon: 'fas fa-droplet-slash', title: 'Keep Dry', text: 'Wipe clean after use and store dry — avoid soaking the wood in water.' }
        ],
        benefits: [
            { icon: 'fas fa-head-side-virus', title: 'Scalp Health', text: 'Anti-bacterial neem helps reduce dandruff and soothes an itchy, flaky scalp.' },
            { icon: 'fas fa-leaf', title: 'Natural Material', text: 'Handmade from solid neem wood — no plastic, paints or chemicals.' },
            { icon: 'fas fa-wand-magic-sparkles', title: 'Healthier Hair', text: 'Distributes natural oils for smoother, shinier, frizz- and static-free hair.' },
            { icon: 'fas fa-hand-holding-droplet', title: 'Care &amp; Lifespan', text: 'Keep dry and oil occasionally with a little coconut oil; lasts for years with care.' }
        ],
        disclaimer: 'Natural wood grain, tone and engraving may vary slightly from piece to piece — each comb is unique.'
    },
    combo: {
        badge: 'Natural · Ayurvedic · 3-Piece Set',
        icon: 'fas fa-gift',
        introHeading: 'Three Traditional Tools, One Kit',
        introText: 'A curated set of the three Velorex wellness pieces: the Vijaysar wooden glass for overnight infused water, the neem wood comb for gentle detangling, and the ridged acupressure stick for pressure points. Each piece is finished by hand from natural wood, and the set makes a thoughtful gift for anyone who likes nature-inspired self-care.',
        points: [
            'Vijaysar glass + neem comb + acupressure stick',
            'All natural wood, no plastic or paint',
            'Ready to gift'
        ],
        specs: [
            { label: 'In the box', value: '1 Vijaysar wooden glass, 1 neem wood comb, 1 wooden acupressure stick' },
            { label: 'Pieces', value: '3' },
            { label: 'Weight', value: 'About 250 g' },
            { label: 'Package size', value: '15.2 × 12.7 × 15.2 cm' },
            { label: 'Made in', value: 'India, by Velorex Design' }
        ],
        stepsHeading: 'A Simple Daily Routine',
        steps: [
            { icon: 'fas fa-glass-water', title: 'Night', text: 'Fill the <strong>Vijaysar glass</strong> with drinking water and leave it for 8 to 10 hours.' },
            { icon: 'fas fa-sun', title: 'Morning', text: 'Drink the infused water on an empty stomach, then <strong>comb</strong> with the neem comb.' },
            { icon: 'fas fa-hand-sparkles', title: 'Anytime', text: 'Use the <strong>acupressure stick</strong> on palms, feet or scalp to ease tension.' }
        ],
        benefits: [
            { icon: 'fas fa-seedling', title: 'Vijaysar Glass', text: 'Traditionally used in Ayurveda to support healthy blood sugar and digestion.' },
            { icon: 'fas fa-leaf', title: 'Neem Comb', text: 'Detangles gently, reduces static and keeps the scalp comfortable.' },
            { icon: 'fas fa-hand-holding-heart', title: 'Acupressure Stick', text: 'Textured nodules stimulate pressure points for soothing relief.' },
            { icon: 'fas fa-gift', title: 'Gift Ready', text: 'A meaningful present for family who value traditional self-care.' }
        ],
        disclaimer: 'Traditional wellness products. Not medicines and not intended to diagnose, treat or cure any condition. Natural wood tone varies from piece to piece.'
    },
    acupressure: {
        badge: 'Natural · Wellness · Chemical-Free',
        introHeading: 'Traditional Acupressure Therapy',
        introText: 'Hand-crafted from smooth, untreated natural wood, this acupressure stick (a thumb / trigger-point tool) applies targeted pressure to acupoints on the hands, feet and body. Acupressure is a traditional practice believed to relieve tension, support circulation and encourage relaxation.',
        points: [
            'Smooth, untreated natural wood — comfortable grip',
            'Targets pressure points on hands, feet &amp; body',
            'Supports relaxation, circulation &amp; tension relief'
        ],
        steps: [
            { icon: 'fas fa-magnifying-glass', title: 'Locate', text: 'Find the tender pressure point or muscle knot on the hand, foot or body.' },
            { icon: 'fas fa-hand-pointer', title: 'Press', text: 'Apply firm, steady pressure with the rounded tip for <strong>5–10 seconds</strong>.' },
            { icon: 'fas fa-repeat', title: 'Release &amp; Repeat', text: 'Release slowly and repeat a few times while breathing deeply.' }
        ],
        benefits: [
            { icon: 'fas fa-spa', title: 'Tension Relief', text: 'Helps ease muscle knots, stiffness and everyday stress.' },
            { icon: 'fas fa-heart-pulse', title: 'Better Circulation', text: 'Stimulating acupoints is believed to support healthy blood flow.' },
            { icon: 'fas fa-tree', title: 'Natural Material', text: 'Crafted from smooth, untreated wood — no chemicals, paints or coatings.' },
            { icon: 'fas fa-suitcase-rolling', title: 'Easy to Carry', text: 'Lightweight and portable, so you can use it anytime, anywhere.' }
        ],
        disclaimer: 'Traditional wellness practice — not a medical device, and not intended to diagnose, treat or cure any condition. Avoid pressing over injuries; consult a doctor if you are pregnant or have a medical condition.'
    },

    'mango-tray': {
        badge: 'Solid Sheesham · Hand-Carved · Detachable Legs',
        icon: 'fas fa-tree',
        introHeading: 'Hand-Carved from Solid Sheesham',
        introText: 'Carved from a single block of Sheesham (<em>Dalbergia sissoo</em>, Indian rosewood) in the mango / paisley shape that runs through Indian folk design. Concentric grooves are cut by hand around a deep scooped well, and the rim is finished with a chiselled scalloped border. Three turned legs thread in and out, so a single piece serves three ways.',
        points: [
            'Solid Sheesham hardwood — not veneer or particle board',
            'Three screw-in turned legs, fitted or removed in seconds',
            'Hand-cut grooves and scalloped rim — every piece unique'
        ],
        specs: [
            { label: 'Material', value: 'Solid Sheesham (Indian rosewood)' },
            { label: 'Finish', value: 'Natural wood, hand-polished' },
            { label: 'Legs', value: '3 detachable turned legs (screw-in)' },
            { label: 'Shape', value: 'Mango / paisley, hand-carved grooved face' },
            { label: 'Care', value: 'Wipe with a dry cloth; keep away from standing water' }
        ],
        stepsHeading: 'Three Ways to Use It',
        steps: [
            { icon: 'fas fa-utensils', title: 'Serve', text: 'Fit the three legs and use it as a <strong>raised serving stand</strong> for dry fruit, snacks or sweets.' },
            { icon: 'fas fa-cookie-bite', title: 'Present', text: 'Take the legs off for a <strong>flat platter</strong> — a centrepiece tray, catch-all or fruit bowl.' },
            { icon: 'fas fa-image', title: 'Display', text: 'The carved face doubles as <strong>wall décor</strong>; the grooved relief catches the light beautifully.' }
        ],
        benefits: [
            { icon: 'fas fa-hand-sparkles', title: 'Hand-Carved', text: 'Grooves, well and scalloped rim are cut by hand — no two trays are identical.' },
            { icon: 'fas fa-tree', title: 'Sheesham Hardwood', text: 'Dense, close-grained Indian rosewood that resists warping and deepens in colour with age.' },
            { icon: 'fas fa-screwdriver-wrench', title: 'Two Heights', text: 'Legs screw in for a footed stand and out for a flat tray — stores flat either way.' },
            { icon: 'fas fa-gift', title: 'Gifting Piece', text: 'A ready housewarming, wedding or festival gift that reads as craft rather than mass production.' }
        ],
        disclaimer: 'Natural wood: grain, tone and carving detail vary slightly from piece to piece. Not dishwasher safe — hand wipe only, and avoid soaking or prolonged contact with water.'
    },

    'rack-4tier': {
        badge: 'Engineered Wood (MDF) · Wall Mounted · Flat-Pack',
        icon: 'fas fa-layer-group',
        introHeading: 'Four Tiers, 24 Inches of Wall',
        introText: 'A four-tier wall mounted rack in dark walnut-finish engineered wood (MDF), 24 inches square with a 4 inch deep shelf. Built for a spice wall in the kitchen — 24 to 32 standard jars across the tiers — and equally at home as a display shelf for books, toys, collectibles and small plants.',
        points: [
            'Four tiers — 24 to 32 standard spice jars',
            'Frees up counter space by going vertical',
            'Ships flat as six pre-drilled boards'
        ],
        specs: [
            { label: 'Size', value: '24&quot; wide × 24&quot; high × 4&quot; deep' },
            { label: 'Tiers', value: '4' },
            { label: 'Material', value: 'Engineered wood (MDF), dark walnut finish' },
            { label: 'Mounting', value: 'Wall mounted — pre-drilled fixing points' },
            { label: 'In the box', value: '6 flat boards + fittings + assembly guide' }
        ],
        stepsHeading: 'Assembly in 3 Steps',
        steps: [
            { icon: 'fas fa-box-open', title: 'Unpack', text: 'Lay out the <strong>six boards</strong> — two sides and four shelves — and check the fittings against the guide.' },
            { icon: 'fas fa-screwdriver', title: 'Assemble', text: 'Slot each shelf into its pre-drilled side panel and <strong>tighten the connectors</strong> evenly.' },
            { icon: 'fas fa-thumbtack', title: 'Mount', text: 'Mark the fixing points on the wall, drill and anchor, then <strong>lift the rack onto the screws</strong>.' }
        ],
        benefits: [
            { icon: 'fas fa-jar', title: 'Big Capacity', text: 'Holds roughly 24–32 standard spice jars, or a mix of jars, bottles and tins.' },
            { icon: 'fas fa-arrows-up-down', title: 'Space-Saving', text: 'Uses vertical wall space instead of the worktop — ideal for compact kitchens.' },
            { icon: 'fas fa-cubes', title: 'Not Just Spices', text: 'Works as a display shelf for books, toys, plants and collectibles.' },
            { icon: 'fas fa-screwdriver-wrench', title: 'Easy Assembly', text: 'Flat-pack boards, pre-drilled holes and a step-by-step guide — up in minutes.' }
        ],
        disclaimer: 'Wall fixings should be matched to your wall type (brick, concrete or drywall). Mount into solid fixing points and do not exceed a sensible load per shelf.'
    },

    'rack-2tier-14': {
        badge: 'Engineered Wood (MDF) · 6&quot; Deep Tiers · Brass Fittings',
        icon: 'fas fa-layer-group',
        introHeading: 'Two Deep Tiers for Tall Jars',
        introText: 'A two-tier organizer in dark walnut-finish engineered wood (MDF), 14 inches wide and 14 inches tall with unusually deep 6 inch trays joined by brass connector hardware. The depth is the point: tall spice jars, oil and sauce bottles, tea and coffee tins all stand upright — and the same trays take a full row of CDs, DVDs or Blu-ray cases.',
        points: [
            '6 inch deep tiers — takes tall jars and bottles upright',
            'Brass connector fittings, dark walnut finish',
            'Counter, desk, shelf or wall — it works on all four'
        ],
        specs: [
            { label: 'Size', value: '14&quot; wide × 14&quot; high × 6&quot; deep' },
            { label: 'Tiers', value: '2' },
            { label: 'Material', value: 'Engineered wood (MDF), dark walnut finish' },
            { label: 'Hardware', value: 'Brass connector fittings' },
            { label: 'Placement', value: 'Free-standing on a counter or desk, or wall mounted' },
            { label: 'In the box', value: '2 side panels + 2 trays + fittings + assembly guide' }
        ],
        stepsHeading: 'Assembly in 3 Steps',
        steps: [
            { icon: 'fas fa-box-open', title: 'Unpack', text: 'Lay out the <strong>two side panels and two trays</strong> with the brass fittings.' },
            { icon: 'fas fa-screwdriver', title: 'Assemble', text: 'Seat each tray between the panels and <strong>hand-tighten the brass connectors</strong>.' },
            { icon: 'fas fa-check', title: 'Place', text: 'Stand it on the counter or desk — or <strong>mount it on the wall</strong> if you would rather free the surface.' }
        ],
        benefits: [
            { icon: 'fas fa-bottle-droplet', title: 'Takes Tall Bottles', text: 'The 6 inch depth holds oil, vinegar, honey and syrup bottles that topple off shallow racks.' },
            { icon: 'fas fa-compact-disc', title: 'Media Storage', text: 'The same two tiers hold a full row of CDs, DVDs and Blu-ray cases spine-out.' },
            { icon: 'fas fa-couch', title: 'Any Room', text: 'Kitchen counter, study desk, bathroom shelf or media unit — deliberately generic.' },
            { icon: 'fas fa-screwdriver-wrench', title: 'Easy Assembly', text: 'Four boards and brass fittings; assembled by hand in minutes.' }
        ],
        disclaimer: 'Engineered wood: keep dry and wipe spills promptly. If wall mounted, match the fixings to your wall type.'
    },

    'rack-2tier-8': {
        badge: 'Engineered Wood (MDF) · Compact · Counter or Cabinet',
        icon: 'fas fa-layer-group',
        introHeading: 'The Compact Everyday Spice Rack',
        introText: 'The small one in the range — 14 inches wide, 8 inches tall and 4 inches deep, in the same dark walnut-finish engineered wood (MDF). Sized to sit on a countertop, inside a cabinet or on an existing kitchen shelf, keeping the six to twelve spices you actually cook with within arm\'s reach.',
        points: [
            'Compact 14&quot; × 8&quot; footprint — fits inside most cabinets',
            'Holds roughly 6–12 standard spice jars',
            'Four flat boards, assembled in minutes'
        ],
        specs: [
            { label: 'Size', value: '14&quot; wide × 8&quot; high × 4&quot; deep' },
            { label: 'Tiers', value: '2' },
            { label: 'Material', value: 'Engineered wood (MDF), dark walnut finish' },
            { label: 'Capacity', value: 'About 6–12 standard spice jars' },
            { label: 'Placement', value: 'Countertop, cabinet or shelf — or wall mounted' },
            { label: 'In the box', value: '2 side panels + 2 shelf boards + fittings + guide' }
        ],
        stepsHeading: 'Assembly in 3 Steps',
        steps: [
            { icon: 'fas fa-box-open', title: 'Unpack', text: 'Lay out the <strong>two side panels and two shelf boards</strong>.' },
            { icon: 'fas fa-screwdriver', title: 'Assemble', text: 'Slot the shelves into the pre-cut joints and <strong>tighten the fittings</strong>.' },
            { icon: 'fas fa-mug-hot', title: 'Fill', text: 'Load your everyday spices on the lower tier and <strong>keep the top tier for taller jars</strong>.' }
        ],
        benefits: [
            { icon: 'fas fa-maximize', title: 'Fits Small Kitchens', text: 'Small enough for a cabinet interior or a crowded worktop corner.' },
            { icon: 'fas fa-hand-pointer', title: 'Everything in Reach', text: 'Two open tiers mean no rummaging — you see every jar at a glance.' },
            { icon: 'fas fa-palette', title: 'Matching Finish', text: 'Same dark walnut finish as the 14&quot; and 24&quot; racks, so the range stacks visually.' },
            { icon: 'fas fa-screwdriver-wrench', title: 'Easy Assembly', text: 'Four flat boards and simple fittings — no special tools needed.' }
        ],
        disclaimer: 'Engineered wood: keep dry and wipe spills promptly. If wall mounted, match the fixings to your wall type.'
    }
};

/* Map a product to its PRODUCT_DETAILS slug via its `extra` flag or name, so
   DB products added from the admin portal pick up the write-up too. */
function resolveDetailSlug(product) {
    if (product.extra && PRODUCT_DETAILS[product.extra]) return product.extra;
    const n = (product.name || '').toLowerCase();
    if (/combo/.test(n)) return 'combo';
    if (/vijaysar/.test(n)) return 'vijaysar';
    if (/neem/.test(n)) return 'neem';
    if (/acupres|accupres|acupress/.test(n)) return 'acupressure';
    if (/(mango|paisley).*tray|tray.*(mango|paisley)/.test(n)) return 'mango-tray';
    if (/4[\s-]*tier/.test(n)) return 'rack-4tier';
    if (/2[\s-]*tier/.test(n)) return /\b8\b|8\s*(inch|")/.test(n) ? 'rack-2tier-8' : 'rack-2tier-14';
    return '';
}

/* Add the starter wellness products to PRODUCTS unless the database already has
   them, so their detail pages and Add-to-Cart work through the normal flow. */
function ensureWellnessSeed() {
    // Matched per product (by id or name) so a newly added starter, such as the
    // combo kit, still appears when the database already has other wellness rows.
    STATIC_WELLNESS_PRODUCTS.forEach(sp => {
        const slug = String(sp.name).trim().toLowerCase();
        const exists = PRODUCTS.some(p =>
            String(p.id) === String(sp.id) ||
            String(p.name || '').trim().toLowerCase() === slug);
        if (!exists) PRODUCTS.push(sp);
    });
}

/* Same idea for the tray and rack starters, but matched per product: a real DB
   row with the same id or name always wins, so running catalog-seed.sql (or
   adding the product in the admin portal) quietly replaces the built-in copy. */
function ensureCatalogSeed() {
    STATIC_CATALOG_PRODUCTS.forEach(sp => {
        const slug = String(sp.name).trim().toLowerCase();
        const exists = PRODUCTS.some(p =>
            String(p.id) === String(sp.id) ||
            String(p.name || '').trim().toLowerCase() === slug);
        if (!exists) PRODUCTS.push(sp);
    });
}

/* One-line blurb for the hero: an explicit `tagline` if the product has one,
   otherwise the opening sentence of its description, trimmed to fit. */
function craftLabel(product) {
    return product && product.cat === 'rack' ? 'Precision-cut, hand-finished' : '100% Handcrafted';
}

function shortDetail(product, max = 150) {
    if (product.tagline) return product.tagline;
    const desc = String(product.desc || '').replace(/\s+/g, ' ').trim();
    if (!desc) return '';
    const first = (desc.match(/^.*?[.!?](?:\s|$)/) || [desc])[0].trim();
    const text = first.length >= 45 ? first : desc;
    if (text.length <= max) return text;
    return text.slice(0, max - 1).replace(/[\s,;:.\u2014-]+\S*$/, '') + '\u2026';
}

function getCategories() {
    const custom = JSON.parse(localStorage.getItem('velorex_store_categories')) || [];
    const merged = DEFAULT_CATS.map(d => {
        const override = custom.find(c => c.id === d.id) || {};
        return {
            ...d,
            icon:  override.icon  || d.icon,
            // The old cartoon wellness graphic was replaced by a real photo; ignore saved copies of it.
            image: (override.image && override.image !== 'cat-wellness.svg') ? override.image : d.image
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
                featured: p.featured === '1' || p.featured === 1 || p.featured === true,
                amazonUrl: p.amazon_url || '',
                badge: p.badge || '',
                createdAt: p.created_at || ''
            };
        });
    } catch (error) {
        console.error('Failed to load products:', error);
    }

    // Always run — even if the API was unreachable — so the built-in wellness
    // and catalog products exist and their detail pages / Add-to-Cart keep working.
    // Catalog starters first, so the newest range leads the hero rotation.
    ensureCatalogSeed();
    ensureWellnessSeed();

    // Product counts and the featured column in the Catalog mega menu need the product list.
    app.renderNavCategories();
    setShopStructuredData();

    const route = parseLocation();
    if (route.view === 'products') {
        app.renderProducts(route.params.get('cat'));
    } else if (route.view === 'product-detail') {
        // The slug in the address may be missing or stale (old link): show the current one.
        const canonical = routeToPath('product-detail', { id: route.params.get('id') });
        if (canonical !== window.location.pathname) history.replaceState(null, '', canonical);
        app.renderProductDetail(route.params.get('id'));
    } else if (route.view === 'wellness') {
        app.renderWellness();
    } else if (route.view === 'home') {
        // Home renders before this resolves, so refresh the hero + featured grid.
        app.renderActiveHome();
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
        this.syncDesignToggle();
        this.restoreSession();
        this.renderNavCategories();
        this.renderFooterCategories();
        loadProducts();
        initRouting();
        this.handleRoute();

        window.addEventListener('storage', (e) => {
            if (e.key === 'velorex_store_categories') {
                CATEGORIES = getCategories();
                this.renderNavCategories();
                this.renderFooterCategories();
                if (parseLocation().view === 'home') this.renderActiveHome();
            }
            if (e.key === 'velorex_design_variant' && window.VelorexDesignSelection) {
                const nextDesign = window.VelorexDesignSelection.normalizeDesign(e.newValue) || 'classic';
                window.VelorexDesignSelection.setDesign(window, nextDesign, { persist: false, clearPreview: false });
            }
        });

        window.addEventListener('velorex:designchange', () => {
            this.syncDesignToggle();
            if (parseLocation().view === 'home') this.handleRoute();
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

    toggleDesign() {
        if (!window.VelorexDesignSelection) return;
        const current = document.documentElement.getAttribute('data-design') || 'classic';
        const nextDesign = current === 'living-craft' ? 'classic' : 'living-craft';
        window.VelorexDesignSelection.setDesign(window, nextDesign);
        this.syncDesignToggle();
    },

    syncDesignToggle() {
        const button = document.querySelector('[data-action="toggle-design"]');
        const label = document.getElementById('designToggleLabel');
        const icon = document.getElementById('designToggleIcon');
        if (!button) return;

        const livingCraft = document.documentElement.getAttribute('data-design') === 'living-craft';
        const currentName = livingCraft ? 'Living Craft' : 'Classic';
        const nextName = livingCraft ? 'Classic' : 'Living Craft';
        button.setAttribute('aria-pressed', String(livingCraft));
        button.setAttribute('aria-label', `Current design: ${currentName}. Switch to ${nextName}.`);
        if (label) label.textContent = currentName;
        if (icon) icon.className = livingCraft ? 'fas fa-seedling' : 'fas fa-gem';
    },

    isLivingCraft() {
        return document.documentElement.getAttribute('data-design') === 'living-craft';
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
            phone.replaceChildren(document.createTextNode(s.phone), document.createElement('br'), document.createTextNode('(Mon–Fri, 10am – 6pm IST)'));
        }
        if (email && s.email) email.textContent = s.email;
        const cleaned = storeWhatsAppNumber();
        if (waLink && cleaned) {
            waLink.href = `https://wa.me/${encodeURIComponent(cleaned)}?text=Hi%20Velorex%20Design,%20I%20am%20interested%20in%20your%20graphic%20design%20services.`;
        }
    },

    navigate(view, params = {}) {
        const next = routeToPath(view, params);
        if (next !== window.location.pathname + window.location.search) history.pushState(null, '', next);
        this.handleRoute();
    },

    handleRoute() {
        const { view, params } = parseLocation();

        // Mark the matching link in the top navigation.
        const here = routeToPath(view === 'product-detail' ? 'products' : view);
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === here);
        });
        window.dispatchEvent(new Event('velorex:route'));

        const appRoot = document.getElementById('app');
        const templateId = view === 'home' && this.isLivingCraft()
            ? 'tpl-home-living-craft'
            : 'tpl-' + view;
        const template = document.getElementById(templateId);

        if (template) {
            appRoot.innerHTML = '<div class="view active">' + template.innerHTML + '</div>';
            window.scrollTo(0, 0);

            // Highlight the matching tab on the phone tab bar.
            const tabFor = { home: 'home', products: 'products', 'product-detail': 'products', wellness: 'wellness', cart: 'cart', profile: 'profile', auth: 'profile' }[view];
            document.querySelectorAll('.tabbar-item[data-tab]').forEach(tab => {
                const on = tab.dataset.tab === tabFor;
                tab.classList.toggle('active', on);
                if (on) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
            });

            // Page title and description for this view (product pages set their own below).
            setSeo(SEO_VIEWS[view] || { noindex: ['cart', 'profile', 'auth'].includes(view) });
            setStructuredData('ldProduct', null);

            if (view === 'home') this.renderActiveHome();
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
            if (view === 'wellness') {
                if (PRODUCTS.length === 0) {
                    loadProducts().then(() => this.renderWellness());
                } else {
                    this.renderWellness();
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
            if (parseLocation().view === 'profile') this.renderProfile();
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
            { test: v => VALIDATORS.minLength(v, 8),  value: pass, message: 'Password must be at least 8 characters' },
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
                    <img src="${img}" alt="${escapeAttr(product.name)}" loading="lazy" decoding="async" data-fallback="https://placehold.co/600x600/1a1a2e/9890b0?text=${encodeURIComponent(product.name || 'Product')}">
                    ${productBadgeHtml(product)}
                    ${amazonUrlFor(product) ? '<span class="amazon-chip"><i class="fab fa-amazon"></i> On Amazon</span>' : ''}
                </div>
                <div class="product-info">
                    <div class="product-cat">${cat}</div>
                    <h3 class="product-title"><a href="${escapeAttr(routeToPath('product-detail', { id: product.id }))}">${name}</a></h3>
                    <div class="card-buy">
                        ${buyButtonHtml(product, 'btn-block')}
                        ${amazonUrlFor(product) && whatsAppOrderUrl(product) ? `<a class="btn btn-whatsapp btn-block btn-sm" href="${escapeAttr(whatsAppOrderUrl(product))}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Order on WhatsApp</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /* Brand-banner CTA: scroll to the home category strip, or open the catalog
       if we are not on the home view. */
    gotoCategories() {
        const strip = document.getElementById('catMarquee') || document.getElementById('lcCategoryGrid');
        if (!strip) { this.navigate('products'); return; }
        strip.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    renderActiveHome() {
        if (this.isLivingCraft()) this.renderLivingCraftHome();
        else this.renderHome();
    },

    renderHome() {
        this.initHeroCarousel();
        this.renderHomeCategories();
        this.renderHomeCollections();
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

    /* Bestsellers, New arrivals and Coming soon rows on the Classic home page.
       Admin badges decide the first two; without badges they fall back to
       featured products and the newest additions. */
    renderHomeCollections() {
        const best = document.getElementById('homeBestGrid');
        const fresh = document.getElementById('homeNewGrid');
        const soon = document.getElementById('homeSoonGrid');
        const card = p => this.createProductCard(p);
        if (best) {
            let list = PRODUCTS.filter(p => p.badge === 'bestseller');
            if (!list.length) list = PRODUCTS.filter(p => p.featured);
            if (!list.length) list = PRODUCTS.slice();
            best.innerHTML = list.slice(0, 4).map(card).join('');
            best.closest('section').hidden = !list.length;
        }
        if (fresh) {
            const ts = p => Date.parse(String(p.createdAt || '').replace(' ', 'T')) || Number(p.id) || 0;
            let list = PRODUCTS.filter(p => p.badge === 'new');
            if (!list.length) list = PRODUCTS.slice().sort((a, b) => ts(b) - ts(a));
            fresh.innerHTML = list.slice(0, 4).map(card).join('');
            fresh.closest('section').hidden = !list.length;
        }
        if (soon) {
            const wa = storeWhatsAppNumber();
            const empty = CATEGORIES.filter(c => !PRODUCTS.some(p => p.cat === c.id));
            soon.innerHTML = empty.map(c => `
                <div class="soon-card">
                    <div class="soon-img"><img src="${escapeAttr(safeUrl(c.image))}" alt="${escapeAttr(c.name)}" loading="lazy"><span class="soon-tag"><i class="fas fa-clock"></i> Coming soon</span></div>
                    <div class="soon-body">
                        <h3>${escapeHtml(c.name)}</h3>
                        <p>New pieces are being made in our Meerut studio.</p>
                        ${wa ? `<a class="btn btn-secondary btn-sm" href="https://wa.me/${wa}?text=${encodeURIComponent('Hi Velorex Design! Please tell me when ' + c.name + ' is available.')}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Notify me</a>` : ''}
                    </div>
                </div>`).join('');
            soon.closest('section').hidden = !empty.length;
        }
    },

    renderLivingCraftHome() {
        this.stopHeroCarousel();

        const categoryGrid = document.getElementById('lcCategoryGrid');
        if (categoryGrid) {
            CATEGORIES = getCategories();
            categoryGrid.innerHTML = CATEGORIES.slice(0, 4).map(category => {
                const image = escapeAttr(safeUrl(category.image) || DEFAULT_CAT_FALLBACK_IMAGE);
                return `
                    <button type="button" class="lc-category"
                            data-action="open-category" data-cat="${escapeAttr(category.id)}">
                        <span class="lc-category-image"><img src="${image}" alt="" loading="lazy" data-fallback="${escapeAttr(DEFAULT_CAT_FALLBACK_IMAGE)}"></span>
                        <span class="lc-category-meta"><strong>${escapeHtml(category.name)}</strong><span>View collection →</span></span>
                    </button>`;
            }).join('');
        }

        const productGrid = document.getElementById('lcFeaturedGrid');
        if (!productGrid) return;
        let featured = PRODUCTS.filter(product => product.featured);
        if (featured.length < 4) featured = PRODUCTS.slice(0, 4);
        else featured = featured.slice(0, 4);
        productGrid.innerHTML = featured.length
            ? featured.map(product => this.createProductCard(product)).join('')
            : '<p class="lc-empty">No products are available yet.</p>';
    },

    stopHeroCarousel() {
        if (this._heroTimer) {
            clearInterval(this._heroTimer);
            this._heroTimer = null;
        }
        if (this._heroVisibility) {
            document.removeEventListener('visibilitychange', this._heroVisibility);
            this._heroVisibility = null;
        }
        if (this._heroCleanup) {
            this._heroCleanup();
            this._heroCleanup = null;
        }
    },

    /* Hero product showcase: the featured products (or the newest ones) rotate
       through the hero with their image, a one-line detail, price and a buy
       path. Auto-advances, pauses on hover/focus and when the tab is hidden,
       and honours prefers-reduced-motion. Falls back to the static intro copy
       written in index.html while the catalog is still empty. */
    initHeroCarousel() {
        const HERO_INTERVAL = 6000;
        const track    = document.getElementById('heroCarousel');
        const dotsWrap = document.getElementById('heroDots');
        const content  = document.getElementById('heroContent');
        const showcase = document.getElementById('heroShowcase');
        const hero     = document.getElementById('heroSection');
        const prevBtn  = document.getElementById('heroPrev');
        const nextBtn  = document.getElementById('heroNext');
        if (!track || !dotsWrap || !content || !showcase) return;

        // Clear the timer from a previous render so intervals never stack.
        if (this._heroTimer) { clearInterval(this._heroTimer); this._heroTimer = null; }
        if (this._heroVisibility) {
            document.removeEventListener('visibilitychange', this._heroVisibility);
            this._heroVisibility = null;
        }

        const overlay = track.querySelector('.hero-overlay');
        track.querySelectorAll('.hero-slide').forEach(el => el.remove());
        dotsWrap.innerHTML = '';

        const featured = PRODUCTS.filter(p => p.featured);
        const products = (featured.length ? featured : PRODUCTS).slice(0, 5);

        // Slide 0 is the Velorex Design banner; campaign banners and featured
        // products alternate after it so the carousel never feels repetitive.
        const promos = HERO_PROMOS.map(p => Object.assign({ promo: true }, p));
        const items = [{ brand: true }];
        const longest = Math.max(promos.length, products.length);
        for (let i = 0; i < longest; i++) {
            if (promos[i]) items.push(promos[i]);
            if (products[i]) items.push(products[i]);
        }

        showcase.style.display = '';
        if (hero) hero.classList.add('hero--product');

        // Brand art, then a blurred product photo per product slide.
        const slideEls = items.map((p, i) => {
            const el = document.createElement('div');
            el.className = 'hero-slide ' + (p.brand ? 'hero-slide--brand' : 'hero-slide--product')
                + (i === 0 ? ' active' : '');
            el.style.backgroundImage = `url('${p.brand ? 'images/hero.webp' : safeUrl(p.promo ? p.bg : p.img)}')`;
            if (p.promo) el.classList.add('hero-slide--promo');
            track.insertBefore(el, overlay);
            return el;
        });

        const multiple = items.length > 1;
        dotsWrap.style.display = multiple ? 'flex' : 'none';
        if (prevBtn) prevBtn.style.display = multiple ? '' : 'none';
        if (nextBtn) nextBtn.style.display = multiple ? '' : 'none';

        const dotEls = items.map((p, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', p.brand ? 'Show the Velorex Design banner' : `Show ${p.promo ? p.eyebrow : p.name}`);
            dot.innerHTML = '<span class="hero-dot-fill"></span>';
            dot.addEventListener('click', () => go(i));
            dotsWrap.appendChild(dot);
            return dot;
        });

        /* The main banner: who Velorex Design is, plus the two ways in. */
        const paintBrand = () => {
            content.innerHTML = `
                <span class="hero-eyebrow"><i class="fas fa-gem"></i> Velorex Design</span>
                <h1 class="hero-title">Handcrafted <br><span class="text-gradient">Art &amp; Design</span></h1>
                <p class="hero-desc">Solid-wood serveware, MDF racks and shelves, resin art and Ayurvedic wellness
                    pieces — made by hand in our own workshop, alongside professional graphic design services.</p>
                <div class="hero-buttons">
                    <button type="button" class="btn btn-primary" data-action="goto-categories">
                        <i class="fas fa-th-large"></i> Shop by Category
                    </button>
                    <button type="button" class="btn btn-secondary" data-action="goto-products">
                        <i class="fas fa-store"></i> All Products
                    </button>
                </div>
                <ul class="hero-meta">
                    <li><i class="fas fa-hammer"></i> Handmade in India</li>
                    <li><i class="fas fa-layer-group"></i> ${CATEGORIES.length} collections</li>
                    <li><i class="fas fa-pen-nib"></i> Design services</li>
                </ul>`;
            // Same single framed card as the other slides (the 4-image collage looked out of place).
            const lead = products[0];
            showcase.innerHTML = lead ? `
                <div class="hero-card" data-action="open-product" data-id="${escapeAttr(lead.id)}">
                    <img src="${escapeAttr(safeUrl(lead.img))}" alt="${escapeAttr(lead.name)}" data-fallback="https://placehold.co/800x800/1a1a2e/9890b0?text=Velorex">
                    <span class="hero-card-tag">Velorex Design</span>
                    <span class="hero-card-tag hero-card-badge">Handmade</span>
                </div>` : '';
        };

        const paintProduct = (p) => {
            const cover = escapeAttr(safeUrl(p.img));
            const fallback = `https://placehold.co/800x800/1a1a2e/9890b0?text=${encodeURIComponent(p.name || 'Product')}`;
            content.innerHTML = `
                <span class="hero-eyebrow"><i class="fas fa-certificate"></i> ${escapeHtml(getCatName(p.cat))}</span>
                <h1 class="hero-title hero-title--product">${escapeHtml(p.name)}</h1>
                <p class="hero-desc">${escapeHtml(shortDetail(p))}</p>
                <div class="hero-buttons">
                    <button type="button" class="btn btn-primary" data-action="open-product" data-id="${escapeAttr(p.id)}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${buyButtonHtml(p)}
                </div>
                <ul class="hero-meta">
                    <li><i class="fas fa-hammer"></i> ${escapeHtml(craftLabel(p))}</li>
                    <li><i class="fas fa-truck"></i> Ships in 3&ndash;5 days</li>
                    ${amazonUrlFor(p) ? '<li><i class="fab fa-amazon"></i> Sold on Amazon</li>' : '<li><i class="fab fa-whatsapp"></i> Order on WhatsApp</li>'}
                </ul>`;
            showcase.innerHTML = `
                <div class="hero-card" data-action="open-product" data-id="${escapeAttr(p.id)}">
                    <img src="${cover}" alt="${escapeAttr(p.name)}" data-fallback="${escapeAttr(fallback)}">
                    <span class="hero-card-tag">${escapeHtml(getCatName(p.cat))}</span>
                </div>`;
        };

        /* Campaign banner: headline, short pitch, the matching buy buttons and art. */
        const paintPromo = (p) => {
            const product = p.product ? PRODUCTS.find(x => p.product.test(x.name || '')) : null;
            let buttons = '';
            if (product) {
                buttons = `${buyButtonHtml(product)}
                    <button type="button" class="btn btn-secondary" data-action="open-product" data-id="${escapeAttr(product.id)}"><i class="fas fa-eye"></i> View Details</button>`;
            } else if (p.category) {
                buttons = `<button type="button" class="btn btn-primary" data-action="open-category" data-cat="${escapeAttr(p.category)}"><i class="fas fa-layer-group"></i> See the collection</button>`;
            } else if (p.buy) {
                const wa = storeWhatsAppNumber();
                buttons = `<a class="btn btn-amazon" href="https://www.amazon.in/l/27943762031?me=A23A7Y0AFUIEBT" target="_blank" rel="noopener noreferrer"><i class="fab fa-amazon"></i> Amazon store</a>
                    ${wa ? `<a class="btn btn-whatsapp" href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> WhatsApp us</a>` : ''}`;
            }
            content.innerHTML = `
                <span class="hero-eyebrow"><i class="${escapeAttr(p.icon)}"></i> ${escapeHtml(p.eyebrow)}</span>
                <h1 class="hero-title hero-title--product">${p.title}</h1>
                <p class="hero-desc">${escapeHtml(p.desc)}</p>
                <div class="hero-buttons">${buttons}</div>
                <ul class="hero-meta">
                    <li><i class="fas fa-hammer"></i> Handmade in India</li>
                    <li><i class="fab fa-amazon"></i> On Amazon</li>
                    <li><i class="fab fa-whatsapp"></i> WhatsApp orders</li>
                </ul>`;
            showcase.innerHTML = `
                <div class="hero-card hero-card--promo"${product ? ` data-action="open-product" data-id="${escapeAttr(product.id)}"` : ''}>
                    <img src="${escapeAttr(safeUrl(p.art))}" alt="${escapeAttr(p.eyebrow)}">
                    ${p.badge ? `<span class="hero-card-tag hero-card-badge">${escapeHtml(p.badge)}</span>` : ''}
                </div>`;
        };

        const paint = (p) => {
            if (p.brand) paintBrand(); else if (p.promo) paintPromo(p); else paintProduct(p);
            // Re-trigger the entrance animation on both columns.
            [content, showcase].forEach(el => {
                el.classList.remove('is-entering');
                void el.offsetWidth;
                el.classList.add('is-entering');
            });
        };

        let current = 0;
        const go = (i) => {
            current = (i + items.length) % items.length;
            slideEls.forEach((el, idx) => el.classList.toggle('active', idx === current));
            dotEls.forEach((el, idx) => el.classList.toggle('active', idx === current));
            paint(items[current]);
            restart();
        };

        const reduceMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const stop = () => {
            if (this._heroTimer) { clearInterval(this._heroTimer); this._heroTimer = null; }
            dotsWrap.classList.add('is-paused');
        };
        const restart = () => {
            stop();
            if (!multiple || reduceMotion) return;
            dotsWrap.classList.remove('is-paused');
            // Restart the active dot's progress fill in step with the timer.
            const fill = dotEls[current].querySelector('.hero-dot-fill');
            if (fill) { fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = ''; }
            this._heroTimer = setInterval(() => go(current + 1), HERO_INTERVAL);
        };

        if (prevBtn) prevBtn.onclick = () => go(current - 1);
        if (nextBtn) nextBtn.onclick = () => go(current + 1);

        if (hero) {
            // Assigned (not added) so repeated renders cannot stack listeners.
            hero.onmouseenter = stop;
            hero.onmouseleave = restart;
            hero.onfocusin = stop;
            hero.onfocusout = restart;
            let touchX = 0;
            hero.ontouchstart = (e) => { touchX = e.changedTouches[0].clientX; stop(); };
            hero.ontouchend = (e) => {
                const dx = e.changedTouches[0].clientX - touchX;
                if (Math.abs(dx) > 45) go(current + (dx < 0 ? 1 : -1));
                else restart();
            };
        }

        this._heroVisibility = () => { if (document.hidden) stop(); else restart(); };
        document.addEventListener('visibilitychange', this._heroVisibility);

        dotsWrap.style.setProperty('--hero-interval', HERO_INTERVAL + 'ms');
        paint(items[0]);
        restart();
    },

    // Catalog mega menu: search box, categories with photo and item count, a side
    // column (search results, recently viewed, or popular products) and a wellness
    // promo. Re-rendered when products finish loading.
    renderNavCategories() {
        const dd = document.getElementById('navCategoryDropdown');
        if (!dd) return;
        CATEGORIES = getCategories();
        const loaded = PRODUCTS.length > 0;

        // Keep whatever the visitor already typed if the panel is rebuilt mid-search.
        const oldInput = document.getElementById('megaSearch');
        const query = oldInput ? oldInput.value : '';
        const hadFocus = oldInput && document.activeElement === oldInput;

        const catTiles = CATEGORIES.map(c => {
            const count = PRODUCTS.filter(p => p.cat === c.id).length;
            const meta = !loaded ? '' : (count ? `${count} item${count === 1 ? '' : 's'}` : 'Coming soon');
            const img = escapeAttr(safeUrl(c.image) || DEFAULT_CAT_FALLBACK_IMAGE);
            return `
                <a href="#products?cat=${encodeURIComponent(c.id)}" class="mega-cat">
                    <span class="mega-cat-thumb">
                        <img src="${img}" alt="" loading="lazy" data-fallback="${escapeAttr(DEFAULT_CAT_FALLBACK_IMAGE)}">
                        <i class="${escapeAttr(c.icon || DEFAULT_CAT_FALLBACK_ICON)}"></i>
                    </span>
                    <span class="mega-cat-text">
                        <span class="mega-cat-name">${escapeHtml(c.name)}</span>
                        <span class="mega-cat-meta">${escapeHtml(meta)}</span>
                    </span>
                </a>`;
        }).join('');

        dd.innerHTML = `
            <div class="mega-search">
                <i class="fas fa-search"></i>
                <input type="search" id="megaSearch" placeholder="Search products, e.g. spice rack" autocomplete="off" maxlength="80" aria-label="Search products">
                <kbd title="Press / anywhere to search">/</kbd>
            </div>
            <div class="mega-inner">
                <div class="mega-col mega-cats">
                    <div class="mega-heading">Shop by category</div>
                    <div class="mega-cat-grid">${catTiles}</div>
                    <a href="#products" class="mega-all">View all products <i class="fas fa-arrow-right"></i></a>
                </div>
                <div class="mega-col mega-featured" id="megaSide" aria-live="polite"></div>
                <a href="#wellness" class="mega-col mega-promo">
                    <span class="mega-promo-tag"><i class="fas fa-leaf"></i> Velorex Wellness</span>
                    <span class="mega-promo-title">Ayurvedic wood, made by hand</span>
                    <span class="mega-promo-text">Vijaysar glass, neem comb and acupressure tools.</span>
                    <span class="mega-promo-link">Explore the range <i class="fas fa-arrow-right"></i></span>
                </a>
            </div>
            <div class="mega-foot">
                <span><i class="fab fa-amazon"></i> Buy on Amazon</span>
                <span><i class="fas fa-hand-sparkles"></i> Handmade in India</span>
                <span><i class="fab fa-whatsapp"></i> Order on WhatsApp</span>
            </div>`;

        const input = document.getElementById('megaSearch');
        if (input) {
            input.value = query;
            if (hadFocus) input.focus();
        }
        this.renderMegaSide(query);
    },

    // Products the visitor opened recently, newest first (ids kept in this browser only).
    getRecentlyViewed() {
        let ids = [];
        try { ids = JSON.parse(localStorage.getItem('velorex_recent_products')) || []; } catch (_) {}
        if (!Array.isArray(ids)) return [];
        return ids.map(id => PRODUCTS.find(p => String(p.id) === String(id))).filter(Boolean);
    },

    trackRecentlyViewed(id) {
        let ids = [];
        try { ids = JSON.parse(localStorage.getItem('velorex_recent_products')) || []; } catch (_) {}
        if (!Array.isArray(ids)) ids = [];
        ids = [String(id)].concat(ids.filter(x => String(x) !== String(id))).slice(0, 6);
        try { localStorage.setItem('velorex_recent_products', JSON.stringify(ids)); } catch (_) {}
        this.renderMegaSide((document.getElementById('megaSearch') || {}).value || '');
    },

    // Side column of the mega menu. With a query it lists matching products;
    // otherwise recently viewed products, or popular ones for a first-time visitor.
    renderMegaSide(query) {
        const side = document.getElementById('megaSide');
        if (!side) return;
        const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
        const row = p => `
            <button type="button" class="mega-product" data-action="open-product" data-id="${escapeAttr(p.id)}">
                <img src="${escapeAttr(safeUrl(p.img) || '')}" alt="" loading="lazy" data-fallback="https://placehold.co/120x120/1a1a2e/9890b0?text=+">
                <span class="mega-product-text">
                    <span class="mega-product-name">${escapeHtml(p.name)}</span>
                </span>
            </button>`;

        const q = String(query || '').trim().toLowerCase();
        let heading, items, empty = '';
        if (q) {
            // Every word typed must appear in the name, description or category.
            const words = q.split(/\s+/);
            items = PRODUCTS.filter(p => {
                const hay = `${p.name} ${p.desc} ${getCatName(p.cat)}`.toLowerCase();
                return words.every(w => hay.includes(w));
            }).slice(0, 5);
            heading = items.length ? `${items.length} result${items.length === 1 ? '' : 's'}` : 'No results';
            if (!items.length) empty = `<p class="mega-empty">Nothing matches “${escapeHtml(query.trim())}”. Try a shorter word, or browse a category.</p>`;
        } else {
            const recent = this.getRecentlyViewed().slice(0, 3);
            if (recent.length) {
                heading = 'Recently viewed';
                items = recent;
            } else {
                heading = 'Popular right now';
                items = PRODUCTS.filter(p => p.featured).concat(PRODUCTS.filter(p => !p.featured)).slice(0, 3);
            }
            if (!items.length) empty = '<p class="mega-empty">Loading products…</p>';
        }
        const seeAll = (q && items.length)
            ? `<a href="#products?q=${encodeURIComponent(query.trim())}" class="mega-all">See all results <i class="fas fa-arrow-right"></i></a>`
            : '';
        side.innerHTML = `<div class="mega-heading">${heading}</div>${items.map(row).join('')}${empty}${seeAll}`;
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
            catLinks;
    },

    renderHomeCategories() {
        const grid = document.getElementById('homeCategoryGrid');
        if (!grid) return;
        CATEGORIES = getCategories();
        const card = (c, hidden) => {
            const img = escapeAttr(safeUrl(c.image) || DEFAULT_CAT_FALLBACK_IMAGE);
            return `
                <div class="category-card" data-action="open-category" data-cat="${escapeAttr(c.id)}" style="cursor:pointer;"${hidden ? ' aria-hidden="true"' : ''}>
                    <img src="${img}" alt="${escapeAttr(c.name)}" data-fallback="${escapeAttr(DEFAULT_CAT_FALLBACK_IMAGE)}" style="width: 100%; height: 200px; object-fit: cover;">
                    <div class="category-overlay">
                        <h3>${escapeHtml(c.name)}</h3>
                    </div>
                </div>
            `;
        };
        // Render the set twice so the marquee can loop seamlessly (translateX -50%).
        const set = CATEGORIES.map(c => card(c, false)).join('');
        const dupe = CATEGORIES.map(c => card(c, true)).join('');
        grid.innerHTML = set + dupe;
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
        const waNumber = storeWhatsAppNumber();
        if (!waNumber) { this.showToast('WhatsApp ordering is not available yet. Please use the contact page.', 'error'); return; }
        const features = pkg.features.map(f => '• ' + f).join('\n');
        const text = `Hi Velorex Design! I would like to order the following service:\n\n*Service:* ${svc.name}\n*Package:* ${pkg.name}\n*Price:* ₹${pkg.price.toLocaleString()}\n\n*What's included:*\n${features}\n\nPlease let me know the next steps!`;
        window.open(`https://wa.me/${encodeURIComponent(waNumber)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    },

    renderWellness() {
        ensureWellnessSeed();
        const grid = document.getElementById('wellnessProductsGrid');
        const empty = document.getElementById('wellnessNoProducts');
        if (!grid) return;
        const items = PRODUCTS.filter(p => p.cat === 'wellness');
        if (items.length > 0) {
            grid.style.display = 'grid';
            if (empty) empty.style.display = 'none';
            grid.innerHTML = items.map(p => this.createProductCard(p)).join('');
        } else {
            grid.style.display = 'none';
            if (empty) empty.style.display = 'block';
        }
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

        if (catFilter && catFilter !== 'all') {
            title.innerHTML = `${escapeHtml(getCatName(catFilter))} <span class="text-gradient">Collection</span>`;
            setSeo({
                title: `${getCatName(catFilter)} | Velorex Design`,
                description: `Shop handcrafted ${getCatName(catFilter)} from Velorex Design. Made by hand in India, sold on Amazon.`
            });
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

        // Filter state. Search, price and stock reset when the category changes;
        // the chosen sort order is kept. A search can also arrive in the URL (?q=).
        const f = this.productFilters;
        const cat = (catFilter && catFilter !== 'all') ? catFilter : 'all';
        const urlQ = parseLocation().params.get('q');
        if (f.cat !== cat) { f.q = ''; f.price = 'all'; f.inStock = false; }
        if (urlQ !== null) f.q = urlQ.slice(0, 80);
        f.cat = cat;

        const search = document.getElementById('pfSearch');
        if (search && search.value !== f.q) search.value = f.q;
        const sort = document.getElementById('pfSort');
        if (sort) sort.value = f.sort;
        const stock = document.getElementById('pfStock');
        if (stock) stock.checked = f.inStock;

        this.applyProductFilters();
    },

    productFilters: { cat: 'all', q: '', price: 'all', inStock: false, sort: 'featured' },

    setProductFilter(key, value) {
        this.productFilters[key] = value;
        this.applyProductFilters();
    },

    clearProductFilters() {
        Object.assign(this.productFilters, { q: '', price: 'all', inStock: false, sort: 'featured' });
        const search = document.getElementById('pfSearch');
        if (search) search.value = '';
        const sort = document.getElementById('pfSort');
        if (sort) sort.value = 'featured';
        const stock = document.getElementById('pfStock');
        if (stock) stock.checked = false;
        this.applyProductFilters();
    },

    // Redraws only the grid, so the search box keeps focus while typing.
    applyProductFilters() {
        const grid = document.getElementById('productsGrid');
        const noProd = document.getElementById('noProducts');
        if (!grid || !noProd) return;
        const f = this.productFilters;

        let list = f.cat === 'all' ? PRODUCTS.slice() : PRODUCTS.filter(p => p.cat === f.cat);
        const inCategory = list.length;

        const q = f.q.trim().toLowerCase();
        if (q) {
            const words = q.split(/\s+/);
            list = list.filter(p => {
                const hay = `${p.name} ${p.desc} ${getCatName(p.cat)}`.toLowerCase();
                return words.every(w => hay.includes(w));
            });
        }
        if (f.price !== 'all') {
            const [min, max] = f.price.split('-');
            const lo = Number(min) || 0;
            const hi = max === '' || max === undefined ? Infinity : Number(max);
            list = list.filter(p => p.price >= lo && (hi === Infinity ? true : p.price < hi));
        }
        if (f.inStock) list = list.filter(p => p.stock > 0);

        const sorters = {
            'price-asc':  (x, y) => x.price - y.price,
            'price-desc': (x, y) => y.price - x.price,
            'name':       (x, y) => String(x.name).localeCompare(String(y.name)),
            'newest':     (x, y) => (Number(y.id) || 0) - (Number(x.id) || 0)
        };
        if (sorters[f.sort]) list.sort(sorters[f.sort]);

        const narrowed = !!q || f.price !== 'all' || f.inStock;
        const active = narrowed || f.sort !== 'featured';

        // Toolbar state
        document.querySelectorAll('.pf-chip').forEach(chip => {
            const on = chip.dataset.price === f.price;
            chip.classList.toggle('active', on);
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const count = document.getElementById('pfCount');
        if (count) {
            count.textContent = narrowed
                ? `${list.length} of ${inCategory} product${inCategory === 1 ? '' : 's'}`
                : `${list.length} product${list.length === 1 ? '' : 's'}`;
        }
        const clear = document.getElementById('pfClear');
        if (clear) clear.hidden = !active;

        if (list.length > 0) {
            grid.style.display = 'grid';
            noProd.style.display = 'none';
            // The full, unfiltered catalog is grouped by category; any filter or
            // sort shows one flat list so the order the visitor asked for is clear.
            grid.innerHTML = (f.cat === 'all' && !active)
                ? this.catalogByTypeHtml(list)
                : list.map(p => this.createProductCard(p)).join('');
        } else {
            grid.style.display = 'none';
            noProd.style.display = 'block';
            const text = document.getElementById('noProductsText');
            if (text) text.textContent = narrowed ? 'No products match these filters.' : 'No products found in this category.';
            const btn = document.getElementById('noProductsClear');
            if (btn) btn.hidden = !narrowed;
        }
    },

    /* The full catalog split into one titled block per category, in the order
       categories are defined. Products in an unknown category fall to the end. */
    catalogByTypeHtml(items) {
        const order = CATEGORIES.map(c => c.id);
        const groups = new Map();
        items.forEach(p => {
            const key = order.includes(p.cat) ? p.cat : '__other';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        });
        const rank = k => (order.indexOf(k) < 0 ? order.length : order.indexOf(k));
        return [...groups.keys()].sort((a, b) => rank(a) - rank(b)).map(key => {
            const cat = CATEGORIES.find(c => c.id === key);
            const icon = cat ? cat.icon : DEFAULT_CAT_FALLBACK_ICON;
            const name = key === '__other' ? 'More Products' : getCatName(key);
            const list = groups.get(key);
            return `
                <h3 class="catalog-group-title">
                    <i class="${escapeAttr(icon)}"></i>
                    <span>${escapeHtml(name)}</span>
                    <span class="catalog-group-count">${list.length}</span>
                </h3>
                ${list.map(p => this.createProductCard(p)).join('')}
            `;
        }).join('');
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
            // Products are still loading on a first visit, so only call it missing once they are in.
            if (PRODUCTS.length) setSeo({ title: 'Product not found | Velorex Design', noindex: true });
            return;
        }

        this.trackRecentlyViewed(product.id);
        setSeo({
            title: `${product.name} | Velorex Design`,
            description: String(product.desc || `${product.name} from Velorex Design, handcrafted in India.`).replace(/\s+/g, ' ').slice(0, 158),
            image: /vijaysar/i.test(product.name || '') ? VIJAYSAR_OG_IMAGE : product.img
        });
        setStructuredData('ldProduct', Object.assign({ '@context': 'https://schema.org' }, productSchema(product)));
        setStructuredData('ldBreadcrumbs', {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: [
                ['Home', '/'], ['Catalog', '/products'],
                [getCatName(product.cat), routeToPath('products', { cat: product.cat })],
                [product.name, routeToPath('product-detail', { id: product.id })]
            ].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: window.location.origin + path }))
        });

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
            <div class="pd-thumbs">
                ${gallery.map((src, i) => `
                    <button type="button" class="pd-thumb${i === 0 ? ' is-active' : ''}" data-action="select-detail-img" data-idx="${i}" id="detail-thumb-${i}" aria-label="Show image ${i + 1}">
                        <img src="${escapeAttr(safeUrl(src))}" data-broken-opacity="1" alt="${escapeAttr(product.name + ' - view ' + (i + 1))}" loading="lazy" width="76" height="76">
                    </button>
                `).join('')}
            </div>` : '';

        const amazon = amazonUrlFor(product);
        const descText = String(product.desc || '');
        const firstSentence = (descText.match(/^[^.!?]+[.!?]/) || [descText])[0];
        const restText = descText.slice(firstSentence.length).trim();
        const shareUrl = window.location.origin + routeToPath('product-detail', { id: product.id });
        container.innerHTML = `
            <div class="pd-gallery">
                <div class="pd-main">
                    ${amazon ? '<span class="pd-flag"><i class="fab fa-amazon"></i> On Amazon</span>' : ''}
                    <img id="detailMainImage" src="${escapeAttr(safeUrl(gallery[0] || ''))}" alt="${escapeAttr(product.name + ' by Velorex Design')}" width="800" height="800" fetchpriority="high" data-fallback="https://placehold.co/600x600/1a1a2e/9890b0?text=${encodeURIComponent(product.name || 'Product')}">
                </div>
                ${thumbsHtml}
            </div>
            <div class="pd-info">
                <a class="pd-cat" href="#products?cat=${encodeURIComponent(product.cat)}">${escapeHtml(getCatName(product.cat))}</a>
                <h1 class="pd-title">${escapeHtml(product.name)}</h1>
                <p class="pd-lead">${escapeHtml(firstSentence)}</p>

                <div class="pd-buy">
                    ${buyButtonHtml(product, 'btn-lg pd-buy-main')}
                    ${amazon && whatsAppOrderUrl(product) ? `<a class="btn btn-whatsapp btn-lg" href="${escapeAttr(whatsAppOrderUrl(product))}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Order on WhatsApp</a>` : ''}
                    <p class="pd-buy-note">${amazon ? 'Buy on Amazon.in, or order directly from us on WhatsApp (' + WA_DISPLAY + ').' : 'Message us on WhatsApp (' + WA_DISPLAY + ') and we will share the price, payment and delivery details.'}</p>
                </div>

                <ul class="pd-trust">
                    <li><i class="fas fa-hand-sparkles"></i><span><strong>Handmade</strong>${escapeHtml(craftLabel(product))}</span></li>
                    <li><i class="fas fa-location-dot"></i><span><strong>Made in India</strong>Meerut studio</span></li>
                    <li><i class="fab fa-whatsapp"></i><span><strong>Order on WhatsApp</strong>Quick reply, Mon–Fri</span></li>
                </ul>

                ${restText ? `<details class="pd-more" open><summary>About this piece</summary><p>${escapeHtml(restText)}</p></details>` : ''}

                <div class="pd-share">
                    <span>Share</span>
                    <a href="https://wa.me/?text=${encodeURIComponent(product.name + ' ' + shareUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp"></i></a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(product.name)}" target="_blank" rel="noopener noreferrer" aria-label="Pin on Pinterest"><i class="fab fa-pinterest-p"></i></a>
                </div>
            </div>
        `;

        const extra = document.getElementById('productExtraContent');
        if (extra) extra.innerHTML = this.productDeepDiveHtml(resolveDetailSlug(product));
    },

    /* Rich deep-dive shown on a product's detail page, built from
       PRODUCT_DETAILS. Returns '' for products without a deep-dive entry.
       Keeps the .wellness-* styles — they are the shared deep-dive skin. */
    productDeepDiveHtml(slug) {
        const d = PRODUCT_DETAILS[slug];
        if (!d) return '';
        const steps = d.steps.map((s, i) => `
            <div class="wellness-step">
                <span class="wellness-step-num">0${i + 1}</span>
                ${s.img ? `<img class="wellness-step-img" src="${s.img}" alt="${s.title}" loading="lazy">` : `<i class="${s.icon}"></i>`}
                <h4>${s.title}</h4>
                <p>${s.text}</p>
            </div>`).join('');
        const benefits = d.benefits.map(b => `
            <div class="wellness-benefit">
                <i class="${b.icon}"></i>
                <h4>${b.title}</h4>
                <p>${b.text}</p>
            </div>`).join('');
        const points = d.points.map(p => `<li><i class="fas fa-check"></i> ${p}</li>`).join('');
        const list = items => (items || []).map(t => `<li><i class="fas fa-check"></i> ${t}</li>`).join('');
        const careBlock = (d.care || d.goodToKnow) ? `
                <div class="care-grid">
                    ${d.care ? `<div><h4 class="care-title">Care</h4><ul class="wellness-points">${list(d.care)}</ul></div>` : ''}
                    ${d.goodToKnow ? `<div><h4 class="care-title">Good to Know</h4><ul class="wellness-points">${list(d.goodToKnow)}</ul></div>` : ''}
                </div>` : '';
        const replaceBlock = d.replaceSchedule ? `
                <div class="replace-card">
                    <div class="replace-card-head">When to Replace Your Glass</div>
                    <div class="replace-card-body">
                        ${d.replaceSchedule.map(r => `<div><strong>${r.days}</strong><span>days</span><em>${r.use}</em></div>`).join('')}
                    </div>
                </div>` : '';
        const specs = (d.specs || []).map(sp => `
            <div class="spec-row">
                <span class="spec-label">${sp.label}</span>
                <span class="spec-value">${sp.value}</span>
            </div>`).join('');
        return `
            <section class="wellness-section" style="margin-top:3rem; border:1px solid var(--border); border-radius:var(--radius-lg); padding:2.5rem;">
                <span class="wellness-badge"><i class="${d.icon || 'fas fa-leaf'}"></i> ${d.badge}</span>
                <h3 style="font-size:1.6rem; margin:1rem 0 0.75rem;">${d.introHeading}</h3>
                <p style="color:var(--text-muted); max-width:760px;">${d.introText}</p>
                <ul class="wellness-points" style="margin-top:1.25rem;">${points}</ul>

                ${specs ? `
                <h3 class="wellness-subheading" style="margin-top:2.5rem;">Specifications</h3>
                <div class="spec-table">${specs}</div>` : ''}

                <h3 class="wellness-subheading" style="margin-top:2.5rem;">${d.stepsHeading || 'How to Use'}</h3>
                <div class="grid wellness-steps">${steps}</div>

                ${d.firstUse ? `<p class="first-use-note"><strong>Before first use:</strong> ${d.firstUse}</p>` : ''}

                ${careBlock || replaceBlock ? `
                <h3 class="wellness-subheading" style="margin-top:2.5rem;">Care &amp; Replacement</h3>
                ${careBlock}
                ${replaceBlock}` : ''}

                <h3 class="wellness-subheading" style="margin-top:2.5rem;">${d.benefitsHeading || 'Key Details &amp; Benefits'}</h3>
                <div class="grid wellness-benefits">${benefits}</div>

                ${d.disclaimer ? `<p class="wellness-disclaimer"><i class="fas fa-circle-info"></i> ${d.disclaimer}</p>` : ''}
            </section>
        `;
    },

    selectDetailImage(i) {
        if (!Array.isArray(this._detailGallery) || !this._detailGallery[i]) return;
        const main = document.getElementById('detailMainImage');
        if (main) main.src = safeUrl(this._detailGallery[i]);
        this._detailGallery.forEach((_, idx) => {
            const t = document.getElementById('detail-thumb-' + idx);
            if (t) t.classList.toggle('is-active', idx === i);
        });
    },

    addToCart(id) {
        const product = PRODUCTS.find(p => String(p.id) === String(id));
        if (!product) return;
        // The site sells through Amazon only. A stale cached page may still
        // show an old Add to Cart button: send that click to Amazon instead.
        const amazon = amazonUrlFor(product);
        if (amazon) { window.open(amazon, '_blank', 'noopener,noreferrer'); return; }
        this.navigate('product-detail', { id: product.id });
        return;

        const existing = this.cart.find(item => String(item.id) === String(id));
        if (existing) {
            if (existing.qty >= 20) { this.showToast('You can order up to 20 of one item. Message us for bulk orders.'); return; }
            existing.qty += 1;
        } else {
            this.cart.push({ ...product, qty: 1 });
        }

        this.saveCart();
        this.showToast(`Added ${product.name} to cart!`);
        if (parseLocation().view === 'cart') this.renderCart();
    },

    updateQty(id, change) {
        const item = this.cart.find(i => String(i.id) === String(id));
        if (item) {
            item.qty = Math.min(20, item.qty + (Number(change) || 0));
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
        // Same count on the phone tab bar
        const tabBadge = document.getElementById('tabbarCartCount');
        if (tabBadge) { tabBadge.textContent = count > 99 ? '99+' : count; tabBadge.hidden = count === 0; }
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

            const waNumber = storeWhatsAppNumber();
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

    /* Overview tab: greeting, counts, latest order. */
    renderProfileOverview(orders) {
        const p = this.userProfile || {};
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const first = String(p.name || '').trim().split(/\s+/)[0] || 'there';
        set('ovName', first);
        set('pmName', p.name || 'My account');
        set('pmEmail', p.email || '');
        set('pmAvatar', (first[0] || 'V').toUpperCase());
        set('ovOrders', orders.length);
        set('ovActive', orders.filter(o => ['Pending', 'Processing', 'Shipped'].includes(o.status)).length);
        set('ovAddr', (p.addresses || []).length);
        const latest = document.getElementById('ovLatest');
        if (!latest) return;
        const o = orders[0];
        latest.innerHTML = o ? `
            <div class="ov-latest-card">
                <div><span class="ov-k">Latest order</span><b>${escapeHtml(o.id || o.order_code || '')}</b><span>${escapeHtml(o.date || '')}</span></div>
                <span class="order-status-pill pill-${escapeAttr(String(o.status || '').toLowerCase())}">${escapeHtml(o.status || '')}</span>
                <button type="button" class="btn btn-secondary btn-sm" data-action="profile-tab" data-tab="orders">View</button>
            </div>` : `<div class="ov-latest-card ov-empty"><span>No orders yet. Browse the collection or order on WhatsApp.</span><button type="button" class="btn btn-primary btn-sm" data-action="goto-products">Shop now</button></div>`;
    },

    async changePassword() {
        const cur = document.getElementById('pwCurrent').value;
        const nw = document.getElementById('pwNew').value;
        const rep = document.getElementById('pwConfirm').value;
        if (!cur || !nw) { this.showToast('Fill in your current and new password', 'error'); return; }
        if (nw.length < 8) { this.showToast('New password must be at least 8 characters', 'error'); return; }
        if (nw !== rep) { this.showToast('The new passwords do not match', 'error'); return; }
        const res = await apiCall('api/customer-account.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'password', current_password: cur, new_password: nw }) });
        if (!res.ok) { this.showToast((res.data && res.data.error) || 'Could not change the password', 'error'); return; }
        ['pwCurrent', 'pwNew', 'pwConfirm'].forEach(id => { document.getElementById(id).value = ''; });
        this.showToast('Password updated', 'success');
    },

    async deleteAccount() {
        const pw = document.getElementById('delPassword').value;
        if (!pw) { this.showToast('Type your password to confirm', 'error'); return; }
        if (!confirm('Delete your Velorex account? This cannot be undone.')) return;
        const res = await apiCall('api/customer-account.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', password: pw }) });
        if (!res.ok) { this.showToast((res.data && res.data.error) || 'Could not delete the account', 'error'); return; }
        this.currentUser = null;
        try { localStorage.removeItem('velorex_design_user'); } catch (_) { /* ignore */ }
        this.showToast('Your account has been deleted', 'info');
        this.navigate('home');
        setTimeout(() => window.location.reload(), 800);
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
        this.renderProfileOverview(myOrders);

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

    openItModal() {
        const modal = document.getElementById('itModal');
        if (!modal) return;
        modal.classList.add('open');
        const first = document.getElementById('itName');
        if (first) first.focus();
    },

    closeItModal() {
        const modal = document.getElementById('itModal');
        if (modal) modal.classList.remove('open');
    },

    // Velorex Studio IT-services enquiry: emailed to the studio inbox by
    // api/it-enquiry.php (the inbox address is kept on the server).
    async submitItEnquiry() {
        const val = id => document.getElementById(id).value.trim();
        const name = val('itName'), phone = val('itPhone'), email = val('itEmail');
        const service = val('itService'), budget = val('itBudget'), message = val('itMessage');

        const err = validateForm([
            { test: VALIDATORS.required, value: name,    message: 'Please enter your name' },
            { test: VALIDATORS.phone,    value: phone,   message: 'Please enter a valid mobile number' },
            { test: VALIDATORS.email,    value: email,   message: 'Please enter a valid email' },
            { test: VALIDATORS.required, value: service, message: 'Please select a service' },
            { test: VALIDATORS.required, value: message, message: 'Please describe your project' },
            { test: v => VALIDATORS.maxLength(v, 2000),  value: message, message: 'Message is too long' }
        ]);
        if (err) { this.showToast(err, 'error'); return; }

        const btn = document.getElementById('itSubmitBtn');
        const btnHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

        let ok = false, errorMsg = 'We could not send your enquiry. Please check your connection and try again.';
        try {
            const res = await fetch('api/it-enquiry.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, email, service, budget, message, website: val('itWebsite') })
            });
            const data = await res.json().catch(() => null);
            ok = res.ok && data && data.success;
            if (!ok && data && data.error) errorMsg = data.error;
        } catch (_) { /* network error: keep the default message */ }

        if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }

        if (!ok) { this.showToast(errorMsg, 'error'); return; }  // keep the form so nothing is lost

        document.getElementById('itForm').reset();
        this.closeItModal();
        this.showToast(`Thanks ${name}! Your enquiry has been sent. We will reply by email or phone.`, 'success');
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
    'toggle-design':       () => app.toggleDesign(),
    'goto-products':       () => app.navigate('products'),
    'goto-categories':     () => app.gotoCategories(),
    'goto-services':       () => app.navigate('services'),
    'open-product':        (e, el) => app.navigate('product-detail', { id: el.dataset.id }),
    'open-category':       (e, el) => app.navigate('products', { cat: el.dataset.cat }),
    'add-to-cart':         (e, el) => app.addToCart(el.dataset.id),
    'qty':                 (e, el) => app.updateQty(el.dataset.id, parseInt(el.dataset.delta, 10)),
    'checkout':            () => app.checkout(),
    'close-checkout':      () => app.closeCheckoutModal(),
    'close-addr-modal':    () => app.hideAddressForm(),
    'open-it-modal':       () => app.openItModal(),
    'open-search':         () => { if (app.openSearch) app.openSearch(); },
    'pf-price':            (e, el) => app.setProductFilter('price', el.dataset.price),
    'pf-clear':            () => app.clearProductFilters(),
    'close-it-modal':      () => app.closeItModal(),
    'it-modal-backdrop':   (e, el) => { if (e.target === el) app.closeItModal(); },
    'edit-address':        (e, el) => app.showAddressForm(el.dataset.id),
    'delete-address':      (e, el) => app.deleteAddress(el.dataset.id),
    'default-address':     (e, el) => app.setDefaultAddress(el.dataset.id),
    'show-addr-form':      () => app.showAddressForm(),
    'logout':              () => app.handleLogout(),
    'profile-tab':         (e, el) => app.switchProfileTab(el.dataset.tab, document.querySelector('#app .profile-menu-item[data-tab="' + el.dataset.tab + '"]') || el),
    'open-chat-track':     () => { const l = document.querySelector('.vx-chat-launch'); if (l) l.click(); setTimeout(() => { const b = document.querySelector('#vxMenuGrid [data-chip="track"]'); if (b) b.click(); }, 700); },
    'select-service':      (e, el) => app.selectServiceType(el.dataset.svc),
    'select-package':      (e, el) => app.selectPackage(el.dataset.svc, parseInt(el.dataset.idx, 10)),
    'proceed-service':     (e, el) => app.proceedService(el.dataset.svc, parseInt(el.dataset.idx, 10)),
    'select-detail-img':   (e, el) => app.selectDetailImage(parseInt(el.dataset.idx, 10)),
    'show-register':       () => app.showAuthForm('register'),
    'show-login':          () => app.showAuthForm('login'),
    'faq-toggle':          (e, el) => el.classList.toggle('active'),
    'scroll-to':           (e, el) => { const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
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
        const action = trigger.dataset.action;
        if (action === 'cat-filter') app.filterProducts();
        else if (action === 'pf-sort') app.setProductFilter('sort', trigger.value);
        else if (action === 'pf-stock') app.setProductFilter('inStock', trigger.checked);
    });

    document.addEventListener('input', (e) => {
        if (e.target.dataset && e.target.dataset.action === 'pf-search') app.setProductFilter('q', e.target.value);
    });

    document.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-action]');
        if (!form) return;
        const action = form.dataset.action;
        e.preventDefault();
        if (action === 'login')           app.handleLogin(e);
        else if (action === 'register')   app.handleRegister(e);
        else if (action === 'save-profile') app.saveProfile();
        else if (action === 'change-password') app.changePassword();
        else if (action === 'delete-account') app.deleteAccount();
        else if (action === 'save-address') app.saveAddress();
        else if (action === 'submit-checkout') app.submitCheckout();
        else if (action === 'submit-contact')  app.submitContact();
        else if (action === 'submit-it')       app.submitItEnquiry();
        else if (action === 'subscribe-newsletter') app.subscribeNewsletter(e);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') app.closeItModal();
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

/* ──────────────────────────────────────────────────────────────
   UI EFFECTS: scroll progress bar, navbar state, reveal on scroll
   ────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────
   MEGA MENU: open/close behaviour for the Catalog panel.
   Desktop: opens on hover or keyboard focus, closes on Escape,
   outside click, or after picking a link. Phone: the Catalog row
   becomes a tap-to-expand section inside the hamburger menu.
   ────────────────────────────────────────────────────────────── */

function initMegaMenu() {
    const items = [...document.querySelectorAll('.nav-mega')];
    if (!items.length) return;

    const isPhone = () => window.matchMedia('(max-width: 768px)').matches;
    const isTouch = () => isPhone() || window.matchMedia('(hover: none)').matches;
    const timers = new Map();

    const setOpen = (item, open) => {
        clearTimeout(timers.get(item));
        if (open) items.forEach(other => { if (other !== item) setOpen(other, false); });
        item.classList.toggle('open', open);
        const trigger = item.querySelector('.nav-mega-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    const closeAll = () => items.forEach(item => setOpen(item, false));

    items.forEach(item => {
        const trigger = item.querySelector('.nav-mega-trigger');
        const panel = item.querySelector('.mega-menu');
        if (!trigger || !panel) return;
        // A trigger with href="#" has no page of its own, so a click only toggles the panel.
        const toggleOnly = (trigger.getAttribute('href') || '#') === '#';

        // Short delay so the pointer can cross the gap between the link and the panel.
        // Do not close under someone who is typing in the search box.
        const closeSoon = () => {
            clearTimeout(timers.get(item));
            timers.set(item, setTimeout(() => {
                if (!panel.contains(document.activeElement)) setOpen(item, false);
            }, 180));
        };

        item.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !isPhone()) setOpen(item, true); });
        item.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !isPhone()) closeSoon(); });

        trigger.addEventListener('click', (e) => {
            if (toggleOnly || isTouch()) {
                // On phones and touch screens the first tap expands the menu instead of navigating.
                e.preventDefault();
                setOpen(item, isTouch() ? !item.classList.contains('open') : true);
            } else {
                setOpen(item, false);
            }
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === ' ' || (toggleOnly && e.key === 'Enter')) {
                e.preventDefault();
                setOpen(item, true);
                const first = panel.querySelector('input, a, button');
                if (first) first.focus();
            }
        });
        item.addEventListener('focusin', () => { if (!isPhone()) setOpen(item, true); });
        item.addEventListener('focusout', (e) => { if (!isPhone() && !item.contains(e.relatedTarget)) setOpen(item, false); });

        // Picking anything inside the panel closes it (and the phone menu).
        panel.addEventListener('click', (e) => {
            if (!e.target.closest('a, button')) return;
            setOpen(item, false);
            const navLinks = document.getElementById('navLinks');
            if (navLinks) navLinks.classList.remove('show');
            if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
        });
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.nav-mega, [data-action="open-search"]')) return;
        closeAll();
    });
    window.addEventListener('velorex:route', closeAll);

    /* ── Product search inside the Catalog panel ── */
    const catalog = document.getElementById('navMega');
    const catalogPanel = document.getElementById('navCategoryDropdown');
    const openSearch = () => {
        if (!catalog) return;
        if (isPhone()) {
            const navLinks = document.getElementById('navLinks');
            if (navLinks) navLinks.classList.add('show');
        }
        setOpen(catalog, true);
        // Wait a frame: the panel has to be visible before the box can take focus.
        requestAnimationFrame(() => {
            const input = document.getElementById('megaSearch');
            if (input) { input.focus(); input.select(); }
        });
    };
    app.openSearch = openSearch;

    if (catalogPanel) {
        // The panel's contents are rebuilt by renderNavCategories(), so listen on the panel itself.
        catalogPanel.addEventListener('input', (e) => {
            if (e.target.id === 'megaSearch') app.renderMegaSide(e.target.value);
        });
        catalogPanel.addEventListener('keydown', (e) => {
            if (e.target.id !== 'megaSearch') return;
            if (e.key === 'Enter') {
                e.preventDefault();
                const first = catalogPanel.querySelector('#megaSide .mega-product');
                if (first) first.click();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const first = catalogPanel.querySelector('#megaSide .mega-product');
                if (first) first.focus();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const open = items.find(item => item.classList.contains('open'));
            if (open) {
                setOpen(open, false);
                const trigger = open.querySelector('.nav-mega-trigger');
                if (trigger && !isPhone()) trigger.blur();
            }
            return;
        }
        // "/" opens search from anywhere, unless the visitor is typing in a field.
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
        if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            openSearch();
        }
    });
}

function initUiEffects() {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scroll progress bar + compact navbar. One rAF-throttled scroll listener.
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    const navbar = document.querySelector('.navbar');
    let ticking = false;
    const onScroll = () => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
        if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    // Reveal on scroll. Views are re-rendered on navigation and product grids
    // arrive after the API responds, so watch #app for new elements.
    if (reduced || !('IntersectionObserver' in window)) return;
    const SELECTOR = '.product-card, .feature-item, .cat-card, .section-header, .service-card, .address-card, .faq-item, .trust-item, .split-card, .amazon-band-inner, .wellness-banner, .care-card';
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('in');
            io.unobserve(el);
            // Drop the helper classes once the fade is done so the element's own
            // hover transition (card lift, etc.) is not slowed by the reveal timing.
            setTimeout(() => {
                el.classList.remove('reveal', 'in');
                el.style.removeProperty('--reveal-delay');
                el.dataset.revealed = '1';
            }, 1100);
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    const register = (root) => {
        if (!root || !root.querySelectorAll) return;
        const found = root.matches && root.matches(SELECTOR) ? [root] : [];
        found.push(...root.querySelectorAll(SELECTOR));
        let i = 0;
        found.forEach(el => {
            if (el.classList.contains('reveal') || el.dataset.revealed || el.closest('.cat-marquee-track')) return;
            // Small stagger so a row of cards comes in one after another.
            el.style.setProperty('--reveal-delay', (i++ % 4) * 70 + 'ms');
            el.classList.add('reveal');
            io.observe(el);
        });
    };

    const appRoot = document.getElementById('app');
    register(appRoot);
    if (appRoot) {
        new MutationObserver(muts => {
            muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) register(n); }));
        }).observe(appRoot, { childList: true, subtree: true });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    wireDelegatedEvents();
    app.init();
    initMegaMenu();
    initUiEffects();
});

/* Small interaction effects: button ripple, card spotlight, gallery cross-fade.
   All skipped when the visitor prefers reduced motion. */
(function () {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.btn');
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const size = Math.max(r.width, r.height);
        const dot = document.createElement('span');
        dot.className = 'ripple';
        dot.style.width = dot.style.height = size + 'px';
        dot.style.left = (e.clientX - r.left - size / 2) + 'px';
        dot.style.top = (e.clientY - r.top - size / 2) + 'px';
        btn.appendChild(dot);
        setTimeout(() => dot.remove(), 650);
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
        const card = e.target.closest && e.target.closest('.product-card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-action="select-detail-img"]')) return;
        const img = document.getElementById('detailMainImage');
        if (!img) return;
        img.classList.remove('swap');
        void img.offsetWidth; // restart the animation
        img.classList.add('swap');
    });
})();

/* Splash screen: lift it once the page is ready (min 700ms so the animation
   lands, max 2.5s so a slow network never holds the visitor). */
(function () {
    const splash = document.getElementById('splash');
    if (!splash || document.documentElement.classList.contains('splash-seen')) { if (splash) splash.remove(); return; }
    const started = performance.now();
    let done = false;
    const hide = () => {
        if (done) return; done = true;
        const wait = Math.max(0, 700 - (performance.now() - started));
        setTimeout(() => {
            splash.classList.add('is-out');
            setTimeout(() => splash.remove(), 650);
        }, wait);
    };
    if (document.readyState === 'complete') hide(); else window.addEventListener('load', hide, { once: true });
    setTimeout(hide, 2500);
})();
