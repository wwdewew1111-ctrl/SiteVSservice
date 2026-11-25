<?php
declare(strict_types=1);

// Only public reads and the existing authenticated admin function are proxied.
const SUPABASE_BASE = 'https://dydsgyjwjbrcymkvzrji.supabase.co';
const PUBLIC_TABLES = [
    'matches', 'news', 'players', 'gallery_photos', 'merch_products',
    'merch_settings', 'site_settings', 'esea_state',
];
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function fail(int $status, string $message): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$path = $_SERVER['PATH_INFO'] ?? '';
if ($path === '') {
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    if (is_string($requestPath) && $script !== '' && str_starts_with($requestPath, $script . '/')) {
        $path = substr($requestPath, strlen($script));
    }
}
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$isRead = $method === 'GET' && preg_match('~^/rest/v1/([a-z_]+)$~D', $path, $matches)
    && in_array($matches[1], PUBLIC_TABLES, true);
$isAdmin = $method === 'POST' && $path === '/functions/v1/site-admin';
if (!$isRead && !$isAdmin) {
    fail(404, 'Маршрут не найден');
}

$key = $_SERVER['HTTP_APIKEY'] ?? '';
if (!is_string($key) || strlen($key) > 256 || !preg_match('~^sb_publishable_[A-Za-z0-9_-]+$~D', $key)) {
    fail(400, 'Некорректный публичный ключ');
}

$query = $_SERVER['QUERY_STRING'] ?? '';
if (strlen($query) > 8192 || preg_match('/[\r\n]/', $query)) {
    fail(400, 'Некорректный запрос');
}
$url = SUPABASE_BASE . $path . ($query !== '' ? '?' . $query : '');
$headers = ['apikey: ' . $key, 'Accept: application/json'];
if ($isAdmin) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    $expectedOrigin = 'https://' . ($_SERVER['HTTP_HOST'] ?? '');
    if (($origin !== '' && $origin !== $expectedOrigin) || ($fetchSite !== '' && $fetchSite !== 'same-origin')) {
        fail(403, 'Недопустимый источник запроса');
    }
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (!preg_match('~^application/json(?:\s*;|$)~i', $contentType)) {
        fail(415, 'Требуется JSON');
    }
    $body = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
    if ($body === false) fail(400, 'Не удалось прочитать запрос');
    if (strlen($body) > MAX_BODY_BYTES) fail(413, 'Запрос слишком большой');
    $headers[] = 'Content-Type: application/json';
}

if (!function_exists('curl_init')) fail(503, 'На сервере недоступен PHP cURL');
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => $isAdmin ? 120 : 30,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_HTTPHEADER => $headers,
]);
if ($isAdmin) {
    curl_setopt($curl, CURLOPT_POST, true);
    curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
}
$response = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
unset($curl);
if ($response === false || $status < 100 || ($status >= 300 && $status < 400)) {
    fail(502, 'Не удалось получить ответ от сервера данных');
}
http_response_code($status);
header('Content-Type: application/json; charset=utf-8');
echo $response;
