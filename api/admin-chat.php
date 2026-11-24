<?php
/**
 * Admin: chat assistant inbox, answer editor and question stats.
 *   GET -> { messages, unread, replies, topics, unmatched }
 *   POST { action: 'done'|'reopen'|'delete', id }
 *   POST { action: 'save-reply', key, html } | { action: 'reset-reply', key }
 */
require_once 'db.php';
require_once 'chat-lib.php';
session_start();

if (!admin_session_ok()) sendResponse(['error' => 'Unauthorized'], 401);
if (!chat_ensure_tables($conn)) sendResponse(['error' => 'Messages are unavailable'], 500);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = [];
    $res = $conn->query("SELECT id, name, contact, message, transcript, status, created_at FROM chat_messages ORDER BY status = 'new' DESC, created_at DESC LIMIT 300");
    while ($r = $res->fetch_assoc()) { $r['id'] = (int) $r['id']; $rows[] = $r; }
    $unread = (int) $conn->query("SELECT COUNT(*) AS n FROM chat_messages WHERE status = 'new'")->fetch_assoc()['n'];

    $replies = [];
    $res = $conn->query('SELECT reply_key, html, updated_at FROM chat_replies');
    while ($r = $res->fetch_assoc()) $replies[$r['reply_key']] = $r;

    $topics = [];
    $res = $conn->query('SELECT topic, COUNT(*) AS n FROM chat_events WHERE created_at > NOW() - INTERVAL 30 DAY GROUP BY topic ORDER BY n DESC');
    while ($r = $res->fetch_assoc()) $topics[] = ['topic' => $r['topic'], 'n' => (int) $r['n']];

    $unmatched = [];
    $res = $conn->query("SELECT text, COUNT(*) AS n FROM chat_events WHERE topic = 'unmatched' AND text <> '' AND created_at > NOW() - INTERVAL 30 DAY GROUP BY text ORDER BY n DESC LIMIT 25");
    while ($r = $res->fetch_assoc()) $unmatched[] = ['text' => $r['text'], 'n' => (int) $r['n']];

    sendResponse(['messages' => $rows, 'unread' => $unread, 'replies' => $replies, 'topics' => $topics, 'unmatched' => $unmatched]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) sendResponse(['error' => 'Invalid request'], 422);
$action = (string) ($in['action'] ?? '');

if ($action === 'save-reply' || $action === 'reset-reply') {
    $key = (string) ($in['key'] ?? '');
    if (!in_array($key, CHAT_REPLY_KEYS, true)) sendResponse(['error' => 'Unknown answer'], 422);
    if ($action === 'reset-reply') {
        $st = $conn->prepare('DELETE FROM chat_replies WHERE reply_key = ?');
        $st->bind_param('s', $key);
    } else {
        $html = chat_clean_html((string) ($in['html'] ?? ''));
        if (trim(strip_tags($html)) === '') sendResponse(['error' => 'The answer cannot be empty'], 422);
        $st = $conn->prepare('INSERT INTO chat_replies (reply_key, html) VALUES (?, ?) ON DUPLICATE KEY UPDATE html = VALUES(html)');
        $st->bind_param('ss', $key, $html);
    }
    $st->execute();
    sendResponse(['success' => true]);
}

$id = isset($in['id']) && is_numeric($in['id']) ? (int) $in['id'] : 0;
if ($id <= 0) sendResponse(['error' => 'Message id required'], 422);

if ($action === 'delete') {
    $st = $conn->prepare('DELETE FROM chat_messages WHERE id = ?');
    $st->bind_param('i', $id);
} elseif ($action === 'done' || $action === 'reopen') {
    $status = $action === 'done' ? 'done' : 'new';
    $st = $conn->prepare('UPDATE chat_messages SET status = ? WHERE id = ?');
    $st->bind_param('si', $status, $id);
} else {
    sendResponse(['error' => 'Unknown action'], 422);
}
$st->execute();
sendResponse(['success' => true]);
