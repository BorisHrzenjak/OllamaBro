const { spawn, execSync } = require('child_process');
const net = require('net');
const path = require('path');

const PROXY_PORT = 3000;
const SERVER_SCRIPT = path.join(__dirname, 'server.js');

// --- Native Messaging Protocol ---

function readMessage(callback) {
    let chunks = [];
    let totalLength = 0;
    let messageSize = null;

    process.stdin.on('data', (chunk) => {
        chunks.push(chunk);
        totalLength += chunk.length;

        if (messageSize === null && totalLength >= 4) {
            const header = Buffer.concat(chunks);
            messageSize = header.readUInt32LE(0);
            chunks = [header.slice(4)];
            totalLength = chunks[0].length;
        }

        if (messageSize !== null && totalLength >= messageSize) {
            const body = Buffer.concat(chunks).slice(0, messageSize);
            callback(JSON.parse(body.toString('utf-8')));
        }
    });
}

function sendMessage(msg) {
    const json = Buffer.from(JSON.stringify(msg), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(json.length, 0);
    process.stdout.write(header);
    process.stdout.write(json);
}

// --- Port helpers ---

function isPortInUse(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('error', () => { resolve(false); });
        socket.connect(port, '127.0.0.1');
    });
}

function killProcessOnPort(port) {
    try {
        // Find PID listening on the port (Windows)
        const output = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, {
            encoding: 'utf-8',
            windowsHide: true
        });
        const lines = output.trim().split('\n');
        const pids = new Set();
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') pids.add(pid);
        }
        for (const pid of pids) {
            try {
                execSync(`taskkill /PID ${pid} /F`, { windowsHide: true });
            } catch (e) { /* process may have already exited */ }
        }
        return pids.size > 0;
    } catch (e) {
        return false;
    }
}

function startServer() {
    const child = spawn(process.execPath, [SERVER_SCRIPT], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(SERVER_SCRIPT),
        windowsHide: true
    });
    child.unref();
    return child;
}

async function waitForPort(port, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortInUse(port)) return true;
        await new Promise(r => setTimeout(r, 300));
    }
    return false;
}

// --- Main ---

readMessage(async (msg) => {
    try {
        if (msg.action === 'status') {
            const running = await isPortInUse(PROXY_PORT);
            sendMessage({ status: running ? 'running' : 'stopped' });

        } else if (msg.action === 'start') {
            const running = await isPortInUse(PROXY_PORT);
            if (running) {
                sendMessage({ status: 'already_running' });
            } else {
                startServer();
                const ok = await waitForPort(PROXY_PORT, 5000);
                sendMessage({ status: ok ? 'started' : 'start_failed' });
            }

        } else if (msg.action === 'restart') {
            // 1. Try graceful shutdown first
            const running = await isPortInUse(PROXY_PORT);
            if (running) {
                try {
                    const http = require('http');
                    await new Promise((resolve) => {
                        const req = http.request(
                            { hostname: '127.0.0.1', port: PROXY_PORT, path: '/api/shutdown', method: 'POST', timeout: 2000 },
                            () => resolve()
                        );
                        req.on('error', () => resolve());
                        req.on('timeout', () => { req.destroy(); resolve(); });
                        req.end();
                    });
                    // Wait briefly for graceful shutdown
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) { /* ignore */ }

                // 2. If still running, force kill
                if (await isPortInUse(PROXY_PORT)) {
                    killProcessOnPort(PROXY_PORT);
                    await new Promise(r => setTimeout(r, 1000));
                }

                // 3. Last resort — force kill again if stubborn
                if (await isPortInUse(PROXY_PORT)) {
                    killProcessOnPort(PROXY_PORT);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // 4. Start fresh server
            startServer();
            const ok = await waitForPort(PROXY_PORT, 5000);
            sendMessage({ status: ok ? 'restarted' : 'restart_failed' });

        } else {
            sendMessage({ error: 'Unknown action: ' + msg.action });
        }
    } catch (err) {
        sendMessage({ error: err.message });
    }
    process.exit(0);
});

// Timeout safety — exit after 30s no matter what
setTimeout(() => process.exit(0), 30000);
