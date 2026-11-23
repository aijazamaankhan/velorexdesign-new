-- ─────────────────────────────────────────────────────────────────────────────
-- Velorex Wellness: update for the live database
-- ─────────────────────────────────────────────────────────────────────────────
-- Safe to run on a database that already has the wellness products (from
-- wellness-seed.sql). It does not create duplicates:
--   1. Adds the new box, infographic and photo gallery to the Vijaysar glass.
--   2. Adds the Natural Wellness Combo Kit, only if it is not there yet.
--   3. Sets prices to match the Amazon.in listings.
--
-- Run once in phpMyAdmin (Hostinger) or the MySQL CLI:
--   mysql -u root velorex_design < wellness-update.sql
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE products
SET images = '["vijaysar-glass.png","images/products/vijaysar/box-front.webp","images/products/vijaysar/box-open.webp","images/products/vijaysar/box-side.webp","images/products/vijaysar/box-back.webp","images/products/vijaysar/infographic.webp","images/products/vijaysar/leaflet-how-to-use.webp","vijaysar-glass-2.png"]'
WHERE category = 'wellness' AND name LIKE '%Vijaysar%' AND name NOT LIKE '%Combo%';

INSERT INTO products (name, category, price, stock, image_url, images, description, featured)
SELECT
  'Natural Wellness Combo Kit',
  'wellness',
  499.00,
  50,
  'images/products/combo/combo-kit.webp',
  '["images/products/combo/combo-kit.webp","images/products/combo/glass.webp","images/products/combo/comb.webp","images/products/combo/stick.webp","images/products/combo/leaflet-more-from-velorex.webp"]',
  'A 3-piece set of traditional wood wellness tools: a Vijaysar wooden glass (Pterocarpus marsupium) for overnight infused water, a neem wood comb that detangles gently and reduces static, and a ridged wooden acupressure stick for pressure points on the scalp and body. Made in India by Velorex Design.',
  0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Natural Wellness Combo Kit');

-- Prices matched to Amazon.in
UPDATE products SET price = 399.00 WHERE name LIKE '%Vijaysar%' AND name NOT LIKE '%Combo%';
UPDATE products SET price = 169.00 WHERE name LIKE '%Neem%Comb%' AND name NOT LIKE '%Combo%';
UPDATE products SET price = 499.00 WHERE name = 'Natural Wellness Combo Kit';
UPDATE products SET price = 649.00 WHERE name LIKE '%Mango%Tray%';
UPDATE products SET price = 589.00 WHERE name LIKE '%Multipurpose 2-Tier%';
UPDATE products SET price = 439.00 WHERE name LIKE '%Compact 2-Tier%';

-- Replacement advice from the printed leaflet (depends on daily use)
UPDATE products
SET description = REPLACE(description, 'Replace every 30 to 45 days of regular use.', 'Replace after 30 to 90 days, depending on how often you use it.')
WHERE name LIKE '%Vijaysar%';
