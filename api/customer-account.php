<?php
/**
 * Signed-in customer: change password or delete the account.
 *   POST { action: 'password', current_password, new_password }
 *   POST { action: 'delete', password }
 * Both need the current password. Deleting removes the account and saved
 * addresses; past orders stay on record without the account link
 * (orders.customer_id is set to NULL by the foreign key).
 */
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
if (empty($_SESSION['customer_id'])) sendResponse(['error' => 'Please sign in again'], 401);
$customerId = (int) $_SESSION['customer_id'];

rateLimitCheck('customer-account', 8, 900);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) sendResponse(['error' => 'Invalid request'], 422);
$action = $in['action'] ?? '';
$current = isset($in['current_password']) && is_string($in['current_password']) ? $in['current_password']
         : (isset($in['password']) && is_string($in['password']) ? $in['password'] : '');

$st = $conn->prepare('SELECT password_hash FROM customers WHERE id = ? LIMIT 1');
$st->bind_param('i', $customerId);
$st->execute();
$row = $st->get_result()->fetch_assoc();
if (!$row || empty($row['password_hash']) || !password_verify($current, $row['password_hash'])) {
    rateLimitHit('customer-account', 900);
    sendResponse(['error' => 'Your current password is not correct'], 401);
}

if ($action === 'password') {
    $new = isset($in['new_password']) && is_string($in['new_password']) ? $in['new_password'] : '';
    if (strlen($new) < 8 || strlen($new) > 200) sendResponse(['error' => 'New password must be 8 to 200 characters'], 422);
    if (password_verify($new, $row['password_hash'])) sendResponse(['error' => 'Choose a password different from the current one'], 422);
    $hash = password_hash($new, PASSWORD_BCRYPT);
    $u = $conn->prepare('UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE id = ?');
    $u->bind_param('si', $hash, $customerId);
    if (!$u->execute()) sendResponse(['error' => 'Could not change the password'], 500);
    session_regenerate_id(true);
    sendResponse(['success' => true]);
}

if ($action === 'delete') {
    $conn->begin_transaction();
    try {
        $a = $conn->prepare('DELETE FROM customer_addresses WHERE customer_id = ?');
        $a->bind_param('i', $customerId);
        $a->execute();
        $o = $conn->prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?');
        $o->bind_param('i', $customerId);
        $o->execute();
        $d = $conn->prepare('DELETE FROM customers WHERE id = ?');
        $d->bind_param('i', $customerId);
        $d->execute();
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        error_log('customer delete failed: ' . $e->getMessage());
        sendResponse(['error' => 'Could not delete the account. Please contact us.'], 500);
    }
    $_SESSION = [];
    session_destroy();
    sendResponse(['success' => true]);
}

sendResponse(['error' => 'Unknown action'], 422);
