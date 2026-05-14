<?php
require_once 'db.php';
session_start();

if (empty($_SESSION['customer_id'])) {
    sendResponse(['error' => 'Not logged in'], 401);
}

$customerId = intval($_SESSION['customer_id']);

$stmt = $conn->prepare('SELECT id, order_code, total_amount, status, shipping_address, shipping_city, shipping_zip, phone, email, tracking_number, admin_note, status_history, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC');
$stmt->bind_param('i', $customerId);
$stmt->execute();
$result = $stmt->get_result();

$orders = [];
while ($row = $result->fetch_assoc()) {
    $orderItems = [];
    $itemStmt = $conn->prepare('SELECT product_id, name, quantity, unit_price FROM order_items WHERE order_id = ?');
    $itemStmt->bind_param('i', $row['id']);
    $itemStmt->execute();
    $itemsResult = $itemStmt->get_result();
    while ($item = $itemsResult->fetch_assoc()) {
        $orderItems[] = [
            'name' => $item['name'],
            'qty' => intval($item['quantity']),
            'price' => floatval($item['unit_price'])
        ];
    }

    $history = [];
    if ($row['status_history']) {
        $history = json_decode($row['status_history'], true) ?: [];
    }

    $orders[] = [
        'id' => $row['order_code'],
        'order_code' => $row['order_code'],
        'status' => $row['status'],
        'total' => floatval($row['total_amount']),
        'date' => $row['created_at'] ? date('M j, Y', strtotime($row['created_at'])) : '',
        'createdAt' => $row['created_at'],
        'address' => [
            'street' => $row['shipping_address'] ?: '',
            'city' => $row['shipping_city'] ?: '',
            'zip' => $row['shipping_zip'] ?: ''
        ],
        'trackingNumber' => $row['tracking_number'] ?: '',
        'adminNote' => $row['admin_note'] ?: '',
        'statusHistory' => $history,
        'items' => $orderItems
    ];
}

sendResponse(['orders' => $orders]);
?>
