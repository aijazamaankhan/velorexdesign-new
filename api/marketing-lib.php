<?php
/**
 * Coupons and loyalty points. Rules follow velorexmusic.com:
 *
 * 1. The browser never sends a discount or a points amount. It sends a coupon
 *    code and/or "use points"; the server works out the discount from the
 *    database prices, the coupon row and the points ledger.
 * 2. A coupon and spending points never combine on one order.
 * 3. Points never pay for shipping and are capped at maxRedeemPercent of the
 *    goods subtotal.
 * 4. Points are earned only when an order is first marked Delivered, on what
 *    was actually paid for goods. Cancelling returns spent points, removes
 *    earned ones and frees the coupon use.
 * 5. The ledger is append-only; balance = SUM(points). UNIQUE(order_code, kind)
 *    makes every order entry idempotent.
 * 6. CREATE/ALTER TABLE end an open transaction in MySQL, so call
 *    marketing_ensure_tables() before begin_transaction(), never inside one.
 */

const MKT_SHIPPING_FEE = 99;
const MKT_FREE_SHIPPING_ABOVE = 999;

function marketing_ensure_tables(mysqli $conn): bool {
    static $ready = null;
    if ($ready !== null) return $ready;
    try {
        $conn->query("CREATE TABLE IF NOT EXISTS coupons (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(40) NOT NULL UNIQUE,
            type ENUM('percent','fixed','free_shipping') NOT NULL DEFAULT 'percent',
            value INT NOT NULL DEFAULT 0,
            min_order INT NOT NULL DEFAULT 0,
            max_discount INT NULL,
            usage_limit INT NULL,
            used_count INT NOT NULL DEFAULT 0,
            per_customer_limit INT NULL,
            starts_at DATETIME NULL,
            expires_at DATETIME NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            note VARCHAR(160) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $conn->query("CREATE TABLE IF NOT EXISTS coupon_redemptions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            coupon_id INT UNSIGNED NOT NULL,
            order_code VARCHAR(100) NOT NULL UNIQUE,
            customer_id INT UNSIGNED NULL,
            email VARCHAR(150) NULL,
            discount INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_red_coupon (coupon_id),
            KEY idx_red_customer (customer_id),
            KEY idx_red_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $conn->query("CREATE TABLE IF NOT EXISTS loyalty_config (
            id TINYINT PRIMARY KEY,
            config TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $conn->query("CREATE TABLE IF NOT EXISTS loyalty_ledger (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            customer_id INT UNSIGNED NOT NULL,
            points INT NOT NULL,
            kind VARCHAR(16) NOT NULL,
            order_code VARCHAR(100) NULL,
            note VARCHAR(255) NULL,
            created_by VARCHAR(20) NOT NULL DEFAULT 'system',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_loyalty_order_kind (order_code, kind),
            KEY idx_loyalty_customer (customer_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $have = [];
        $res = $conn->query('SHOW COLUMNS FROM orders');
        if ($res) while ($r = $res->fetch_assoc()) $have[$r['Field']] = true;
        $add = [
            'subtotal'        => 'DECIMAL(10,2) NULL',
            'shipping'        => 'DECIMAL(10,2) NULL',
            'coupon_code'     => 'VARCHAR(40) NULL',
            'coupon_discount' => 'DECIMAL(10,2) NOT NULL DEFAULT 0',
            'points_used'     => 'INT NOT NULL DEFAULT 0',
            'points_discount' => 'DECIMAL(10,2) NOT NULL DEFAULT 0',
        ];
        foreach ($add as $col => $def) {
            if (!isset($have[$col])) $conn->query("ALTER TABLE orders ADD COLUMN $col $def");
        }
        $ready = true;
    } catch (Throwable $e) {
        error_log('marketing tables unavailable: ' . $e->getMessage());
        $ready = false;
    }
    return $ready;
}

/* ───────────── Loyalty ───────────── */

function loyalty_default_config(): array {
    return [
        'enabled'          => false, // ships OFF until the owner turns it on in admin
        'earnPercent'      => 5.0,   // % of the paid goods value given back as points value
        'pointsPerRupee'   => 1,     // this many points = ₹1
        'maxRedeemPercent' => 20,    // max share of the goods subtotal payable with points
        'minRedeemPoints'  => 100,   // need at least this many points to spend any
        'signupBonus'      => 0,     // points given once when a customer creates an account
        'expiryMonths'     => 12,    // balance expires after this long with no activity (0 = never)
    ];
}

function loyalty_config(mysqli $conn): array {
    $cfg = loyalty_default_config();
    try {
        $res = $conn->query('SELECT config FROM loyalty_config WHERE id = 1');
        $row = $res ? $res->fetch_assoc() : null;
        $saved = $row ? json_decode((string) $row['config'], true) : null;
        if (is_array($saved)) $cfg = array_merge($cfg, array_intersect_key($saved, $cfg));
    } catch (Throwable $e) {
        $cfg['enabled'] = false;
    }
    $cfg['enabled']          = (bool) $cfg['enabled'];
    $cfg['earnPercent']      = (float) $cfg['earnPercent'];
    $cfg['pointsPerRupee']   = max(1, (int) $cfg['pointsPerRupee']);
    $cfg['maxRedeemPercent'] = (int) $cfg['maxRedeemPercent'];
    $cfg['minRedeemPoints']  = (int) $cfg['minRedeemPoints'];
    $cfg['signupBonus']      = (int) $cfg['signupBonus'];
    $cfg['expiryMonths']     = (int) $cfg['expiryMonths'];
    return $cfg;
}

/** Returns [config|null, errors]. */
function loyalty_validate_config($in): array {
    if (!is_array($in)) return [null, ['config' => 'Invalid settings']];
    $errors = [];
    $num = function ($k) use ($in) { return isset($in[$k]) && is_numeric($in[$k]) ? $in[$k] + 0 : null; };
    $int = function ($k, $min, $max, $msg) use ($num, &$errors) {
        $v = $num($k);
        if ($v === null || (int) $v != $v || $v < $min || $v > $max) { $errors[$k] = $msg; return 0; }
        return (int) $v;
    };
    $out = ['enabled' => !empty($in['enabled'])];
    $earn = $num('earnPercent');
    if ($earn === null || $earn < 0 || $earn > 20) $errors['earnPercent'] = 'Earn rate must be 0 to 20%';
    $out['earnPercent']      = round((float) $earn, 2);
    $out['pointsPerRupee']   = $int('pointsPerRupee', 1, 100, 'Points per ₹1 must be 1 to 100');
    $out['maxRedeemPercent'] = $int('maxRedeemPercent', 0, 50, 'Max redeem must be 0 to 50%');
    $out['minRedeemPoints']  = $int('minRedeemPoints', 0, 100000, 'Minimum points must be 0 to 100000');
    $out['signupBonus']      = $int('signupBonus', 0, 10000, 'Sign-up bonus must be 0 to 10000 points');
    $out['expiryMonths']     = $int('expiryMonths', 0, 60, 'Expiry must be 0 (never) to 60 months');
    return [$errors ? null : $out, $errors];
}

function loyalty_save_config(mysqli $conn, array $cfg): bool {
    $json = json_encode($cfg);
    $st = $conn->prepare('INSERT INTO loyalty_config (id, config) VALUES (1, ?) ON DUPLICATE KEY UPDATE config = VALUES(config)');
    $st->bind_param('s', $json);
    return $st->execute();
}

function loyalty_points_for(array $cfg, float $rupees): int {
    if ($rupees <= 0 || $cfg['earnPercent'] <= 0) return 0;
    return (int) floor($rupees * $cfg['earnPercent'] / 100 * $cfg['pointsPerRupee'] + 1e-9);
}

function loyalty_balance(mysqli $conn, int $customerId, ?array $cfg = null, bool $applyExpiry = true): int {
    if ($customerId <= 0) return 0;
    $cfg = $cfg ?? loyalty_config($conn);
    $st = $conn->prepare("SELECT COALESCE(SUM(points),0) AS bal,
            MAX(CASE WHEN kind IN ('earn','redeem','bonus') THEN created_at END) AS last_activity
        FROM loyalty_ledger WHERE customer_id = ?");
    $st->bind_param('i', $customerId);
    $st->execute();
    $r = $st->get_result()->fetch_assoc() ?: ['bal' => 0, 'last_activity' => null];
    $bal = (int) $r['bal'];
    if ($bal > 0 && $cfg['expiryMonths'] > 0 && !empty($r['last_activity'])
        && strtotime($r['last_activity'] . ' +' . $cfg['expiryMonths'] . ' months') < time()) {
        if ($applyExpiry) loyalty_add($conn, $customerId, -$bal, 'expire', null, 'No activity for ' . $cfg['expiryMonths'] . ' months');
        return 0;
    }
    return max(0, $bal);
}

/** Adds one ledger row. Returns false when an order-linked row already exists. */
function loyalty_add(mysqli $conn, int $customerId, int $points, string $kind, ?string $orderCode, string $note, string $by = 'system'): bool {
    if ($customerId <= 0 || $points === 0) return false;
    $note = mb_substr($note, 0, 255);
    $st = $conn->prepare('INSERT IGNORE INTO loyalty_ledger (customer_id, points, kind, order_code, note, created_by) VALUES (?, ?, ?, ?, ?, ?)');
    $st->bind_param('iissss', $customerId, $points, $kind, $orderCode, $note, $by);
    $st->execute();
    return $st->affected_rows > 0;
}

function loyalty_history(mysqli $conn, int $customerId, int $limit = 50): array {
    $st = $conn->prepare('SELECT points, kind, order_code, note, created_at FROM loyalty_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT ' . (int) $limit);
    $st->bind_param('i', $customerId);
    $st->execute();
    $out = [];
    $res = $st->get_result();
    while ($r = $res->fetch_assoc()) {
        $out[] = ['points' => (int) $r['points'], 'kind' => $r['kind'], 'orderCode' => $r['order_code'], 'note' => (string) $r['note'], 'at' => $r['created_at']];
    }
    return $out;
}

/* ───────────── Coupons ───────────── */

function coupon_normalize_code($code): string {
    return is_string($code) ? strtoupper(preg_replace('/[^A-Za-z0-9_-]/', '', trim($code))) : '';
}

function coupon_find(mysqli $conn, string $code): ?array {
    if ($code === '') return null;
    $st = $conn->prepare('SELECT * FROM coupons WHERE code = ? LIMIT 1');
    $st->bind_param('s', $code);
    $st->execute();
    return $st->get_result()->fetch_assoc() ?: null;
}

/** Times this customer (by account or email) has used the coupon. */
function coupon_customer_uses(mysqli $conn, int $couponId, int $customerId, ?string $email): int {
    if ($customerId > 0) {
        $st = $conn->prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND (customer_id = ? OR email = ?)');
        $e = (string) $email;
        $st->bind_param('iis', $couponId, $customerId, $e);
    } elseif ($email) {
        $st = $conn->prepare('SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND email = ?');
        $st->bind_param('is', $couponId, $email);
    } else {
        return 0;
    }
    $st->execute();
    return (int) $st->get_result()->fetch_assoc()['n'];
}

/**
 * Works out a coupon's effect on a subtotal.
 * Returns ['ok'=>bool, 'reason'=>?string, 'discount'=>int, 'freeShipping'=>bool, 'coupon'=>?array].
 */
function coupon_quote(mysqli $conn, string $code, float $subtotal, int $customerId, ?string $email): array {
    $fail = function ($why) { return ['ok' => false, 'reason' => $why, 'discount' => 0, 'freeShipping' => false, 'coupon' => null]; };
    $c = coupon_find($conn, $code);
    if (!$c || !(int) $c['active']) return $fail('This coupon code is not valid.');
    $now = time();
    if ($c['starts_at'] && strtotime($c['starts_at']) > $now) return $fail('This coupon is not active yet.');
    if ($c['expires_at'] && strtotime($c['expires_at']) < $now) return $fail('This coupon has expired.');
    if ($c['usage_limit'] !== null && (int) $c['used_count'] >= (int) $c['usage_limit']) return $fail('This coupon has been fully used.');
    if ($subtotal < (int) $c['min_order']) return $fail('Add items worth ₹' . (int) $c['min_order'] . ' or more to use this coupon.');
    if ($c['per_customer_limit'] !== null) {
        if ($customerId <= 0 && !$email) return $fail('Sign in or enter your email to use this coupon.');
        if (coupon_customer_uses($conn, (int) $c['id'], $customerId, $email) >= (int) $c['per_customer_limit']) {
            return $fail('You have already used this coupon.');
        }
    }
    $discount = 0;
    $free = false;
    if ($c['type'] === 'percent') {
        $discount = (int) floor($subtotal * (int) $c['value'] / 100);
        if ($c['max_discount'] !== null) $discount = min($discount, (int) $c['max_discount']);
    } elseif ($c['type'] === 'fixed') {
        $discount = (int) $c['value'];
    } else {
        $free = true;
    }
    // A coupon can never make the goods free or negative.
    $discount = max(0, min($discount, (int) floor($subtotal) - 1));
    return ['ok' => true, 'reason' => null, 'discount' => $discount, 'freeShipping' => $free, 'coupon' => $c];
}

/* ───────────── Whole-order quote ───────────── */

/**
 * The single place the order total is decided. Used by the cart preview
 * (checkout-quote.php) and by create-order.php, so both always agree.
 */
function marketing_quote(mysqli $conn, float $subtotal, string $couponCode, bool $usePoints, int $customerId, ?string $email): array {
    $out = [
        'subtotal' => $subtotal, 'shipping' => $subtotal > MKT_FREE_SHIPPING_ABOVE ? 0 : MKT_SHIPPING_FEE,
        'couponCode' => null, 'couponDiscount' => 0, 'couponError' => null, 'couponId' => null,
        'pointsUsed' => 0, 'pointsDiscount' => 0, 'pointsError' => null, 'pointsBalance' => 0,
        'loyaltyEnabled' => false, 'pointsPerRupee' => 1,
    ];
    $cfg = loyalty_config($conn);
    $out['loyaltyEnabled'] = $cfg['enabled'];
    $out['pointsPerRupee'] = $cfg['pointsPerRupee'];
    if ($customerId > 0 && $cfg['enabled']) $out['pointsBalance'] = loyalty_balance($conn, $customerId, $cfg, false);

    if ($couponCode !== '') {
        $q = coupon_quote($conn, $couponCode, $subtotal, $customerId, $email);
        if ($q['ok']) {
            $out['couponCode'] = $q['coupon']['code'];
            $out['couponId'] = (int) $q['coupon']['id'];
            $out['couponDiscount'] = $q['discount'];
            if ($q['freeShipping']) $out['shipping'] = 0;
        } else {
            $out['couponError'] = $q['reason'];
        }
    }

    if ($usePoints) {
        $bal = $out['pointsBalance'];
        if (!$cfg['enabled']) $out['pointsError'] = 'Reward points are not available right now.';
        elseif ($customerId <= 0) $out['pointsError'] = 'Sign in to use your points.';
        elseif ($out['couponCode']) $out['pointsError'] = 'Points cannot be combined with a coupon.';
        elseif ($bal < max(1, $cfg['minRedeemPoints'])) $out['pointsError'] = 'You need at least ' . max(1, $cfg['minRedeemPoints']) . ' points to redeem.';
        else {
            $cap = (int) floor($subtotal * $cfg['maxRedeemPercent'] / 100);
            $rupees = min((int) floor($bal / $cfg['pointsPerRupee']), $cap, max(0, (int) floor($subtotal) - 1));
            if ($rupees <= 0) $out['pointsError'] = 'This order is too small to use points on.';
            else { $out['pointsDiscount'] = $rupees; $out['pointsUsed'] = $rupees * $cfg['pointsPerRupee']; }
        }
    }

    $out['total'] = max(0, $subtotal - $out['couponDiscount'] - $out['pointsDiscount'] + $out['shipping']);
    $out['pointsToEarn'] = $cfg['enabled'] && $customerId > 0
        ? loyalty_points_for($cfg, $subtotal - $out['couponDiscount'] - $out['pointsDiscount']) : 0;
    return $out;
}

/** Public shape of a quote (no internal ids). */
function marketing_public_quote(array $q): array {
    unset($q['couponId']);
    return $q;
}

/* ───────────── Order status hooks ───────────── */

/** Called by update-order.php after a status change. Safe to call twice. */
function marketing_on_status_change(mysqli $conn, string $orderCode, string $from, string $to): void {
    if ($from === $to) return;
    $st = $conn->prepare('SELECT customer_id, subtotal, coupon_code, coupon_discount, points_used, points_discount, total_amount FROM orders WHERE order_code = ?');
    $st->bind_param('s', $orderCode);
    $st->execute();
    $o = $st->get_result()->fetch_assoc();
    if (!$o) return;
    $customerId = (int) $o['customer_id'];
    // Only registered accounts collect points; guest records have no password.
    if ($customerId > 0) {
        $acc = $conn->prepare('SELECT password_hash FROM customers WHERE id = ?');
        $acc->bind_param('i', $customerId);
        $acc->execute();
        $a = $acc->get_result()->fetch_assoc();
        if (!$a || empty($a['password_hash'])) $customerId = 0;
    }

    if ($to === 'Delivered' && $customerId > 0) {
        $cfg = loyalty_config($conn);
        if ($cfg['enabled']) {
            $goods = $o['subtotal'] !== null ? (float) $o['subtotal'] : (float) $o['total_amount'];
            $paid = $goods - (float) $o['coupon_discount'] - (float) $o['points_discount'];
            $pts = loyalty_points_for($cfg, $paid);
            if ($pts > 0) loyalty_add($conn, $customerId, $pts, 'earn', $orderCode, 'Order ' . $orderCode . ' delivered');
        }
    }

    if ($to === 'Cancelled') {
        if ($customerId > 0 && (int) $o['points_used'] > 0) {
            loyalty_add($conn, $customerId, (int) $o['points_used'], 'refund', $orderCode, 'Order ' . $orderCode . ' cancelled, points returned');
        }
        if ($customerId > 0) {
            $e = $conn->prepare("SELECT points FROM loyalty_ledger WHERE order_code = ? AND kind = 'earn' LIMIT 1");
            $e->bind_param('s', $orderCode);
            $e->execute();
            $row = $e->get_result()->fetch_assoc();
            if ($row && (int) $row['points'] > 0) {
                loyalty_add($conn, $customerId, -(int) $row['points'], 'clawback', $orderCode, 'Order ' . $orderCode . ' cancelled, earned points removed');
            }
        }
        // Free the coupon use so the customer can use it again.
        $r = $conn->prepare('SELECT coupon_id FROM coupon_redemptions WHERE order_code = ?');
        $r->bind_param('s', $orderCode);
        $r->execute();
        $red = $r->get_result()->fetch_assoc();
        if ($red) {
            $d = $conn->prepare('DELETE FROM coupon_redemptions WHERE order_code = ?');
            $d->bind_param('s', $orderCode);
            $d->execute();
            if ($d->affected_rows > 0) {
                $cid = (int) $red['coupon_id'];
                $u = $conn->prepare('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?');
                $u->bind_param('i', $cid);
                $u->execute();
            }
        }
    }
}
