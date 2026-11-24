<?php
require_once 'db.php';
session_start();

if (admin_session_ok()) {
    sendResponse([
        'authenticated' => true,
        'admin' => [
            'id' => $_SESSION['admin_id'],
            'email' => $_SESSION['admin_email'] ?? null,
            'name' => $_SESSION['admin_name'] ?? null
        ]
    ]);
}
sendResponse(['authenticated' => false], 401);
?>