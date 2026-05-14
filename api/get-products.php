<?php
require_once 'db.php';

$category = isset($_GET['category']) ? sanitize($_GET['category']) : '';
$search = isset($_GET['search']) ? sanitize($_GET['search']) : '';

$query = 'SELECT id, name, category, price, stock, image_url, images, description, featured FROM products';
$params = [];
$types = '';
$where = [];

if ($category && $category !== 'all') {
    $where[] = 'category = ?';
    $types .= 's';
    $params[] = $category;
}

if ($search) {
    $where[] = '(name LIKE ? OR description LIKE ? OR category LIKE ?)';
    $types .= 'sss';
    $searchParam = "%{$search}%";
    $params[] = $searchParam;
    $params[] = $searchParam;
    $params[] = $searchParam;
}

if (count($where) > 0) {
    $query .= ' WHERE ' . implode(' AND ', $where);
}

$query .= ' ORDER BY featured DESC, name ASC';

$stmt = $conn->prepare($query);
if ($params) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$products = [];
while ($row = $result->fetch_assoc()) {
    if (!empty($row['images'])) {
        $decoded = json_decode($row['images'], true);
        $row['images'] = is_array($decoded) ? $decoded : [];
    } else {
        $row['images'] = $row['image_url'] ? [$row['image_url']] : [];
    }
    $products[] = $row;
}

sendResponse(['products' => $products]);
?>
