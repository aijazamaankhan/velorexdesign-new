<?php
require_once 'db.php';
session_start();

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

// Discover columns so we can degrade gracefully on un-migrated databases.
$custCols = [];
if ($r = $conn->query('SHOW COLUMNS FROM customers')) {
    while ($c = $r->fetch_assoc()) $custCols[$c['Field']] = true;
}
$hasPw = isset($custCols['password_hash']);

$search = isset($_GET['search']) ? sanitize($_GET['search']) : '';

$accountExpr = $hasPw
    ? '(c.password_hash IS NOT NULL AND c.password_hash <> "")'
    : '0';

$query = 'SELECT c.id, c.name, c.email, c.phone, c.created_at,
                 ' . $accountExpr . ' AS has_account,
                 COALESCE(o.orders_count, 0) AS orders_count,
                 COALESCE(o.total_spent, 0)  AS total_spent,
                 o.last_order_at
          FROM customers c
          LEFT JOIN (
              SELECT customer_id,
                     COUNT(*) AS orders_count,
                     SUM(total_amount) AS total_spent,
                     MAX(created_at) AS last_order_at
              FROM orders
              WHERE customer_id IS NOT NULL
              GROUP BY customer_id
          ) o ON o.customer_id = c.id';

$params = [];
$types  = '';
if ($search !== '') {
    $query .= ' WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?';
    $types  = 'sss';
    $like   = "%{$search}%";
    $params = [$like, $like, $like];
}

$query .= ' ORDER BY c.created_at DESC';

$stmt = $conn->prepare($query);
if (!$stmt) {
    sendResponse(['error' => 'Customer query failed', 'detail' => $conn->error], 500);
}
if ($params) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$res = $stmt->get_result();

$customers = [];
while ($row = $res->fetch_assoc()) {
    $customers[] = [
        'id'            => intval($row['id']),
        'name'          => $row['name'],
        'email'         => $row['email'],
        'phone'         => $row['phone'],
        'has_account'   => (bool) $row['has_account'],
        'orders_count'  => intval($row['orders_count']),
        'total_spent'   => floatval($row['total_spent']),
        'last_order_at' => $row['last_order_at'],
        'created_at'    => $row['created_at']
    ];
}

sendResponse(['customers' => $customers]);
?>
