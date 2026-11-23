<?php
/** Signed-in customer's points balance, history and the programme rules. */
require_once 'db.php';
require_once 'marketing-lib.php';
session_start();

if (!marketing_ensure_tables($conn)) sendResponse(['enabled' => false]);
$cfg = loyalty_config($conn);
$public = [
    'enabled' => $cfg['enabled'], 'earnPercent' => $cfg['earnPercent'], 'pointsPerRupee' => $cfg['pointsPerRupee'],
    'maxRedeemPercent' => $cfg['maxRedeemPercent'], 'minRedeemPoints' => $cfg['minRedeemPoints'],
    'signupBonus' => $cfg['signupBonus'], 'expiryMonths' => $cfg['expiryMonths'],
];
$customerId = !empty($_SESSION['customer_id']) ? (int) $_SESSION['customer_id'] : 0;
if ($customerId <= 0) sendResponse(['config' => $public, 'signedIn' => false]);

sendResponse([
    'config' => $public,
    'signedIn' => true,
    'balance' => $cfg['enabled'] ? loyalty_balance($conn, $customerId, $cfg) : 0,
    'history' => loyalty_history($conn, $customerId, 50),
]);
