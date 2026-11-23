# Velorex Design

Velorex Design is a PHP and MySQL storefront for handcrafted wood, resin-art, and wellness products. It includes a customer-facing catalog and checkout flow, customer accounts, an admin portal, product and order management, generated SEO pages, and a Velorex Studio enquiry form.

## Current development state

Code lives on GitHub at `aijazamaankhan/velorexdesign-new`. The live site deploys automatically from the `amazon-storefront` branch. The live site is **velorexdesign.com** on Hostinger (account `u286479481`, document root `domains/velorexdesign.com/public_html`). Pushing to `amazon-storefront` updates the live site within a minute; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

See [CHANGELOG.md](CHANGELOG.md) for what changed and when.

## How the shop sells

The site shows no prices and has no cart. Every product links to its Amazon.in listing (`AMAZON_LINKS` in `js/index.js`), or offers an email enquiry when it is not on Amazon.

## Storefront designs

Only the **Classic** design is shown to visitors. The second design, **Living Craft**, is kept in the code but hidden:

- `ALTERNATE_DESIGN_ENABLED = false` in `js/design-selection.js` ignores saved choices and hides the header switch.
- Preview it any time with `?design=living-craft` in the address.
- To bring it back for everyone, set the flag to `true`. Its styles are in `css/themes/`.

## Runtime requirements

- A PHP-enabled Apache host
- MySQL or MariaDB
- PHP `mysqli` support; the API uses prepared statements and `mysqli_stmt::get_result()`
- Apache `mod_rewrite` for application routes, `robots.txt`, and `sitemap.xml`
- Apache `mod_headers` for the security headers defined in `.htaccess`
- PHP `mail()` configured if the IT-services enquiry form should send mail

There is no Node, Composer, or frontend build step in this repository.

## Setup

1. Create an empty MySQL or MariaDB database.
2. Copy `.env.example` to `.env` in the project root.
3. Set `DB_HOST`, `DB_USER`, `DB_PASS`, and `DB_NAME` in `.env`.
4. Import `database-schema.sql` using phpMyAdmin or the MySQL client.
5. Create the first admin account as described under [Create the first admin](#create-the-first-admin).
6. Optionally review and import `wellness-seed.sql` and `catalog-seed.sql`. The catalog seed contains placeholder prices that must be replaced before import.
7. Serve the repository root from a PHP-enabled Apache virtual host.
8. Open `/` for the storefront and `/admin.html` for the admin portal.

The former `api/setup.php` installer was removed. Do not use instructions that reference that endpoint.

### Environment configuration

Configuration is resolved in this order:

1. Server environment variables
2. Root `.env`
3. Legacy `api/.env`
4. Development fallbacks in `api/db.php`

The real `.env` is ignored by Git and must never be committed. The root `.htaccess` blocks web access to dotfiles, SQL, Markdown, logs, and other support files, but host configuration should also prevent accidental publication of repository metadata.

### Create the first admin

Generate a bcrypt password hash locally or on the server:

```sh
php -r "echo password_hash('replace-with-a-strong-password', PASSWORD_BCRYPT), PHP_EOL;"
```

Then insert an admin in phpMyAdmin or the MySQL client, replacing every placeholder:

```sql
INSERT INTO admins (name, email, password_hash)
VALUES ('Store Owner', 'admin-username', '<PASSWORD_HASH>');
```

The `email` column is used as the admin login identifier and can contain the chosen username. Use a unique value and a strong password; no default admin credentials are installed by the schema.

## Database files

| File | Purpose |
| --- | --- |
| `database-schema.sql` | Creates admins, customers, addresses, products, orders, and order items |
| `wellness-seed.sql` | Adds the three starter wellness products |
| `catalog-seed.sql` | Adds four starter catalog products; replace placeholder prices first |
| `wellness-update.sql` | Safe to run on the live database: adds the Vijaysar gallery and the Combo Kit, and sets prices to match Amazon.in. Use this instead of re-running `wellness-seed.sql`, which would create duplicates |

Orders are stored before the WhatsApp handoff and reserve stock. The application does **not** include an online payment gateway.

## Application structure

| Path | Purpose |
| --- | --- |
| `index.html` | Storefront shell and static page markup |
| `js/index.js` | Storefront routing, catalog, cart, accounts, and checkout behavior |
| `admin.html`, `js/admin.js` | Admin portal for products, orders, customers, and settings |
| `api/` | PHP JSON endpoints, database connection, uploads, enquiries, and SEO feeds |
| `docs/API.md` | Request methods, authentication boundaries, and endpoint responsibilities |
| `seo-render.php` | Server-rendered metadata and indexable content for public routes |
| `.htaccess` | Apache routing, access restrictions, canonical redirects, and security headers |
| `manifest.webmanifest` | Installable standalone browser experience; no service worker or offline cache is provided |

## Public routes and SEO

Apache rewrites clean public addresses to `seo-render.php`, including:

- `/product/{id-slug}`
- `/category/{category}`
- `/products`, `/wellness`, `/services`, `/about`, `/contact`, `/faq`
- `/shipping`, `/returns`, `/terms`, `/privacy`, `/process`
- `/cart`, `/profile`, and `/auth` (served with `noindex` behavior)

`/robots.txt` and `/sitemap.xml` are generated by PHP so they use the active host. Public pages receive route-specific titles, descriptions, canonical URLs, and structured data. The storefront upgrades navigation in the browser without full-page reloads.

## Accounts, orders, and admin

- Customer authentication and profile data are stored server-side with PHP sessions and MySQL.
- Cart, light/dark appearance, Classic/Living Craft design choice, recent-product, and selected UI state are stored in the browser.
- The storefront design selector is independent from light/dark appearance. `?design=classic` and `?design=living-craft` provide non-persistent previews; explicit choices use `velorex_design_variant`.
- Checkout validates product IDs, quantities, prices, and stock on the server before creating an order.
- Admin endpoints require an authenticated admin session.
- The admin portal supports catalog, inventory, orders, customers, uploads, and account settings.

See [docs/API.md](docs/API.md) for the current endpoint inventory. It is an implementation reference, not a stable public API contract.

The current local hardening adds session regeneration, hardened cookie settings, same-origin checks for state-changing requests, rate limits, safer upload validation, and generic public error responses. These changes remain Unreleased until committed and deployed.

## Store links and ordering

- Amazon listings are mapped by product name in `AMAZON_LINKS` in `js/index.js`. A matching product gets a "Buy on Amazon" button and an "On Amazon" chip.
- WhatsApp ordering uses `STORE_WHATSAPP_DEFAULT` in `js/index.js`, or the number saved in admin settings. While both are empty, the WhatsApp buttons stay hidden.
- Brand files live in `images/brand/`; the link-preview image is `images/products/vijaysar/og-vijaysar.jpg`.

## Operational notes

- Keep `api/uploads/products/` writable by the PHP process and non-listable by the web server.
- Keep `api/error.log` private; API error details are logged rather than returned to browsers.
- The file-based rate limiter writes to the system temporary directory, so PHP must be able to write there.
- Configure PHP mail delivery before enabling the Velorex Studio enquiry workflow in production.
- Test `.htaccess` behavior on the target host; clean routes depend on Apache rewrite support.

## Verification checklist

- Import the schema into an empty database without errors.
- Confirm the storefront loads products from `api/get-products.php`.
- Confirm customer registration, login, profile, address, and order-history flows.
- Confirm admin login, product upload, inventory update, and order update flows.
- Confirm `/robots.txt`, `/sitemap.xml`, one product route, and an unknown route return the expected content and status.
- Confirm private files such as `/.env`, `/README.md`, and `/database-schema.sql` are denied over HTTP.
- Confirm the enquiry form sends mail on the production host.

## Security and deployment

Never commit `.env`, runtime logs, or uploaded customer/store content. Change the first admin password immediately if a temporary credential is used. Review the Unreleased working tree before deployment, and back up the database and uploaded images before replacing production files.
