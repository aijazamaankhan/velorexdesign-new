# Velorex Design — Complete Website Flow & Architecture

> Source-of-truth document describing how the **actual** files in this project work end-to-end.
> Reflects what is implemented in [index.html](index.html), [admin.html](admin.html), [maintenance.html](maintenance.html), and [api/](api/).

---

## 1. System Overview

**Velorex Design** is a single-page-app (SPA) e-commerce storefront with a separate admin dashboard. It sells:

- Wood Items
- Resin Arts
- Handmade Soap
- Handmade Candles
- Raw Materials
- Graphic Design Services (Logo/Branding, UI/UX, Social Kits, Packaging) — quoted/ordered via **WhatsApp**

**Stack**
- **Frontend:** Single-file HTML/CSS/JS pages (no build step, no framework). All CSS and JS lives inline inside each HTML file.
- **Backend:** PHP 7+ with MySQLi prepared statements.
- **Database:** MySQL (5 tables — see [database-schema.sql](database-schema.sql)).
- **Hosting target:** Hostinger shared hosting.
- **Auth (admin):** PHP `$_SESSION` cookie. Default credentials are **`owner` / `owner123`** (set by [api/setup.php](api/setup.php) — change after first login).
- **Checkout:** Order is saved to MySQL via [api/create-order.php](api/create-order.php) and (when configured) the customer is redirected to a pre-filled **WhatsApp** chat to confirm payment. No built-in payment gateway.
- **Customer accounts:** localStorage-only inside [index.html](index.html) — they do not hit the server.

---

## 2. File / Folder Structure

```
velorex-design/
├── index.html              ← Customer SPA (~3,360 lines, all templates/CSS/JS inline)
├── admin.html              ← Admin dashboard SPA (~1,620 lines, inline CSS/JS)
├── maintenance.html        ← Standalone "Under Maintenance" page
├── database-schema.sql     ← MySQL schema (run via api/setup.php or phpMyAdmin)
├── claude.dm               ← This document
│
├── hero.png  cat-wood.png  cat-resin.png  cat-raw.png  ← Static image assets
│
└── api/                    ← PHP backend
    ├── .htaccess           ← Blocks HTTP access to db.php / .env / *.log; disables PHP in /uploads
    ├── .env.example        ← Template for DB credentials (copy to .env on server)
    ├── db.php              ← MySQLi connection + sanitize() + sendResponse(); reads .env
    ├── setup.php           ← One-click installer: creates tables + seeds owner admin (delete after use)
    ├── login.php           ← Admin login (POST username/password → $_SESSION). Accepts non-email usernames.
    ├── logout.php          ← session_destroy()
    ├── session-check.php   ← Returns {authenticated:true|false}
    ├── get-products.php    ← Public list w/ ?category= & ?search=; decodes `images` JSON
    ├── add-product.php     ← Admin-only INSERT — accepts `images` JSON
    ├── update-product.php  ← Admin-only partial UPDATE
    ├── delete-product.php  ← Admin-only DELETE
    ├── upload-image.php    ← Admin-only multipart upload, supports image[] for batches → /api/uploads/products/*
    ├── create-order.php    ← Public POST (JSON). Validates products against DB, decrements stock, transactional.
    ├── get-orders.php      ← Admin-only (session-gated). Returns orders w/ items + status history.
    └── update-order.php    ← Admin-only — status/tracking/admin_note (JSON keyed by order_code)
```

---

## 3. Database Model ([database-schema.sql](database-schema.sql))

```
admins (id, name, email UNIQUE, password_hash, created_at)
        — email column stores the login identifier (can be plain username like "owner")

customers (id, name, email UNIQUE, phone, created_at)

products (id, name, category, price, stock,
          image_url,          -- cover image (denormalised first entry of `images`)
          images TEXT,        -- JSON array: ["url1","url2",...]
          description, featured TINYINT, created_at, updated_at)

orders (id, customer_id → customers, order_code UNIQUE, total_amount,
        status DEFAULT 'Pending', shipping_address, shipping_city,
        shipping_zip, phone, email, tracking_number, admin_note,
        status_history TEXT (JSON array), created_at, updated_at)

order_items (id, order_id → orders ON DELETE CASCADE,
             product_id → products ON DELETE SET NULL,
             name, quantity, unit_price, total_price)
```

Order status values: `Pending → Processing → Shipped → Delivered` (+ `Cancelled`).

---

## 4. Customer SPA — [index.html](index.html)

### 4.1 Hash routing

| Hash route | Template id | Renderer |
|---|---|---|
| `#home` (default) | `tpl-home` | `app.renderHome()` |
| `#products` / `#products?cat=<id>` | `tpl-products` | `app.renderProducts(cat)` |
| `#product-detail?id=<n>` | `tpl-product-detail` | `app.renderProductDetail(id)` |
| `#cart` | `tpl-cart` | `app.renderCart()` |
| `#services` | `tpl-services` | `app.renderServices()` |
| `#auth` | `tpl-auth` | login + register forms |
| `#profile` | `tpl-profile` | `app.renderProfile()` |
| `#about` / `#contact` / `#faq` / `#shipping` / `#returns` / `#terms` / `#privacy` / `#process` | `tpl-<name>` | static |

Unknown hashes → `#home`.

### 4.2 Boot sequence

`app.init()` → `updateCartBadge` → `updateAuthNav` → `loadProducts()` (fetches [api/get-products.php](api/get-products.php) into `PRODUCTS[]`) → `handleRoute()`.

### 4.3 Product images

Each product now carries an `images` array (server-decoded from JSON). The detail page renders a thumbnail strip below the main image; clicking a thumbnail swaps the main image via `app.selectDetailImage(i)`. Cards/carts/cart use the first image (`product.img`).

### 4.4 Checkout (`app.checkout()` in `#cart`)

```
cart in localStorage  ─┐
                       ▼
       POST api/create-order.php  (JSON body)
       {
         customer_name, customer_email, customer_phone,
         address: { street, city, zip },
         items: [ { product_id, name, qty, price }, … ]
       }
                       │
                       ▼
   server (transactional):
       1. validate each product_id; reject if missing or out of stock
       2. compute authoritative subtotal from products.price (ignores client price)
       3. add shipping (free > ₹999, else ₹99)
       4. upsert customer by email
       5. INSERT order (order_code = 'ORD-' + strtoupper(uniqid()))
       6. INSERT order_items, UPDATE products SET stock = stock - qty
       7. seed status_history with {Pending, now}
                       │
                       ▼
   response: { success, order_code, subtotal, shipping, total_amount }
                       │
                       ▼
   client:
     ① mirror order locally in 'velorex_design_all_orders'
     ② if WhatsApp number configured → open wa.me chat with order_code
     ③ clear cart, show success toast (with order_code in the message)
```

If WhatsApp isn't configured the order **still saves** and the user gets the reference code in a toast — no silent failure.

### 4.5 Services flow (`#services`)

`SERVICES_DATA` is hard-coded in [index.html](index.html). Selecting a package builds a pre-filled WhatsApp message and opens `wa.me/...`. No server involvement.

### 4.6 Customer auth (localStorage-only)

`app.handleRegister` / `app.handleLogin` work entirely off `velorex_design_registered_users`. There's no `/api/register.php`. Checkout does **not** require login — guests can buy.

---

## 5. Admin SPA — [admin.html](admin.html)

### 5.1 Auth flow

1. `checkSession()` on load → GET [api/session-check.php](api/session-check.php) → if `authenticated:true`, show dashboard.
2. Login form → POST username + password to [api/login.php](api/login.php) → on success the PHP session cookie is set.
3. **Fallback:** if the server is unreachable (e.g. opening `admin.html` via `file://`), `owner`/`owner123` unlocks the dashboard UI for offline preview only. Server writes will 401 in that mode.

Default credentials seeded by [api/setup.php](api/setup.php): **`owner` / `owner123`**.

### 5.2 Tabs

| Tab | Server calls |
|---|---|
| **Inventory** | `get-products.php`, `add-product.php`, `update-product.php`, `delete-product.php`, `upload-image.php` |
| **Orders** | `get-orders.php`, `update-order.php` |
| **Featured** | `update-product.php` |
| **Categories** | localStorage only |
| **Analytics** | client-side aggregation |
| **Settings** | localStorage only (WhatsApp, phone, email, address) |

### 5.3 Product modal — multi-image upload

Each product now has a gallery editor:
- "Upload" picks multiple files at once (`image[]`) → POSTs to [api/upload-image.php](api/upload-image.php) → server returns `image_urls[]` → each thumbnail appears in the gallery.
- "Add URL" inserts an external image URL.
- The first image is the cover (marked **COVER**); click ★ on any other thumbnail to promote it. × removes one.
- On save, `images` (JSON array) and `image_url` (the cover) are both sent so legacy display code keeps working.

### 5.4 Order management

All three actions POST JSON to [api/update-order.php](api/update-order.php) keyed by `order_code`:

| Action | Payload | Server effect |
|---|---|---|
| Status change | `{order_code, status}` | UPDATE + append to `status_history` |
| Tracking number | `{order_code, tracking_number}` | UPDATE |
| Admin note | `{order_code, admin_note}` | UPDATE |

---

## 6. API Reference

### 6.1 Public endpoints

#### `GET api/get-products.php`
Query: `category` (or `'all'`), `search`. Order: `featured DESC, name ASC`.
Returns `{ products: [ { id, name, category, price, stock, image_url, images:[...], description, featured } ] }`.

#### `POST api/create-order.php` *(JSON body)*
Validates each `product_id` against `products`, rejects if missing/out of stock, recomputes total from DB prices, decrements stock in a transaction. See §4.4 for the full flow.

### 6.2 Admin endpoints (require `$_SESSION['admin_id']`)

| Endpoint | Method | Body / params |
|---|---|---|
| [api/login.php](api/login.php) | POST | form: `email` (or username), `password` |
| [api/session-check.php](api/session-check.php) | GET | — |
| [api/logout.php](api/logout.php) | * | — |
| [api/get-orders.php](api/get-orders.php) | GET | `search`, `status` — **now session-gated** |
| [api/update-order.php](api/update-order.php) | POST | JSON: `order_code` + any of `status` / `tracking_number` / `admin_note` |
| [api/add-product.php](api/add-product.php) | POST | form: name, category, price, stock, image_url, images (JSON), description, featured |
| [api/update-product.php](api/update-product.php) | POST | form: id + **any subset** of the above |
| [api/delete-product.php](api/delete-product.php) | POST | form: id |
| [api/upload-image.php](api/upload-image.php) | POST | multipart: `image` (single) or `image[]` (multi). Returns `{ image_url, image_urls: [], skipped: [] }`. Max 5MB per file, jpeg/png/webp/gif. |

### 6.3 Bootstrap endpoint

#### `GET api/setup.php`
Idempotent installer. Creates every table, adds the `images` column if missing, creates `api/uploads/products/`, and seeds (or resets) the admin `owner` / `owner123`. Returns JSON status. Delete after first successful run.

### 6.4 Response conventions

All JSON. Common codes: `200`, `401` unauth, `405` wrong method, `422` validation, `415` bad upload type, `500` db error.

---

## 7. End-to-End Buy Flow

```
 Browser (index.html)                          api/                            MySQL
 ─────────────────────                         ────                            ─────
 boot → fetch api/get-products.php  ────────► get-products.php  ────SELECT───► products
                                ◄────────────  { products: [...] }
 user adds items → localStorage.velorex_design_cart
 user clicks "Proceed to Order" on #cart
 app.checkout() builds payload
                                ─POST JSON──► api/create-order.php
                                                BEGIN TRANSACTION
                                                ├─ SELECT each product (price, stock)
                                                ├─ verify qty <= stock
                                                ├─ SELECT/INSERT customer  ──► customers
                                                ├─ INSERT order            ──► orders
                                                ├─ INSERT order_items (n)  ──► order_items
                                                ├─ UPDATE products SET stock = stock - qty
                                                COMMIT
                                ◄────────────  { success, order_code, total_amount }
 mirror order in localStorage.velorex_design_all_orders
 if WhatsApp configured → window.open(wa.me/<store>?text=…with order_code)
 clear cart, toast "Order placed! Reference: ORD-…"
```

---

## 8. Hosting on Hostinger

1. **Upload** every file to the public web root (or a subdomain root) via FTP / File Manager.
2. **Create a MySQL database** in cPanel (note the host, username, password, database name).
3. **Configure credentials** — either:
   - copy `api/.env.example` to `api/.env` and fill it in (recommended; `.env` is blocked by .htaccess), or
   - edit the defaults in [api/db.php](api/db.php).
4. **Run the installer once:** visit `https://your-domain/api/setup.php` in a browser. You should see JSON confirming the tables and the admin seed.
5. **Log in:** open `https://your-domain/admin.html` and sign in with **`owner` / `owner123`**.
6. **Set the WhatsApp number** in Settings (checkout uses it).
7. **Add products** with multi-image gallery support.
8. **Delete `api/setup.php`** (it lets anyone reset the admin password if left in place).
9. **Optional but recommended:**
   - Change the admin password by re-running setup.php after editing it, or via SQL: `UPDATE admins SET password_hash = '<bcrypt of new password>' WHERE email = 'owner';`
   - Make sure `api/uploads/products/` is writable (755 or 775).
   - Force HTTPS via Hostinger's free SSL.

---

## 9. localStorage Keys (Customer)

| Key | Purpose |
|---|---|
| `velorex_design_cart` | Shopping cart |
| `velorex_design_profile` | name/email/phone/addresses[] |
| `velorex_design_user` / `velorex_design_registered_users` | Client-only customer accounts |
| `velorex_design_all_orders` | Local mirror of placed orders (per browser) |
| `velorex_design_theme` | light/dark |
| `velorex_notifications_<userId>` | Profile notifications |
| `velorex_store_settings` | WhatsApp/phone/email/address (set in admin Settings tab) |
| `velorex_store_categories` | Custom category list (admin Categories tab) |
| `velorex_admin_logged`, `velorex_admin_email` | Client admin flag (server session is separate) |

---

## 10. Security Notes

- [api/.htaccess](api/.htaccess) blocks direct HTTP access to `db.php`, `.env`, and `*.log`, and prevents PHP execution under `api/uploads/`.
- All admin write endpoints require `$_SESSION['admin_id']`. [api/get-orders.php](api/get-orders.php) is now also gated.
- All DB writes use prepared statements with `bind_param`.
- Image uploads are mime-checked, extension-checked, size-capped (5MB), and stored under random hex names.
- `api/create-order.php` uses DB-side prices — clients cannot tamper with totals.
- **Known limitations:** customer accounts are still localStorage-only (plain-text passwords stored client-side). The `setup.php` endpoint resets the admin password every time it runs, so delete it once the site is live.

---

## 11. Pre-flight Checklist (before going live)

- [ ] `api/.env` (or `api/db.php`) has real DB credentials
- [ ] Visited `api/setup.php` once → got `success:true`
- [ ] Logged in to admin.html with `owner` / `owner123`
- [ ] Set WhatsApp number in admin Settings
- [ ] Added at least one product with multiple images
- [ ] Placed a test order from `index.html` end-to-end (order appears in admin Orders tab, stock decremented)
- [ ] Deleted `api/setup.php`
- [ ] Changed admin password from default
- [ ] HTTPS enabled

---

**Document Version:** 3.0 (production-ready pass)
**Last Updated:** 2026-05-14
