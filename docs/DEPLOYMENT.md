# Deploying velorexdesign.com

| | |
| --- | --- |
| Live site | https://velorexdesign.com |
| Host | Hostinger shared hosting, account `u286479481` |
| Document root | `/home/u286479481/domains/velorexdesign.com/public_html` |
| Code | GitHub `aijazamaankhan/velorexdesign-new` |
| Live branch | `mobile-polish` (Git auto-deploy is on) |
| Database | MariaDB `u286479481_velorexdesign`, user `u286479481_velorexdesig_n`; credentials in `.env` on the server only |

**Pushing to the live branch (`mobile-polish`) updates the live site within about a minute.** Pushing to `main` does not. To make another branch live, change the branch in hPanel → Websites → velorexdesign.com → Git (or redeploy from that branch).

## How the storefront sells

- Products show no price and have no cart. Each product has a **Buy on Amazon** button (links in `AMAZON_LINKS` in `js/index.js`), or **Ask about this** (email to velorexdesign@gmail.com) when it has no Amazon listing.
- Only the Classic design is shown. Living Craft stays in the code, hidden (`ALTERNATE_DESIGN_ENABLED` in `js/design-selection.js`).
- Coupons and loyalty points are built (admin tabs Coupons and Loyalty Points, `api/marketing-lib.php`) but unused while there is no cart.

## Files that exist only on the server

Never delete or overwrite these. They are not in Git.

- `.env`: database name, user, password and `ADMIN_PATH_KEY`. Without it every page that needs the database fails.
- `api/error.log`: PHP error log.
- `api/uploads/products/`: images uploaded through admin.

## Before each deploy

1. Run the checks:
   ```bash
   for f in api/*.php seo-render.php admin-gate.php; do php -l "$f"; done
   node --check js/index.js && node --check js/admin.js && node --check js/admin-marketing.js
   node --test tests/design-selection.test.js
   ```
2. If you changed any CSS or JS file, bump the `?v=` number on its `<script>`/`<link>` tag in `index.html` or `admin.html`. Browsers keep these files for 7 days; without a new number visitors keep seeing the old version.
3. Commit and push to the live branch.

## Deploy

Git auto-deploy pulls the branch and keeps `.env`. Do not use "deploy from archive" or the Hostinger deploy tool with a zip or folder: it replaces the whole folder and **deletes `.env`** (this happened on 24 November 2026 and took the database down).

**Deleting a file in Git does not delete it on the server.** Hostinger's Git deploy copies new and changed files but leaves removed ones in place. To retire a file, replace it with an empty stub (as `api/db-repair.php` is), or delete it in File Manager.

## Layout check before a release

Every release should pass the overflow sweep: open each main page at 320, 375, 414, 768, 1024 and 1180px wide, check the header stays on one line, and confirm nothing is cut off and the page never scrolls sideways. Also open the phone menu (three-line button) and the Catalog dropdown inside it.

Known trap: never put `backdrop-filter`, `filter` or `transform` on `.navbar` on phones. Any of them makes the fixed phone menu position against the 80px bar instead of the screen, and the menu collapses to one link.

## After a deploy

1. Run any new database script once in phpMyAdmin. Never re-run `wellness-seed.sql` or `catalog-seed.sql` on the live database; they create duplicates.
2. Open the home page, the catalog, a product page and the secret admin link, and check the browser console for errors.
3. Check that https://velorexdesign.com/.env returns 403 and https://velorexdesign.com/admin.html returns 404.

## Database state

On 24 November 2026 the live database was repaired. Its original tables had been renamed to `*_old_backup` and tables from another app (`users`, `payment_orders`, …) sat beside them. The repair created the storefront tables (`admins`, `customers`, `customer_addresses`, `products`, `orders`, `order_items`, plus `coupons`, `coupon_redemptions`, `loyalty_config`, `loyalty_ledger`), the admin `owner`, and the 8 starter products from `wellness-seed.sql` and `catalog-seed.sql`. Nothing else was touched; the backup tables can be dropped later once nothing in them is needed (2 admins, 3 customers, no products or orders).

## Admin features (quick reference)

- Inventory (dashboard): summary cards; products with Amazon link, badge, selling price and cost price; image upload with cropper and auto-crop.
- Orders: status, tracking, notes, Print bill (A4), Address label (4x6 in / A6).
- Analytics & P&L: website orders are counted automatically; record Amazon payouts and costs in the ledger (`api/admin-ledger.php`, table `ledger_entries`).
- Coupons and Loyalty Points: built, unused while the shop sells through Amazon and WhatsApp.
- Sessions end 8 hours after login.

## Admin access

- Easy address: `https://velorexdesign.com/velorex-admin`. The secret address `https://velorexdesign.com/manage/<ADMIN_PATH_KEY>` also still works.
- Either way the admin username and password are required, and logins are rate limited. Use a strong password.
- `/admin.html` and `/admin-gate.php` return 404 on purpose. There is no admin link on the public site or in `robots.txt`.
- A wrong key also returns 404. The admin still needs a username and password.
- To change the secret link, change `ADMIN_PATH_KEY` in the server `.env`. The old link stops working at once.
- Change the admin username or password from admin → Settings after logging in.

## Ordering and contact

- WhatsApp: +91 79060 27807 (`STORE_WHATSAPP_DEFAULT` in `js/index.js`). A number saved in admin settings overrides it.
- Email: velorexdesign@gmail.com. Address: Meerut, Uttar Pradesh 250002, India.

## Images and speed

- Every JPG/PNG under the site has a `.webp` copy next to it; `.htaccess` sends the WebP to browsers that accept it. When you add a new JPG/PNG to the repo, add its WebP copy too (Python Pillow, quality 78–80, max 1200 px wide).
- Product photos uploaded through admin are served as uploaded.
- Versioned CSS/JS and images are cached for a year; bump the `?v=` number when CSS or JS changes.

## Social media

- YouTube: https://www.youtube.com/@sahacraft. Instagram: https://www.instagram.com/velorexdesign_saha_craft/
- Shown as footer icons, a "Follow Velorex" band with QR codes in the footer, and a "Follow us" block on the Contact page. Also listed as `sameAs` in the shop's structured data.
- QR codes are `images/social/qr-youtube.svg|png` and `qr-instagram.svg|png`. If a handle changes, regenerate them (Python `segno`, colours `#1a0a2e` on `#fbf6ea`, corner squares in the platform colour) and update the links in `index.html` and `setShopStructuredData()` in `js/index.js`.

## Settings to fill in later

