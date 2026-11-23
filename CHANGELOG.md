# Changelog

This file records repository development. Entries under **Unreleased** describe the current local working tree and are not proof of production deployment.

## Unreleased — storefront update, 24 November 2026

### Added

- Vijaysar glass: new box photos, how-to-use steps with photos, infographic, care guide and replacement schedule (30 to 90 days).
- Natural Wellness Combo Kit (Rs 499) and the `wellness-update.sql` script for the live database, which does not create duplicates.
- "Buy on Amazon" buttons on products listed on Amazon.in, "On Amazon" chips on product cards, an Amazon band on both home pages, a yellow "Velorex on Amazon" footer link and a first entry in the stores menu.
- WhatsApp ordering button. It stays hidden until a store number is set.
- New logo set (header emblem, light and dark wordmarks, favicons, app icons) and a link-preview image for WhatsApp and social sharing.
- Classic theme: a trust strip under the hero, deeper product-card hover effects, a title underline that draws in, badge pop-ins, a floating Amazon image, button press feedback and scroll reveals on more sections. All motion respects reduced-motion settings.

### Changed

- Prices match the Amazon.in listings.
- Contact details: Meerut, Uttar Pradesh 250002, India; Mon to Fri, 10am to 6pm IST; velorexdesign@gmail.com.
- Product detail images are a fixed square size, and alignment is fixed on phones in both themes.

## Earlier — local checkout reviewed 16 November 2026

### Added

- A Classic/Living Craft storefront selector with pre-paint initialization, saved visitor preference, non-persistent URL previews, an isolated light/dark Living Craft token foundation, and focused selector tests.
- A structurally distinct Living Craft home view based on the approved concept preview, using the live catalogue and existing cart/navigation actions.
- Clean, shareable routes for products, categories, and fixed storefront pages.
- Server-rendered page metadata and indexable content through `seo-render.php`.
- Generated `robots.txt` and `sitemap.xml`, canonical URLs, Open Graph metadata, and structured data.
- Web app manifest and favicon for standalone installation behavior.
- Catalog mega menu, search, category filtering, sorting, recently viewed products, mobile tab navigation, and responsive interface polish.
- Velorex Studio IT-services enquiry modal and PHP mail endpoint.
- Admin and storefront validation around product images, orders, and account operations.

### Changed

- Checkout now performs stricter server-side validation and records orders without an online payment step before the WhatsApp handoff.
- Updated order, authentication, product, upload, and customer-deletion paths avoid returning internal database or filesystem details. Some older admin read endpoints still include database details in error responses and require a separate hardening pass.
- Authentication regenerates sessions after login and applies rate limits to repeated login, registration, enquiry, and order attempts.
- Session cookies, same-origin request checks, upload validation, security headers, directory listing, and sensitive-file access rules are hardened.
- Admin pages are marked `noindex`, while missing/private storefront pages receive appropriate status and indexing behavior.

### Working-tree note

- 17 tracked implementation files were modified locally.
- 8 runtime files were untracked when reviewed: `api/it-enquiry.php`, `api/robots.php`, `api/seo-lib.php`, `api/sitemap.php`, `api/uploads/.htaccess`, `favicon.svg`, `manifest.webmanifest`, and `seo-render.php`.
- No implementation changes were staged when this documentation was written.

## 11 September 2026

### Changed

- Commit `8b7c96a`: admin and new product listing work, including catalog seed content and product imagery.

## 15 June 2026

### Added

- Commit `86fbd16`: wellness polish, category marquee, per-product detail pages, and robust seed behavior.
- Commit `04f9d06`: initial Velorex Wellness range for Vijaysar glass, neem comb, and acupressure products.

## 2 June 2026

### Removed

- Commit `f4cb373`: removed the one-time `api/setup.php` production setup endpoint.
