<?php
require_once 'db.php';
session_start();

if (empty($_SESSION['customer_id'])) {
    sendResponse(['error' => 'Not logged in'], 401);
}

$customerId = intval($_SESSION['customer_id']);

function fetchAddresses($conn, $customerId) {
    $stmt = $conn->prepare('SELECT id, title, street, city, zip, is_default FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id ASC');
    $stmt->bind_param('i', $customerId);
    $stmt->execute();
    $res = $stmt->get_result();
    $list = [];
    while ($row = $res->fetch_assoc()) {
        $list[] = [
            'id' => intval($row['id']),
            'title' => $row['title'],
            'street' => $row['street'],
            'city' => $row['city'],
            'zip' => $row['zip'],
            'isDefault' => intval($row['is_default']) === 1
        ];
    }
    return $list;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    sendResponse(['addresses' => fetchAddresses($conn, $customerId)]);
}

if ($method !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;
$action = isset($input['action']) ? $input['action'] : '';

if ($action === 'add' || $action === 'update') {
    $title = isset($input['title']) ? trim($input['title']) : 'Address';
    $street = isset($input['street']) ? trim($input['street']) : '';
    $city = isset($input['city']) ? trim($input['city']) : '';
    $zip = isset($input['zip']) ? trim($input['zip']) : '';

    if ($street === '' || $city === '') {
        sendResponse(['error' => 'Street and city are required'], 422);
    }
    if ($title === '') $title = 'Address';

    if ($action === 'add') {
        // First address becomes default automatically.
        $count = $conn->prepare('SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?');
        $count->bind_param('i', $customerId);
        $count->execute();
        $isDefault = intval($count->get_result()->fetch_assoc()['n']) === 0 ? 1 : 0;

        $ins = $conn->prepare('INSERT INTO customer_addresses (customer_id, title, street, city, zip, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())');
        $ins->bind_param('issssi', $customerId, $title, $street, $city, $zip, $isDefault);
        if (!$ins->execute()) {
            sendResponse(['error' => 'Failed to save address'], 500);
        }
    } else {
        $addrId = isset($input['id']) ? intval($input['id']) : 0;
        if ($addrId <= 0) sendResponse(['error' => 'Address id required'], 422);

        $upd = $conn->prepare('UPDATE customer_addresses SET title = ?, street = ?, city = ?, zip = ? WHERE id = ? AND customer_id = ?');
        $upd->bind_param('ssssii', $title, $street, $city, $zip, $addrId, $customerId);
        if (!$upd->execute()) {
            sendResponse(['error' => 'Failed to update address'], 500);
        }
    }
} elseif ($action === 'delete') {
    $addrId = isset($input['id']) ? intval($input['id']) : 0;
    if ($addrId <= 0) sendResponse(['error' => 'Address id required'], 422);

    $del = $conn->prepare('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?');
    $del->bind_param('ii', $addrId, $customerId);
    if (!$del->execute()) {
        sendResponse(['error' => 'Failed to delete address'], 500);
    }

    // Ensure at least one address is marked default.
    $check = $conn->prepare('SELECT id FROM customer_addresses WHERE customer_id = ? AND is_default = 1 LIMIT 1');
    $check->bind_param('i', $customerId);
    $check->execute();
    if ($check->get_result()->num_rows === 0) {
        $first = $conn->prepare('SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY id ASC LIMIT 1');
        $first->bind_param('i', $customerId);
        $first->execute();
        $r = $first->get_result();
        if ($r->num_rows === 1) {
            $firstId = intval($r->fetch_assoc()['id']);
            $mark = $conn->prepare('UPDATE customer_addresses SET is_default = 1 WHERE id = ?');
            $mark->bind_param('i', $firstId);
            $mark->execute();
        }
    }
} elseif ($action === 'set_default') {
    $addrId = isset($input['id']) ? intval($input['id']) : 0;
    if ($addrId <= 0) sendResponse(['error' => 'Address id required'], 422);

    $owns = $conn->prepare('SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ? LIMIT 1');
    $owns->bind_param('ii', $addrId, $customerId);
    $owns->execute();
    if ($owns->get_result()->num_rows === 0) {
        sendResponse(['error' => 'Address not found'], 404);
    }

    $clear = $conn->prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?');
    $clear->bind_param('i', $customerId);
    $clear->execute();

    $set = $conn->prepare('UPDATE customer_addresses SET is_default = 1 WHERE id = ? AND customer_id = ?');
    $set->bind_param('ii', $addrId, $customerId);
    $set->execute();
} else {
    sendResponse(['error' => 'Unknown action'], 422);
}

sendResponse(['success' => true, 'addresses' => fetchAddresses($conn, $customerId)]);
?>
