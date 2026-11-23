<?php
/**
 * Cart preview: what a coupon and/or points would do to this cart.
 * Prices come from the database, so the numbers match create-order.php.
 */
require_once 'db.php';
require_once 'marketing-lib.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);

// Guessing coupon codes is the obvious abuse, so keep it slow.
rateLimitCheck('checkout-quote', 40, 600);
rateLimitHit('checkout-quote', 600);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || empty($input['items']) || !is_array($input['items']) || count($input['items']) > 25) {
    sendResponse(['error' => 'Invalid cart'], 422);
}

$subtotal = 0.0;
$price = $conn->prepare('SELECT price FROM products WHERE id = ?');
foreach ($input['items'] as $item) {
    $id = is_array($item) && is_numeric($item['product_id'] ?? null) ? (int) $item['product_id'] : 0;
    $qty = is_array($item) && is_numeric($item['qty'] ?? null) ? (int) $item['qty'] : 0;
    if ($id <= 0 || $qty <= 0 || $qty > 20) sendResponse(['error' => 'Invalid cart'], 422);
    $price->bind_param('i', $id);
    $price->execute();
    $row = $price->get_result()->fetch_assoc();
    if (!$row) continue; // product removed; create-order.php will report it
    $subtotal += $qty * (float) $row['price'];
}

if (!marketing_ensure_tables($conn)) sendResponse(['error' => 'Offers are unavailable right now'], 503);

$customerId = !empty($_SESSION['customer_id']) ? (int) $_SESSION['customer_id'] : 0;
$email = strtolower(strField($input, 'email', 150));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';

$q = marketing_quote($conn, $subtotal, coupon_normalize_code($input['coupon_code'] ?? ''), !empty($input['use_points']), $customerId, $email ?: null);
sendResponse(['success' => true, 'quote' => marketing_public_quote($q)]);
