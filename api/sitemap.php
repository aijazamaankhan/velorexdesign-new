<?php
/**
 * sitemap.xml, served at /sitemap.xml through a rewrite in the root .htaccess.
 * Built live from the database, so a new product is listed as soon as it is added.
 *
 * It lists only pages that seo-render.php marks as indexable: the home page,
 * the fixed pages, categories that have products, and every product. Cart,
 * account and login are left out on purpose.
 */
require_once 'db.php';
require_once 'seo-lib.php';
header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=3600');

$base = velorex_base_url();
$x = function ($v) { return htmlspecialchars((string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8'); };

$products = [];
try { $res = $conn->query('SELECT id, name, category, image_url, images, updated_at FROM products ORDER BY id ASC LIMIT 5000'); } catch (Throwable $e) { $res = false; }
if ($res) {
    while ($row = $res->fetch_assoc()) $products[] = $row;
}

// The date written is always a real "last changed" date, never today's date by default.
$day = function ($ts) { return $ts ? date('Y-m-d', strtotime($ts)) : null; };
$latest = null;
$catLatest = [];
foreach ($products as $p) {
    $d = $day($p['updated_at']);
    if ($d && (!$latest || $d > $latest)) $latest = $d;
    if ($d && (empty($catLatest[$p['category']]) || $d > $catLatest[$p['category']])) $catLatest[$p['category']] = $d;
    if (!isset($catLatest[$p['category']])) $catLatest[$p['category']] = null;
}

$url = function ($path, $lastmod = null, $image = null) use ($base, $x) {
    echo "  <url>\n    <loc>{$x($base . $path)}</loc>\n";
    if ($lastmod) echo "    <lastmod>{$lastmod}</lastmod>\n";
    if ($image) echo "    <image:image><image:loc>{$x($image[0])}</image:loc><image:title>{$x($image[1])}</image:title></image:image>\n";
    echo "  </url>\n";
};

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

$url('/', $latest);
$url('/products', $latest);
if (array_key_exists('wellness', $catLatest)) $url('/wellness', $catLatest['wellness']);
foreach ($catLatest as $cat => $d) {
    if (preg_match('/^[A-Za-z0-9_-]+$/', (string) $cat)) $url('/category/' . $cat, $d);
}
foreach ($products as $p) {
    $img = velorex_product_image($p, $base);
    $url(velorex_product_path($p['id'], $p['name']), $day($p['updated_at']), $img !== '' ? [$img, $p['name']] : null);
}
foreach (['about', 'process', 'services', 'contact', 'faq', 'shipping', 'returns', 'terms', 'privacy'] as $page) {
    $url('/' . $page);
}

echo "</urlset>\n";
