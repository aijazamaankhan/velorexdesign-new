<?php
require_once 'db.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['items']) || !is_array($input['items']) || empty($input['items'])) {
    sendResponse(['error' => 'Invalid order data'], 422);
}

$customerName = isset($input['customer_name']) ? trim($input['customer_name']) : 'Guest';
$customerEmail = isset($input['customer_email']) ? trim($input['customer_email']) : null;
$customerPhone = isset($input['customer_phone']) ? trim($input['customer_phone']) : null;
$address = isset($input['address']) && is_array($input['address']) ? $input['address'] : [];

$shippingAddress = isset($address['street']) ? trim($address['street']) : '';
$shippingCity = isset($address['city']) ? trim($address['city']) : '';
$shippingZip = isset($address['zip']) ? trim($address['zip']) : '';

$validated = [];
$subtotal = 0.0;

foreach ($input['items'] as $item) {
    $productId = isset($item['product_id']) ? intval($item['product_id']) : 0;
    $qty = isset($item['qty']) ? intval($item['qty']) : 0;
    if ($productId <= 0 || $qty <= 0) {
        sendResponse(['error' => 'Invalid item in cart'], 422);
    }

    $stmt = $conn->prepare('SELECT id, name, price, stock FROM products WHERE id = ?');
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $r = $stmt->get_result();
    if ($r->num_rows === 0) {
        sendResponse(['error' => 'Product no longer available (id ' . $productId . ')'], 422);
    }
    $product = $r->fetch_assoc();
    $stock = intval($product['stock']);
    if ($stock < $qty) {
        sendResponse(['error' => 'Insufficient stock for "' . $product['name'] . '" (available: ' . $stock . ')'], 422);
    }

    $unitPrice = floatval($product['price']);
    $lineTotal = $qty * $unitPrice;
    $validated[] = [
        'product_id' => $productId,
        'name' => $product['name'],
        'qty' => $qty,
        'unit_price' => $unitPrice,
        'total_price' => $lineTotal
    ];
    $subtotal += $lineTotal;
}

$shipping = $subtotal > 999 ? 0.0 : 99.0;
$grandTotal = $subtotal + $shipping;

$conn->begin_transaction();
try {
    $customerId = null;
    // Prefer the logged-in customer's id over email matching so guest checkouts
    // by the same person don't accidentally collide.
    if (!empty($_SESSION['customer_id'])) {
        $customerId = intval($_SESSION['customer_id']);
    } elseif ($customerEmail) {
        $stmt = $conn->prepare('SELECT id FROM customers WHERE email = ? LIMIT 1');
        $stmt->bind_param('s', $customerEmail);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 1) {
            $customerId = intval($result->fetch_assoc()['id']);
        }
    }
    if (!$customerId) {
        $stmt = $conn->prepare('INSERT INTO customers (name, email, phone, created_at) VALUES (?, ?, ?, NOW())');
        $stmt->bind_param('sss', $customerName, $customerEmail, $customerPhone);
        if (!$stmt->execute()) {
            throw new Exception('Unable to save customer');
        }
        $customerId = $stmt->insert_id;
    }

    $orderCode = 'ORD-' . strtoupper(uniqid());
    $status = 'Pending';
    $statusHistory = json_encode([['status' => $status, 'timestamp' => date('Y-m-d H:i:s')]]);
    $trackingNumber = '';
    $adminNote = '';

    $stmt = $conn->prepare('INSERT INTO orders (customer_id, order_code, total_amount, status, shipping_address, shipping_city, shipping_zip, phone, email, tracking_number, admin_note, status_history, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
    $stmt->bind_param(
        'isdsssssssss',
        $customerId,
        $orderCode,
        $grandTotal,
        $status,
        $shippingAddress,
        $shippingCity,
        $shippingZip,
        $customerPhone,
        $customerEmail,
        $trackingNumber,
        $adminNote,
        $statusHistory
    );
    if (!$stmt->execute()) {
        throw new Exception('Unable to save order');
    }
    $orderId = $stmt->insert_id;

    $insertItem = $conn->prepare('INSERT INTO order_items (order_id, product_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)');
    $decrementStock = $conn->prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

    foreach ($validated as $item) {
        $insertItem->bind_param('iisidd', $orderId, $item['product_id'], $item['name'], $item['qty'], $item['unit_price'], $item['total_price']);
        if (!$insertItem->execute()) {
            throw new Exception('Failed to record line item');
        }

        $decrementStock->bind_param('iii', $item['qty'], $item['product_id'], $item['qty']);
        $decrementStock->execute();
        if ($decrementStock->affected_rows === 0) {
            throw new Exception('Stock became unavailable for: ' . $item['name']);
        }
    }

    $conn->commit();
    sendResponse([
        'success' => true,
        'order_code' => $orderCode,
        'subtotal' => $subtotal,
        'shipping' => $shipping,
        'total_amount' => $grandTotal
    ]);
} catch (Exception $e) {
    $conn->rollback();
    sendResponse(['error' => $e->getMessage()], 500);
}
?>
