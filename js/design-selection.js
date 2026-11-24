(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) module.exports = api;
    if (!root || !root.document) return;

    root.VelorexDesignSelection = api;
    api.bootstrap(root);
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const STORAGE_KEY = 'velorex_design_variant';
    const DEFAULT_DESIGN = 'classic';
    const SUPPORTED_DESIGNS = new Set(['classic', 'living-craft']);
    // Living Craft is kept in the code but hidden from visitors. While false:
    // saved choices are ignored, the header switch is hidden, and the design
    // can only be previewed with ?design=living-craft. Set to true to bring it back.
    const ALTERNATE_DESIGN_ENABLED = false;

    function normalizeDesign(value) {
        return typeof value === 'string' && SUPPORTED_DESIGNS.has(value) ? value : null;
    }

    function getPreviewDesign(search) {
        const params = new URLSearchParams(search || '');
        const values = params.getAll('design');
        return values.length === 1 ? normalizeDesign(values[0]) : null;
    }

    function resolveDesign({ preview, saved } = {}) {
        return normalizeDesign(preview) || normalizeDesign(saved) || DEFAULT_DESIGN;
    }

    function applyDesign(documentElement, design) {
        const nextDesign = normalizeDesign(design) || DEFAULT_DESIGN;
        documentElement.setAttribute('data-design', nextDesign);
        return nextDesign;
    }

    function readSavedDesign(storage) {
        try {
            return storage ? storage.getItem(STORAGE_KEY) : null;
        } catch (_) {
            return null;
        }
    }

    function saveDesign(storage, design) {
        try {
            if (storage) storage.setItem(STORAGE_KEY, design);
        } catch (_) {
            // Storage can be unavailable in privacy modes; the in-page choice still applies.
        }
    }

    function clearPreviewQuery(win) {
        if (!win.location || !win.history || typeof win.history.replaceState !== 'function') return;
        const url = new URL(win.location.href);
        if (!url.searchParams.has('design')) return;
        url.searchParams.delete('design');
        win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
    }

    function bootstrap(win) {
        // Splash shows once per visit; later pages in the same tab skip it before paint.
        try {
            if (win.sessionStorage && win.sessionStorage.getItem('vx_splash')) win.document.documentElement.classList.add('splash-seen');
            else if (win.sessionStorage) win.sessionStorage.setItem('vx_splash', '1');
        } catch (_) { /* storage blocked: show the splash */ }
        const preview = getPreviewDesign(win.location ? win.location.search : '');
        const saved = ALTERNATE_DESIGN_ENABLED ? readSavedDesign(win.localStorage) : null;
        if (!ALTERNATE_DESIGN_ENABLED) win.document.documentElement.setAttribute('data-design-switch', 'off');
        const design = applyDesign(win.document.documentElement, resolveDesign({ preview, saved }));
        return { design, preview: Boolean(preview) };
    }

    function setDesign(win, design, options = {}) {
        const nextDesign = applyDesign(win.document.documentElement, design);
        if (options.persist !== false) saveDesign(win.localStorage, nextDesign);
        if (options.clearPreview !== false) clearPreviewQuery(win);

        if (typeof win.CustomEvent === 'function') {
            win.dispatchEvent(new win.CustomEvent('velorex:designchange', {
                detail: { design: nextDesign }
            }));
        }
        return nextDesign;
    }

    function applySavedDesignChange(win, design) {
        const preview = getPreviewDesign(win.location ? win.location.search : '');
        if (preview) return applyDesign(win.document.documentElement, preview);
        return applyDesign(win.document.documentElement, ALTERNATE_DESIGN_ENABLED ? design : DEFAULT_DESIGN);
    }

    return {
        STORAGE_KEY,
        DEFAULT_DESIGN,
        normalizeDesign,
        getPreviewDesign,
        resolveDesign,
        applyDesign,
        bootstrap,
        setDesign,
        applySavedDesignChange
    };
});
