<?php
/**
 * Chat assistant: "Leave a message". Saves the message for the admin inbox.
 * POST { name, contact, message, transcript, website (honeypot) }
 * Rate limited and honeypot-protected like the IT enquiry form.
 */
require_once 'db.php';
require_once 'chat-lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(['error' => 'Invalid request method'], 405);
rateLimitCheck('chat-message', 5, 3600);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) sendResponse(['error' => 'Invalid message'], 422);
if (strField($in, 'website', 200) !== '') sendResponse(['success' => true]); // bot

$name = strField($in, 'name', 120);
$contact = strField($in, 'contact', 150);
$message = strField($in, 'message', 1500);
$transcript = strField($in, 'transcript', 3000);

if ($name === '' || $message === '') sendResponse(['error' => 'Please add your name and message'], 422);
$isEmail = filter_var($contact, FILTER_VALIDATE_EMAIL);
$isPhone = preg_match('/^[0-9+\-\s()]{7,20}$/', $contact);
if (!$isEmail && !$isPhone) sendResponse(['error' => 'Please add a valid phone number or email so we can reply'], 422);

if (!chat_ensure_tables($conn)) sendResponse(['error' => 'Messages are unavailable right now. Please use WhatsApp.'], 503);
rateLimitHit('chat-message', 3600);

$st = $conn->prepare('INSERT INTO chat_messages (name, contact, message, transcript) VALUES (?, ?, ?, ?)');
$st->bind_param('ssss', $name, $contact, $message, $transcript);
if (!$st->execute()) sendResponse(['error' => 'Could not send. Please use WhatsApp.'], 500);
sendResponse(['success' => true]);
