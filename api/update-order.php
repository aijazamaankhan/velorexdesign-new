<?php
require_once 'db.php';
require_once 'marketing-lib.php';
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

$orderCode = trim((string) $input['order_code']);
$allowedStatus = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
if (isset($input['status']) && !in_array($input['status'], $allowedStatus, true)) {
    sendResponse(['error' => 'Unknown status'], 422);
}
$oldStatus = null;
$cur = $conn->prepare('SELECT status FROM orders WHERE order_code = ?');
$cur->bind_param('s', $orderCode);
$cur->execute();
$curRow = $cur->get_result()->fetch_assoc();
if (!$curRow) sendResponse(['error' => 'Order not found'], 404);
$oldStatus = $curRow['status'];
marketing_ensure_tables($conn);
$fields = [];
$params = [];
$types = '';

if (isset($input['status'])) {
    $fields[] = 'status = ?';
    $types .= 's';
    $params[] = trim($input['status']);
}
if (isset($input['tracking_number'])) {
    $fields[] = 'tracking_number = ?';
    $types .= 's';
    $params[] = trim($input['tracking_number']);
}
if (isset($input['admin_note'])) {
    $fields[] = 'admin_note = ?';
    $types .= 's';
    $params[] = trim($input['admin_note']);
}

if (isset($input['status'])) {
    $item = ['status' => trim($input['status']), 'timestamp' => date('Y-m-d H:i:s')];
    $statusStmt = $conn->prepare('SELECT status_history FROM orders WHERE order_code = ?');
    $statusStmt->bind_param('s', $orderCode);
    $statusStmt->execute();
    $statusResult = $statusStmt->get_result();
    if ($statusResult->num_rows === 1) {
        $row = $statusResult->fetch_assoc();
        $history = json_decode($row['status_history'], true) ?: [];
        $history[] = $item;
        $fields[] = 'status_history = ?';
        $types .= 's';
        $params[] = json_encode($history);
    }
}

if (empty($fields)) {
    sendResponse(['error' => 'No update fields provided'], 422);
}

$fields[] = 'updated_at = NOW()';
$query = 'UPDATE orders SET ' . implode(', ', $fields) . ' WHERE order_code = ?';
$types .= 's';
$params[] = $orderCode;

$updateStmt = $conn->prepare($query);
$updateStmt->bind_param($types, ...$params);
if (!$updateStmt->execute()) {
    sendResponse(['error' => 'Failed to update order'], 500);
}

if (isset($input['status'])) {
    try {
        marketing_on_status_change($conn, $orderCode, (string) $oldStatus, (string) $input['status']);
    } catch (Throwable $e) {
        error_log('loyalty/coupon status hook failed for ' . $orderCode . ': ' . $e->getMessage());
    }
}

sendResponse(['success' => true]);
?>