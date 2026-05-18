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
if (!$input) $input = $_POST;

$id = isset($input['id']) ? intval($input['id']) : 0;
if ($id <= 0) {
    sendResponse(['error' => 'Customer id is required'], 422);
}

// Confirm the customer exists before issuing the delete so we can return 404.
$check = $conn->prepare('SELECT id FROM customers WHERE id = ? LIMIT 1');
$check->bind_param('i', $id);
$check->execute();
if ($check->get_result()->num_rows === 0) {
    sendResponse(['error' => 'Customer not found'], 404);
}

// customer_addresses cascades on customer delete; orders.customer_id is ON DELETE SET NULL,
// so past orders are preserved but become "Guest".
$stmt = $conn->prepare('DELETE FROM customers WHERE id = ?');
$stmt->bind_param('i', $id);
if (!$stmt->execute()) {
    sendResponse(['error' => 'Failed to delete customer: ' . $stmt->error], 500);
}

sendResponse(['success' => true, 'id' => $id]);
?>
