<?php
require_once 'db.php';
session_start();

if (empty($_SESSION['customer_id'])) {
    sendResponse(['authenticated' => false]);
}

$customerId = intval($_SESSION['customer_id']);
$stmt = $conn->prepare('SELECT id, name, email, phone FROM customers WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $customerId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    // Row was removed; treat as logged out.
    unset($_SESSION['customer_id'], $_SESSION['customer_email'], $_SESSION['customer_name']);
    sendResponse(['authenticated' => false]);
}

$c = $result->fetch_assoc();

sendResponse([
    'authenticated' => true,
    'user' => [
        'id' => intval($c['id']),
        'name' => $c['name'],
        'email' => $c['email'],
        'phone' => $c['phone'] ?: ''
    ]
]);
?>
