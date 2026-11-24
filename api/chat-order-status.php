<?php
/**
 * Chat assistant: order status lookup.
 * POST { order_code, contact }  (contact = the email or phone used on the order)
 * Returns status, date and tracking number only when BOTH match, so an order
 * number alone reveals nothing. Rate limited to slow down guessing.
 */
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
rateLimitCheck('chat-order', 10, 600);
rateLimitHit('chat-order', 600);

$in = json_decode(file_get_contents('php://input'), true);
$code = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', strField($in, 'order_code', 40)));
$contact = strtolower(strField($in, 'contact', 150));
if ($code === '' || $contact === '') sendResponse(['error' => 'Order number and email or phone are needed'], 422);

$digits = preg_replace('/\D/', '', $contact);
$phoneTail = strlen($digits) >= 10 ? substr($digits, -10) : '';

$st = $conn->prepare('SELECT o.order_code, o.status, o.tracking_number, o.created_at, o.email, o.phone, c.email AS cemail, c.phone AS cphone
                      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.order_code = ? LIMIT 1');
$st->bind_param('s', $code);
$st->execute();
$o = $st->get_result()->fetch_assoc();

$match = false;
if ($o) {
    foreach ([$o['email'], $o['cemail']] as $e) if ($e && strtolower($e) === $contact) $match = true;
    if ($phoneTail) foreach ([$o['phone'], $o['cphone']] as $p) {
        $pd = preg_replace('/\D/', '', (string) $p);
        if (strlen($pd) >= 10 && substr($pd, -10) === $phoneTail) $match = true;
    }
}
// Same answer for "no such order" and "wrong contact", so neither can be probed.
if (!$match) sendResponse(['found' => false]);

sendResponse([
    'found' => true,
    'order_code' => $o['order_code'],
    'status' => $o['status'],
    'tracking' => $o['tracking_number'] ?: '',
    'date' => $o['created_at'] ? date('j M Y', strtotime($o['created_at'])) : '',
]);
