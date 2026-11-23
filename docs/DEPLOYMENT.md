# Deploying velorexdesign.com

| | |
| --- | --- |
| Live site | https://velorexdesign.com |
| Host | Hostinger shared hosting, account `u286479481` |
| Document root | `/home/u286479481/domains/velorexdesign.com/public_html` |
| Code | GitHub `aijazamaankhan/velorexdesign-new`, branch `main` |
| Database | MySQL on the same server; credentials in `.env` on the server only |

Pushing to GitHub does not change the live site. Git auto-deploy is not set up.

## Files that exist only on the server

Never delete or overwrite these. They are not in Git.

- `.env`: database name, user and password. Without it every page that needs the database fails.
- `api/error.log`: PHP error log.
- `api/uploads/products/`: images uploaded through admin.
- `maintenance.html`: maintenance page.

## Before each deploy

1. In hPanel File Manager, download a copy of `.env` (and `api/uploads/products/` if it has images).
2. Locally, run the checks:
   ```bash
   for f in api/*.php seo-render.php; do php -l "$f"; done
   node --check js/index.js && node --check js/admin.js
   node --test tests/design-selection.test.js
   ```
3. Commit and push to `main`.

## Deploy

Upload the changed files to `public_html` (hPanel File Manager, FTP, or the Hostinger deploy tool). Upload over the top of the existing files; do not empty the folder first.

**Warning:** the Hostinger deploy tool (and hPanel "deploy from archive") replaces the whole folder and **deletes `.env`**. This happened on 24 November 2026 and took the database connection down. Either upload files over the top in File Manager, connect Git in hPanel (Git pulls keep `.env`), or recreate `.env` immediately after an archive deploy.

## After a deploy

1. If the release has a database script (for example `wellness-update.sql`), run it once in phpMyAdmin. Do not re-run `wellness-seed.sql` or `catalog-seed.sql` on the live database; they create duplicates.
2. Open the home page, a product page, the cart and the secret admin link, and check the browser console for errors.
3. Check that https://velorexdesign.com/.env returns 403.

## Settings to fill in later

- WhatsApp number: `STORE_WHATSAPP_DEFAULT` in `js/index.js`, or admin settings. WhatsApp buttons stay hidden until it is set.
- Contact page phone number is still a placeholder.
- Footer social links (YouTube, Instagram) are placeholders.

## Admin access

- The admin portal is only reachable at `https://velorexdesign.com/manage/<ADMIN_PATH_KEY>`.
  `ADMIN_PATH_KEY` is set in the server `.env` (32 random letters and digits). It is never in Git.
- `/admin.html` and `/admin-gate.php` return 404 when opened directly. There is no admin link on the public site or in `robots.txt`.
- A wrong key also returns 404, so the address gives nothing away. The admin API still needs a username and password.
- To change the secret link, change `ADMIN_PATH_KEY` in the server `.env`. The old link stops working at once.
- Change the admin username or password from the admin Settings page after logging in.
