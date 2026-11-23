<?php
/** Admin: loyalty settings, member balances, and manual point adjustments. */
require_once 'db.php';
require_once 'marketing-lib.php';
session_start();

if (empty($_SESSION['admin_id'])) sendResponse(['error' => 'Unauthorized'], 401);
if (!marketing_ensure_tables($conn)) sendResponse(['error' => 'Loyalty tables could not be created'], 500);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $members = [];
    $res = $conn->query('SELECT c.id, c.name, c.email, SUM(l.points) AS balance, MAX(l.created_at) AS last_activity
                         FROM loyalty_ledger l JOIN customers c ON c.id = l.customer_id
                         GROUP BY c.id, c.name, c.email ORDER BY balance DESC LIMIT 100');
    while ($r = $res->fetch_assoc()) {
        $r['id'] = (int) $r['id'];
        $r['balance'] = (int) $r['balance'];
        $members[] = $r;
    }
    $tot = $conn->query("SELECT COALESCE(SUM(CASE WHEN points > 0 AND kind IN ('earn','bonus','adjust') THEN points END),0) AS issued,
                                COALESCE(-SUM(CASE WHEN kind = 'redeem' THEN points END),0) AS redeemed,
                                COALESCE(SUM(points),0) AS outstanding FROM loyalty_ledger")->fetch_assoc();
    sendResponse(['config' => loyalty_config($conn), 'members' => $members, 'totals' => array_map('intval', $tot)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) sendResponse(['error' => 'Invalid request'], 422);
$action = $in['action'] ?? '';

if ($action === 'save-config') {
    [$cfg, $errors] = loyalty_validate_config($in['config'] ?? null);
    if (!$cfg) sendResponse(['error' => implode('. ', array_values($errors))], 422);
    if (!loyalty_save_config($conn, $cfg)) sendResponse(['error' => 'Could not save settings'], 500);
    sendResponse(['success' => true, 'config' => loyalty_config($conn)]);
}

if ($action === 'adjust') {
    $email = strtolower(strField($in, 'email', 150));
    $points = isset($in['points']) && is_numeric($in['points']) ? (int) $in['points'] : 0;
    $note = strField($in, 'note', 200);
    if ($points === 0 || abs($points) > 100000) sendResponse(['error' => 'Points must be a non-zero number up to 100000'], 422);
    if ($note === '') sendResponse(['error' => 'Add a short reason'], 422);
    $st = $conn->prepare('SELECT id FROM customers WHERE email = ? AND password_hash IS NOT NULL LIMIT 1');
    $st->bind_param('s', $email);
    $st->execute();
    $c = $st->get_result()->fetch_assoc();
    if (!$c) sendResponse(['error' => 'No registered customer with that email'], 404);
    $cid = (int) $c['id'];
    if ($points < 0 && loyalty_balance($conn, $cid, null, false) + $points < 0) sendResponse(['error' => 'That would make the balance negative'], 422);
    loyalty_add($conn, $cid, $points, 'adjust', null, $note, 'admin');
    sendResponse(['success' => true, 'balance' => loyalty_balance($conn, $cid, null, false)]);
}

sendResponse(['error' => 'Unknown action'], 422);
