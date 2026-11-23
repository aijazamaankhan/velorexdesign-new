<?php
/**
 * IT services enquiry (Velorex Studio popup in the footer).
 * Emails the enquiry to the studio inbox. The inbox address stays on the
 * server, so it is never exposed in the page source for spam harvesters.
 *
 * Override the recipient by adding ENQUIRY_EMAIL=someone@example.com to .env.
 */
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['error' => 'Invalid request method'], 405);
}

// At most 5 enquiries per hour from one IP address.
rateLimitCheck('it-enquiry', 5, 3600);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    sendResponse(['error' => 'Invalid enquiry data'], 422);
}

// Hidden field that people never see or fill. Bots fill every field, so a
// value here means spam: answer "sent" without sending anything.
if (strField($input, 'website', 200) !== '') {
    sendResponse(['success' => true]);
}

$name    = strField($input, 'name', 120);
$phone   = strField($input, 'phone', 20);
$email   = strtolower(strField($input, 'email', 160));
$service = strField($input, 'service', 80);
$budget  = strField($input, 'budget', 40);
$message = strField($input, 'message', 2000);

if ($name === '' || $service === '' || $message === '') {
    sendResponse(['error' => 'Name, service and project details are required'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(['error' => 'Please enter a valid email address'], 422);
}
if (!preg_match('/^[0-9+\-\s()]{7,20}$/', $phone)) {
    sendResponse(['error' => 'Please enter a valid mobile number'], 422);
}

// Anything that ends up in a mail header must be a single line, otherwise a
// visitor could add their own headers (for example Bcc) and send spam through us.
$oneLine = function ($v) { return trim(preg_replace('/[\r\n\t]+/', ' ', $v)); };
$name    = $oneLine($name);
$service = $oneLine($service);
$budget  = $oneLine($budget);

$to = getenv('ENQUIRY_EMAIL') ?: ($_ENV['ENQUIRY_EMAIL'] ?? 'thevelorexdesign@gmail.com');

// Send from an address on this site's own domain. Mail servers reject messages
// that claim to come from the visitor's address; their address goes in Reply-To.
$host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
$host = preg_replace('/^www\./', '', $host);
if (!preg_match('/^[a-z0-9.-]+$/', $host)) $host = 'localhost';
$from = 'no-reply@' . $host;

$subject = 'IT services enquiry: ' . $service . ' (' . $name . ')';

$body = "New IT services enquiry from the Velorex Design website.\n\n"
      . "Service:  {$service}\n"
      . "Budget:   " . ($budget !== '' ? $budget : 'Not specified') . "\n\n"
      . "Name:     {$name}\n"
      . "Mobile:   {$phone}\n"
      . "Email:    {$email}\n\n"
      . "Project details:\n{$message}\n\n"
      . "--\nSent " . date('d M Y, H:i') . " from " . $host . "\n";

$headers = [
    'From: Velorex Design Website <' . $from . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];

rateLimitHit('it-enquiry', 3600);

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$sent = @mail($to, $encodedSubject, $body, implode("\r\n", $headers));

if (!$sent) {
    error_log('it-enquiry: mail() failed for enquiry from ' . $email);
    sendResponse(['error' => 'We could not send your enquiry right now. Please try again later.'], 500);
}

sendResponse(['success' => true]);
