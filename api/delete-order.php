<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['order_code'])) {
    sendResponse(['error' => 'Order code is required'], 422);
}

$orderCode = trim($input['order_code']);

$stmt = $conn->prepare('DELETE FROM orders WHERE order_code = ?');
$stmt->bind_param('s', $orderCode);

if (!$stmt->execute()) {
    sendResponse(['error' => 'Failed to delete order'], 500);
}

if ($stmt->affected_rows === 0) {
    sendResponse(['error' => 'Order not found'], 404);
}

sendResponse(['success' => true]);
?>
