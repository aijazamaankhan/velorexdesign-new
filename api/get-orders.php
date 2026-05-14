<?php
require_once 'db.php';
session_start();

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

$search = isset($_GET['search']) ? sanitize($_GET['search']) : '';
$status = isset($_GET['status']) ? sanitize($_GET['status']) : '';

$query = 'SELECT o.id, o.order_code, o.customer_id, o.total_amount, o.status, o.shipping_address, o.shipping_city, o.shipping_zip, o.phone, o.email, o.tracking_number, o.admin_note, o.status_history, o.created_at, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM orders o LEFT JOIN customers c ON o.customer_id = c.id';
$where = [];
$params = [];
$types = '';

if ($search) {
    $where[] = '(o.order_code LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR o.status LIKE ?)';
    $types .= 'ssss';
    $params[] = "%{$search}%";
    $params[] = "%{$search}%";
    $params[] = "%{$search}%";
    $params[] = "%{$search}%";
}

if ($status && $status !== 'all') {
    $where[] = 'o.status = ?';
    $types .= 's';
    $params[] = $status;
}

if ($where) {
    $query .= ' WHERE ' . implode(' AND ', $where);
}

$query .= ' ORDER BY o.created_at DESC';
$stmt = $conn->prepare($query);
if ($params) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$orders = [];
while ($row = $result->fetch_assoc()) {
    $orderItems = [];
    $itemStmt = $conn->prepare('SELECT product_id, name, quantity, unit_price, total_price FROM order_items WHERE order_id = ?');
    $itemStmt->bind_param('i', $row['id']);
    $itemStmt->execute();
    $itemsResult = $itemStmt->get_result();
    while ($item = $itemsResult->fetch_assoc()) {
        $orderItems[] = $item;
    }

    $history = [];
    if ($row['status_history']) {
        $history = json_decode($row['status_history'], true) ?: [];
    }

    $orders[] = [
        'id' => $row['order_code'],
        'db_id' => intval($row['id']),
        'order_code' => $row['order_code'],
        'customer_name' => $row['customer_name'] ?: 'Guest',
        'customer_email' => $row['customer_email'],
        'customer_phone' => $row['customer_phone'],
        'status' => $row['status'],
        'total' => floatval($row['total_amount']),
        'shipping_address' => $row['shipping_address'],
        'shipping_city' => $row['shipping_city'],
        'shipping_zip' => $row['shipping_zip'],
        'tracking_number' => $row['tracking_number'],
        'admin_note' => $row['admin_note'],
        'status_history' => $history,
        'items' => $orderItems,
        'created_at' => $row['created_at']
    ];
}

sendResponse(['orders' => $orders]);
?>
