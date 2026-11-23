# Changelog

This file records repository development. Entries under **Unreleased** describe the current local working tree and are not proof of production deployment.

## mobile-polish branch, 24 November 2026 (live)

### Later the same day

- Home wellness section: Buy on Amazon is now the first button; the three buttons are equal and full width on phones.
- Search icon shown in the phone header as well as the tab bar.
- Header stays on one line on tablets and small laptops (800 to 1200px); the logo text hides below 960px so the menu fits.
- Banner arrows hidden below 1200px (they covered the headline); dots and swipe still work.
- Banner says "Sold on Amazon" only for products that are on Amazon, otherwise "Order by email".

- Live database repaired: storefront tables created, admin `owner` added, 8 starter products loaded. Admin login and the product list work again.
- Phone tab bar has five equal slots (Home, Shop, Search, Wellness, Account) so Search sits in the middle.
- "Our Other Stores" in the phone menu shows full-width stacked store cards with the IT services card below.

### Earlier

- Phone menu (three-line button) now opens full screen with every link. The header's blur effect had squeezed it into the 80px bar so only Home showed.
- Home banner no longer cut off on small phones (320 to 375px).
- One button size system (46px standard, 36px small, 54px large) with focus rings and a click ripple.
- Popups match the theme: orange top bar, themed backdrop, rotating close button; they open as bottom sheets on phones. Toasts are small and sit above the phone tab bar.
- Effects: pointer spotlight on product cards, image fade-in, Amazon button sweep, gallery cross-fade, gentle icon motion. All off for reduced-motion users.
- Taller, full-width desktop header.
- Checked 13 pages at 320, 375, 414, 768 and 1024px: nothing cut off or wider than the screen.

## amazon-storefront branch, 24 November 2026

- Amazon-only shop: prices, cart and checkout removed; Buy on Amazon or Ask about this on every product.
- Redesigned product page and catalog header; breadcrumb structured data and better image alt text.
- Admin portal behind a secret link; `/admin.html` returns 404.
- Coupons and loyalty points (admin tabs), dormant while there is no cart.
- CSS/JS links carry a `?v=` version so browsers fetch new files after a deploy.
- Pages and the sitemap still render if the products table is missing.

## 41d8962 — storefront update, 24 November 2026 (pushed to GitHub, not yet deployed)

### Security

- Signing up with an email that a guest used at checkout no longer reveals that guest's orders and address. The old guest record is detached and kept in admin.
- Guest orders can no longer be filed under a registered customer's account.
- Order limits: 5 orders per hour per IP, 20 of one item, 25 lines per order. The cart caps at 20.
- Admin endpoints no longer return database error text. Customer passwords need 8 characters.

### Designs

- Living Craft is hidden; visitors always get Classic. See README, "Storefront designs".


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
