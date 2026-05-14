<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';

if ($email === '' || $password === '') {
    sendResponse(['error' => 'Email and password are required'], 422);
}

$stmt = $conn->prepare('SELECT id, name, email, phone, password_hash FROM customers WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    sendResponse(['error' => 'Invalid email or password'], 401);
}

$customer = $result->fetch_assoc();
if (empty($customer['password_hash']) || !password_verify($password, $customer['password_hash'])) {
    sendResponse(['error' => 'Invalid email or password'], 401);
}

$_SESSION['customer_id'] = intval($customer['id']);
$_SESSION['customer_email'] = $customer['email'];
$_SESSION['customer_name'] = $customer['name'];

sendResponse([
    'success' => true,
    'user' => [
        'id' => intval($customer['id']),
        'name' => $customer['name'],
        'email' => $customer['email'],
        'phone' => $customer['phone'] ?: ''
    ]
]);
?>
