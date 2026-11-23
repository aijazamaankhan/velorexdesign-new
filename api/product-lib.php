<?php
/** Product helpers shared by the product endpoints. */

/** Adds products.amazon_url on first use (MariaDB IF NOT EXISTS). */
function products_ensure_columns(mysqli $conn): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $conn->query('ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_url VARCHAR(500) NULL');
    } catch (Throwable $e) {
        error_log('products amazon_url column: ' . $e->getMessage());
    }
}

/**
 * Accepts only Amazon India product links (amazon.in, amzn.in, amzn.to).
 * Returns the cleaned link, '' for empty, or false when invalid.
 */
function products_clean_amazon_url($raw) {
    $u = is_string($raw) ? trim($raw) : '';
    if ($u === '') return '';
    if (strlen($u) > 500) return false;
    $p = parse_url($u);
    if (!$p || ($p['scheme'] ?? '') !== 'https') return false;
    $host = strtolower($p['host'] ?? '');
    if (!preg_match('/(^|\.)(amazon\.in|amzn\.in|amzn\.to)$/', $host)) return false;
    return $u;
}
