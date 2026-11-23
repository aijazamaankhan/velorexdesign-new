<?php
/** Admin: list, create, edit, switch on/off and delete coupons. */
require_once 'db.php';
require_once 'marketing-lib.php';
session_start();

if (empty($_SESSION['admin_id'])) sendResponse(['error' => 'Unauthorized'], 401);
if (!marketing_ensure_tables($conn)) sendResponse(['error' => 'Coupon tables could not be created'], 500);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = [];
    $res = $conn->query('SELECT c.*, (SELECT COALESCE(SUM(discount),0) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS total_discount
                         FROM coupons c ORDER BY c.created_at DESC');
    while ($r = $res->fetch_assoc()) {
        foreach (['id', 'value', 'min_order', 'used_count', 'active', 'total_discount'] as $k) $r[$k] = (int) $r[$k];
        foreach (['max_discount', 'usage_limit', 'per_customer_limit'] as $k) $r[$k] = $r[$k] === null ? null : (int) $r[$k];
        $rows[] = $r;
    }
    sendResponse(['coupons' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) sendResponse(['error' => 'Invalid request'], 422);
$action = $in['action'] ?? '';
$id = isset($in['id']) && is_numeric($in['id']) ? (int) $in['id'] : 0;

if ($action === 'toggle' && $id > 0) {
    $st = $conn->prepare('UPDATE coupons SET active = 1 - active WHERE id = ?');
    $st->bind_param('i', $id);
    $st->execute();
    sendResponse(['success' => true]);
}
if ($action === 'delete' && $id > 0) {
    $st = $conn->prepare('DELETE FROM coupons WHERE id = ?');
    $st->bind_param('i', $id);
    $st->execute();
    sendResponse(['success' => true]);
}
if ($action !== 'save') sendResponse(['error' => 'Unknown action'], 422);

// Validate every field. Amounts are whole rupees.
$code = coupon_normalize_code($in['code'] ?? '');
$type = in_array($in['type'] ?? '', ['percent', 'fixed', 'free_shipping'], true) ? $in['type'] : '';
$int = function ($k, $min, $max, $nullable = false) use ($in) {
    $v = $in[$k] ?? null;
    if ($nullable && ($v === null || $v === '')) return null;
    if (!is_numeric($v) || (int) $v != $v || $v < $min || $v > $max) return false;
    return (int) $v;
};
$value = $type === 'free_shipping' ? 0 : $int('value', 1, $type === 'percent' ? 90 : 100000);
$minOrder = $int('min_order', 0, 1000000);
$maxDiscount = $int('max_discount', 1, 100000, true);
$usageLimit = $int('usage_limit', 1, 1000000, true);
$perCustomer = $int('per_customer_limit', 1, 1000, true);
$date = function ($k) use ($in) {
    $v = trim((string) ($in[$k] ?? ''));
    if ($v === '') return null;
    $t = strtotime($v);
    return $t ? date('Y-m-d H:i:s', $t) : false;
};
$starts = $date('starts_at');
$expires = $date('expires_at');
$note = mb_substr(trim((string) ($in['note'] ?? '')), 0, 160);
$active = !empty($in['active']) ? 1 : 0;

$errors = [];
if (strlen($code) < 3 || strlen($code) > 40) $errors[] = 'Code must be 3 to 40 letters or numbers';
if ($type === '') $errors[] = 'Choose a coupon type';
if ($value === false) $errors[] = $type === 'percent' ? 'Percent must be 1 to 90' : 'Amount must be 1 to 100000 rupees';
if ($minOrder === false) $errors[] = 'Minimum order is invalid';
if ($maxDiscount === false) $errors[] = 'Maximum discount is invalid';
if ($usageLimit === false) $errors[] = 'Total uses is invalid';
if ($perCustomer === false) $errors[] = 'Uses per customer is invalid';
if ($starts === false || $expires === false) $errors[] = 'Dates are invalid';
if ($starts && $expires && $expires <= $starts) $errors[] = 'End date must be after the start date';
if ($errors) sendResponse(['error' => implode('. ', $errors)], 422);

if ($id > 0) {
    $st = $conn->prepare('UPDATE coupons SET code=?, type=?, value=?, min_order=?, max_discount=?, usage_limit=?, per_customer_limit=?, starts_at=?, expires_at=?, active=?, note=? WHERE id=?');
    $st->bind_param('ssiiiiissisi', $code, $type, $value, $minOrder, $maxDiscount, $usageLimit, $perCustomer, $starts, $expires, $active, $note, $id);
} else {
    $st = $conn->prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, usage_limit, per_customer_limit, starts_at, expires_at, active, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    $st->bind_param('ssiiiiissis', $code, $type, $value, $minOrder, $maxDiscount, $usageLimit, $perCustomer, $starts, $expires, $active, $note);
}
try {
    $ok = $st->execute();
} catch (Throwable $e) {
    $ok = false;
}
if (!$ok) {
    if ($conn->errno === 1062) sendResponse(['error' => 'A coupon with this code already exists'], 409);
    error_log('admin-coupons save failed: ' . $conn->error);
    sendResponse(['error' => 'Could not save the coupon'], 500);
}
sendResponse(['success' => true]);
