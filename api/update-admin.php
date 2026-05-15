<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Not logged in'], 401);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$adminId = intval($_SESSION['admin_id']);
$currentPassword = isset($input['current_password']) ? (string)$input['current_password'] : '';
$newEmail = isset($input['new_email']) ? trim($input['new_email']) : '';
$newPassword = isset($input['new_password']) ? (string)$input['new_password'] : '';
$newName = isset($input['new_name']) ? trim($input['new_name']) : '';

if ($currentPassword === '') {
    sendResponse(['error' => 'Current password is required'], 422);
}
if ($newEmail === '' && $newPassword === '' && $newName === '') {
    sendResponse(['error' => 'Provide at least one new value (username, password, or name)'], 422);
}

$stmt = $conn->prepare('SELECT id, name, email, password_hash FROM admins WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $adminId);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0) {
    sendResponse(['error' => 'Admin account no longer exists'], 404);
}
$admin = $result->fetch_assoc();

if (!password_verify($currentPassword, $admin['password_hash'])) {
    sendResponse(['error' => 'Current password is incorrect'], 401);
}

$fields = [];
$params = [];
$types = '';

if ($newEmail !== '' && $newEmail !== $admin['email']) {
    // login.php matches on `email` (treated as username) so we accept any non-empty
    // string here; just guard against collisions with another admin's username.
    $check = $conn->prepare('SELECT id FROM admins WHERE email = ? AND id <> ? LIMIT 1');
    $check->bind_param('si', $newEmail, $adminId);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        sendResponse(['error' => 'That username is already taken'], 409);
    }
    $fields[] = 'email = ?';
    $types .= 's';
    $params[] = $newEmail;
}

if ($newPassword !== '') {
    if (strlen($newPassword) < 6) {
        sendResponse(['error' => 'New password must be at least 6 characters'], 422);
    }
    $fields[] = 'password_hash = ?';
    $types .= 's';
    $params[] = password_hash($newPassword, PASSWORD_BCRYPT);
}

if ($newName !== '' && $newName !== $admin['name']) {
    $fields[] = 'name = ?';
    $types .= 's';
    $params[] = $newName;
}

if (empty($fields)) {
    sendResponse(['success' => true, 'message' => 'No changes applied']);
}

$query = 'UPDATE admins SET ' . implode(', ', $fields) . ' WHERE id = ?';
$types .= 'i';
$params[] = $adminId;

$upd = $conn->prepare($query);
$upd->bind_param($types, ...$params);
if (!$upd->execute()) {
    sendResponse(['error' => 'Failed to update admin account'], 500);
}

if ($newEmail !== '') $_SESSION['admin_email'] = $newEmail;
if ($newName !== '') $_SESSION['admin_name'] = $newName;

sendResponse([
    'success' => true,
    'admin' => [
        'id' => $adminId,
        'email' => $newEmail !== '' ? $newEmail : $admin['email'],
        'name' => $newName !== '' ? $newName : $admin['name']
    ]
]);
?>
