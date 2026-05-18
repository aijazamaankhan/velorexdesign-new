<?php
require_once 'db.php';
session_start();

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    sendResponse(['error' => 'Customer id is required'], 422);
}

$stmt = $conn->prepare('SELECT id, name, email, phone, created_at, updated_at,
                              (password_hash IS NOT NULL AND password_hash <> "") AS has_account
                       FROM customers WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 0) {
    sendResponse(['error' => 'Customer not found'], 404);
}
$row = $res->fetch_assoc();
$customer = [
    'id'          => intval($row['id']),
    'name'        => $row['name'],
    'email'       => $row['email'],
    'phone'       => $row['phone'],
    'has_account' => (bool) $row['has_account'],
    'created_at'  => $row['created_at'],
    'updated_at'  => $row['updated_at']
];

// Addresses
$addresses = [];
$addrStmt = $conn->prepare('SELECT id, title, full_name, phone, street, line2, landmark, city, state, zip, country, is_default, created_at
                            FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id ASC');
$addrStmt->bind_param('i', $id);
$addrStmt->execute();
$addrRes = $addrStmt->get_result();
while ($a = $addrRes->fetch_assoc()) {
    $addresses[] = [
        'id'         => intval($a['id']),
        'title'      => $a['title'],
        'full_name'  => $a['full_name'],
        'phone'      => $a['phone'],
        'street'     => $a['street'],
        'line2'      => $a['line2'],
        'landmark'   => $a['landmark'],
        'city'       => $a['city'],
        'state'      => $a['state'],
        'zip'        => $a['zip'],
        'country'    => $a['country'],
        'is_default' => (bool) $a['is_default'],
        'created_at' => $a['created_at']
    ];
}

// Orders + aggregates
$orders = [];
$total_spent = 0.0;
$ordStmt = $conn->prepare('SELECT id, order_code, total_amount, status, created_at
                           FROM orders WHERE customer_id = ? ORDER BY created_at DESC');
$ordStmt->bind_param('i', $id);
$ordStmt->execute();
$ordRes = $ordStmt->get_result();
while ($o = $ordRes->fetch_assoc()) {
    $orders[] = [
        'id'           => intval($o['id']),
        'order_code'   => $o['order_code'],
        'total_amount' => floatval($o['total_amount']),
        'status'       => $o['status'],
        'created_at'   => $o['created_at']
    ];
    $total_spent += floatval($o['total_amount']);
}

sendResponse([
    'customer'    => $customer,
    'addresses'   => $addresses,
    'orders'      => $orders,
    'total_spent' => $total_spent
]);
?>
