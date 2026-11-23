# Capability Map: Velorex Dual-Theme Storefront

Status: Approved; `design-foundation` specification awaiting approval  
Date: 16 November 2026  
Scope: Customer-facing storefront only; the admin interface is excluded unless a later spec explicitly includes it.

## Objective

Preserve the current storefront as the **Classic** design while adding a separately selectable **Living Craft** design. Both designs must use the same products, routes, cart, customer account, ordering, SEO, and API behavior. During development, the owner must be able to switch designs locally and compare them without replacing or destabilizing Classic.

This document defines capability boundaries only. Detailed specifications, plans, tasks, and implementation are gated behind approval of this map.

## Assumptions to approve

1. “Theme selection” means **Classic vs. Living Craft** and is independent of the existing **dark vs. light** appearance toggle.
2. Classic remains the default for visitors until Living Craft is explicitly approved for launch.
3. The first Living Craft implementation targets the public storefront; `admin.html` and `css/admin.css` retain their current design.
4. Both designs share the existing HTML/JavaScript behavior rather than duplicating the storefront into two applications.
5. A local preview query such as `?design=living-craft` may override the saved preference for comparison without changing it.
6. A visitor-facing selector will be available during the preview phase. Whether it remains visible after launch will be a later release decision.
7. Existing product photography remains the source of truth for product identity. Approved AI-composited campaign images may place those products in generated luxury environments, must be disclosed in the asset manifest, and must not fabricate artisans, workshops, certifications, reviews, health outcomes, or product capabilities. Missing documentary imagery remains a content gap rather than fabricated proof.
8. No database, PHP API, order, authentication, SEO route, or admin behavior change is part of this initiative.

## Capability modules

| Module id | Responsibility | Depends on | Primary files expected |
| --- | --- | --- | --- |
| `design-foundation` | Define design names, tokens, typography, palette, spacing, imagery rules, approved campaign assets, component states, accessibility targets, and Classic-preservation rules. | — | `SPEC-design-foundation.md`, `docs/themes/LIVING-CRAFT-ASSETS.md`, `images/themes/living-craft/`, later `css/themes/living-craft.css` or an equivalently isolated stylesheet |
| `design-selection` | Select Classic or Living Craft, validate saved values, support non-persistent URL preview, apply the design before CSS paints, and keep dark/light state independent. | `design-foundation` | `SPEC-design-selection.md`, `index.html`, `js/index.js` or a small dedicated bootstrap file |
| `living-craft-shell` | Restyle the shared storefront frame: navigation, page background, typography, buttons, forms, dialogs, mobile tab bar, footer, focus states, and responsive spacing. | `design-foundation`, `design-selection` | `SPEC-living-craft-shell.md`, isolated Living Craft CSS, minimal shared markup hooks in `index.html` |
| `living-craft-commerce` | Build the Living Craft homepage, catalogue/product cards, filters, product detail, cart, checkout/order request, account, empty/loading/error/out-of-stock states, and mobile behavior without changing business logic. | `living-craft-shell` | `SPEC-living-craft-commerce.md`, isolated Living Craft CSS, narrowly scoped template hooks in `index.html` and `js/index.js` |
| `motion-experience` | Add purposeful Living Craft effects and animation: signature product transitions, scroll entrances, material-selection transitions, image feedback, cart feedback, route/state transitions, and complete reduced-motion behavior without changing commerce logic. | `living-craft-commerce` | `SPEC-motion-experience.md`, isolated Living Craft motion CSS, narrowly scoped JavaScript observers/state hooks where CSS alone is insufficient |
| `theme-verification` | Prove Classic regression safety, Living Craft quality, theme persistence/preview behavior, route and action parity, accessibility, responsive layouts, reduced motion, animation performance, and browser behavior. | `design-selection`, `motion-experience` | `SPEC-theme-verification.md`, browser evidence under a temporary ignored test-output directory, documentation updates |

## Dependency graph

```text
design-foundation
        |
        v
design-selection
        |
        v
living-craft-shell
        |
        v
living-craft-commerce
        |
        v
motion-experience
        |
        v
theme-verification
```

Build order: `design-foundation` → `design-selection` → `living-craft-shell` → `living-craft-commerce` → `motion-experience` → `theme-verification`.

Implementation status on 17 November 2026: the foundation and design-selection contracts are implemented, and the Living Craft shell has begun with a structurally distinct home view. Browser evidence, the remaining storefront views, optimized campaign-image derivatives, commerce-specific composition, and motion verification remain open.

The order is intentionally sequential. The selector cannot be safely implemented before the design contract defines valid variants; commerce screens cannot be styled reliably before the shared shell and token system exist; motion cannot compensate for an unfinished static composition; final verification requires every preceding capability.

## Motion intent

Living Craft must look complete and remain fully usable with animation disabled. Motion is an engagement and feedback layer applied after the static commerce experience is approved.

The detailed `motion-experience` spec will select exact timings and implementation mechanisms. Its intended motion vocabulary is:

- One signature slow crossfade between consistently framed featured products
- A direct, thumb-friendly “choose a material” interaction whose product image and field color transition together
- Section entrances applied to heading, copy, and imagery as separate parts with restrained stagger
- Product-gallery crossfades and thumbnail feedback without layout movement
- Immediate pressed, loading, success, error, selected, saved, and add-to-cart feedback
- Cart-count and order-summary updates that communicate change without pulling attention away from checkout
- Dialog and drawer transitions that preserve focus, scroll position, and keyboard behavior
- Subtle image drift only where it represents light moving across a physical object
- A complete `prefers-reduced-motion: reduce` path that removes travel, looping, parallax, and crossfades while retaining all content and state feedback

The following effects are out of scope unless a later approved spec supplies a functional reason:

- Cursor followers or custom cursors
- Continuous page-wide parallax
- Scroll-jacking or mandatory pinned storytelling
- Autoplay carousels with hidden controls
- Magnetic buttons, pointer-chasing cards, and 3D tilt on commerce controls
- Particle systems, decorative canvas effects, or WebGL used only as ornament
- Animation that delays access to price, stock, product details, cart, checkout, or error messages
- Motion based on width, height, margin, or other layout properties when transform/opacity can express the same transition

## Cross-module contracts

These names are proposed now so later models do not invent conflicting mechanisms:

- Existing appearance dimension: `data-theme="dark|light"`
- Proposed design dimension: `data-design="classic|living-craft"`
- Existing appearance storage: `velorex_design_theme`
- Proposed design storage: `velorex_design_variant`
- Proposed preview query: `?design=classic` or `?design=living-craft`
- Safe fallback for missing, corrupt, or unsupported values: `classic`

The detailed `design-selection` spec will decide exact precedence and selector behavior. The proposed precedence is:

```text
valid URL preview → valid saved preference → classic
```

URL preview must not overwrite the saved preference. Design selection must occur before the design styles paint to prevent a flash of Classic when Living Craft is selected.

## Non-negotiable preservation boundary

The following behavior belongs to the existing application and must remain functionally unchanged:

- Clean routes, direct product/category URLs, browser back/forward, and legacy hash migration
- SEO titles, descriptions, canonicals, structured data, sitemap, and robots behavior
- Product loading, categories, search, sorting, filtering, and recent products
- Cart data, quantities, stock validation, order creation, and WhatsApp handoff
- Customer registration, login, session, profile, addresses, and order history
- Admin functionality and storage
- Existing delegated `data-action` handlers
- Store settings and contact information
- Dark/light preference semantics
- API and database contracts

New design work may add semantic classes, wrappers, or presentation attributes, but it must not fork or rewrite these behaviors merely to simplify styling.

## Isolation rules for parallel work

- Classic is the unscoped/default implementation and must not be rewritten during the first Living Craft pass.
- Living Craft selectors must be scoped beneath `:root[data-design="living-craft"]` or an approved equivalent.
- Do not add unscoped global element rules for the new design.
- Do not reuse `data-theme` for design selection.
- Do not reuse or change the meaning of `velorex_design_theme`.
- Do not let admin store settings own a visitor's presentation preference.
- Do not move or rename existing API endpoints, routes, storage keys, or action names.
- Each module spec owns its listed responsibility; later modules may consume its contract but must not redefine it.
- Any required change outside the primary files listed above must be added to the active module spec before implementation.

## Known risks to address in module specs

- `index.html` contains many inline styles; some will resist token overrides and can leave Classic fragments inside Living Craft.
- `css/index.css` contains broad global rules, hard-coded colors, gradients, borders, shadows, and partial light-theme overrides.
- The current public theme is applied after startup, which can produce a flash; design selection must initialize before styles paint.
- Design and dark/light preferences can conflict unless their state machines remain independent.
- The storefront renders significant markup from `js/index.js`; visual hooks must cover both static and generated content.
- A visually ambitious homepage must not degrade product discovery, mobile checkout, performance, reduced-motion behavior, or direct-route rendering.
- Too many simultaneous effects can make handcrafted products feel synthetic, distract from purchase decisions, and increase interaction latency on lower-end mobile devices.
- Motion applied to dynamically rendered templates can duplicate observers/listeners unless lifecycle ownership and cleanup are specified.
- The current worktree already contains substantial uncommitted feature changes. Theme work must avoid overwriting or normalizing unrelated edits.
- Generated campaign images are large PNG masters. Delivery derivatives must be produced and performance-tested before they are referenced by the storefront.

## Initiative-level acceptance outcomes

Detailed measurable criteria belong in the module specs. At initiative completion:

1. A fresh visitor receives Classic with no visual or functional regression.
2. Living Craft can be selected, persists after reload, and can be previewed through a URL without changing the saved preference.
3. Dark/light and Classic/Living Craft operate independently in all four combinations, or a later approved spec explicitly narrows Living Craft to one appearance with an accessible fallback.
4. Direct public routes open in the selected design without breaking canonical URLs or browser navigation.
5. Storefront actions and server requests are identical across both designs.
6. Living Craft is complete on desktop, tablet, and mobile for home, catalogue, product detail, cart/order request, account/auth, policy pages, modals, and system states.
7. Keyboard navigation, visible focus, contrast, touch targets, reduced motion, and responsive reflow are verified.
8. Living Craft motion remains smooth on representative mobile and desktop viewports, does not shift layout, and never blocks reading or purchasing actions.
9. Reduced-motion mode preserves all content, controls, state changes, and route behavior without decorative travel or looping effects.
10. Classic and Living Craft have recorded browser screenshots at agreed viewport widths for owner comparison, plus short motion evidence for the animated design.
11. No database or API migration is required to enable or disable the new design.
12. Disabling Living Craft requires removing or changing only the selector/default, not reverting application logic.

## Approval gate

Approval of this map confirms:

- The six module boundaries
- The dependency direction and build order
- Classic as the default during development
- Separate design and dark/light state
- Storefront-only initial scope
- The proposed preview and persistence model

After approval, the next phase is to write `SPEC-design-foundation.md`. No plan or implementation should begin before that spec is separately reviewed and approved.
