#!/usr/bin/env node
// Force all logs to stderr to avoid corrupting the native messaging stdout stream.
{
    const toStderr = (...args) => { try { console.error(...args); } catch { } };
    console.log = toStderr;
    console.info = toStderr;
    console.debug = toStderr;
    console.warn = toStderr; // Node writes warn to stderr already, but keep consistent.
}

// native-messaging-host.js
// Bridge between Chrome extension and a Node.js i18n file updater.
// IMPORTANT: Never write anything except framed JSON to stdout.
// All logs go to stderr.

const { updateI18n } = require('../update-i18n');

// Message framing state
let buffer = Buffer.alloc(0);
let expectedLen = 0;
let hasResponded = false;

console.error('[DEBUG] Native messaging host started');
console.error('[DEBUG] PID:', process.pid);
console.error('[DEBUG] ARGV:', process.argv);

// ---- Input: read framed messages from stdin ----
process.stdin.on('readable', () => {
    const chunk = process.stdin.read();
    if (chunk === null) return;

    console.error('[DEBUG] stdin chunk bytes:', chunk.length);
    buffer = Buffer.concat([buffer, chunk]);
    console.error('[DEBUG] total buffered bytes:', buffer.length);

    // Process as many complete frames as are available
    while (true) {
        if (expectedLen === 0) {
            if (buffer.length < 4) break; // need more
            expectedLen = buffer.readUInt32LE(0);
            buffer = buffer.slice(4);
            console.error('[DEBUG] parsed frame length (bytes):', expectedLen);
        }
        if (buffer.length < expectedLen) break; // need more

        // We have a complete frame
        const messageBytes = buffer.subarray(0, expectedLen);
        buffer = buffer.subarray(expectedLen);
        expectedLen = 0;

        const json = messageBytes.toString('utf8');
        console.error('[DEBUG] received JSON (chars len):', json.length);

        let msg;
        try {
            msg = JSON.parse(json);
            console.error('[DEBUG] parsed JSON ok');
        } catch (err) {
            console.error('[DEBUG] JSON parse error:', err.message);
            return sendMessage({
                success: false,
                error: `JSON parse error: ${err.message}`,
                message: `Failed to parse message: ${err.message}`,
            });
        }

        // Handle the message
        handleMessage(msg);

        // This host answers once and exits (sendNativeMessage use-case).
        // If you want to support multiple requests per process, remove the return.
        return;
    }
});

// ---- Message handler ----
function handleMessage(message) {
    console.error('Native host received message:', JSON.stringify(message, null, 2));
    try {
        // Validate structure
        if (!message.root || !message.lang || !message.payload) {
            throw new Error('Missing required fields: root, lang, payload');
        }

        // Do the update
        const result = updateI18n(message);
        console.error('Native host result:', JSON.stringify(result, null, 2));

        // Keep response minimal to avoid large payloads
        sendMessage({
            success: !!result.success,
            message: result.message || 'OK',
            // If you need details, add small, essential fields only:
            // changedFiles: result.changedFiles,
        });
    } catch (err) {
        console.error('Native host error:', err.stack || err.message);
        sendMessage({
            success: false,
            error: err.message,
            message: `Error: ${err.message}`,
        });
    }
}

// ---- Output: send framed JSON and exit only after flush ----
function sendMessage(response) {
    if (hasResponded) {
        console.error('[DEBUG] sendMessage ignored: already sent');
        return;
    }

    // Serialize first; if this throws, we can still send an error later
    let jsonStr;
    try {
        jsonStr = JSON.stringify(response);
    } catch (err) {
        console.error('[DEBUG] JSON.stringify error:', err.message);
        // Attempt to send a minimal error
        jsonStr = JSON.stringify({
            success: false,
            error: `JSON serialization error: ${err.message}`,
            message: 'Failed to serialize response',
        });
    }

    hasResponded = true;

    const byteLen = Buffer.byteLength(jsonStr, 'utf8');
    const out = Buffer.alloc(4 + byteLen);
    out.writeUInt32LE(byteLen, 0);
    out.write(jsonStr, 4, 'utf8');

    console.error('[DEBUG] sending response bytes:', byteLen);

    process.stdout.write(out, (err) => {
        if (err) console.error('[DEBUG] stdout write error:', err);
        // Close writable side; Chrome reads until EOF
        process.stdout.end();
    });
}

// Exit only after stdout is fully flushed (clean EOF)
process.stdout.on('finish', () => {
    console.error('[DEBUG] stdout finished, exiting');
    process.exit(0);
});

// Graceful termination (won’t interrupt a write-in-progress)
process.on('SIGINT', () => {
    console.error('Native host received SIGINT');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('Native host received SIGTERM');
    process.exit(0);
});

// Error guards — let sendMessage own the shutdown
process.on('uncaughtException', (error) => {
    console.error('Native host uncaught exception:', error);
    sendMessage({
        success: false,
        error: `Uncaught exception: ${error.message}`,
        message: `Fatal error: ${error.message}`,
    });
});
process.on('unhandledRejection', (reason) => {
    console.error('Native host unhandled rejection:', reason);
    sendMessage({
        success: false,
        error: `Unhandled rejection: ${reason}`,
        message: `Promise rejection: ${reason}`,
    });
});
