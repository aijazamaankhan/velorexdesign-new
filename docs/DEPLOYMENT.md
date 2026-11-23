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

## Admin access

- The admin portal is only at `https://velorexdesign.com/manage/<ADMIN_PATH_KEY>`. The key is in the server `.env`, never in Git.
- `/admin.html` and `/admin-gate.php` return 404 on purpose. There is no admin link on the public site or in `robots.txt`.
- A wrong key also returns 404. The admin still needs a username and password.
- To change the secret link, change `ADMIN_PATH_KEY` in the server `.env`. The old link stops working at once.
- Change the admin username or password from admin → Settings after logging in.

## Settings to fill in later

- WhatsApp number: `STORE_WHATSAPP_DEFAULT` in `js/index.js`, or admin settings. WhatsApp buttons stay hidden until it is set.
- Contact page phone number is still a placeholder.
- Footer social links (YouTube, Instagram) are placeholders.
