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
        echo json_encode([
            'error' => 'Server error',
            'detail' => $err['message']
        ]);
    }
});

$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Database connection failed',
        'hint'  => 'Create a .env file in the project root (next to index.html) with your DB credentials, then visit api/setup.php once.'
    ]);
    exit();
}

$conn->set_charset('utf8mb4');

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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
