# Spec: Living Craft Design Foundation

Module id: `design-foundation`  
Capability map: `THEME-CAPABILITY-MAP.md`  
Status: Approved; implementation plan awaiting approval  
Date: 16 November 2026

## Assumptions

1. Living Craft is a selectable design variant, not a replacement for Classic during development.
2. The public storefront is the only consumer of this foundation; the admin UI remains unchanged.
3. Living Craft supports both existing appearance preferences: light and dark.
4. Zilla Slab is the Living Craft display face; the already-used DM Sans remains the body and control face.
5. Existing product data, copy, routes, actions, server-rendered SEO content, and commerce behavior remain authoritative.
6. Generated Living Craft campaign images provide atmosphere, while original product photography remains authoritative for product accuracy.
7. The first implementation may add semantic classes or wrappers, but it may not duplicate the storefront or fork commerce logic.
8. “Luxury” means confident scale, material detail, disciplined typography, consistent photography, and quiet interaction—not gradients, glow, excessive rounding, or decorative effects.

Approval of this spec confirms these assumptions unless a later approved spec changes them.

## Objective

Define the complete visual and interaction foundation for the Living Craft storefront so multiple models can implement later modules without inventing palettes, typography, spacing, imagery treatment, component geometry, accessibility rules, or Classic-preservation behavior.

The design should make Velorex feel like a contemporary Indian catalogue of handcrafted objects. A visitor should understand within five seconds that the store sells handcrafted wood, resin, home-storage, and wellness products and should see a clear path to browse the collection.

This module defines contracts. It does not implement the selector, shared shell, commerce screens, or motion system.

## Design concept

Direction: **The Living Craft Catalogue**  
Composition family: **Specimen Catalogue**  
Idea sentence:

> On this storefront, Velorex’s carved wood, resin surfaces, and wellness objects become collected specimens—shown consistently, named plainly, and treated as objects worth examining.

The catalogue should alternate between:

- Dominant product photography
- Flat material-inspired color fields
- Short, direct commerce information
- Real product facts and care/shipping guidance
- A limited number of editorial compositions rather than repeated generic cards

The static page must feel complete before animation is added.

## Users and primary actions

Primary users:

- Mobile-first shoppers browsing handcrafted home and wellness products in India
- Visitors arriving directly on a product or category route
- Returning shoppers checking cart, account, addresses, or order history

Primary actions, in priority order:

1. Browse products or choose a material/category
2. Understand product price, stock, material, scale, shipping, and returns
3. Add a product to the cart
4. Complete the existing order-request and WhatsApp handoff
5. Access account and order information

Visual storytelling must never reduce the prominence or usability of these actions.

## Tech stack

- Static HTML storefront shell and templates in `index.html`
- Plain CSS in `css/index.css`, with Living Craft expected to move into an isolated stylesheet during implementation
- Vanilla JavaScript in `js/index.js`
- PHP and MySQL backend; unchanged by this module
- Apache production routing; PHP built-in server may be used for homepage visual development only
- Google Fonts currently loaded by `index.html`
- Font Awesome currently used for interface icons
- No Node package, bundler, component framework, or CSS framework

No new runtime dependency is approved by this spec.

## Commands

Local homepage preview:

```powershell
php -S 127.0.0.1:8080
```

Open the current storefront:

```text
http://127.0.0.1:8080/
```

Production-like clean-route verification requires a PHP-enabled Apache host with the repository `.htaccess`; the PHP built-in server does not apply Apache rewrites.

Design lint after implementation:

```powershell
node C:\Users\aijaz\.codex\skills\design-taste-frontend\scripts\lint.mjs index.html css js
```

Visual inspection after implementation:

```powershell
node C:\Users\aijaz\.codex\skills\design-taste-frontend\scripts\inspect.mjs http://127.0.0.1:8080/?design=living-craft
```

Repository whitespace/error check:

```powershell
git -c safe.directory='Z:/AI-developed-softwares/velorex-design - Copy' diff --check
```

## Project structure

Current and approved design-foundation paths:

```text
THEME-CAPABILITY-MAP.md                 initiative boundaries and module order
SPEC-design-foundation.md               this visual contract
docs/themes/LIVING-CRAFT-ASSETS.md      generated-image governance and placement
images/themes/living-craft/             generated PNG master assets
index.html                              existing shared shell and static templates
css/index.css                           existing Classic styles; preserve behavior
js/index.js                             existing rendering and behavior; preserve behavior
```

Expected later implementation paths, subject to implementation-plan approval:

```text
css/themes/living-craft.css              scoped Living Craft tokens and components
css/themes/living-craft-motion.css       scoped animation layer owned by motion-experience
js/design-preference.js                  optional pre-paint design bootstrap
```

The expected paths are not authorization to create them during this specification phase.

## Visual tokens

### Typography

Living Craft uses two families at most:

- Display: `Zilla Slab`, weights 500 and 600
- Body, controls, prices, metadata: existing `DM Sans`, weights 400, 500, 600, and 700 only where required

Proposed scale:

```css
--lc-step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem);
--lc-step-body: clamp(1rem, 0.96rem + 0.18vw, 1.125rem);
--lc-step-lead: clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem);
--lc-step-title: clamp(2.25rem, 1.45rem + 3.4vw, 4.75rem);
--lc-step-hero: clamp(3.25rem, 1.6rem + 7vw, 8rem);
```

Rules:

- One `h1` per rendered page view
- Every content section has a meaningful heading
- Headings remain within two lines at 390, 768, and 1440 pixel viewport widths
- Display tracking: `-0.025em`; display line-height: `0.95–1.05`
- Body line-height: `1.5–1.65`; normal body copy: at least 16px
- Long-form text measure: 45–75 characters
- No tiny uppercase tracked labels, decorative monospace, outlined type, or styled accent words inside headings
- Prices use DM Sans with tabular numerals where alignment benefits from them

### Living Craft light appearance

```css
--lc-bg: #e7e4df;
--lc-surface: #d8d3cb;
--lc-surface-strong: #c8c2b8;
--lc-ink: #252521;
--lc-muted: #625f58;
--lc-accent: #1e6546;
--lc-accent-ink: #ffffff;
--lc-danger: #9a342f;
--lc-success: #1e6546;
--lc-focus: #0e5cc7;
```

### Living Craft dark appearance

```css
--lc-bg: #1e211d;
--lc-surface: #2b302a;
--lc-surface-strong: #373d35;
--lc-ink: #f0eee9;
--lc-muted: #b8b3aa;
--lc-accent: #8ac39d;
--lc-accent-ink: #12251a;
--lc-danger: #f08a82;
--lc-success: #8ac39d;
--lc-focus: #8db8ff;
```

Color rules:

- One ground, one ink, one action accent, and a small set of material fields
- Full-strength ink for reading text; muted color only for secondary information
- Accent appears on the primary action, current selection, focus support, and limited availability/success states
- No gradients in Living Craft UI or text
- No glow
- No translucent glass navigation or backdrop blur as a design motif
- Surface separation uses a tone step or space, not decorative borders and shadows
- Destructive and success states include text or icons; color alone is insufficient
- Normal text contrast target: at least 4.5:1; large text and essential control boundaries: at least 3:1

### Material fields

Optional section and specimen-tile fields must come from this controlled set and remain secondary to product imagery:

```css
--lc-field-wood: #c8b39d;
--lc-field-resin: #bdcacc;
--lc-field-wellness: #c5d0c0;
--lc-field-stone: #cbc6bd;
```

Dark appearance uses equivalent darker tone steps derived from `--lc-surface` and `--lc-surface-strong`, not saturated category colors.

### Spacing and frame

```css
--lc-space-1: 0.25rem;
--lc-space-2: 0.5rem;
--lc-space-3: 0.75rem;
--lc-space-4: 1rem;
--lc-space-6: 1.5rem;
--lc-space-8: 2rem;
--lc-space-12: 3rem;
--lc-space-16: 4rem;
--lc-space-24: 6rem;
--lc-space-32: 8rem;
```

Rules:

- Equal left and right page margins at every viewport
- Outer margin: `clamp(1rem, 2.2vw, 2rem)`
- Catalogue gap: 8–16px depending on viewport and density
- Major desktop section spacing: 120–200px
- Mobile section spacing: 72–112px
- No unexplained blank stretch taller than half a viewport
- Asymmetry is permitted inside the grid only when the opposite side contains imagery, text, a list, or another balancing element
- Adjacent major sections should not repeat the same composition

### Geometry

- Media: square corners by default; one 2px radius may be used to prevent harsh raster edges
- Controls: one consistent 2px radius
- Fully round controls are limited to icon-only controls whose shape communicates their hit area
- Dialogs and floating drawers may use an 8px radius and the only resting elevation/shadow in the design
- Product tiles are fields, not bordered cards
- Resting product tiles do not lift on hover
- Buttons are flat filled or text actions; no gradient, glow, double outline, or permanent shadow
- Minimum pointer target: 44 × 44 CSS pixels for primary controls; never below WCAG 2.2 AA requirements

## Imagery contract

Image priority:

1. Original Velorex product photography
2. Approved AI-composited campaign imagery based on actual product references
3. Honest material/process photography supplied by Velorex
4. Credited open-collection imagery showing the broader material world, never pretending to show Velorex operations

Approved generated masters and their governance live in `docs/themes/LIVING-CRAFT-ASSETS.md`.

Required treatment:

- One dominant product image is preferred to a cluster of unrelated small images
- Catalogue products should use consistent apparent scale, crop family, and visual mass
- Product detail pages must retain original reference images for factual inspection
- Every image has explicit dimensions and useful alt text
- The above-the-fold hero uses one optimized derivative; below-the-fold images lazy-load
- Product shapes must not be hidden by headline text, controls, or decorative overlays
- No fabricated artisans, workshops, customer homes, manufacturing processes, certificates, reviews, packaging, or health outcomes
- Generated campaign imagery must not be used to infer scale, dimensions, included accessories, or exact finish

Approved initial placements:

- `hero-mango-tray-v1.png`: home hero, product to the right and copy on the left
- `category-storage-v1.png`: portrait storage-category introduction
- `category-wellness-v1.png`: wellness editorial split, products to the right and copy on the left

PNG masters must not be served directly for routine production delivery. Responsive WebP/AVIF derivatives are created only after rendered sizes are approved.

## Composition contract

### Home hero

- First screen identifies Velorex and handcrafted product categories without relying on animation
- One dominant campaign image occupies roughly half or more of the visual field
- One supporting sentence and one primary action
- No announcement carousel, multiple competing CTAs, badges, floating decorative cards, or testimonial claims
- Desktop composition uses left copy and right product image; mobile stacks copy before image while keeping the primary action visible early

### Catalogue

- Four-column wide-desktop rhythm, two columns on typical phones, and one column only when content density or accessibility requires it
- One item in approximately six may span two columns to create editorial rhythm
- Labels remain outside the image field
- Each listing exposes product name, price, availability, and one useful material/category fact without opening the detail page
- Filtering and sorting remain obvious and usable; visual experimentation must not hide them

### Product detail

- Image gallery is dominant
- Purchase information remains readable and stable beside the gallery on desktop and below it on mobile
- Price, stock, quantity, primary action, shipping summary, and return access appear before extended storytelling
- Include at least one original reference image; an in-scale image is a documented content requirement where absent
- Mobile uses a clear gallery index/thumbnails and does not hide primary content behind horizontal tabs

### Cart, order request, account, and policy views

- These views inherit tokens and typography but prioritize task completion over editorial composition
- Forms use persistent visible labels, correct input types, preserved error values, specific errors, and logical keyboard order
- Guest order flow remains visually primary
- Loading, empty, error, success, offline/network, and out-of-stock states receive complete designs
- Policy and support content uses readable measures and direct navigation rather than decorative cards

### Footer

- Designed as a final field, not an undifferentiated sitemap
- Large Velorex wordmark returns once
- Shop, support, contact, location/hours, and one contact action remain available
- Legal and disclosure text remains readable at the small-step size or larger

## Interaction-state contract

Every interactive component must define:

- Rest
- Hover where hover exists
- Keyboard focus
- Pressed/active
- Selected/current
- Disabled
- Loading/busy
- Success
- Error

Focus indicators must remain visible against both appearances and must not be obscured by fixed navigation or bottom bars. Hover must never be the only way to reveal essential content.

The `motion-experience` module owns animated transitions. Foundation-level states must still be understandable when all animation is disabled.

## Code style contract

Later implementation uses design-scoped, semantic tokens and avoids raw values in component rules:

```css
:root[data-design="living-craft"] {
  --bg: var(--lc-bg);
  --surface: var(--lc-surface);
  --text: var(--lc-ink);
  --text-muted: var(--lc-muted);
  --secondary: var(--lc-accent);
  --font-display: "Zilla Slab", serif;
  --font-body: "DM Sans", sans-serif;
}

:root[data-design="living-craft"] .product-card {
  background: var(--surface);
  border: 0;
  border-radius: 2px;
  box-shadow: none;
}
```

Rules:

- Every Living Craft selector is rooted under the approved design attribute
- No unscoped global element rules for the new design
- Prefer semantic classes over `!important`; use `!important` only when an inline Classic declaration cannot yet be removed safely and document each occurrence
- Do not rename existing IDs, `data-action` values, storage keys, route values, or API paths for styling convenience
- Avoid inline styling in new markup
- New JavaScript behavior must be presentation-only and must not duplicate commerce state
- Comments explain why a non-obvious isolation or accessibility decision exists, not what a declaration does

## Testing strategy

This module is a specification, so implementation tests are executed by downstream modules. The foundation defines the required evidence:

### Static checks

- Design lint on changed HTML/CSS/JS
- `git diff --check`
- No accidental secret or environment-file inclusion
- No unscoped Living Craft rules
- No new gradients, text effects, ornamental shadows, or unsupported raw colors in Living Craft files

### Visual checks

- Viewports: 390 × 844, 768 × 1024, 1024 × 768, and 1440 × 1000
- Living Craft light and dark
- Classic light and dark comparison screenshots
- Home, catalogue, product detail, cart/order request, auth/account, representative policy page, modal/drawer, and all system states
- No horizontal overflow, clipped focus, overlapping fixed controls, or hidden primary actions
- Every heading stays within its agreed line count

### Accessibility checks

- Keyboard-only navigation and focus order
- Visible focus against every surface
- WCAG contrast checks
- Text resize/reflow and zoom behavior
- Touch-target sizing
- Labels, headings, landmarks, alt text, live status, dialogs, and error association
- Reduced-motion mode during the later motion module

### Functional regression checks

- Existing routing, product loading, filtering, cart, order, auth, account, modal, and delegated action paths work in Classic and Living Craft
- Design changes do not alter request payloads, API paths, storage formats, canonical URLs, or browser history behavior

## Boundaries

### Always do

- Keep Classic as the default until a later launch decision
- Preserve the original product images and current functional behavior
- Scope Living Craft presentation beneath its design attribute
- Verify both light and dark Living Craft appearances
- Use the asset manifest for generated imagery
- Design mobile and keyboard behavior at the same time as desktop behavior
- Provide complete loading, empty, error, success, and out-of-stock states
- Keep the static composition understandable without animation

### Ask first

- Change the selected typefaces or core palette
- Add a runtime dependency, build tool, CSS framework, animation library, or icon library
- Remove the dark/light toggle or narrow Living Craft to one appearance
- Change product copy, prices, claims, policies, contact details, or category taxonomy
- Add new generated images that imply people, processes, customer environments, or product capabilities
- Change the database, PHP endpoints, server routes, or SEO architecture
- Make Living Craft the default for all visitors

### Never do

- Rewrite Classic while implementing Living Craft
- Duplicate the application into a second HTML/JavaScript storefront
- Expose or commit secrets
- Invent reviews, ratings, customers, awards, certifications, artisan stories, sustainability claims, or medical benefits
- Hide price, stock, shipping, returns, cart, or errors behind animation or hover
- Use generated campaign imagery as factual evidence
- Introduce scroll-jacking, cursor followers, decorative WebGL, autoplay UI carousels, or animation that blocks interaction
- Break direct product/category routes, canonical URLs, browser navigation, or existing action handlers

## Success criteria

The `design-foundation` module is complete when:

1. This specification is approved and remains linked from the capability map.
2. The Living Craft idea, palette, typography, spacing, geometry, imagery, composition, states, accessibility, and isolation rules are unambiguous enough for another model to implement without choosing new visual fundamentals.
3. Living Craft light and dark token values are defined, with contrast verified during implementation.
4. Generated assets have approved purposes, crop guidance, and disclosure rules.
5. Classic-preservation and functional boundaries explicitly prevent behavior or API drift.
6. Required browser sizes, views, states, and accessibility checks are listed.
7. The future selector, shell, commerce, motion, and verification modules can consume this contract without redefining it.
8. No implementation code is changed as part of approving this specification.

## Open questions

No blocking questions. The following are deferred release decisions, not foundation blockers:

- Whether the Classic/Living Craft selector remains visible to all visitors after launch
- Whether Living Craft eventually becomes the default after comparison and approval
- Which additional original process and in-scale product photographs Velorex will supply
