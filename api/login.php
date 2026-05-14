<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$identifier = isset($_POST['email']) ? trim($_POST['email']) : '';
$password = isset($_POST['password']) ? $_POST['password'] : '';

if ($identifier === '' || $password === '') {
    sendResponse(['error' => 'Username and password are required'], 422);
}

$stmt = $conn->prepare('SELECT id, email, password_hash, name FROM admins WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $identifier);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    sendResponse(['error' => 'Invalid username or password'], 401);
}

$admin = $result->fetch_assoc();
if (!password_verify($password, $admin['password_hash'])) {
    sendResponse(['error' => 'Invalid username or password'], 401);
}

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
