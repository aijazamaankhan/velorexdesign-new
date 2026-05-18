<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

if (empty($_SESSION['admin_id'])) {
    sendResponse(['error' => 'Unauthorized'], 401);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$id          = isset($input['id'])           ? intval($input['id'])              : 0;
$name        = isset($input['name'])         ? trim($input['name'])              : null;
$email       = isset($input['email'])        ? trim(strtolower($input['email'])) : null;
$phone       = isset($input['phone'])        ? trim($input['phone'])             : null;
$newPassword = isset($input['new_password']) ? (string)$input['new_password']    : '';

if ($id <= 0) {
    sendResponse(['error' => 'Customer id is required'], 422);
}

// Discover available columns (older DBs may lack password_hash / updated_at).
$custCols = [];
if ($r = $conn->query('SHOW COLUMNS FROM customers')) {
    while ($c = $r->fetch_assoc()) $custCols[$c['Field']] = true;
}

// Confirm the customer exists.
$check = $conn->prepare('SELECT id FROM customers WHERE id = ? LIMIT 1');
$check->bind_param('i', $id);
$check->execute();
if ($check->get_result()->num_rows === 0) {
    sendResponse(['error' => 'Customer not found'], 404);
}

$fields = [];
$types  = '';
$params = [];

if ($name !== null) {
    if ($name === '') {
        sendResponse(['error' => 'Name cannot be empty'], 422);
    }
    $fields[] = 'name = ?';
    $types   .= 's';
    $params[] = $name;
}

if ($email !== null) {
    if ($email === '') {
        // Storing NULL keeps the unique-index escape valve for guest emails.
        $fields[] = 'email = NULL';
    } else {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendResponse(['error' => 'Please enter a valid email address'], 422);
        }
        // Block taking another customer's email.
        $dup = $conn->prepare('SELECT id FROM customers WHERE email = ? AND id <> ? LIMIT 1');
        $dup->bind_param('si', $email, $id);
        $dup->execute();
        if ($dup->get_result()->num_rows > 0) {
            sendResponse(['error' => 'That email is already used by another customer'], 409);
        }
        $fields[] = 'email = ?';
        $types   .= 's';
        $params[] = $email;
    }
}

if ($phone !== null) {
    $fields[] = 'phone = ?';
    $types   .= 's';
    $params[] = $phone;
}

if ($newPassword !== '') {
    if (!isset($custCols['password_hash'])) {
        sendResponse([
            'error' => 'This database does not have a password_hash column. Run api/setup.php once to add it, then try again.'
        ], 500);
    }
    if (strlen($newPassword) < 6) {
        sendResponse(['error' => 'New password must be at least 6 characters'], 422);
    }
    $fields[] = 'password_hash = ?';
    $types   .= 's';
    $params[] = password_hash($newPassword, PASSWORD_BCRYPT);
}

if (empty($fields)) {
    sendResponse(['error' => 'Provide at least one field to update'], 422);
}

// Only touch updated_at if the column exists (older schemas lack it).
$setClause = implode(', ', $fields);
if (isset($custCols['updated_at'])) {
    $setClause .= ', updated_at = NOW()';
}

$query   = 'UPDATE customers SET ' . $setClause . ' WHERE id = ?';
$types   .= 'i';
$params[] = $id;

$upd = $conn->prepare($query);
if (!$upd) {
    sendResponse(['error' => 'Update query failed to prepare', 'detail' => $conn->error], 500);
}
$upd->bind_param($types, ...$params);
if (!$upd->execute()) {
    sendResponse(['error' => 'Failed to update customer', 'detail' => $upd->error], 500);
}

sendResponse([
    'success'        => true,
    'id'             => $id,
    'password_reset' => $newPassword !== '',
    'changed_fields' => count($fields)
]);
?>
