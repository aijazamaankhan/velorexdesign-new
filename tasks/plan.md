# Implementation Plan: Living Craft Design Foundation

Module id: `design-foundation`  
Source spec: `SPEC-design-foundation.md`  
Capability map: `THEME-CAPABILITY-MAP.md`  
Status: Foundation and selection code implemented; browser evidence pending  
Date: 17 November 2026

## Overview

Implement the approved Living Craft visual foundation as an isolated layer. The foundation tokens and design selector are now registered, while the remaining browser evidence and the later shell, commerce, and motion compositions are still pending. The implementation must not modify commerce behavior or visually change Classic unless the visitor explicitly selects Living Craft.

## Architecture decisions

### Isolated design stylesheet

Create `css/themes/living-craft.css` rather than appending another large block to `css/index.css`.

Reasons:

- `css/index.css` already contains the current Classic implementation and substantial uncommitted local work.
- A separate file gives future models a clear ownership boundary.
- Every selector can be audited for the required `:root[data-design="living-craft"]` scope.
- The theme can later be disabled without reverting Classic declarations.

The stylesheet will initially contain:

- Light and dark Living Craft tokens
- Mapping from Living Craft tokens to existing semantic storefront tokens
- Typography scale and font roles
- Spacing, frame, geometry, focus, and state primitives
- Design-scoped utility hooks needed by later modules
- Reduced-motion-safe defaults where foundation primitives transition

It will not contain completed navigation, homepage, catalogue, product-detail, cart, account, footer, or motion compositions; those belong to downstream modules.

### Preloaded, explicitly selected CSS

The foundation stylesheet is linked from `index.html` after `css/index.css`. Every rule remains design-scoped, so it has no visual effect while `data-design="classic"` is active.

This avoids a second network/style-loading race. `js/design-selection.js` now owns pre-paint attribute initialization under the contract in `SPEC-design-selection.md`.

### Typography loading

Extend the existing Google Fonts request to include Zilla Slab weights 500 and 600 while preserving existing Playfair Display and DM Sans families required by Classic.

The foundation stylesheet maps:

- Living Craft display text → Zilla Slab
- Living Craft body and controls → DM Sans
- Classic remains mapped to its existing Playfair Display and DM Sans tokens

No JavaScript font loader or additional runtime package is introduced.

### Existing semantic token compatibility

Living Craft remaps existing semantic variables such as `--bg`, `--surface`, `--text`, `--text-muted`, `--secondary`, `--success`, `--danger`, `--font-display`, and `--font-body` only inside the Living Craft root scope.

New `--lc-*` values remain the source of truth. Later component rules consume existing semantic variables when that preserves compatibility and use `--lc-*` values only for Living Craft-specific roles not represented by the current system.

### Asset masters remain source-only

The three generated PNG assets remain unchanged under `images/themes/living-craft/`.

No approved local image encoder is available:

- ImageMagick is not installed.
- `cwebp` and `avifenc` are not available.
- PHP does not include GD.
- Adding a Node image package would be a new dependency and requires separate approval.

Therefore this module will not fabricate WebP/AVIF derivatives. Local preview may later reference the PNG masters, but production optimization remains a recorded release blocker until an approved encoder or externally supplied derivatives are available.

### Classic baseline and regression boundary

Before foundation edits, capture Classic light and dark evidence at agreed viewport widths. After edits, repeat the same views and compare:

- Typography loaded and rendered as before in Classic
- Colors and spacing unchanged
- No new horizontal overflow or console errors
- No Living Craft selector affects a root without `data-design="living-craft"`

Any Classic difference caused by this module is a failure unless it is limited to an additional unused font network request already approved by the plan.

## Dependency graph

```text
Approved design-foundation spec
        |
        v
Classic baseline evidence
        |
        v
Living Craft token stylesheet
        |
        v
Font and stylesheet registration
        |
        v
Static scope/accessibility checks
        |
        v
Classic regression evidence
        |
        v
Foundation handoff documentation
```

Each step is sequential because the regression comparison requires a before state, and registration cannot be judged safely before the stylesheet is complete and scope-audited.

## Implementation slices

Detailed task records are tracked in `tasks/todo.md`.

### Slice A: Baseline and ownership record

- Capture the current Classic homepage in light and dark at 390, 768, and 1440 pixel widths.
- Record console errors, active font families, root theme attributes, horizontal overflow, and key color tokens.
- Store generated evidence only in an ignored or temporary output directory; do not add screenshots to production assets.

Checkpoint: baseline is readable and reproducible before any implementation edit.

### Slice B: Living Craft token foundation

- Add `css/themes/living-craft.css` with light/dark tokens and semantic mappings.
- Define typography, spacing, geometry, focus, selection, and state primitives.
- Keep every effective selector rooted under `:root[data-design="living-craft"]`.
- Do not style completed commerce components in this slice.

Checkpoint: static scope audit passes and the stylesheet remains inert in Classic.

### Slice C: Resource registration

- Extend the current Google Fonts URL with approved Zilla Slab weights.
- Link the Living Craft foundation stylesheet after the Classic stylesheet.
- Preserve existing CSP-compatible hosts and avoid new domains.

Checkpoint: Classic still renders identically and loads without CSS/font errors.

### Slice D: Validation and handoff

- Run design lint and repository diff checks.
- Repeat Classic screenshots and behavioral smoke checks.
- Temporarily apply the Living Craft root attribute only in controlled browser evaluation to confirm both light and dark tokens render and meet initial contrast expectations; do not persist or commit activation behavior.
- Document unresolved contrast or token adjustments and the production image-derivative blocker.
- Update module status and handoff notes for `design-selection`.

Checkpoint: foundation acceptance criteria are met and the next module can consume the contract without redefining tokens.

## File ownership

Files expected to change in this module:

| File | Planned change | Ownership constraint |
| --- | --- | --- |
| `css/themes/living-craft.css` | New scoped token and primitive stylesheet | Sole implementation surface for Living Craft foundation |
| `index.html` | Extend existing font URL and register stylesheet | Minimal head-only edit; no template or behavior changes |
| `SPEC-design-foundation.md` | Status and implementation evidence | Contract changes require renewed approval |
| `docs/themes/LIVING-CRAFT-ASSETS.md` | Record derivative blocker only if needed | Do not rewrite existing asset governance |
| `tasks/plan.md` | Plan status and final notes | Planning record only |
| `tasks/todo.md` | Detailed tasks after plan approval | Must not be created before approval |

Files explicitly excluded:

- `js/index.js`
- `css/index.css`, except read-only comparison
- `admin.html`, `css/admin.css`, `js/admin.js`
- All PHP and SQL files
- Product seed data and API contracts

If implementation requires an excluded file, stop and update the plan/spec before editing it.

## Verification checkpoints

### Foundation scope checkpoint

- Every effective Living Craft rule is scoped to the Living Craft root attribute.
- Classic root without `data-design` receives no Living Craft token remap.
- Dark/light appearance selectors compose with the Living Craft design selector without redefining Classic selectors.

### Static quality checkpoint

- `git diff --check` passes.
- Design lint has no unapproved blocker.
- No new inline style is introduced.
- No gradient, glow, glass treatment, ornamental shadow, or raw untracked palette value appears in Living Craft CSS.
- No new runtime dependency or external host appears.

### Browser regression checkpoint

- Classic light and dark match baseline at 390, 768, and 1440 pixel widths.
- Page remains keyboard navigable.
- No horizontal overflow or clipped fixed controls.
- No stylesheet or font request fails.
- No new browser console error.

### Controlled foundation checkpoint

- Living Craft light and dark root tokens can be applied manually in the browser.
- Body text, display text, primary action, muted copy, danger, success, and focus roles meet the spec's intended hierarchy.
- Initial contrast measurements meet required thresholds or are corrected before handoff.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| New stylesheet leaks into Classic | High | Require root scope on every effective rule; compare before/after screenshots |
| Existing inline styles override future tokens | Medium | Do not solve them in foundation; inventory for shell/commerce specs |
| Zilla Slab request alters or delays Classic font rendering | Medium | Preserve current font families and weights; verify network and computed fonts |
| Dark Living Craft palette fails contrast | High | Measure text, action, focus, danger, and success combinations before handoff |
| Semantic variable remapping changes unexpected generated templates | Medium | Keep foundation primitives conservative; component styling belongs downstream |
| Large PNG assets are served in production | High | Do not wire them in foundation; keep derivative optimization as a release blocker |
| Dirty worktree changes are overwritten | High | Apply narrow patches only; inspect diffs by file; never reformat unrelated code |
| Planning expands into selector or commerce implementation | Medium | Enforce excluded-file list and module boundary |

## Parallelization

This module is intentionally small and sequential. Parallel implementation would create overlapping ownership in `index.html` and the shared token contract, so the main agent retains implementation and integration.

Independent read-only review may be delegated after the stylesheet exists:

- Scope and Classic-leakage audit
- Palette/contrast audit
- Final browser evidence review

No delegated agent may edit `index.html` or the foundation stylesheet concurrently with the main agent.

## Open questions

No blocking implementation question.

Production image derivative generation remains deferred. Before Living Craft becomes a launch candidate, one of these must be approved:

- Install/use a local image encoder
- Add a development-only image-processing dependency
- Supply externally optimized derivatives
- Use an approved hosting/CDN image transformation service

## Plan approval gate

Approval authorizes creation of `tasks/todo.md` with task-level acceptance criteria and verification steps. It does not yet authorize implementation code. Implementation begins only after the resulting task list is reviewed and approved.
