<?php
require_once 'db.php';
session_start();

unset($_SESSION['customer_id'], $_SESSION['customer_email'], $_SESSION['customer_name']);

sendResponse(['success' => true]);
?>
