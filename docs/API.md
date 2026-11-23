# API reference

This document describes the current PHP endpoint surface in the local checkout. These endpoints support the bundled storefront and admin portal; they are not versioned or guaranteed as a stable third-party API.

## Conventions

- Responses are JSON unless noted otherwise.
- Browser requests use same-origin session cookies.
- Admin endpoints require `admin_id` in the PHP session.
- Customer endpoints that operate on an account require `customer_id` in the PHP session.
- State-changing requests with an `Origin` header are rejected when the origin host does not match the request host.
- Authentication, registration, enquiry, and order creation have file-based, per-IP rate limits in the current local update.
- API errors are written to `api/error.log`. Some older admin read endpoints still include database details in their JSON error response; do not expose the admin surface to untrusted users.

## Public storefront

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `api/get-products.php` | List products, optionally filtered by category or search term |
| `POST` | `api/create-order.php` | Validate cart data and stock, create an order, and decrement stock |
| `POST` | `api/it-enquiry.php` | Validate and email a Velorex Studio service enquiry |

Order creation accepts guest or signed-in customer checkout. The server reads product names and prices from the database rather than trusting browser totals. It does not collect an online payment.

## Customer account

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `api/customer-register.php` | Public | Create a customer account and start its session |
| `POST` | `api/customer-login.php` | Public | Verify credentials and start a customer session |
| `GET` | `api/customer-session.php` | Optional | Return the current customer session state |
| `GET` | `api/customer-logout.php` | Customer session | Clear customer session data |
| `POST` | `api/customer-profile.php` | Customer | Update customer name, email, and phone |
| `GET` | `api/customer-orders.php` | Customer | Return the signed-in customer's order history |
| `GET` | `api/customer-addresses.php` | Customer | List saved addresses |
| `POST` | `api/customer-addresses.php` | Customer | Create, update, delete, or select a default address using the request action |

Customer registration and login regenerate the PHP session identifier. Customer passwords are stored as hashes and checked with PHP password APIs.

## Admin authentication and account

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `api/login.php` | Public | Verify the admin identifier and password and start an admin session |
| `GET` | `api/session-check.php` | Optional | Return the current admin session state |
| `GET` | `api/logout.php` | Admin session | Destroy the current session |
| `POST` | `api/update-admin.php` | Admin | Update the admin identifier, display name, or password after password re-verification |

The `admins.email` field is treated as the login identifier even when the stored value is a username rather than an email address.

## Admin catalog

| Method | Endpoint | Request format | Purpose |
| --- | --- | --- | --- |
| `POST` | `api/add-product.php` | Form data | Create a product |
| `POST` | `api/update-product.php` | Form data | Update product fields and image metadata |
| `POST` | `api/delete-product.php` | Form data | Delete a product |
| `POST` | `api/upload-image.php` | Multipart form data | Validate and store product images |

All catalog mutation endpoints require an admin session. Uploaded product files are stored below `api/uploads/products/`; the PHP process needs write access to that directory.

## Admin orders and customers

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `api/get-orders.php` | List and search orders |
| `POST` | `api/update-order.php` | Update status, tracking number, or admin note |
| `POST` | `api/delete-order.php` | Delete an order by order code |
| `GET` | `api/get-customers.php` | List customers with order statistics |
| `GET` | `api/get-customer.php` | Return one customer's profile, addresses, and orders |
| `POST` | `api/admin-update-customer.php` | Update customer profile or password fields |
| `POST` | `api/admin-delete-customer.php` | Delete a customer and saved addresses while retaining historical orders as guest orders |

Every endpoint in this section requires an admin session.

## Search-engine responses

| Method | Public path | Implementation | Response |
| --- | --- | --- | --- |
| `GET` | `/robots.txt` | `api/robots.php` | Plain-text crawler rules and the live sitemap URL |
| `GET` | `/sitemap.xml` | `api/sitemap.php` | XML sitemap generated from fixed pages, categories, and products |
| `GET` | Public storefront routes | `seo-render.php` | HTML shell with route-specific metadata, content, status, and structured data |

These public paths depend on the rewrite rules in the root `.htaccess`.
