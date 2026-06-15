-- ─────────────────────────────────────────────────────────────────────────────
-- Velorex Wellness — seed products
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the three starter Wellness products so they appear on the #wellness page
-- and are fully buyable (Add to Cart / checkout validate against this table).
--
-- Run once, e.g. in phpMyAdmin (Hostinger) or the MySQL CLI:
--   mysql -u root velorex_design < wellness-seed.sql
--
-- Adjust price / stock / image paths to taste. Image paths are relative to the
-- site root — drop the matching files in /images, or upload real photos via the
-- admin portal (which overwrites image_url with an uploaded path).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO products (name, category, price, stock, image_url, images, description, featured) VALUES
(
  'Vijaysar Wood Wellness Glass',
  'wellness',
  599.00,
  50,
  'vijaysar-glass.png',
  '["vijaysar-glass.png","vijaysar-glass-2.png"]',
  'A traditional Ayurvedic tumbler hand-turned from the heartwood of the Vijaysar tree (Pterocarpus marsupium, the Indian Kino tree). Fill it with drinking water at night and let it sit for 8 to 10 hours; by morning the water turns a light brown colour as the wood''s natural bioactive compounds infuse into it. Drink on an empty stomach to support healthy metabolism and blood sugar balance. 100% natural wood — no paints, chemicals or polishes. Replace every 30 to 45 days of regular use. (Traditional wellness product, not a medicine.)',
  1
),
(
  'Neem Wood Comb',
  'wellness',
  199.00,
  100,
  'neem-comb.png',
  '["neem-comb.png","neem-comb-detailes.png"]',
  'Hand-finished comb made from anti-bacterial neem wood. Helps reduce dandruff, soothes an itchy scalp, controls frizz and distributes natural oils through the hair — a chemical-free, static-free alternative to plastic combs.',
  0
),
(
  'Acupressure Wooden Stick',
  'wellness',
  149.00,
  100,
  'acupressure-stick.png',
  '["acupressure-stick.png"]',
  'Hand-held wooden acupressure tool used to stimulate pressure points across the hands, feet and body. Helps ease muscle tension, improve circulation and support everyday relaxation. Crafted from smooth, untreated natural wood.',
  0
);
