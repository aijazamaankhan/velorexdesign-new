<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (empty($_SESSION['customer_id'])) {
    sendResponse(['error' => 'Not logged in'], 401);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$customerId = intval($_SESSION['customer_id']);
$name = isset($input['name']) ? trim($input['name']) : '';
$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
$phone = isset($input['phone']) ? trim($input['phone']) : '';

if ($name === '' || $email === '') {
    sendResponse(['error' => 'Name and email are required'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['error' => 'Please enter a valid email address'], 422);
}

// Block taking another customer's email.
$check = $conn->prepare('SELECT id FROM customers WHERE email = ? AND id <> ? LIMIT 1');
$check->bind_param('si', $email, $customerId);
$check->execute();
if ($check->get_result()->num_rows > 0) {
    sendResponse(['error' => 'That email is already used by another account'], 409);
}

$upd = $conn->prepare('UPDATE customers SET name = ?, email = ?, phone = ?, updated_at = NOW() WHERE id = ?');
$upd->bind_param('sssi', $name, $email, $phone, $customerId);
if (!$upd->execute()) {
    sendResponse(['error' => 'Failed to update profile'], 500);
}

$_SESSION['customer_email'] = $email;
$_SESSION['customer_name'] = $name;

sendResponse([
    'success' => true,
    'user' => [
        'id' => $customerId,
        'name' => $name,
        'email' => $email,
        'phone' => $phone
    ]
]);
?>
