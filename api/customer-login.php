<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$email = strtolower(strField($input, 'email', 150));
$password = isset($input['password']) && is_string($input['password']) ? $input['password'] : '';

// At most 10 failed customer logins per 15 minutes from one IP address.
rateLimitCheck('customer-login', 10, 900);

if ($email === '' || $password === '') {
    sendResponse(['error' => 'Email and password are required'], 422);
}

$stmt = $conn->prepare('SELECT id, name, email, phone, password_hash FROM customers WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();

$customer = $result->num_rows === 1 ? $result->fetch_assoc() : null;
$hash = ($customer && !empty($customer['password_hash']))
    ? $customer['password_hash']
    : '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
if (!password_verify($password, $hash) || !$customer || empty($customer['password_hash'])) {
    rateLimitHit('customer-login', 900);
    sendResponse(['error' => 'Invalid email or password'], 401);
}

rateLimitClear('customer-login');
session_regenerate_id(true);

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
