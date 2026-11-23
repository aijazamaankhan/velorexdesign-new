# Living Craft image asset manifest

Status: Generated masters available; not yet wired into storefront code  
Created: 16 November 2026  
Generation method: OpenAI built-in image generation, using existing Velorex product images as edit/compositing references

## Purpose

This manifest is the source of truth for generated imagery used by the proposed Living Craft design. It tells future models which files are approved, what each image represents, where it may be used, and what must not be inferred from it.

These images are campaign compositions, not documentary photographs. They may show generated rooms, surfaces, props, lighting, and plants. The referenced Velorex products remain the subject and should stay visually recognizable.

## Approved master assets

| Asset | Dimensions | Intended placement | Focal/crop guidance |
| --- | ---: | --- | --- |
| `images/themes/living-craft/hero-mango-tray-v1.png` | 1536 × 1024 | Living Craft home hero and closing product feature | Keep the tray on the right; preserve the empty plaster/stone field on the left for copy; safe desktop crop approximately 3:2; do not crop the carved outer edge |
| `images/themes/living-craft/category-storage-v1.png` | 1122 × 1402 | Home-storage category tile, editorial interlude, or rack collection introduction | Portrait master; keep the full rack frame and all four shelf levels visible; crop peripheral chair/console before cropping the rack |
| `images/themes/living-craft/category-wellness-v1.png` | 1536 × 1024 | Wellness category hero or split editorial feature | Keep the Vijaysar glass and neem comb together on the right; preserve left-side negative space; do not crop product silhouettes or imply a medical outcome |

No generated master is currently referenced by `index.html`, `css/index.css`, or `js/index.js`. Wiring belongs to an approved Living Craft implementation phase.

## Source references

| Generated asset | Product reference files | Reference role |
| --- | --- | --- |
| `hero-mango-tray-v1.png` | `images/products/mango-tray-1.jpg` | Exact tray identity, carved silhouette, concentric channels, central bowl, dark polished grain |
| `category-storage-v1.png` | `images/products/rack-4tier-1.jpg` | Rack proportions, four-level construction, dark timber frame |
| `category-wellness-v1.png` | `vijaysar-glass.png`, `neem-comb.png` | Exact wellness-product silhouettes, turned grooves, comb arch and tooth pattern |

The original product references remain authoritative for catalog accuracy. Generated assets must not replace the complete product gallery or the original images used to verify shape, finish, scale, included accessories, or condition.

## Shared visual direction

All three images use one luxury language:

- Mineral or sage-grey plaster
- Charcoal stone and dark timber
- Restrained aged brass
- Natural undyed textiles
- One limited green botanical accent
- Soft directional window light
- Calm editorial composition with generous negative space
- Visible wood grain and tactile surfaces
- No gradients, glass UI effects, neon color, excessive decoration, or fake awards

This is compatible with the Living Craft “specimen catalogue” direction: each product is treated as an object worth examining, while generated surroundings supply atmosphere rather than claims.

## Asset-specific prompt records

### Mango tray hero

Use case: `product-mockup`  
Request summary: Place the supplied carved mango tray in a premium contemporary Indian dining setting with a mineral-grey plaster wall and dark honed-stone table. Keep the tray on the right with clear negative space on the left. Preserve its carved geometry and grain. Exclude people, logos, text, food covering the tray, duplicate products, awards, and packaging.

### Home-storage category

Use case: `product-mockup`  
Request summary: Restyle the supplied four-tier rack in a sophisticated reading corner using mineral plaster, restrained books, stone, brass, and greenery. Remove toy-like styling while preserving the rack's exact shelf count, proportions, frame thickness, and timber appearance. Exclude people, logos, text, extra shelves, and implausible scale.

### Wellness category

Use case: `compositing`  
Request summary: Combine the supplied Vijaysar glass and neem comb in a quiet morning wellness still life on charcoal stone, with muted sage plaster, natural cotton, a stone dish, and neem leaves. Preserve both product forms. Exclude people, cosmetics, candles, medical claims, duplicate products, logos, and promotional text.

## Accuracy and disclosure rules

- Describe these files internally and in production metadata as **AI-composited campaign imagery based on Velorex product references**.
- Do not call the generated environment a Velorex workshop, showroom, customer home, or manufacturing facility.
- Do not use generated people, hands, artisans, testimonials, certifications, packaging, or process scenes as factual evidence.
- Do not infer dimensions from these compositions. Use database/product-copy dimensions only.
- Do not use the wellness image to imply prevention, treatment, cure, or guaranteed Ayurvedic/medical benefits.
- If the physical product differs materially from a generated image, replace the campaign image or regenerate it from an accurate reference before launch.
- Product detail galleries must include original, non-composited reference photography.

## Delivery requirements before implementation

The PNG files are visual masters and are too large to serve directly as routine storefront images. Before wiring them into the theme:

1. Keep the PNG masters unchanged in this folder.
2. Produce responsive AVIF and WebP derivatives for the actual rendered slots.
3. Suggested wide widths: 768, 1280, and 1920 pixels, without upscaling beyond the master.
4. Suggested portrait widths: 560, 840, and 1122 pixels.
5. Record real output dimensions in `width` and `height` attributes.
6. Preload only the selected above-the-fold hero derivative.
7. Lazy-load category imagery below the first viewport.
8. Use `object-position` values that preserve the product focal areas described above.
9. Verify color, crop, readability, LCP, and layout shift at 1440, 768, and 390 pixel viewport widths.

Derivative generation is intentionally deferred until the design-foundation spec establishes exact rendered sizes and crop behavior. This avoids producing unused formats or destructive crops before layout approval.

## Suggested alt text

- Hero: `Carved dark wood serving tray displayed on a charcoal stone table.`
- Storage: `Four-tier dark wood wall rack styled with books, plants and small decor.`
- Wellness: `Vijaysar wooden glass and neem wood comb arranged on a dark stone surface.`

Alt text should describe the visible product and setting. It should not include “luxury,” SEO keyword lists, health promises, or disclosure language. Disclosure belongs in asset governance and, if required, adjacent editorial copy—not inside image alternative text.

## Replacement and versioning

- Never overwrite a generated master silently.
- Regenerations use incremented names such as `hero-mango-tray-v2.png`.
- Update this manifest with the new reference, differences, approval status, and intended replacement.
- Remove an old version from production references before considering deletion; retain it while comparisons or rollback remain useful.
