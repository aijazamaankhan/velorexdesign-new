-- ─────────────────────────────────────────────────────────────────────────────
-- Velorex Design — catalog seed (Sheesham tray + MDF racks)
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the four starter catalog products so they appear on #products under the
-- right type and are fully buyable (api/create-order.php validates every cart
-- item against this table, so the built-in JS copies alone cannot check out).
--
-- Run once, e.g. in phpMyAdmin (Hostinger) or the MySQL CLI:
--   mysql -u root velorex_design < catalog-seed.sql
--
-- ⚠ PRICES BELOW ARE PLACEHOLDERS — set the real ones before running, and keep
-- them in step with PLACEHOLDER_PRICES in js/index.js.
-- Image paths are relative to the site root (files live in images/products/).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO products (name, category, price, stock, image_url, images, description, featured) VALUES
(
  'Mango-Shaped Sheesham Wood Tray',
  'wood',
  1499.00,
  25,
  'images/products/mango-tray-1.jpg',
  '["images/products/mango-tray-1.jpg","images/products/mango-tray-2.jpg","images/products/mango-tray-3.jpg","images/products/mango-tray-4.jpg"]',
  'A hand-carved serving tray in solid Sheesham (Indian rosewood), shaped like a mango / paisley motif. Concentric hand-cut grooves ripple out from a deep scooped well, and the whole edge is finished with a scalloped, hand-chiselled border. Three turned legs screw in and out, so the same piece works as a footed serving stand, a flat platter or a wall display piece. Natural wood grain and tone vary from piece to piece — no two trays are identical.',
  0
),
(
  'Velorex 4-Tier Wall Mounted Rack — 24" × 24"',
  'rack',
  1299.00,
  30,
  'images/products/rack-4tier-1.jpg',
  '["images/products/rack-4tier-1.jpg","images/products/rack-4tier-2.jpg","images/products/rack-4tier-3.jpg","images/products/rack-4tier-4.jpg"]',
  'A four-tier wall mounted rack in dark walnut-finish engineered wood (MDF), 24 inches wide by 24 inches tall with a 4 inch deep shelf. Holds 24 to 32 standard spice jars in the kitchen, or works just as well as a display shelf for books, toys, collectibles and plants. Ships flat as six pre-drilled boards and assembles in minutes.',
  0
),
(
  'Velorex Multipurpose 2-Tier Organizer Rack — 14" × 14"',
  'rack',
  899.00,
  40,
  'images/products/rack-2tier-14-1.jpg',
  '["images/products/rack-2tier-14-1.jpg","images/products/rack-2tier-14-2.jpg","images/products/rack-2tier-14-3.jpg","images/products/rack-2tier-14-4.jpg","images/products/rack-2tier-14-5.jpg","images/products/rack-2tier-14-6.jpg"]',
  'A two-tier organizer rack in dark walnut-finish engineered wood (MDF), 14 inches wide by 14 inches tall with deep 6 inch trays and brass connector hardware. The extra depth takes tall spice jars, oil and sauce bottles, tea and coffee tins — or a full row of CDs, DVDs and Blu-ray cases. Sits on a counter or desk, or mounts on a wall.',
  0
),
(
  'Velorex Compact 2-Tier Spice Rack — 14" × 8"',
  'rack',
  599.00,
  50,
  'images/products/rack-2tier-8-1.jpg',
  '["images/products/rack-2tier-8-1.jpg","images/products/rack-2tier-8-2.jpg","images/products/rack-2tier-8-3.jpg","images/products/rack-2tier-8-4.jpg"]',
  'The compact two-tier rack in the same dark walnut-finish engineered wood (MDF) — 14 inches wide, 8 inches tall, 4 inches deep. Sized for a countertop, a kitchen shelf or inside a cabinet, it keeps six to twelve everyday spice jars in easy reach without taking over the worktop. Four flat boards, assembled in minutes.',
  0
);
