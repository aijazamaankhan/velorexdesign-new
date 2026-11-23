<?php
/**
 * Secret entrance to the admin portal.
 *
 * admin.html cannot be opened directly (.htaccess denies it). It is only served
 * from /manage/<key>, where <key> must equal ADMIN_PATH_KEY in the server .env.
 * The key never lives in Git. Anyone with the wrong key gets an ordinary 404,
 * so the address gives nothing away. The admin API still requires a login.
 */

$key = '';
foreach ([__DIR__ . '/.env', __DIR__ . '/api/.env'] as $envFile) {
    if (!is_readable($envFile)) continue;
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*ADMIN_PATH_KEY\s*=\s*["\']?([A-Za-z0-9_-]+)["\']?\s*$/', $line, $m)) {
            $key = $m[1];
        }
    }
    break;
}
if ($key === '') $key = (string) getenv('ADMIN_PATH_KEY');

$given = isset($_GET['k']) && is_string($_GET['k']) ? $_GET['k'] : '';

// A short key is too easy to guess, so the gate stays shut until a long one is set.
if (strlen($key) < 24 || !hash_equals($key, $given)) {
    usleep(300000); // slows down anyone trying keys
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>Not found</title><h1>Not found</h1>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer'); // keeps the secret address out of other sites' logs
// The page is served from /manage/<key>, so point relative css/js/api paths at the site root.
$html = file_get_contents(__DIR__ . '/admin.html');
echo preg_replace('/<head>/i', "<head>\n    <base href=\"/\">", $html, 1);
