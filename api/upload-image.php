<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

if (!isset($_FILES['image'])) {
    sendResponse(['error' => 'No image uploaded'], 422);
}

$files = [];
if (is_array($_FILES['image']['name'])) {
    $count = count($_FILES['image']['name']);
    for ($i = 0; $i < $count; $i++) {
        if ($_FILES['image']['error'][$i] === UPLOAD_ERR_OK) {
            $files[] = [
                'name' => $_FILES['image']['name'][$i],
                'type' => $_FILES['image']['type'][$i],
                'tmp_name' => $_FILES['image']['tmp_name'][$i],
                'error' => $_FILES['image']['error'][$i]
            ];
        }
    }
} else {
    if ($_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $files[] = $_FILES['image'];
    }
}

if (empty($files)) {
    sendResponse(['error' => 'No valid files uploaded'], 422);
}

$validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
$maxBytes = 5 * 1024 * 1024;

$uploadDir = __DIR__ . '/uploads/products';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    sendResponse(['error' => 'Failed to create upload directory'], 500);
}

$urls = [];
$skipped = [];
foreach ($files as $file) {
    if (!in_array($file['type'], $validTypes, true)) {
        $skipped[] = $file['name'] . ' (unsupported type)';
        continue;
    }
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($extension, $allowedExt, true)) {
        $skipped[] = $file['name'] . ' (bad extension)';
        continue;
    }
    if (filesize($file['tmp_name']) > $maxBytes) {
        $skipped[] = $file['name'] . ' (over 5MB)';
        continue;
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $extension;
    $destination = $uploadDir . '/' . $filename;

    if (move_uploaded_file($file['tmp_name'], $destination)) {
        $urls[] = 'api/uploads/products/' . $filename;
    } else {
        $skipped[] = $file['name'] . ' (write failed)';
    }
}

if (empty($urls)) {
    sendResponse(['error' => 'No files uploaded successfully', 'skipped' => $skipped], 500);
}

sendResponse([
    'success' => true,
    'image_url' => $urls[0],
    'image_urls' => $urls,
    'skipped' => $skipped
]);
?>
