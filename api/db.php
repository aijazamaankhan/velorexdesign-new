<?php
/**
 * Database Connection — Velorex Design
 *
 * Configuration order:
 *   1. Environment variables (DB_HOST, DB_USER, DB_PASS, DB_NAME)
 *   2. .env file — checked in the project root first (../.env), then in api/.env
 *      for backward compatibility. KEY=VALUE per line, blocked from public access
 *      by the project-root .htaccess (and api/.htaccess if it lives there).
 *   3. Defaults below (override these for production)
 *
 * On Hostinger, create a .env file next to index.html with your DB credentials.
 */

$envCandidates = [
    __DIR__ . '/../.env',  // project root — preferred location
    __DIR__ . '/.env',     // legacy location (kept for backward compatibility)
];
foreach ($envCandidates as $envFile) {
    if (!file_exists($envFile)) continue;
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        list($k, $v) = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if (strlen($v) >= 2 && (($v[0] === '"' && substr($v, -1) === '"') || ($v[0] === "'" && substr($v, -1) === "'"))) {
            $v = substr($v, 1, -1);
        }
        if (!isset($_ENV[$k])) $_ENV[$k] = $v;
    }
    break; // first file found wins
}

if (!defined('DB_HOST')) define('DB_HOST', getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? 'localhost'));
if (!defined('DB_USER')) define('DB_USER', getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? 'root'));
if (!defined('DB_PASS')) define('DB_PASS', getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? ''));
if (!defined('DB_NAME')) define('DB_NAME', getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? 'velorex_design'));

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// Ensure clients always get JSON — even on fatal errors when display_errors is off.
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
        }
        // Details go to error.log only. Sending them to the browser would expose
        // file paths, the DB user and stack traces to anyone who can trigger an error.
        echo json_encode(['error' => 'Server error']);
    }
});

header('X-Content-Type-Options: nosniff');
// seo-render.php defines VELOREX_SOFT_DB: it serves cacheable HTML pages and must
// keep working (without product data) even if the database is unreachable.
$softDb = defined('VELOREX_SOFT_DB');
if (!$softDb) header('Cache-Control: no-store');

// Session cookie hardening. Every endpoint includes this file before calling
// session_start(), so these settings apply to all of them.
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
ini_set('session.use_strict_mode', 1);
ini_set('session.use_only_cookies', 1);
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);

// CSRF defence: a state-changing request must come from this site. Browsers
// always send Origin on cross-site POSTs, so a mismatch means another site is
// trying to act with the visitor's session.
if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['POST', 'PUT', 'PATCH', 'DELETE'], true)
    && !empty($_SERVER['HTTP_ORIGIN'])) {
    $o = parse_url($_SERVER['HTTP_ORIGIN']);
    $originHost = strtolower(($o['host'] ?? '') . (isset($o['port']) ? ':' . $o['port'] : ''));
    if ($originHost !== strtolower($_SERVER['HTTP_HOST'] ?? '')) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Cross-site request blocked']);
        exit();
    }
}

$connectError = null;
try {
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $connectError = $conn->connect_error;
} catch (Throwable $e) {
    $connectError = $e->getMessage();
}

if ($connectError && $softDb) {
    error_log('DB connection failed (page still served): ' . $connectError);
    $conn = null;
} elseif ($connectError) {
    error_log('DB connection failed: ' . $connectError);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database connection failed']);
    exit();
}

if ($conn) $conn->set_charset('utf8mb4');

if (!function_exists('sanitize')) {
    function sanitize($data) {
        global $conn;
        return $conn->real_escape_string(htmlspecialchars(strip_tags($data)));
    }
}

if (!function_exists('sendResponse')) {
    function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit();
    }
}

/* Rate limiting.
 * Small file-based limiter keyed by bucket + client IP, so it needs no extra
 * database table. Used to slow down password guessing and order spam.
 */
if (!function_exists('rateLimitFile')) {
    function rateLimitFile($bucket) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        return sys_get_temp_dir() . '/velorex_rl_' . hash('sha256', $bucket . '|' . $ip) . '.json';
    }
    function rateLimitHits($bucket, $windowSec) {
        $data = @json_decode((string) @file_get_contents(rateLimitFile($bucket)), true);
        if (!is_array($data)) return [];
        $cutoff = time() - $windowSec;
        return array_values(array_filter($data, function ($t) use ($cutoff) { return is_int($t) && $t > $cutoff; }));
    }
    /** Stops the request with HTTP 429 once $max hits were recorded inside the window. */
    function rateLimitCheck($bucket, $max, $windowSec) {
        if (count(rateLimitHits($bucket, $windowSec)) >= $max) {
            header('Retry-After: ' . $windowSec);
            sendResponse(['error' => 'Too many attempts. Please wait a few minutes and try again.'], 429);
        }
    }
    function rateLimitHit($bucket, $windowSec) {
        $hits = rateLimitHits($bucket, $windowSec);
        $hits[] = time();
        @file_put_contents(rateLimitFile($bucket), json_encode($hits), LOCK_EX);
    }
    function rateLimitClear($bucket) {
        @unlink(rateLimitFile($bucket));
    }
}

/* Admin sessions last at most 8 hours from login (same as velorexmusic.com's
   admin tickets). After that every admin endpoint answers 401 and the admin
   logs in again. Call after session_start(). */
if (!defined('ADMIN_SESSION_HOURS')) define('ADMIN_SESSION_HOURS', 8);
if (!function_exists('admin_session_ok')) {
    function admin_session_ok() {
        if (empty($_SESSION['admin_id'])) return false;
        $at = isset($_SESSION['admin_login_at']) ? (int) $_SESSION['admin_login_at'] : 0;
        if ($at <= 0 || time() - $at > ADMIN_SESSION_HOURS * 3600) {
            unset($_SESSION['admin_id'], $_SESSION['admin_email'], $_SESSION['admin_name'], $_SESSION['admin_login_at']);
            return false;
        }
        return true;
    }
}

/** True when the admin has blocked this customer (column may not exist yet). */
if (!function_exists('customer_is_blocked')) {
    function customer_is_blocked($conn, $id) {
        try {
            $st = $conn->prepare('SELECT is_blocked FROM customers WHERE id = ? LIMIT 1');
            if (!$st) return false;
            $st->bind_param('i', $id);
            $st->execute();
            $r = $st->get_result()->fetch_assoc();
            return $r && !empty($r['is_blocked']);
        } catch (Throwable $e) {
            return false; // column not added yet: nobody is blocked
        }
    }
}

/** Reads a request field as a trimmed string, capped in length. Non-strings become ''. */
if (!function_exists('strField')) {
    function strField($source, $key, $maxLen = 255) {
        if (!is_array($source) || !isset($source[$key]) || !is_scalar($source[$key])) return '';
        return substr(trim((string) $source[$key]), 0, $maxLen);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
