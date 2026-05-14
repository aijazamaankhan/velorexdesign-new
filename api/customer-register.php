<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$name = isset($input['name']) ? trim($input['name']) : '';
$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';
$phone = isset($input['phone']) ? trim($input['phone']) : '';

if ($name === '' || $email === '' || $password === '') {
    sendResponse(['error' => 'Name, email, and password are required'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['error' => 'Please enter a valid email address'], 422);
}
if (strlen($password) < 6) {
    sendResponse(['error' => 'Password must be at least 6 characters'], 422);
}

$stmt = $conn->prepare('SELECT id, password_hash FROM customers WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$existing = $stmt->get_result();

$hash = password_hash($password, PASSWORD_BCRYPT);
$customerId = 0;

if ($existing->num_rows === 1) {
    $row = $existing->fetch_assoc();
    if (!empty($row['password_hash'])) {
        sendResponse(['error' => 'An account with this email already exists. Please sign in.'], 409);
    }
    // Claim guest customer row that was created by a previous checkout.
    $customerId = intval($row['id']);
    if ($phone !== '') {
        $upd = $conn->prepare('UPDATE customers SET name = ?, phone = ?, password_hash = ?, updated_at = NOW() WHERE id = ?');
        $upd->bind_param('sssi', $name, $phone, $hash, $customerId);
    } else {
        $upd = $conn->prepare('UPDATE customers SET name = ?, password_hash = ?, updated_at = NOW() WHERE id = ?');
        $upd->bind_param('ssi', $name, $hash, $customerId);
    }
    if (!$upd->execute()) {
        sendResponse(['error' => 'Failed to create account'], 500);
    }
} else {
    $ins = $conn->prepare('INSERT INTO customers (name, email, phone, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())');
    $ins->bind_param('ssss', $name, $email, $phone, $hash);
    if (!$ins->execute()) {
        sendResponse(['error' => 'Failed to create account'], 500);
    }
    $customerId = $ins->insert_id;
}

$_SESSION['customer_id'] = $customerId;
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
