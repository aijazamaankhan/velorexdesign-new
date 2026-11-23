# Specification: Storefront Design Selection

Module id: `design-selection`  
Capability map: `THEME-CAPABILITY-MAP.md`  
Foundation: `SPEC-design-foundation.md`  
Status: Implemented; browser evidence pending  
Date: 17 November 2026

## Objective

Allow visitors to switch between Classic and Living Craft without changing storefront behavior or the independent light/dark appearance preference. Classic remains the safe default.

## State contract

| Concern | Contract |
| --- | --- |
| Root attribute | `data-design="classic|living-craft"` |
| Saved preference | `velorex_design_variant` |
| Non-persistent preview | `?design=classic` or `?design=living-craft` |
| Fallback | `classic` |
| Precedence | valid URL preview, then valid saved preference, then Classic |
| Appearance state | remains `data-theme="dark|light"` in `velorex_design_theme` |

Only exact supported values are accepted. Unknown, duplicated, or corrupt preview values do not override a valid saved preference. Storage errors must leave the storefront usable.

## Initialization

`js/design-selection.js` loads synchronously in the document head before the theme stylesheets. It resolves and applies `data-design` before CSS paints. A URL preview is read-only and never writes to storage.

An explicit user choice:

1. applies immediately;
2. writes only `velorex_design_variant`;
3. removes an active `design` preview parameter while preserving other route parameters; and
4. dispatches `velorex:designchange` so the control label and pressed state remain synchronized.

## Selector behavior

The storefront navbar exposes one keyboard-native button. Its visible text names the current design. Its accessible label names both the current design and the result of activating the button. `aria-pressed="true"` means Living Craft is active.

The selector must not:

- write `velorex_design_theme`;
- change `data-theme`;
- fork routing, product, cart, checkout, account, or API behavior;
- make Living Craft the default for a fresh visitor; or
- expose the selector in the admin portal.

## Files

- `js/design-selection.js` — validation, precedence, pre-paint bootstrap, persistence
- `index.html` — bootstrap/style registration and selector markup
- `js/index.js` — delegated selector action and accessible state synchronization
- `css/index.css` — design-neutral selector control styling
- `css/themes/living-craft.css` — scoped Living Craft foundation tokens
- `tests/design-selection.test.js` — behavior and integration contract

## Verification

Automated:

```text
node --test tests/design-selection.test.js
node --check js/design-selection.js
node --check js/index.js
```

Browser evidence still required before the module is considered fully verified:

- fresh visitor receives Classic;
- saved Living Craft restores before paint;
- URL preview overrides but does not overwrite the saved choice;
- selector works on home, catalogue, product, cart, auth, and policy routes;
- Classic/Living Craft × light/dark all remain readable at 390, 768, and 1440 pixels;
- keyboard focus, screen-reader naming, console, network, and horizontal overflow are clean.

## Current boundary

Design selection, the visual foundation, and the alternate Living Craft home composition are implemented. The alternate home uses the working catalogue and shared action handlers rather than duplicating commerce logic. Full Living Craft catalogue, product-detail, cart, account, footer, optimized imagery derivatives, and motion composition remain owned by the later shell, commerce, and motion modules.
