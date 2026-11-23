<?php
require_once 'db.php';
require_once 'product-lib.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (!admin_session_ok()) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$category = isset($_POST['category']) ? trim($_POST['category']) : '';
$price = isset($_POST['price']) ? floatval($_POST['price']) : 0;
$stock = isset($_POST['stock']) ? intval($_POST['stock']) : 0;
$image_url = isset($_POST['image_url']) ? trim($_POST['image_url']) : '';
$description = isset($_POST['description']) ? trim($_POST['description']) : '';
$featured = isset($_POST['featured']) && $_POST['featured'] === '1' ? 1 : 0;

$imagesJson = '';
if (isset($_POST['images'])) {
    $decoded = json_decode($_POST['images'], true);
    if (is_array($decoded)) {
        $clean = array_values(array_filter(array_map('trim', $decoded), function ($u) { return $u !== ''; }));
        $imagesJson = json_encode($clean);
        if ($image_url === '' && !empty($clean)) {
            $image_url = $clean[0];
        }
    }
}

if (!$name || !$category || $price < 0) {
    sendResponse(['error' => 'Required fields missing (name, category)'], 422);
}
$amazon = products_clean_amazon_url($_POST['amazon_url'] ?? '');
if ($amazon === false) sendResponse(['error' => 'Amazon link must be an https://www.amazon.in/... or amzn.in link'], 422);
products_ensure_columns($conn);

$stmt = $conn->prepare('INSERT INTO products (name, category, price, stock, image_url, description, featured, images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
$stmt->bind_param('ssdissis', $name, $category, $price, $stock, $image_url, $description, $featured, $imagesJson);
if (!$stmt->execute()) {
    sendResponse(['error' => 'Database insert failed'], 500);
}

$productId = $stmt->insert_id;
if (isset($_POST['cost_price']) && $_POST['cost_price'] !== '') {
    $cost = max(0, (float) $_POST['cost_price']);
    $cq = $conn->prepare('UPDATE products SET cost_price = ? WHERE id = ?');
    $cq->bind_param('di', $cost, $productId);
    $cq->execute();
}
$badge = products_clean_badge($_POST['badge'] ?? '');
if ($badge !== false && $badge !== '') {
    $bq = $conn->prepare('UPDATE products SET badge = ? WHERE id = ?');
    $bq->bind_param('si', $badge, $productId);
    $bq->execute();
}
if ($amazon !== '') {
    $a = $conn->prepare('UPDATE products SET amazon_url = ? WHERE id = ?');
    $a->bind_param('si', $amazon, $productId);
    $a->execute();
}
sendResponse(['success' => true, 'product_id' => $productId]);
?>
