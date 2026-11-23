<?php
/**
 * Server-side renderer for the shop's real URLs.
 *
 * WHY: search engines index one page per URL. A product at /product/5-vijaysar-glass
 * can rank for its own name; a product that only exists as /#product-detail?id=5
 * cannot, because everything after "#" is never sent to the server.
 *
 * HOW: .htaccess rewrites the pretty URLs onto this file. It serves the SAME
 * index.html shell, but with that page's title, description, canonical URL,
 * link-preview tags and structured data, and with the real content already in
 * the page. The single-page app (js/index.js) then starts and takes over.
 *
 *   /product/5-vijaysar-wood-glass  → ?_route=product&slug=5-vijaysar-wood-glass
 *   /category/wood                  → ?_route=category&cat=wood
 *   /products, /wellness, /about …  → ?_route=page&page=products
 *
 * If a marker this file patches is ever renamed in index.html, the injection
 * simply does nothing and the page still works as a normal app page.
 */

define('VELOREX_SOFT_DB', true);   // a database outage must not break page loads
require_once __DIR__ . '/api/db.php';
require_once __DIR__ . '/api/seo-lib.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');

$base  = velorex_base_url();
$route = $_GET['_route'] ?? '';
$e     = function ($v) { return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); };
$inr   = function ($n) { return '₹' . number_format((float) $n, fmod((float) $n, 1) ? 2 : 0); };

$shell = @file_get_contents(__DIR__ . '/index.html');
if ($shell === false) { http_response_code(500); exit('Storefront shell missing.'); }

// What this page declares about itself. Filled in per route below.
$seo = [
    'title'       => null,           // null = keep the shell's default
    'description' => null,
    'path'        => strtok($_SERVER['REQUEST_URI'] ?? '/', '?'),
    'image'       => $base . '/hero.png',
    'robots'      => 'index, follow, max-image-preview:large',
    'status'      => 200,
];
$jsonLd  = [];   // id => array
$content = '';   // HTML placed inside <main id="app">

$crumbs = function (array $trail) use ($e, $base, &$jsonLd) {
    // $trail: [[label, path|null], …]. The same trail is shown and declared as data.
    $html = '<ul class="breadcrumbs">';
    $items = [];
    foreach ($trail as $i => $c) {
        $last = $i === count($trail) - 1;
        $html .= $last || !$c[1]
            ? '<li class="breadcrumb-item active">' . $e($c[0]) . '</li>'
            : '<li class="breadcrumb-item"><a href="' . $e($c[1]) . '">' . $e($c[0]) . '</a></li>';
        $item = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $c[0]];
        if ($c[1]) $item['item'] = $base . $c[1];
        $items[] = $item;
    }
    $jsonLd['ldBreadcrumbs'] = ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
    return $html . '</ul>';
};

$productSchema = function ($row) use ($base) {
    $img = velorex_product_image($row, $base);
    $data = [
        '@type'       => 'Product',
        'name'        => $row['name'],
        'description' => mb_substr(trim((string) $row['description']), 0, 500),
        'category'    => velorex_category_name($row['category']),
        'brand'       => ['@type' => 'Brand', 'name' => 'Velorex Design'],
    ];
    if ($img !== '') $data['image'] = [$img];   // only a real photo, never a placeholder
    return $data;
};

$listing = function (array $rows) use ($e, $inr, $base) {
    if (!$rows) return '<p>No products here yet. Please check back soon.</p>';
    $html = '<div class="grid">';
    foreach ($rows as $r) {
        $img = velorex_product_image($r, $base);
        $path = velorex_product_path($r['id'], $r['name']);
        $html .= '<div class="product-card"><div class="product-img">'
              . ($img !== '' ? '<a href="' . $e($path) . '"><img src="' . $e($img) . '" alt="' . $e($r['name']) . '" loading="lazy"></a>' : '')
              . '</div><div class="product-info"><div class="product-cat">' . $e(velorex_category_name($r['category'])) . '</div>'
              . '<h3 class="product-title"><a href="' . $e($path) . '">' . $e($r['name']) . '</a></h3>'
              . '</div></div>';
    }
    return $html . '</div>';
};

$fetchProducts = function ($where = '', $types = '', $params = []) use ($conn) {
    if (!$conn) return [];
    $stmt = $conn->prepare('SELECT id, name, category, price, stock, image_url, images, description FROM products ' . $where . ' ORDER BY featured DESC, name ASC LIMIT 200');
    if (!$stmt) return [];
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
};

$wrap = function ($inner) { return '<div class="view active"><section class="section"><div class="container">' . $inner . '</div></section></div>'; };

/* ───────────────────────────── routes ───────────────────────────── */

if ($route === 'product') {
    $slug = (string) ($_GET['slug'] ?? '');
    $row = null;
    if (preg_match('/^(\d+)(?:-.*)?$/', $slug, $m)) {
        $rows = $fetchProducts('WHERE id = ?', 'i', [intval($m[1])]);
        $row = $rows[0] ?? null;
    }
    if ($row) {
        // One address per product: an old or mistyped slug moves to the current one.
        $canonicalPath = velorex_product_path($row['id'], $row['name']);
        if ($seo['path'] !== $canonicalPath) {
            header('Location: ' . $canonicalPath, true, 301);
            exit;
        }
        $catName = velorex_category_name($row['category']);
        $inStock = intval($row['stock']) > 0;
        $desc = trim(preg_replace('/\s+/', ' ', (string) $row['description']));
        $seo['title'] = $row['name'] . ' | Velorex Design';
        $lead = $row['name'] . ' by Velorex Design. ';
        $seo['description'] = mb_substr($lead . ($desc !== '' ? $desc : 'Handcrafted in India by Velorex Design.'), 0, 160);
        $img = velorex_product_image($row, $base);
        if ($img !== '') $seo['image'] = $img;
        // Vijaysar has a designed share banner; use it for link previews.
        if (stripos((string) $row['name'], 'vijaysar') !== false) $seo['image'] = $base . '/images/products/vijaysar/og-vijaysar.jpg';

        $jsonLd['ldProduct'] = ['@context' => 'https://schema.org'] + $productSchema($row);
        $content = $wrap(
            $crumbs([['Home', '/'], ['Catalog', '/products'], [$catName, '/category/' . rawurlencode($row['category'])], [$row['name'], null]])
            . '<div class="detail-grid"><div>' . ($img !== '' ? '<img src="' . $e($img) . '" alt="' . $e($row['name']) . '" style="width:100%; border-radius:16px;">' : '') . '</div>'
            . '<div><h1 class="section-title" style="text-align:left;">' . $e($row['name']) . '</h1>'
            . '<p>' . $e($catName) . '</p>'
            . '<p style="color:var(--text-muted); line-height:1.7;">' . nl2br($e($row['description'])) . '</p></div></div>'
        );
    } else {
        // Unknown product. Built-in starter products have non-numeric ids and are
        // drawn by the app itself, so serve the shell, but keep it out of search.
        $seo['robots'] = 'noindex, follow';
        if (preg_match('/^\d/', $slug)) {
            $seo['status'] = 404;
            $seo['title'] = 'Product not found | Velorex Design';
            $content = $wrap('<h1 class="section-title">Product not found</h1><p>This product is no longer available. <a href="/products">Browse all products</a>.</p>');
        }
    }

} elseif ($route === 'category') {
    $cat = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($_GET['cat'] ?? ''));
    $rows = $cat !== '' ? $fetchProducts('WHERE category = ?', 's', [$cat]) : [];
    $known = array_key_exists($cat, velorex_category_names());
    $name = velorex_category_name($cat);
    if (!$rows && !$known) {
        $seo['status'] = 404;
        $seo['robots'] = 'noindex, follow';
        $seo['title'] = 'Category not found | Velorex Design';
        $content = $wrap('<h1 class="section-title">Category not found</h1><p><a href="/products">Browse all products</a>.</p>');
    } else {
        $seo['title'] = $name . ' | Velorex Design';
        $seo['description'] = 'Shop handcrafted ' . $name . ' from Velorex Design. Made by hand in India, sold on Amazon.';
        // An empty shelf is not worth a place in search results until it is stocked.
        if (!$rows) $seo['robots'] = 'noindex, follow';
        if ($rows) {
            $first = velorex_product_image($rows[0], $base);
            if ($first !== '') $seo['image'] = $first;
            $jsonLd['ldProducts'] = ['@context' => 'https://schema.org', '@type' => 'ItemList', 'name' => $name,
                'itemListElement' => array_map(function ($r, $i) use ($productSchema) { return ['@type' => 'ListItem', 'position' => $i + 1, 'item' => $productSchema($r)]; }, $rows, array_keys($rows))];
        }
        $content = $wrap($crumbs([['Home', '/'], ['Catalog', '/products'], [$name, null]])
            . '<h1 class="section-title" style="text-align:left;">' . $e($name) . '</h1>' . $listing($rows));
    }

} elseif ($route === 'page') {
    $page = preg_replace('/[^a-z-]/', '', (string) ($_GET['page'] ?? ''));
    $meta = velorex_page_meta();
    if (in_array($page, velorex_private_pages(), true)) {
        // Cart, account and login: the app draws them; search engines are told to skip them.
        $seo['robots'] = 'noindex, follow';
        $seo['title'] = ucfirst($page === 'auth' ? 'Sign in' : ($page === 'profile' ? 'My account' : 'Cart')) . ' | Velorex Design';
    } elseif (isset($meta[$page])) {
        $seo['title'] = $meta[$page][0];
        $seo['description'] = $meta[$page][1];
        if ($page === 'wellness') $seo['image'] = $base . '/images/products/vijaysar/og-vijaysar.jpg';
        if ($page === 'products' || $page === 'wellness') {
            $rows = $page === 'wellness' ? $fetchProducts('WHERE category = ?', 's', ['wellness']) : $fetchProducts();
            $label = $page === 'wellness' ? 'Velorex Wellness' : 'Catalog';
            if ($rows) {
                $jsonLd['ldProducts'] = ['@context' => 'https://schema.org', '@type' => 'ItemList', 'name' => $label,
                    'itemListElement' => array_map(function ($r, $i) use ($productSchema) { return ['@type' => 'ListItem', 'position' => $i + 1, 'item' => $productSchema($r)]; }, $rows, array_keys($rows))];
            }
            $content = $wrap($crumbs([['Home', '/'], [$label, null]])
                . '<h1 class="section-title" style="text-align:left;">' . $e($page === 'wellness' ? 'Velorex Wellness' : 'Our Catalog') . '</h1>' . $listing($rows));
        } else {
            // Fixed pages (About, FAQ, policies …): their text already lives in a
            // template inside index.html, so show that same text straight away.
            if (class_exists('DOMDocument')) {
                $dom = new DOMDocument();
                libxml_use_internal_errors(true);
                $dom->loadHTML('<?xml encoding="utf-8"?>' . $shell);
                libxml_clear_errors();
                $node = $dom->getElementById('tpl-' . $page);
                if ($node) {
                    $inner = '';
                    foreach ($node->childNodes as $child) $inner .= $dom->saveHTML($child);
                    $content = '<div class="view active">' . $inner . '</div>';
                }
            }
            $crumbs([['Home', '/'], [explode(' | ', $meta[$page][0])[0], null]]);   // data only
        }
    } else {
        $seo['status'] = 404;
        $seo['robots'] = 'noindex, follow';
        $seo['title'] = 'Page not found | Velorex Design';
        $content = $wrap('<h1 class="section-title">Page not found</h1><p><a href="/">Go to the home page</a> or <a href="/products">browse all products</a>.</p>');
    }

} else {
    $seo['status'] = 404;
    $seo['robots'] = 'noindex, follow';
    $seo['title'] = 'Page not found | Velorex Design';
    $content = $wrap('<h1 class="section-title">Page not found</h1><p><a href="/">Go to the home page</a> or <a href="/products">browse all products</a>.</p>');
}

/* ───────────────────────────── inject into the shell ───────────────────────────── */

http_response_code($seo['status']);

// Sets one attribute on the tag carrying the given id (tags are written id-first in index.html).
$setAttr = function ($html, $id, $attr, $value) use ($e) {
    return preg_replace_callback(
        '/<(meta|link)\b[^>]*\bid="' . preg_quote($id, '/') . '"[^>]*>/s',
        function ($m) use ($attr, $value, $e) {
            return preg_replace('/\b' . $attr . '="[^"]*"/s', $attr . '="' . $e($value) . '"', $m[0], 1);
        },
        $html, 1
    );
};

$canonical = $base . $seo['path'];
if ($seo['title'] !== null) {
    $shell = preg_replace('#<title>.*?</title>#s', '<title>' . $e($seo['title']) . '</title>', $shell, 1);
    $shell = $setAttr($shell, 'ogTitle', 'content', $seo['title']);
}
if ($seo['description'] !== null) {
    $shell = $setAttr($shell, 'metaDescription', 'content', $seo['description']);
    $shell = $setAttr($shell, 'ogDescription', 'content', $seo['description']);
}
$shell = $setAttr($shell, 'ogImage', 'content', $seo['image']);
$shell = $setAttr($shell, 'ogUrl', 'content', $canonical);
$shell = preg_replace('/<meta name="robots" content="[^"]*">/', '<meta name="robots" content="' . $e($seo['robots']) . '">', $shell, 1);

if ($seo['status'] === 200 && strpos($seo['robots'], 'noindex') === false) {
    $shell = $setAttr($shell, 'canonicalLink', 'href', $canonical);
} else {
    // A missing or private page has no canonical address (never point it at the home page).
    $shell = preg_replace('/\s*<link rel="canonical"[^>]*>/', '', $shell, 1);
}

$ld = '';
foreach ($jsonLd as $id => $data) {
    $ld .= '  <script type="application/ld+json" id="' . $e($id) . '">'
        . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP)
        . "</script>\n";
}
if ($ld !== '') $shell = preg_replace('#</head>#', $ld . '</head>', $shell, 1);

if ($content !== '') {
    $shell = preg_replace_callback('#<main id="app"></main>#', function () use ($content) { return '<main id="app">' . $content . '</main>'; }, $shell, 1);
}

echo $shell;
