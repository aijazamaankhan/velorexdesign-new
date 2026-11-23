<?php
/**
 * robots.txt, served at /robots.txt through a rewrite in the root .htaccess.
 * Built here so the Sitemap line always carries the real domain.
 */
header('Content-Type: text/plain; charset=UTF-8');
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$host = preg_replace('/[^a-zA-Z0-9.:-]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$base = ($https ? 'https' : 'http') . '://' . $host;

echo "User-agent: *\n";
echo "Allow: /\n";
// Keep the admin panel and private endpoints out of search results. The product
// list and product photos stay open: Google needs them to render the shop.
echo "Disallow: /api/\n";
echo "Allow: /api/get-products.php\n";
echo "Allow: /api/uploads/\n";
echo "\nSitemap: {$base}/sitemap.xml\n";
