<?php
header('Content-Type: application/json');

// Error handling
function sendError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

// Check if request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Get input data
$input = json_decode(file_get_contents('php://input'), true);
$url = $input['url'] ?? null;
$apiKey = $input['apiKey'] ?? null;
$prompt = $input['prompt'] ?? null;

if (!$url || !$apiKey || !$prompt) {
    sendError('Missing required parameters');
}

// Load config
$config = json_decode(file_get_contents('../config.json'), true);

// 1. Scrape content
function scrape($url, $userAgent, $timeout) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, $userAgent);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $content = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    
    if ($info['http_code'] !== 200) {
        return false;
    }
    
    return $content;
}

$rawHtml = scrape($url, $config['scraper']['user_agent'], $config['scraper']['timeout']);

if (!$rawHtml) {
    sendError('Failed to fetch the URL');
}

// 2. Clean HTML
function cleanHtml($html) {
    // Remove scripts and styles
    $html = preg_replace('/<(script|style|iframe|noscript|svg|canvas)[^>]*>.*?<\/\1>/is', '', $html);
    // Remove comments
    $html = preg_replace('/<!--.*?-->/s', '', $html);
    // Remove all attributes except href for links (optional, but keeps it smaller)
    // Actually, for OpenAI, it's better to just keep text and some structure.
    
    // Convert to simplified version
    $dom = new DOMDocument();
    @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    
    $xpath = new DOMXPath($dom);
    
    // Basic body extraction
    $body = $dom->getElementsByTagName('body')->item(0);
    if ($body) {
        $cleanContent = $dom->saveHTML($body);
    } else {
        $cleanContent = $dom->saveHTML();
    }
    
    // Further stripping of tags but keeping content
    $cleanContent = strip_tags($cleanContent, '<div><span><p><h1><h2><h3><h4><h5><h6><ul><li><table><tr><td><th><a>');
    
    // Remove excessive whitespace
    $cleanContent = preg_replace('/\s+/', ' ', $cleanContent);
    $cleanContent = trim($cleanContent);
    
    // Truncate to avoid exceeding context limits (roughly)
    // 1 token ~= 4 chars. 4o-mini has 128k context, but we want to be efficient.
    // Let's cap at 50,000 characters for the cleaned HTML.
    if (strlen($cleanContent) > 50000) {
        $cleanContent = substr($cleanContent, 0, 50000) . '... [TRUNCATED]';
    }
    
    return $cleanContent;
}

$cleanedHtml = cleanHtml($rawHtml);

// 3. Call OpenAI
function callOpenAI($apiKey, $model, $temperature, $maxTokens, $cleanedHtml, $userPrompt) {
    $apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    $messages = [
        [
            'role' => 'system',
            'content' => 'You are a web scraping assistant. Your goal is to parse the provided HTML content and extract structured data as JSON based on the user\'s instructions. Only return valid JSON.'
        ],
        [
            'role' => 'user',
            'content' => "HTML Content:\n$cleanedHtml\n\nInstructions: $userPrompt\n\nResult (valid JSON):"
        ]
    ];
    
    $data = [
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature,
        'max_tokens' => $maxTokens,
        'response_format' => ['type' => 'json_object']
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    
    if ($info['http_code'] !== 200) {
        $errorResponse = json_decode($response, true);
        $errorMessage = $errorResponse['error']['message'] ?? 'OpenAI API request failed';
        return ['error' => $errorMessage];
    }
    
    return json_decode($response, true);
}

$openaiResponse = callOpenAI(
    $apiKey,
    $config['openai']['model'],
    $config['openai']['temperature'],
    $config['openai']['max_tokens'],
    $cleanedHtml,
    $prompt
);

if (isset($openaiResponse['error'])) {
    sendError($openaiResponse['error'], 500);
}

$result = json_decode($openaiResponse['choices'][0]['message']['content'], true);

echo json_encode([
    'success' => true,
    'data' => $result,
    'usage' => $openaiResponse['usage']
]);
