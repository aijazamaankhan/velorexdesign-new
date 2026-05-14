<?php
/**
 * One-time setup endpoint for Velorex Design.
 *
 * Visit https://your-domain/api/setup.php once after deploying.
 * It is idempotent — running it again only resets the admin password.
 *
 * IMPORTANT: delete this file after successful setup.
 */

require_once 'db.php';

$tables = [
    'admins' => "CREATE TABLE IF NOT EXISTS admins (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    'customers' => "CREATE TABLE IF NOT EXISTS customers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NULL,
        phone VARCHAR(30) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_customer_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    'products' => "CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        stock INT NOT NULL DEFAULT 0,
        image_url VARCHAR(255) NULL,
        images TEXT NULL,
        description TEXT NULL,
        featured TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    'orders' => "CREATE TABLE IF NOT EXISTS orders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        customer_id INT UNSIGNED NULL,
        order_code VARCHAR(100) NOT NULL UNIQUE,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        shipping_address TEXT NULL,
        shipping_city VARCHAR(100) NULL,
        shipping_zip VARCHAR(50) NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(150) NULL,
        tracking_number VARCHAR(100) NULL,
        admin_note TEXT NULL,
        status_history TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    'order_items' => "CREATE TABLE IF NOT EXISTS order_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NULL,
        name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    'customer_addresses' => "CREATE TABLE IF NOT EXISTS customer_addresses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        customer_id INT UNSIGNED NOT NULL,
        title VARCHAR(80) NOT NULL DEFAULT 'Address',
        street TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        zip VARCHAR(50) NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
];

$createdTables = [];
foreach ($tables as $name => $sql) {
    if (!$conn->query($sql)) {
        sendResponse(['error' => 'Failed creating table ' . $name . ': ' . $conn->error], 500);
    }
    $createdTables[] = $name;
}

$columnAdded = false;
$check = $conn->query("SHOW COLUMNS FROM products LIKE 'images'");
if ($check && $check->num_rows === 0) {
    if ($conn->query("ALTER TABLE products ADD COLUMN images TEXT NULL AFTER image_url")) {
        $columnAdded = true;
    }
}

// Migrate customers table for customer accounts (idempotent).
$customerMigrations = [];
$pwCheck = $conn->query("SHOW COLUMNS FROM customers LIKE 'password_hash'");
if ($pwCheck && $pwCheck->num_rows === 0) {
    if ($conn->query("ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255) NULL AFTER phone")) {
        $customerMigrations[] = 'added password_hash';
    }
}
$updCheck = $conn->query("SHOW COLUMNS FROM customers LIKE 'updated_at'");
if ($updCheck && $updCheck->num_rows === 0) {
    if ($conn->query("ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")) {
        $customerMigrations[] = 'added updated_at';
    }
}

// Convert legacy empty-string emails to NULL. The unique index allows many
// NULLs but rejects duplicate empty strings, which blocked subsequent guest
// checkouts. Safe to run repeatedly.
if ($conn->query("UPDATE customers SET email = NULL WHERE email = ''")) {
    if ($conn->affected_rows > 0) {
        $customerMigrations[] = 'normalised ' . $conn->affected_rows . ' blank emails to NULL';
    }
}

$uploadDir = __DIR__ . '/uploads/products';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

$adminUsername = 'owner';
$adminPassword = 'owner123';
$adminName = 'Owner';
$adminHash = password_hash($adminPassword, PASSWORD_BCRYPT);

$stmt = $conn->prepare('SELECT id FROM admins WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $adminUsername);
$stmt->execute();
$existing = $stmt->get_result();

if ($existing->num_rows === 0) {
    $insert = $conn->prepare('INSERT INTO admins (name, email, password_hash, created_at) VALUES (?, ?, ?, NOW())');
    $insert->bind_param('sss', $adminName, $adminUsername, $adminHash);
    $insert->execute();
    $adminMessage = 'Admin user created.';
} else {
    $update = $conn->prepare('UPDATE admins SET password_hash = ? WHERE email = ?');
    $update->bind_param('ss', $adminHash, $adminUsername);
    $update->execute();
    $adminMessage = 'Admin password reset.';
}

sendResponse([
    'success' => true,
    'tables_ready' => $createdTables,
    'images_column_added' => $columnAdded,
    'customer_migrations' => $customerMigrations,
    'uploads_dir' => is_dir($uploadDir) ? 'ready' : 'missing — create api/uploads/products/ manually with write permission',
    'admin' => [
        'message' => $adminMessage,
        'username' => $adminUsername,
        'password' => $adminPassword
    ],
    'next_steps' => [
        '1. Open admin.html and log in with username "' . $adminUsername . '" / password "' . $adminPassword . '".',
        '2. Set your WhatsApp number in Settings (checkout uses it for order confirmation).',
        '3. DELETE this file (api/setup.php) once everything works.'
    ]
]);
?>
