<?php
/**
 * Public: records which topic a chat question matched, or the words when
 * nothing matched, for the admin's "what people ask" stats. Contact details
 * typed by mistake are blanked out before saving.
 */
require_once 'db.php';
require_once 'chat-lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
rateLimitCheck('chat-event', 60, 600);
rateLimitHit('chat-event', 600);

$in = json_decode(file_get_contents('php://input'), true);
$topic = preg_replace('/[^a-z_]/', '', strtolower(strField($in, 'topic', 40)));
if ($topic === '') sendResponse(['ok' => false], 422);

$text = $topic === 'unmatched' ? strField($in, 'text', 200) : '';
$text = preg_replace(['/\S+@\S+/', '/\+?\d[\d\s-]{7,}\d/'], ['[email]', '[number]'], $text);

if (!chat_ensure_tables($conn)) sendResponse(['ok' => false], 503);
$st = $conn->prepare('INSERT INTO chat_events (topic, text) VALUES (?, ?)');
$st->bind_param('ss', $topic, $text);
$st->execute();
sendResponse(['ok' => true]);
