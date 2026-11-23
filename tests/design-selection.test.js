const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeDesign,
  resolveDesign,
  getPreviewDesign,
  applyDesign,
  bootstrap,
  setDesign,
  applySavedDesignChange
} = require('../js/design-selection.js');

test('normalizes only supported storefront designs', () => {
  assert.equal(normalizeDesign('classic'), 'classic');
  assert.equal(normalizeDesign('living-craft'), 'living-craft');
  assert.equal(normalizeDesign('future-theme'), null);
  assert.equal(normalizeDesign(null), null);
});

test('uses a valid URL preview before a saved preference', () => {
  assert.equal(resolveDesign({ preview: 'living-craft', saved: 'classic' }), 'living-craft');
  assert.equal(resolveDesign({ preview: 'classic', saved: 'living-craft' }), 'classic');
});

test('falls back from invalid values to a saved preference and then Classic', () => {
  assert.equal(resolveDesign({ preview: 'unknown', saved: 'living-craft' }), 'living-craft');
  assert.equal(resolveDesign({ preview: null, saved: 'unknown' }), 'classic');
});

test('reads only supported design preview query values', () => {
  assert.equal(getPreviewDesign('?design=living-craft'), 'living-craft');
  assert.equal(getPreviewDesign('?category=wood&design=classic'), 'classic');
  assert.equal(getPreviewDesign('?design=unknown'), null);
});

test('applies design without changing the independent appearance attribute', () => {
  const attributes = new Map([['data-theme', 'light']]);
  const documentElement = {
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; }
  };

  applyDesign(documentElement, 'living-craft');

  assert.equal(attributes.get('data-design'), 'living-craft');
  assert.equal(attributes.get('data-theme'), 'light');
});

test('URL preview wins without overwriting the saved design', () => {
  const attributes = new Map([['data-theme', 'dark']]);
  let writes = 0;
  const win = {
    location: { search: '?design=living-craft' },
    localStorage: {
      getItem() { return 'classic'; },
      setItem() { writes += 1; }
    },
    document: {
      documentElement: {
        setAttribute(name, value) { attributes.set(name, value); }
      }
    }
  };

  const result = bootstrap(win);

  assert.deepEqual(result, { design: 'living-craft', preview: true });
  assert.equal(writes, 0);
  assert.equal(attributes.get('data-theme'), 'dark');
});

test('explicit selection persists and removes a conflicting preview query', () => {
  const attributes = new Map([['data-theme', 'light']]);
  const writes = [];
  let replacedUrl = null;
  const win = {
    location: {
      href: 'http://127.0.0.1:8080/products?cat=wood&design=living-craft',
      search: '?cat=wood&design=living-craft'
    },
    history: {
      state: null,
      replaceState(_state, _title, url) { replacedUrl = url; }
    },
    localStorage: {
      setItem(key, value) { writes.push([key, value]); }
    },
    document: {
      documentElement: {
        setAttribute(name, value) { attributes.set(name, value); }
      }
    },
    dispatchEvent() {},
    CustomEvent: function CustomEvent() {}
  };

  setDesign(win, 'classic');

  assert.deepEqual(writes, [['velorex_design_variant', 'classic']]);
  assert.equal(replacedUrl, '/products?cat=wood');
  assert.equal(attributes.get('data-theme'), 'light');
});

test('a valid URL preview keeps precedence over cross-tab saved changes', () => {
  let applied = null;
  const win = {
    location: { search: '?design=living-craft' },
    document: {
      documentElement: {
        setAttribute(name, value) { if (name === 'data-design') applied = value; }
      }
    },
    dispatchEvent() {},
    CustomEvent: function CustomEvent() {}
  };

  applySavedDesignChange(win, 'classic');

  assert.equal(applied, 'living-craft');
});

test('storefront registers the flash-free bootstrap, scoped stylesheet, and selector control', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const bootstrapPosition = html.indexOf('js/design-selection.js');
  const themeStylesPosition = html.indexOf('css/themes/living-craft.css');

  assert.ok(bootstrapPosition > -1, 'design bootstrap script should be registered');
  assert.ok(themeStylesPosition > bootstrapPosition, 'theme CSS should load after the design bootstrap');
  assert.match(html, /data-action="toggle-design"/);
  assert.match(html, /id="designToggleLabel"/);
});

test('Living Craft stylesheet stays scoped and defines both appearance palettes', () => {
  const cssPath = path.resolve(__dirname, '..', 'css', 'themes', 'living-craft.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /:root\[data-design="living-craft"\]/);
  assert.match(css, /:root\[data-design="living-craft"\]\[data-theme="dark"\]/);
  assert.doesNotMatch(css, /(^|\n)\s*:root\s*\{/);
});

test('storefront registers a separately scoped Living Craft shell', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const foundationPosition = html.indexOf('css/themes/living-craft.css');
  const shellPosition = html.indexOf('css/themes/living-craft-shell.css');
  const shell = fs.readFileSync(path.join(root, 'css', 'themes', 'living-craft-shell.css'), 'utf8');

  assert.ok(shellPosition > foundationPosition, 'shell CSS should load after foundation CSS');
  assert.match(shell, /:root\[data-design="living-craft"\] \.navbar/);
  assert.match(shell, /:root\[data-design="living-craft"\] \.product-card/);
  assert.doesNotMatch(shell, /(^|\n)\s*\.(?!\d)/, 'shell selectors must not leak into Classic');
});

test('Living Craft uses an alternate home composition with live commerce actions', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js', 'index.js'), 'utf8');

  assert.match(html, /id="tpl-home-living-craft"/);
  assert.match(html, /class="lc-hero"/);
  assert.match(html, /id="lcFeaturedGrid"/);
  assert.match(html, /data-action="goto-products"/);
  assert.match(app, /renderLivingCraftHome\(\)/);
  assert.match(app, /'tpl-home-living-craft'/);
  assert.match(app, /this\.createProductCard\(product\)/);
  assert.match(app, /stopHeroCarousel\(\)/);
});
