<?php
/**
 * Admin: block or unblock a customer's login.
 *   POST { id, blocked: true|false } -> { success, blocked }
 * A blocked customer cannot sign in and is signed out on their next visit.
 * Their orders and addresses are kept.
 */
require_once 'db.php';
session_start();

if (!admin_session_ok()) sendResponse(['error' => 'Unauthorized'], 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);

$in = json_decode(file_get_contents('php://input'), true);
$id = is_array($in) && isset($in['id']) && is_numeric($in['id']) ? (int) $in['id'] : 0;
$blocked = !empty($in['blocked']) ? 1 : 0;
if ($id <= 0) sendResponse(['error' => 'Customer id required'], 422);

try {
    $conn->query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0');
} catch (Throwable $e) {
    error_log('is_blocked column: ' . $e->getMessage());
    sendResponse(['error' => 'Could not update the customer'], 500);
}
$st = $conn->prepare('UPDATE customers SET is_blocked = ? WHERE id = ?');
$st->bind_param('ii', $blocked, $id);
$st->execute();
sendResponse(['success' => true, 'blocked' => (bool) $blocked]);
