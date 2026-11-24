<?php
/** Chat assistant storage and helpers. */
function chat_ensure_tables(mysqli $conn): bool {
    static $ready = null;
    if ($ready !== null) return $ready;
    try {
        $conn->query("CREATE TABLE IF NOT EXISTS chat_messages (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            contact VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            transcript TEXT NULL,
            status ENUM('new','done') NOT NULL DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_chat_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        // Admin-edited answers (override the built-in text in js/chat.js).
        $conn->query("CREATE TABLE IF NOT EXISTS chat_replies (
            reply_key VARCHAR(40) PRIMARY KEY,
            html TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        // What visitors ask: the matched topic, or the words when nothing matched.
        $conn->query("CREATE TABLE IF NOT EXISTS chat_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            topic VARCHAR(40) NOT NULL,
            text VARCHAR(200) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_chat_events (created_at, topic)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $ready = true;
    } catch (Throwable $e) {
        error_log('chat tables: ' . $e->getMessage());
        $ready = false;
    }
    return $ready;
}

/** Answer keys the admin may edit; must match ANSWERS in js/chat.js. */
const CHAT_REPLY_KEYS = ['buy', 'price', 'shipping', 'returns', 'vijaysar', 'health', 'material', 'bulk', 'contact', 'order', 'custom', 'payment', 'care', 'story', 'ventures'];

/**
 * Keeps admin-written answers safe to show: only simple formatting tags and
 * links to http(s), mailto, tel or site pages survive; everything else is escaped.
 */
function chat_clean_html(string $html): string {
    $out = htmlspecialchars(mb_substr($html, 0, 4000), ENT_QUOTES, 'UTF-8');
    $out = preg_replace('#&lt;(/?)(b|i|strong|em|ul|li)&gt;#i', '<$1$2>', $out);
    $out = preg_replace('#&lt;br\s*/?&gt;#i', '<br>', $out);
    $out = preg_replace_callback(
        '#&lt;a href=&quot;((?:https?://|mailto:|tel:|/)[^&"<>\s]*)&quot;&gt;(.*?)&lt;/a&gt;#i',
        function ($m) { return '<a href="' . $m[1] . '">' . $m[2] . '</a>'; },
        $out
    );
    return nl2br($out, false);
}
