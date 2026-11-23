<?php
require_once 'db.php';
require_once 'marketing-lib.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$name = strField($input, 'name', 150);
$email = strtolower(strField($input, 'email', 150));
$password = isset($input['password']) && is_string($input['password']) ? $input['password'] : '';
$phone = strField($input, 'phone', 30);

// At most 10 sign-up attempts per hour from one IP address.
rateLimitCheck('customer-register', 10, 3600);
rateLimitHit('customer-register', 3600);

if ($name === '' || $email === '' || $password === '') {
    sendResponse(['error' => 'Name, email, and password are required'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['error' => 'Please enter a valid email address'], 422);
}
if (strlen($password) < 8 || strlen($password) > 200) {
    sendResponse(['error' => 'Password must be 8 to 200 characters'], 422);
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
    // A guest checkout used this email before. Nothing proves the person signing
    // up owns that inbox, so they must not see the guest's orders and address.
    // Detach the old guest record (it stays in admin with its orders) and create
    // a fresh account below.
    $guestId = intval($row['id']);
    $detach = $conn->prepare('UPDATE customers SET email = NULL WHERE id = ? AND password_hash IS NULL');
    $detach->bind_param('i', $guestId);
    if (!$detach->execute()) {
        sendResponse(['error' => 'Failed to create account'], 500);
    }
}
{
    $ins = $conn->prepare('INSERT INTO customers (name, email, phone, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())');
    $ins->bind_param('ssss', $name, $email, $phone, $hash);
    if (!$ins->execute()) {
        sendResponse(['error' => 'Failed to create account'], 500);
    }
    $customerId = $ins->insert_id;
}

// Welcome points, if the owner has switched them on.
if (marketing_ensure_tables($conn)) {
    $lcfg = loyalty_config($conn);
    if ($lcfg['enabled'] && $lcfg['signupBonus'] > 0) {
        loyalty_add($conn, (int) $customerId, $lcfg['signupBonus'], 'bonus', 'SIGNUP-' . (int) $customerId, 'Welcome bonus');
    }
}

session_regenerate_id(true);
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
