# Velorex Design — E-Commerce Website

Build a premium, fully responsive, multi-page e-commerce website for selling **Wood Items**, **Resin Arts**, and **Graphic Design Services**, with cross-links to the existing **Velorex Music Store** and **Garment Website**. Ready for deployment on Hostinger (static HTML/CSS/JS).

## User Review Required

> [!IMPORTANT]
> **Brand Name**: I'll use **"Velorex Design"** as the brand. Should it be different?

> [!IMPORTANT]
> **Garment Website URL**: Please provide the URL for your garment website so I can link it properly. I'll use a placeholder (`#`) for now.

> [!IMPORTANT]
> **Music Store URL**: I'll link to `velorexmusic.com`. Is that correct?

## Open Questions

1. **Payment Gateway**: Should this include a mock checkout (like Vinyl Vault) or just a WhatsApp/contact-based ordering system for now?
2. **Product Data**: Should I pre-populate with sample products in each category, or leave the product catalog empty for you to fill?
3. **Color Scheme**: I'll match the Velorex brand palette (dark mode, orange/gold gradients). Any preference for a different theme?

---

## Proposed Changes

### Site Architecture — 6 HTML Pages with Shared Header/Footer

All pages will share an identical header (sticky navbar) and footer via a JavaScript component injection system (same approach as your Vinyl Vault site).

```
velorex-design/
├── index.html          ← Homepage (hero, featured products, categories)
├── products.html       ← Product catalog with filters & search
├── product-detail.html ← Single product detail page
├── services.html       ← Graphic Design services page
├── cart.html            ← Shopping cart & checkout
├── contact.html         ← Contact / About page
├── css/
│   └── style.css        ← Complete design system
├── js/
│   ├── components.js    ← Shared header, footer, toast, back-to-top
│   ├── products-data.js ← Product catalog data (wood items, resin arts)
│   ├── cart.js           ← Cart logic (LocalStorage-based)
│   └── app.js            ← Page-specific initialization, routing
└── images/              ← Generated product/hero images
```

---

### Design System (`css/style.css`)

#### [NEW] [style.css](file:///c:/Users/aijaz/Downloads/velorex-design/css/style.css)

Complete design system matching the Velorex brand:
- **CSS Variables**: Same palette as Vinyl Vault (`--primary: #1a0a2e`, `--secondary: #ff6b35`, `--accent: #ffd700`, etc.)
- **Dark/Light Mode** toggle support
- **Typography**: Playfair Display (headings) + DM Sans (body) from Google Fonts
- **Components**: Navbar, Hero, Product Cards, Category Cards, Service Cards, Cart UI, Footer
- **Responsive Breakpoints**: Desktop (1280px+), Tablet (768px–1279px), Mobile (<768px)
- **Animations**: Hover effects, card lifts, fade-in on scroll, gradient shimmer effects
- **Glassmorphism**: Navbar backdrop blur, card glass effects

---

### Shared Components (`js/components.js`)

#### [NEW] [components.js](file:///c:/Users/aijaz/Downloads/velorex-design/js/components.js)

Injects identical header and footer on every page:

**Header includes:**
- Velorex Design logo with gold gradient
- Navigation: Home, Products (dropdown with Wood Items / Resin Arts), Services, Contact
- **External Links dropdown**: 🎵 Velorex Music Store, 👕 Garment Store
- Search bar
- Cart icon with badge counter
- Dark/Light mode toggle
- Hamburger menu for mobile

**Footer includes:**
- Brand info & description
- Quick links (all pages)
- Product categories
- External store links
- Social media icons
- Copyright notice
- Newsletter signup

---

### Homepage (`index.html`)

#### [NEW] [index.html](file:///c:/Users/aijaz/Downloads/velorex-design/index.html)

- **Hero Section**: Full-width with animated gradient background, tagline "Handcrafted Art & Design", CTA buttons
- **Categories Section**: 3 stunning category cards (Wood Items, Resin Arts, Graphic Design) with hover effects
- **Featured Products**: Grid of 8 products from mixed categories
- **Why Choose Us**: Trust badges (Handcrafted, Free Shipping, Secure Payment, 24/7 Support)
- **Testimonials**: Customer review carousel
- **Our Other Stores**: Cards linking to Music Store & Garment Website
- **Newsletter**: Email signup section

---

### Product Catalog (`products.html`)

#### [NEW] [products.html](file:///c:/Users/aijaz/Downloads/velorex-design/products.html)

- **Filter Sidebar**: Category, price range, sort by (popularity, price, newest)
- **Search**: Real-time product search
- **Product Grid**: Responsive grid with product cards showing image, name, price, category tag, add-to-cart button
- **Pagination** or infinite scroll
- **URL parameter support**: `?cat=wood`, `?cat=resin` for direct category links

---

### Product Detail (`product-detail.html`)

#### [NEW] [product-detail.html](file:///c:/Users/aijaz/Downloads/velorex-design/product-detail.html)

- **Image Gallery**: Large product image with zoom on hover
- **Product Info**: Name, price, description, category, availability
- **Quantity Selector** + Add to Cart button
- **Related Products**: Grid of similar items
- **Breadcrumb** navigation

---

### Services Page (`services.html`)

#### [NEW] [services.html](file:///c:/Users/aijaz/Downloads/velorex-design/services.html)

- **Service Cards**: Logo Design, Brand Identity, Social Media Graphics, Packaging Design, Print Design, Custom Illustrations
- **Pricing Tiers**: Basic, Standard, Premium packages
- **Process Steps**: How it works (Consult → Design → Review → Deliver)
- **Portfolio Gallery**: Sample design work (generated images)
- **CTA**: Contact for custom quote

---

### Shopping Cart (`cart.html`)

#### [NEW] [cart.html](file:///c:/Users/aijaz/Downloads/velorex-design/cart.html)

- **Cart Items**: List with image, name, quantity adjuster, price, remove button
- **Order Summary**: Subtotal, shipping, tax, total
- **Checkout Form**: Name, email, phone, address
- **Mock Payment**: Card/UPI payment simulation (like Vinyl Vault)
- **Order Confirmation**: Success screen with order ID
- **LocalStorage** persistence

---

### Contact Page (`contact.html`)

#### [NEW] [contact.html](file:///c:/Users/aijaz/Downloads/velorex-design/contact.html)

- **Contact Form**: Name, email, subject, message
- **Contact Info**: Phone, email, address, business hours
- **Map Embed** placeholder
- **FAQ Accordion**
- **Links** to Music Store & Garment Store

---

### Product Data (`js/products-data.js`)

#### [NEW] [products-data.js](file:///c:/Users/aijaz/Downloads/velorex-design/js/products-data.js)

Pre-populated with ~20 sample products:
- **Wood Items** (~8): Carved wall art, wooden trays, jewelry boxes, phone stands, coasters, bookends, clocks, picture frames
- **Resin Arts** (~8): Resin coasters, wall art, keychains, bookmarks, jewelry, trays, lamps, phone cases
- **Each product**: id, name, price, category, description, image, badge, rating

---

### Cart Logic (`js/cart.js`)

#### [NEW] [cart.js](file:///c:/Users/aijaz/Downloads/velorex-design/js/cart.js)

- Add/remove/update cart items
- LocalStorage persistence
- Cart count badge update
- Checkout flow with form validation
- Order ID generation
- Order history in LocalStorage

---

## Generated Assets

I'll use the image generation tool to create:
1. Hero background/banner image
2. Category card images (Wood, Resin, Design)
3. Sample product images for the catalog

---

## Verification Plan

### Automated Tests
- Open each page in the browser and verify rendering
- Test responsive design at mobile (375px), tablet (768px), and desktop (1440px) widths
- Test cart flow: add item → view cart → checkout → order confirmation
- Verify all navigation links work across pages
- Check that header/footer are identical on all pages

### Manual Verification
- Visual inspection of all pages for design quality
- Cross-page navigation testing
- Cart persistence across page reloads
- External links to music store and garment site

### Deployment Readiness
- All files are static HTML/CSS/JS — ready for Hostinger file manager upload
- No build step required
- No server-side dependencies
