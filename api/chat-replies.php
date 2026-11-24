<?php
/** Public: admin-edited chat answers (overrides for js/chat.js). Cached 5 minutes. */
require_once 'db.php';
require_once 'chat-lib.php';
header('Cache-Control: public, max-age=300');

$out = [];
if ($conn && chat_ensure_tables($conn)) {
    $res = $conn->query('SELECT reply_key, html FROM chat_replies');
    while ($res && ($r = $res->fetch_assoc())) {
        if (in_array($r['reply_key'], CHAT_REPLY_KEYS, true)) $out[$r['reply_key']] = $r['html'];
    }
}
sendResponse(['replies' => $out]);
