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

/**
 * Returns the set of columns that exist on $table so the SELECT we build
 * below never references a column added by a later migration. This lets the
 * endpoint work on databases that have not yet run api/setup.php after the
 * customer-addresses / password_hash / updated_at migrations.
 */
function table_columns($conn, $table) {
    $cols = [];
    $res = $conn->query('SHOW COLUMNS FROM ' . $table);
    if (!$res) return $cols;
    while ($row = $res->fetch_assoc()) {
        $cols[$row['Field']] = true;
    }
    return $cols;
}

function pick($row, $col, $default = null) {
    return array_key_exists($col, $row) ? $row[$col] : $default;
}

$custCols = table_columns($conn, 'customers');
$addrCols = table_columns($conn, 'customer_addresses');
$ordCols  = table_columns($conn, 'orders');

// Build a defensive SELECT for the customer record.
$wantCust = array_intersect(
    ['id', 'name', 'email', 'phone', 'created_at', 'updated_at', 'password_hash'],
    array_keys($custCols)
);
$selectCust = 'SELECT ' . implode(', ', $wantCust) . ' FROM customers WHERE id = ? LIMIT 1';
$stmt = $conn->prepare($selectCust);
if (!$stmt) {
    sendResponse(['error' => 'Customer query failed', 'detail' => $conn->error], 500);
}
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 0) {
    sendResponse(['error' => 'Customer not found'], 404);
}
$row = $res->fetch_assoc();

$pwHash = pick($row, 'password_hash', '');
$customer = [
    'id'          => intval($row['id']),
    'name'        => pick($row, 'name'),
    'email'       => pick($row, 'email'),
    'phone'       => pick($row, 'phone'),
    'has_account' => $pwHash !== null && $pwHash !== '',
    'created_at'  => pick($row, 'created_at'),
    'updated_at'  => pick($row, 'updated_at')
];

// Addresses — only select the columns this DB actually has.
$addresses = [];
if ($addrCols) {
    $wantAddr = array_intersect(
        ['id', 'title', 'full_name', 'phone', 'street', 'line2', 'landmark', 'city', 'state', 'zip', 'country', 'is_default', 'created_at'],
        array_keys($addrCols)
    );
    $orderBy = isset($addrCols['is_default']) ? 'is_default DESC, id ASC' : 'id ASC';
    $selectAddr = 'SELECT ' . implode(', ', $wantAddr) . ' FROM customer_addresses WHERE customer_id = ? ORDER BY ' . $orderBy;
    $addrStmt = $conn->prepare($selectAddr);
    if ($addrStmt) {
        $addrStmt->bind_param('i', $id);
        $addrStmt->execute();
        $addrRes = $addrStmt->get_result();
        while ($a = $addrRes->fetch_assoc()) {
            $addresses[] = [
                'id'         => intval($a['id']),
                'title'      => pick($a, 'title'),
                'full_name'  => pick($a, 'full_name'),
                'phone'      => pick($a, 'phone'),
                'street'     => pick($a, 'street'),
                'line2'      => pick($a, 'line2'),
                'landmark'   => pick($a, 'landmark'),
                'city'       => pick($a, 'city'),
                'state'      => pick($a, 'state'),
                'zip'        => pick($a, 'zip'),
                'country'    => pick($a, 'country'),
                'is_default' => (bool) pick($a, 'is_default', 0),
                'created_at' => pick($a, 'created_at')
            ];
        }
    }
}

// Orders + aggregate spend.
$orders = [];
$total_spent = 0.0;
if ($ordCols && isset($ordCols['customer_id'])) {
    $ordStmt = $conn->prepare('SELECT id, order_code, total_amount, status, created_at
                               FROM orders WHERE customer_id = ? ORDER BY created_at DESC');
    if ($ordStmt) {
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
    }
}

sendResponse([
    'customer'    => $customer,
    'addresses'   => $addresses,
    'orders'      => $orders,
    'total_spent' => $total_spent
]);
?>
