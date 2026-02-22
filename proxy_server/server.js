require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { URL } = require('url');
const { spawn } = require('child_process');

// --- Web Search (Tavily + Jina Reader) ---

const SEARCH_TRIGGERS = [
    /\b(today|yesterday|this (week|month|year)|right now|currently|latest|recent|newest)\b/i,
    /\b(breaking|just announced|just released|as of \d{4})\b/i,
    /\b(what('s| is| are) the? (current|latest|newest|price|score|weather))\b/i,
    /\b(news about|update on|what happened (to|with|at)|who won|who is the current)\b/i,
    /\b(20(24|25|26))\b/,
    /\b(stock price|weather forecast|election results|release date)\b/i,
];

function heuristicNeedsSearch(text) {
    return SEARCH_TRIGGERS.some(re => re.test(text));
}

function extractUrls(text) {
    const urlRegex = /https?:\/\/[^\s)>,"'\]]+/g;
    return [...new Set(text.match(urlRegex) || [])];
}

// Jina Reader: fetches live page content as markdown, free, no API key needed
async function fetchPageViaJina(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s max
    try {
        const resp = await fetch(`https://r.jina.ai/${url}`, {
            headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
            signal: controller.signal
        });
        if (!resp.ok) throw new Error(`Jina HTTP ${resp.status}`);
        const text = await resp.text();
        return text.slice(0, 4000); // cap to avoid flooding context window
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchTavilyResults(query) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === 'your_tavily_api_key_here') {
        console.warn('[Search] TAVILY_API_KEY not set in .env — skipping search');
        return null;
    }
    const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: apiKey,
            query: query.slice(0, 300),
            max_results: 5,
            search_depth: 'basic'
        })
    });
    if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
    return resp.json();
}

const app = express();
const PORT = 3000;
const OLLAMA_API_BASE_URL = 'http://localhost:11434';
const extensionOrigin = 'chrome-extension://gkpfpdekobmonacdgjgbfehilnloaacm';

// Kokoro TTS state
let kokoroTTS = null;
let kokoroStatus = 'not_loaded'; // 'not_loaded' | 'loading' | 'ready' | 'error'
let kokoroLoadError = null;

// Static Kokoro voice metadata (from kokoro-js VOICES constant)
const KOKORO_VOICES = [
    { id: 'af_heart', name: 'Heart', language: 'en-us', gender: 'Female', grade: 'A' },
    { id: 'af_alloy', name: 'Alloy', language: 'en-us', gender: 'Female', grade: 'C' },
    { id: 'af_aoede', name: 'Aoede', language: 'en-us', gender: 'Female', grade: 'C+' },
    { id: 'af_bella', name: 'Bella', language: 'en-us', gender: 'Female', grade: 'A-' },
    { id: 'af_jessica', name: 'Jessica', language: 'en-us', gender: 'Female', grade: 'D' },
    { id: 'af_kore', name: 'Kore', language: 'en-us', gender: 'Female', grade: 'C+' },
    { id: 'af_nicole', name: 'Nicole', language: 'en-us', gender: 'Female', grade: 'B-' },
    { id: 'af_nova', name: 'Nova', language: 'en-us', gender: 'Female', grade: 'C' },
    { id: 'af_river', name: 'River', language: 'en-us', gender: 'Female', grade: 'D' },
    { id: 'af_sarah', name: 'Sarah', language: 'en-us', gender: 'Female', grade: 'C+' },
    { id: 'af_sky', name: 'Sky', language: 'en-us', gender: 'Female', grade: 'C-' },
    { id: 'am_adam', name: 'Adam', language: 'en-us', gender: 'Male', grade: 'F+' },
    { id: 'am_echo', name: 'Echo', language: 'en-us', gender: 'Male', grade: 'D' },
    { id: 'am_eric', name: 'Eric', language: 'en-us', gender: 'Male', grade: 'D' },
    { id: 'am_fenrir', name: 'Fenrir', language: 'en-us', gender: 'Male', grade: 'C+' },
    { id: 'am_liam', name: 'Liam', language: 'en-us', gender: 'Male', grade: 'D' },
    { id: 'am_michael', name: 'Michael', language: 'en-us', gender: 'Male', grade: 'C+' },
    { id: 'am_onyx', name: 'Onyx', language: 'en-us', gender: 'Male', grade: 'D' },
    { id: 'am_puck', name: 'Puck', language: 'en-us', gender: 'Male', grade: 'C+' },
    { id: 'am_santa', name: 'Santa', language: 'en-us', gender: 'Male', grade: 'D-' },
    { id: 'bf_alice', name: 'Alice', language: 'en-gb', gender: 'Female', grade: 'D' },
    { id: 'bf_emma', name: 'Emma', language: 'en-gb', gender: 'Female', grade: 'B-' },
    { id: 'bf_isabella', name: 'Isabella', language: 'en-gb', gender: 'Female', grade: 'C' },
    { id: 'bf_lily', name: 'Lily', language: 'en-gb', gender: 'Female', grade: 'D' },
    { id: 'bm_daniel', name: 'Daniel', language: 'en-gb', gender: 'Male', grade: 'D' },
    { id: 'bm_fable', name: 'Fable', language: 'en-gb', gender: 'Male', grade: 'C' },
    { id: 'bm_george', name: 'George', language: 'en-gb', gender: 'Male', grade: 'C' },
    { id: 'bm_lewis', name: 'Lewis', language: 'en-gb', gender: 'Male', grade: 'D+' },
];

async function loadKokoroModel() {
    if (kokoroStatus === 'ready' || kokoroStatus === 'loading') return;
    kokoroStatus = 'loading';
    kokoroLoadError = null;
    console.log('[TTS] Loading Kokoro model (q8, ~86MB first time)...');
    try {
        const { KokoroTTS } = await import('kokoro-js');
        kokoroTTS = await KokoroTTS.from_pretrained(
            'onnx-community/Kokoro-82M-v1.0-ONNX',
            { dtype: 'q8' }
        );
        kokoroStatus = 'ready';
        console.log('[TTS] Kokoro model loaded successfully');
    } catch (err) {
        kokoroStatus = 'error';
        kokoroLoadError = err.message;
        console.error('[TTS] Failed to load Kokoro model:', err);
    }
}

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origin === extensionOrigin) {
            callback(null, true);
        } else {
            console.warn(`CORS: Request from origin '${origin}' blocked. Expected '${extensionOrigin}'`);
            callback(new Error('Not allowed by CORS'));
        }
    }
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            try {
                req.body = JSON.parse(data);
            } catch (e) {
                // ignore
            }
            next();
        });
    } else {
        next();
    }
});

// --- Server Management ---

let serverInstance = null;

app.post('/api/shutdown', (req, res) => {
    res.json({ status: 'shutting_down' });
    setTimeout(() => {
        if (serverInstance) serverInstance.close();
        process.exit(0);
    }, 200);
});

// --- Kokoro TTS Endpoints ---

app.get('/api/tts/status', (req, res) => {
    res.json({
        status: kokoroStatus,
        error: kokoroLoadError
    });
});

app.get('/api/tts/voices', (req, res) => {
    // Voice list is static - no need to wait for model load
    res.json({ voices: KOKORO_VOICES });
});

app.post('/api/tts/load', async (req, res) => {
    // Pre-load the model so first TTS use is fast
    if (kokoroStatus === 'ready') {
        return res.json({ status: 'ready' });
    }
    if (kokoroStatus === 'loading') {
        return res.json({ status: 'loading' });
    }
    // Start loading in background, respond immediately
    loadKokoroModel();
    res.json({ status: 'loading' });
});

// Split text into sentences for chunked generation
function splitIntoSentences(text) {
    // Split on sentence-ending punctuation followed by space/newline, or on double newlines
    const chunks = text
        .split(/(?<=[.!?])\s+|(?:\r?\n){2,}/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    // Merge very short fragments into the previous chunk
    const merged = [];
    for (const chunk of chunks) {
        if (merged.length > 0 && chunk.length < 20) {
            merged[merged.length - 1] += ' ' + chunk;
        } else {
            merged.push(chunk);
        }
    }
    return merged.length > 0 ? merged : [text];
}

app.post('/api/tts/generate', async (req, res) => {
    const { text, voice } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'text is required' });
    }

    try {
        if (kokoroStatus === 'not_loaded' || kokoroStatus === 'error') {
            await loadKokoroModel();
        }
        if (kokoroStatus === 'loading') {
            return res.status(503).json({ status: 'loading', message: 'Model is loading, please try again shortly' });
        }
        if (kokoroStatus !== 'ready' || !kokoroTTS) {
            return res.status(500).json({ error: 'TTS model not available' });
        }

        const sentences = splitIntoSentences(text);
        console.log(`[TTS] Generating ${sentences.length} sentence(s) for ${text.length} chars`);

        res.setHeader('Content-Type', 'application/octet-stream');
        let sampleRateSent = false;
        let aborted = false;

        req.on('close', () => { aborted = true; });

        for (const sentence of sentences) {
            if (aborted) break;
            try {
                const audio = await kokoroTTS.generate(sentence, { voice: voice || undefined });
                const sampleRate = audio.sampling_rate || 24000;

                if (!sampleRateSent) {
                    res.setHeader('X-Sample-Rate', String(sampleRate));
                    sampleRateSent = true;
                }

                const pcmData = audio.audio; // Float32Array
                const buffer = Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
                res.write(buffer);
            } catch (sentenceErr) {
                console.error(`[TTS] Error generating sentence "${sentence.substring(0, 50)}...":`, sentenceErr.message);
                // Skip this sentence and continue with the rest
            }
        }

        res.end();
    } catch (err) {
        console.error('[TTS] Error generating speech:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.end();
        }
    }
});

// --- LLMFit Hardware Recommendations ---

app.get('/api/llmfit/recommend', (req, res) => {
    const proc = spawn('llmfit', ['--json', 'fit']);
    let stdout = '';
    let stderr = '';
    let done = false;

    const finish = () => { done = true; };

    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    proc.on('error', err => {
        if (done || res.headersSent) return;
        finish();
        res.status(500).json({ error: `llmfit not found or failed to start: ${err.message}` });
    });

    proc.on('close', code => {
        if (done || res.headersSent) return;
        finish();
        if (code !== 0) {
            return res.status(500).json({ error: stderr.trim() || `llmfit exited with code ${code}` });
        }
        try {
            res.json(JSON.parse(stdout));
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse llmfit output' });
        }
    });

    setTimeout(() => {
        if (done || res.headersSent) return;
        finish();
        proc.kill();
        res.status(504).json({ error: 'llmfit timed out' });
    }, 30000);
});

// --- Ollama Proxy ---

app.all('/proxy/*', async (req, res) => {
    const originalPath = req.params[0];
    const ollamaPath = '/' + originalPath;
    const targetUrlString = OLLAMA_API_BASE_URL + ollamaPath;
    const ALLOWED_OLLAMA_PATHS = ['/api/tags', '/api/chat', '/api/generate', '/api/show', '/api/pull'];

    console.log(`Proxying request: ${req.method} ${req.originalUrl} -> ${targetUrlString}`);

    if (!ALLOWED_OLLAMA_PATHS.some(allowedPath => ollamaPath.startsWith(allowedPath))) {
        console.warn(`Forbidden: Path '${ollamaPath}' not allowed.`);
        return res.status(403).send('Forbidden: Path not allowed.');
    }

    try {
        const targetUrl = new URL(targetUrlString);

        if (targetUrl.hostname !== 'localhost' && targetUrl.hostname !== '127.0.0.1') {
            console.warn(`Forbidden: Host '${targetUrl.hostname}' not allowed.`);
            return res.status(403).send('Forbidden: Host not allowed.');
        }

        // Construct headers for the outgoing request to Ollama
        const ollamaRequestHeaders = {
            'host': targetUrl.hostname, // Essential: Must match the target
            'accept': req.headers['accept'] || '*/*', // Pass through accept or default
            'user-agent': req.headers['user-agent'] || 'OllamaBroProxy/1.0', // Pass through user-agent or set a custom one
            // We will set Content-Type and Content-Length specifically when sending the body
        };

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: ollamaRequestHeaders, // Use our more controlled set of headers
        };

        const proxyReq = http.request(options, (proxyRes) => {
            console.log(`Proxy to Ollama: Received response status: ${proxyRes.statusCode}`);
            console.log('Proxy to Ollama: Received response headers:', JSON.stringify(proxyRes.headers, null, 2));
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
            proxyRes.on('end', () => console.log('Proxy to Ollama: Response stream from Ollama ended.'));
            proxyRes.on('error', (err) => console.error('Proxy to Ollama: Error on response stream from Ollama:', err));
        });

        // Pull requests can take many minutes to download large models
        const OLLAMA_REQUEST_TIMEOUT = ollamaPath.startsWith('/api/pull') ? 1800000 : 60000;
        proxyReq.setTimeout(OLLAMA_REQUEST_TIMEOUT, () => {
            console.error(`Proxy to Ollama: Request timed out after ${OLLAMA_REQUEST_TIMEOUT / 1000}s. Aborting.`);
            proxyReq.abort();
            if (!res.headersSent) res.status(504).send('Gateway Timeout: Ollama did not respond.');
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy to Ollama: Request error:', err);
            if (!res.headersSent) res.status(502).send('Bad Gateway: Proxy request to Ollama failed.');
        });

        proxyReq.on('socket', (socket) => {
            console.log('Proxy to Ollama: Socket assigned.');
            socket.on('connect', () => console.log('Proxy to Ollama: Socket connected.'));
            socket.on('timeout', () => console.error('Proxy to Ollama: Socket timeout event.'));
        });

        if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.rawBody) {
            let bodyToSend = req.rawBody;
            let contentType = req.headers['content-type'] || 'application/json';

            // Check if the request is for the chat API and is JSON
            if (ollamaPath.startsWith('/api/chat') && contentType === 'application/json') {
                try {
                    const ollamaPayload = JSON.parse(req.rawBody);

                    // Ensure streaming: true for /api/chat
                    // Ollama defaults to streaming if 'stream' is not present or true.
                    if (ollamaPayload.hasOwnProperty('stream') && ollamaPayload.stream === false) {
                        ollamaPayload.stream = true;
                        console.log('Proxy to Ollama: Modified payload for /api/chat to ensure streaming (changed stream:false to stream:true).');
                    } else if (!ollamaPayload.hasOwnProperty('stream')) {
                        ollamaPayload.stream = true;
                        console.log('Proxy to Ollama: Modified payload for /api/chat to ensure streaming (added stream:true).');
                    }
                    // If ollamaPayload.stream is already true, no changes needed to the stream property.

                    // --- Web search context injection ---
                    const lastMsg = ollamaPayload.messages?.at(-1);

                    if (lastMsg?.role === 'user') {
                        const messageContent = lastMsg.content || '';
                        const webSearchRequested = ollamaPayload._webSearch === true;
                        const contextParts = [];
                        const today = new Date().toISOString().split('T')[0];

                        // Track 1: fetch any URLs in the message via Jina Reader (live page content)
                        const urls = extractUrls(messageContent);
                        console.log(`[Search] URLs found in message: ${JSON.stringify(urls)}`);
                        for (const url of urls.slice(0, 2)) {
                            try {
                                console.log(`[Search] Fetching URL via Jina: ${url}`);
                                const content = await fetchPageViaJina(url);
                                contextParts.push(`Retrieved page (${url}):\n${content}`);
                                console.log(`[Search] Jina: got ${content.length} chars from ${url}`);
                            } catch (jinaErr) {
                                console.warn(`[Search] Jina failed for ${url}:`, jinaErr.message);
                            }
                        }

                        // Track 2: Tavily search if toggle is on or heuristic triggers
                        if (webSearchRequested || heuristicNeedsSearch(messageContent)) {
                            try {
                                const query = messageContent.slice(0, 300);
                                console.log(`[Search] Querying Tavily for: "${query.slice(0, 80)}"`);
                                const data = await fetchTavilyResults(query);
                                if (data?.results?.length > 0) {
                                    const snippets = data.results
                                        .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.content}`)
                                        .join('\n\n');
                                    contextParts.push(`Web search results:\n${snippets}`);
                                    console.log(`[Search] Tavily: injected ${data.results.length} results`);
                                }
                            } catch (searchErr) {
                                console.warn('[Search] Tavily failed, continuing without search context:', searchErr.message);
                            }
                        }

                        // Inject all gathered context into the system message
                        if (contextParts.length > 0) {
                            const contextBlock = `The following information was retrieved by a tool before this conversation. Use it to answer the user directly — do not say you cannot access the internet, as this data is already provided to you.\n\n${contextParts.join('\n\n')}\n\nToday's date: ${today}.`;
                            const sysIdx = ollamaPayload.messages.findIndex(m => m.role === 'system');
                            if (sysIdx >= 0) {
                                ollamaPayload.messages[sysIdx].content = contextBlock + '\n\n' + ollamaPayload.messages[sysIdx].content;
                            } else {
                                ollamaPayload.messages.unshift({ role: 'system', content: contextBlock });
                            }
                        }
                    }
                    delete ollamaPayload._webSearch; // strip internal flag before forwarding

                    bodyToSend = JSON.stringify(ollamaPayload);
                } catch (e) {
                    console.error('Proxy to Ollama: Error parsing/modifying JSON body for /api/chat, sending raw body as fallback:', e.message);
                    // Fallback to sending rawBody if parsing/stringifying fails, bodyToSend remains req.rawBody
                }
            }
            
            console.log(`Proxy to Ollama: Sending request body to Ollama (Path: ${ollamaPath}):`, bodyToSend);
            
            proxyReq.setHeader('Content-Type', contentType); // Use the original or default content type
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyToSend));
            
            proxyReq.write(bodyToSend);
            proxyReq.end();
        } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            console.warn('Proxy to Ollama: POST/PUT/PATCH request, but req.rawBody is not set. Attempting to pipe.');
            // This path should ideally not be hit if rawBody middleware works.
            // If piping, Node will set Content-Length and Content-Type if possible, but it can be less reliable.
            req.pipe(proxyReq, { end: true });
        } else {
            proxyReq.end();
        }

    } catch (error) {
        console.error('Error in proxy logic:', error);
        if (!res.headersSent) res.status(500).send('Internal proxy error.');
    }
});

serverInstance = app.listen(PORT, () => {
    console.log(`OllamaBro CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`Allowing CORS origin: ${extensionOrigin}`);
    console.log(`Proxying requests from /proxy/* to ${OLLAMA_API_BASE_URL}`);
});