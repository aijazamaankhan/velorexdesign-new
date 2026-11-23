# Task List: Living Craft Design Foundation

Module id: `design-foundation`  
Plan: `tasks/plan.md`  
Spec: `SPEC-design-foundation.md`  
Status: Implementation in progress; automated foundation checks pass, browser evidence pending  
Date: 17 November 2026

## Task 1: Record the Classic baseline

**Description:** Capture a reproducible visual and computed-style baseline before foundation implementation so any Classic regression can be identified rather than guessed.

**Acceptance criteria:**

- [ ] Classic dark and light homepage evidence exists at 390, 768, and 1440 pixel viewport widths.
- [ ] The record includes root attributes, computed display/body fonts, key semantic color tokens, horizontal-overflow result, and browser console errors.
- [ ] Evidence is stored under `test-results/theme-foundation/before/` and is not referenced by production code.

**Verification:**

- [ ] Start local preview: `php -S 127.0.0.1:8080`
- [ ] Run the design inspector or equivalent browser capture against `http://127.0.0.1:8080/` for both saved Classic appearances.
- [ ] Confirm the screenshots and measurement record are readable and cover all six viewport/appearance combinations.

**Dependencies:** None

**Files likely touched:**

- `test-results/theme-foundation/before/*` — test evidence only

**Estimated scope:** Small: evidence only

## Task 2: Create the scoped Living Craft foundation stylesheet

**Description:** Implement the approved light/dark tokens, semantic mappings, typography scale, spacing, geometry, focus, selection, and state primitives in an isolated stylesheet without styling complete storefront components.

**Acceptance criteria:**

- [x] `css/themes/living-craft.css` contains every approved token family from `SPEC-design-foundation.md`.
- [x] Every effective selector is rooted under `:root[data-design="living-craft"]`; the dark appearance composes with `data-theme="dark"` without redefining Classic.
- [x] The file contains no gradients, glow, glass treatment, ornamental resting shadow, unapproved animation, or completed commerce-component composition.

**Verification:**

- [x] Scope audit: `rg -n '^[^@/[:space:]][^{]*\{' css/themes/living-craft.css`
- [x] Forbidden-pattern audit: `rg -n 'linear-gradient|radial-gradient|backdrop-filter|text-shadow|box-shadow' css/themes/living-craft.css`
- [x] Repository check: `git -c safe.directory='Z:/AI-developed-softwares/velorex-design - Copy' diff --check -- css/themes/living-craft.css`
- [x] Manually inspect the complete stylesheet against the approved spec.

**Dependencies:** Task 1

**Files likely touched:**

- `css/themes/living-craft.css`

**Estimated scope:** Small: 1 file

## Task 3: Register Living Craft resources without activating the design

**Description:** Make the approved display font and scoped stylesheet available to the storefront while leaving Classic as the active visual design.

**Acceptance criteria:**

- [x] The existing Google Fonts request still includes all Classic Playfair Display and DM Sans weights and additionally includes only approved Zilla Slab weights 500 and 600.
- [x] `css/themes/living-craft.css` loads after `css/index.css`.
- [x] Classic remains the fallback; design selection now follows the separately documented `SPEC-design-selection.md` contract.

**Verification:**

- [ ] Head diff contains only font and stylesheet-registration changes: `git -c safe.directory='Z:/AI-developed-softwares/velorex-design - Copy' diff -- index.html`
- [ ] Browser network check shows no failed Living Craft stylesheet or font request.
- [ ] Classic computed display/body fonts remain Playfair Display and DM Sans.
- [x] Repository check: `git -c safe.directory='Z:/AI-developed-softwares/velorex-design - Copy' diff --check -- index.html`

**Dependencies:** Task 2

**Files likely touched:**

- `index.html`

**Estimated scope:** Extra small: 1 file

## Checkpoint: Foundation registration

- [ ] Tasks 1–3 acceptance criteria are complete.
- [ ] Classic is still the active default with no `data-design` attribute.
- [ ] No JavaScript, PHP, SQL, admin, or existing Classic stylesheet file was changed by this module.
- [ ] Review the exact `index.html` and new stylesheet diffs before validation proceeds.

## Task 4: Validate Classic regression safety and Living Craft tokens

**Description:** Compare Classic with its baseline, evaluate Living Craft light/dark tokens under controlled temporary browser attributes, and record evidence and blockers for the next module.

**Acceptance criteria:**

- [ ] Classic light and dark match the baseline at 390, 768, and 1440 pixel widths, excluding only the approved unused-font network request.
- [ ] Controlled Living Craft light and dark evaluation confirms typography hierarchy, token application, visible focus, and required contrast for body, muted, action, danger, success, and focus roles.
- [ ] Validation does not commit design activation, preference storage, commerce-component styles, or generated-image references.

**Verification:**

- [ ] Run design lint: `node C:\Users\aijaz\.codex\skills\design-taste-frontend\scripts\lint.mjs index.html css js`
- [ ] Capture after evidence under `test-results/theme-foundation/after/`.
- [ ] Run repository check: `git -c safe.directory='Z:/AI-developed-softwares/velorex-design - Copy' diff --check`
- [ ] Confirm no new browser console errors, horizontal overflow, failed resources, clipped focus, or fixed-control overlap.

**Dependencies:** Task 3 and Foundation registration checkpoint

**Files likely touched:**

- `test-results/theme-foundation/after/*` — test evidence only
- `SPEC-design-foundation.md` — implementation result/status only
- `tasks/plan.md` — implementation result/status only
- `tasks/todo.md` — checked acceptance and verification items
- `docs/themes/LIVING-CRAFT-ASSETS.md` — only if the existing derivative blocker needs clarification

**Estimated scope:** Medium: evidence plus 2–4 documentation files

## Checkpoint: Design foundation complete

- [ ] All four tasks and both checkpoints are complete.
- [ ] Foundation success criteria in `SPEC-design-foundation.md` are satisfied.
- [ ] Classic remains visually and functionally unchanged.
- [ ] Living Craft tokens are ready for the `design-selection` module.
- [ ] Production image derivatives remain explicitly blocked until an encoder or optimized files are approved.
- [ ] Final changed-path list and actual verification results are recorded for handoff.

## Authorization boundary

Checklist approval authorizes only the four tasks above. It does not authorize:

- Implementing the Classic/Living Craft selector
- Changing `js/index.js`
- Styling completed navigation, homepage, catalogue, product, cart, account, or footer components
- Wiring generated images into production markup
- Installing dependencies or image encoders
- Changing API, database, server, routing, SEO, or admin behavior
