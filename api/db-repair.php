<?php
/**
 * ONE-TIME database repair for the live site (24 November 2026).
 * Creates the storefront tables that are missing, the first admin, and the
 * starter products when the products table is empty. Leaves every other
 * table (including the *_old_backup tables) untouched.
 *
 * Locked to POST + the ADMIN_PATH_KEY from the server .env. Remove this file
 * after it has run.
 */
require_once 'db.php';
require_once 'marketing-lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Not found'], 404);
rateLimitCheck('db-repair', 5, 3600);
rateLimitHit('db-repair', 3600);

$in = json_decode(file_get_contents('php://input'), true);
$key = (string) (getenv('ADMIN_PATH_KEY') ?: ($_ENV['ADMIN_PATH_KEY'] ?? ''));
$given = is_array($in) && is_string($in['key'] ?? null) ? $in['key'] : '';
if (strlen($key) < 24 || !hash_equals($key, $given)) sendResponse(['error' => 'Not found'], 404);

$adminUser = is_string($in['admin_user'] ?? null) ? trim($in['admin_user']) : '';
$adminPass = is_string($in['admin_password'] ?? null) ? $in['admin_password'] : '';

$report = [];
$runFile = function ($file) use ($conn, &$report) {
    $sql = @file_get_contents(__DIR__ . '/../' . $file);
    if ($sql === false) { $report[] = "$file: missing"; return false; }
    try {
        if (!$conn->multi_query($sql)) { $report[] = "$file: " . $conn->error; return false; }
        do { if ($r = $conn->store_result()) $r->free(); } while ($conn->more_results() && $conn->next_result());
        if ($conn->errno) { $report[] = "$file: " . $conn->error; return false; }
    } catch (Throwable $e) {
        while ($conn->more_results() && @$conn->next_result()) {}
        $report[] = "$file: " . $e->getMessage();
        return false;
    }
    $report[] = "$file: ok";
    return true;
};
$count = function ($table) use ($conn) {
    try { return (int) $conn->query("SELECT COUNT(*) AS n FROM `$table`")->fetch_assoc()['n']; } catch (Throwable $e) { return -1; }
};

// 1. Tables (CREATE TABLE IF NOT EXISTS only; the admin line in the file is a comment).
$runFile('database-schema.sql');

// 2. Columns older copies of these tables may lack.
$alters = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT NULL",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS featured TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history TEXT NULL",
];
foreach ($alters as $q) { try { $conn->query($q); } catch (Throwable $e) { $report[] = 'alter: ' . $e->getMessage(); } }
marketing_ensure_tables($conn);

// 3. First admin, only if there is none.
if ($count('admins') === 0) {
    if ($adminUser === '' || strlen($adminPass) < 8) {
        $report[] = 'admin: skipped (send admin_user and an 8+ character admin_password)';
    } else {
        $hash = password_hash($adminPass, PASSWORD_BCRYPT);
        $name = 'Owner';
        $st = $conn->prepare('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)');
        $st->bind_param('sss', $name, $adminUser, $hash);
        $report[] = $st->execute() ? "admin: created '$adminUser'" : 'admin: failed';
    }
} else {
    $report[] = 'admin: already exists, unchanged';
}

// 4. Starter products, only into an empty table (re-running cannot duplicate).
if ($count('products') === 0) {
    $runFile('wellness-seed.sql');
    $runFile('catalog-seed.sql');
}
$runFile('wellness-update.sql');

sendResponse([
    'success' => true,
    'report' => $report,
    'counts' => ['admins' => $count('admins'), 'products' => $count('products'), 'customers' => $count('customers'), 'orders' => $count('orders')],
]);
