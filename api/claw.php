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
$mode = $input['mode'] ?? 'standard';
$apiKey = $input['apiKey'] ?? null;

if (!$apiKey) {
    sendError('Missing API Key');
}

// Load config
$config = json_decode(file_get_contents('../config.json'), true);

// Scraper function
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

// Clean HTML function
function cleanHtml($html) {
    $html = preg_replace('/<(script|style|iframe|noscript|svg|canvas)[^>]*>.*?<\/\1>/is', '', $html);
    $html = preg_replace('/<!--.*?-->/s', '', $html);
    
    $dom = new DOMDocument();
    @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    
    $body = $dom->getElementsByTagName('body')->item(0);
    $cleanContent = $body ? $dom->saveHTML($body) : $dom->saveHTML();
    
    $cleanContent = strip_tags($cleanContent, '<div><span><p><h1><h2><h3><h4><h5><h6><ul><li><table><tr><td><th><a>');
    $cleanContent = preg_replace('/\s+/', ' ', $cleanContent);
    $cleanContent = trim($cleanContent);
    
    if (strlen($cleanContent) > 30000) { // Reduced to allow multiple pages in context
        $cleanContent = substr($cleanContent, 0, 30000) . '... [TRUNCATED]';
    }
    
    return $cleanContent;
}

// Prepare content based on mode
$contextData = "";
if ($mode === 'cro') {
    $urls = $input['urls'] ?? [];
    if (count($urls) < 2) {
        sendError('At least 2 URLs are required for comparison');
    }
    foreach ($urls as $index => $url) {
        if (empty($url)) continue;
        $raw = scrape($url, $config['scraper']['user_agent'], $config['scraper']['timeout']);
        if ($raw) {
            $cleaned = cleanHtml($raw);
            $contextData .= "--- PAGE " . ($index + 1) . " (URL: $url) ---\n$cleaned\n\n";
        } else {
            $contextData .= "--- PAGE " . ($index + 1) . " (URL: $url) ---\nFAILED TO FETCH\n\n";
        }
    }
    $systemPrompt = "You are a Conversion Rate Optimization (CRO) expert. Your goal is to compare the provided web pages and identify which one has the best conversion potential based on UX, design patterns, and copywriting. Provide your analysis in structured JSON.";
    $userPrompt = "Compare these pages and decide which is better for conversion. Identify strengths and weaknesses for each.\n\n$contextData";
} elseif ($mode === 'enhanced') {
    $url = $input['url'] ?? null;
    $instructions = $input['prompt'] ?? '';
    if (!$url) sendError('Target URL is required');
    
    $raw = scrape($url, $config['scraper']['user_agent'], $config['scraper']['timeout']);
    if (!$raw) sendError('Failed to fetch the URL');
    
    $cleaned = cleanHtml($raw);
    $systemPrompt = "You are a Scraping and CRO Expert. Your goal is to extract data and provide a detailed analysis. You MUST return a JSON object with exactly three keys: 'json_data' (structured object of extracted info), 'html_table' (a string containing a clean HTML table of the key data), and 'text_report' (a detailed text-based CRO and UX analysis).";
    $userPrompt = "HTML Content:\n$cleaned\n\nInstructions: $instructions\n\nExtract the data and provide the table and report.";
} else {
    $url = $input['url'] ?? null;
    $instructions = $input['prompt'] ?? null;
    if (!$url || !$instructions) sendError('Missing URL or Prompt');
    
    $raw = scrape($url, $config['scraper']['user_agent'], $config['scraper']['timeout']);
    if (!$raw) sendError('Failed to fetch the URL');
    
    $cleaned = cleanHtml($raw);
    $systemPrompt = "You are a web scraping assistant. Your goal is to parse the provided HTML content and extract structured data as JSON based on the user's instructions. Only return valid JSON.";
    $userPrompt = "HTML Content:\n$cleaned\n\nInstructions: $instructions\n\nResult (valid JSON):";
}

// Call OpenAI
$apiUrl = 'https://api.openai.com/v1/chat/completions';
$messages = [
    ['role' => 'system', 'content' => $systemPrompt],
    ['role' => 'user', 'content' => $userPrompt]
];

$data = [
    'model' => $config['openai']['model'],
    'messages' => $messages,
    'temperature' => $config['openai']['temperature'],
    'max_tokens' => $config['openai']['max_tokens'],
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
    sendError($errorMessage, 500);
}

$openaiResult = json_decode($response, true);
$content = json_decode($openaiResult['choices'][0]['message']['content'], true);

echo json_encode([
    'success' => true,
    'mode' => $mode,
    'data' => $content,
    'usage' => $openaiResult['usage']
]);
