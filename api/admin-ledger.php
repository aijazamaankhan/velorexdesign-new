<?php
/**
 * Admin: income and expense ledger for the profit and loss view.
 * Records money the site cannot see by itself: Amazon payouts, materials,
 * packaging, courier, ads and so on. Website orders are counted separately
 * from the orders table.
 *
 *   GET                          -> { entries: [...] }  (newest first, max 2000)
 *   POST { action:'add', entry_date, kind, category, note, amount } -> { success, id }
 *   POST { action:'delete', id } -> { success }
 */
require_once 'db.php';
session_start();

if (!admin_session_ok()) sendResponse(['error' => 'Unauthorized'], 401);

try {
    $conn->query("CREATE TABLE IF NOT EXISTS ledger_entries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entry_date DATE NOT NULL,
        kind ENUM('income','expense') NOT NULL,
        category VARCHAR(60) NOT NULL,
        note VARCHAR(200) NULL,
        amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_ledger_date (entry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Throwable $e) {
    error_log('ledger table: ' . $e->getMessage());
    sendResponse(['error' => 'Ledger is unavailable'], 500);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = [];
    $res = $conn->query('SELECT id, entry_date, kind, category, note, amount FROM ledger_entries ORDER BY entry_date DESC, id DESC LIMIT 2000');
    while ($r = $res->fetch_assoc()) {
        $r['id'] = (int) $r['id'];
        $r['amount'] = (float) $r['amount'];
        $rows[] = $r;
    }
    sendResponse(['entries' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) sendResponse(['error' => 'Invalid request'], 422);
$action = $in['action'] ?? '';

if ($action === 'delete') {
    $id = isset($in['id']) && is_numeric($in['id']) ? (int) $in['id'] : 0;
    if ($id <= 0) sendResponse(['error' => 'Entry id required'], 422);
    $st = $conn->prepare('DELETE FROM ledger_entries WHERE id = ?');
    $st->bind_param('i', $id);
    $st->execute();
    sendResponse(['success' => true]);
}

if ($action !== 'add') sendResponse(['error' => 'Unknown action'], 422);

$date = strField($in, 'entry_date', 10);
$kind = $in['kind'] ?? '';
$category = strField($in, 'category', 60);
$note = strField($in, 'note', 200);
$amount = isset($in['amount']) && is_numeric($in['amount']) ? round((float) $in['amount'], 2) : 0;

$errors = [];
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) $errors[] = 'Pick a valid date';
if (!in_array($kind, ['income', 'expense'], true)) $errors[] = 'Choose income or expense';
if ($category === '') $errors[] = 'Choose a category';
if ($amount <= 0 || $amount > 10000000) $errors[] = 'Amount must be more than 0';
if ($errors) sendResponse(['error' => implode('. ', $errors)], 422);

$st = $conn->prepare('INSERT INTO ledger_entries (entry_date, kind, category, note, amount) VALUES (?, ?, ?, ?, ?)');
$st->bind_param('ssssd', $date, $kind, $category, $note, $amount);
if (!$st->execute()) sendResponse(['error' => 'Could not save the entry'], 500);
sendResponse(['success' => true, 'id' => (int) $st->insert_id]);
