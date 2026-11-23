<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$identifier = strField($_POST, 'email', 150);
$password = isset($_POST['password']) && is_string($_POST['password']) ? $_POST['password'] : '';

// At most 8 failed admin logins per 15 minutes from one IP address.
rateLimitCheck('admin-login', 8, 900);

if ($identifier === '' || $password === '') {
    sendResponse(['error' => 'Username and password are required'], 422);
}

$stmt = $conn->prepare('SELECT id, email, password_hash, name FROM admins WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $identifier);
$stmt->execute();
$result = $stmt->get_result();

$admin = $result->num_rows === 1 ? $result->fetch_assoc() : null;
// Verify against a dummy hash when the user is unknown so both cases take the
// same time and reveal nothing about which usernames exist.
$hash = $admin ? $admin['password_hash'] : '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
if (!password_verify($password, $hash) || !$admin) {
    rateLimitHit('admin-login', 900);
    sendResponse(['error' => 'Invalid username or password'], 401);
}

rateLimitClear('admin-login');
// New session id on login, so an id planted before login is useless afterwards.
session_regenerate_id(true);

$_SESSION['admin_id'] = $admin['id'];
$_SESSION['admin_email'] = $admin['email'];
$_SESSION['admin_name'] = $admin['name'];

sendResponse([
    'success' => true,
    'admin' => [
        'id' => $admin['id'],
        'name' => $admin['name'],
        'email' => $admin['email']
    ]
]);
?>
