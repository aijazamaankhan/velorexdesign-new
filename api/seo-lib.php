<?php
/**
 * Shared SEO helpers for seo-render.php and api/sitemap.php.
 *
 * velorex_slugify() and velorex_route_path() have twins in js/index.js
 * (slugify() and routeToPath()). They must return the same URLs, otherwise
 * the server and the browser would disagree on a page's address.
 */

if (!function_exists('velorex_slugify')) {
    function velorex_slugify($text) {
        $s = strtolower(trim((string) $text));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        $s = trim($s, '-');
        if (strlen($s) > 60) $s = rtrim(substr($s, 0, 60), '-');
        return $s;
    }

    /** Scheme + host of the current request, e.g. https://velorexdesign.com */
    function velorex_base_url() {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $host = preg_replace('/[^a-zA-Z0-9.:-]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
        return ($https ? 'https' : 'http') . '://' . $host;
    }

    function velorex_product_path($id, $name) {
        $slug = velorex_slugify($name);
        return '/product/' . intval($id) . ($slug !== '' ? '-' . $slug : '');
    }

    /** Built-in categories. Extra ones created in the admin panel fall back to a tidied id. */
    function velorex_category_names() {
        return [
            'wood'         => 'Wood Items',
            'rack'         => 'MDF Racks & Shelves',
            'wellness'     => 'Wellness',
            'resin'        => 'Resin Art',
            'soap'         => 'Handmade Soap',
            'candle'       => 'Candles',
            'raw_material' => 'Raw Materials',
        ];
    }

    function velorex_category_name($id) {
        $names = velorex_category_names();
        return $names[$id] ?? ucwords(str_replace(['_', '-'], ' ', (string) $id));
    }

    /** Title and description for the fixed pages. Keep in step with SEO_VIEWS in js/index.js. */
    function velorex_page_meta() {
        return [
            'products' => ['Shop All Handcrafted Products | Velorex Design', 'Browse every Velorex Design product: wood serveware, MDF racks and shelves, resin art, handmade soap, candles and wellness pieces. Buy on Amazon.'],
            'wellness' => ['Velorex Wellness | Vijaysar Glass, Neem Comb & Acupressure', 'Traditional Ayurvedic wood products made by hand: Vijaysar wood glass, neem wood comb and acupressure tools. 100% natural, no paint or polish.'],
            'services' => ['Graphic Design Services | Velorex Design', 'Logo, branding, social media and print design from Velorex Design. Pick a package and message us on WhatsApp.'],
            'about'    => ['About Us | Velorex Design', 'Velorex Design is an Indian workshop making handcrafted wood items, resin art and wellness products.'],
            'process'  => ['How We Make It | Velorex Design', 'How Velorex Design products go from raw wood and resin to a finished, hand-checked piece.'],
            'contact'  => ['Contact Us | Velorex Design', 'Questions about an order or a custom piece? Contact Velorex Design by WhatsApp, phone or email.'],
            'faq'      => ['FAQ | Velorex Design', 'Answers about ordering, payment, shipping, returns and custom work at Velorex Design.'],
            'shipping' => ['Shipping & Delivery | Velorex Design', 'Delivery times and shipping charges for Velorex Design orders across India. Free shipping above ₹999.'],
            'returns'  => ['Returns & Refunds | Velorex Design', 'When and how Velorex Design accepts returns and issues refunds.'],
            'terms'    => ['Terms & Conditions | Velorex Design', 'Terms that apply when you buy from Velorex Design.'],
            'privacy'  => ['Privacy Policy | Velorex Design', 'What personal information Velorex Design collects and how it is used.'],
        ];
    }

    /** Pages that belong to one visitor and must never appear in search results. */
    function velorex_private_pages() {
        return ['cart', 'profile', 'auth'];
    }

    /** First image of a product row, as an absolute URL ('' when it has none). */
    function velorex_product_image($row, $base) {
        $img = trim((string) ($row['image_url'] ?? ''));
        if ($img === '' && !empty($row['images'])) {
            $list = json_decode($row['images'], true);
            if (is_array($list) && !empty($list[0])) $img = trim((string) $list[0]);
        }
        if ($img === '') return '';
        return preg_match('#^https?://#i', $img) ? $img : $base . '/' . ltrim($img, '/');
    }
}
