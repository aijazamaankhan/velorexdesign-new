<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
if ($id <= 0) {
    sendResponse(['error' => 'Product ID required'], 422);
}

$fields = [];
$params = [];
$types = '';

if (isset($_POST['name'])) {
    $fields[] = 'name = ?';
    $types .= 's';
    $params[] = trim($_POST['name']);
}
if (isset($_POST['category'])) {
    $fields[] = 'category = ?';
    $types .= 's';
    $params[] = trim($_POST['category']);
}
if (isset($_POST['price'])) {
    $fields[] = 'price = ?';
    $types .= 'd';
    $params[] = floatval($_POST['price']);
}
if (isset($_POST['stock'])) {
    $fields[] = 'stock = ?';
    $types .= 'i';
    $params[] = intval($_POST['stock']);
}
if (isset($_POST['description'])) {
    $fields[] = 'description = ?';
    $types .= 's';
    $params[] = trim($_POST['description']);
}
if (isset($_POST['featured'])) {
    $fields[] = 'featured = ?';
    $types .= 'i';
    $params[] = $_POST['featured'] === '1' ? 1 : 0;
}

$cleanImages = null;
if (isset($_POST['images'])) {
    $decoded = json_decode($_POST['images'], true);
    if (is_array($decoded)) {
        $cleanImages = array_values(array_filter(array_map('trim', $decoded), function ($u) { return $u !== ''; }));
        $fields[] = 'images = ?';
        $types .= 's';
        $params[] = json_encode($cleanImages);
    }
}

if (isset($_POST['image_url'])) {
    $fields[] = 'image_url = ?';
    $types .= 's';
    $params[] = trim($_POST['image_url']);
} elseif ($cleanImages !== null) {
    $fields[] = 'image_url = ?';
    $types .= 's';
    $params[] = !empty($cleanImages) ? $cleanImages[0] : '';
}

if (empty($fields)) {
    sendResponse(['error' => 'No fields to update'], 422);
}

$fields[] = 'updated_at = NOW()';
$query = 'UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?';
$types .= 'i';
$params[] = $id;

$stmt = $conn->prepare($query);
$stmt->bind_param($types, ...$params);

if (!$stmt->execute()) {
    sendResponse(['error' => 'Product update failed: ' . $stmt->error], 500);
}

sendResponse(['success' => true]);
?>
