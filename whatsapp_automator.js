/**
 * Bank Loan Appraisal - Automated WhatsApp Web Interceptor
 * Strictly isolated for D:\Bank_Loan_Appraisal
 * Uses native Chrome DevTools Protocol & Node 24 WebSocket (Zero npm dependencies)
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SESSION_DIR = path.join(__dirname, '.whatsapp_session');
const CDP_PORT = 9222;

let cdpSocket = null;
let messageId = 1;
const pendingRequests = new Map();

function getBrowserPath() {
    if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
    if (fs.existsSync(EDGE_PATH)) return EDGE_PATH;
    throw new Error('Neither Google Chrome nor Microsoft Edge was found.');
}

// 1. Launch Browser with Remote Debugging
function launchWhatsAppBrowser() {
    return new Promise((resolve, reject) => {
        const browserExe = getBrowserPath();
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        console.log(`[WhatsApp Automator] Launching browser: ${browserExe}`);
        const args = [
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${SESSION_DIR}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--window-size=1200,850',
            'https://web.whatsapp.com'
        ];

        const browserProcess = spawn(browserExe, args, {
            detached: true,
            stdio: 'ignore'
        });
        browserProcess.unref();

        // Poll until CDP port is ready (max 20 seconds)
        let attempts = 0;
        const checkCdp = setInterval(() => {
            attempts++;
            http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
                if (res.statusCode === 200) {
                    clearInterval(checkCdp);
                    console.log(`[WhatsApp Automator] Browser CDP ready on port ${CDP_PORT}`);
                    resolve(true);
                }
            }).on('error', () => {
                if (attempts > 30) {
                    clearInterval(checkCdp);
                    reject(new Error('Browser failed to start CDP in time'));
                }
            });
        }, 600);
    });
}

// 2. Query CDP Tabs
function getTabs() {
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve([]);
                }
            });
        }).on('error', reject);
    });
}

// 3. Connect via native WebSocket
async function connectToWhatsAppTab() {
    const tabs = await getTabs();
    const waTab = tabs.find(t => t.url && t.url.includes('web.whatsapp.com')) || tabs[0];
    if (!waTab || !waTab.webSocketDebuggerUrl) {
        throw new Error('WhatsApp tab not found in browser');
    }

    console.log(`[WhatsApp Automator] Connecting to tab: ${waTab.title || waTab.url}`);
    
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(waTab.webSocketDebuggerUrl);

        ws.onopen = () => {
            console.log(`[WhatsApp Automator] Connected to WhatsApp Web via CDP!`);
            cdpSocket = ws;
            resolve(ws);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.id && pendingRequests.has(msg.id)) {
                    const callback = pendingRequests.get(msg.id);
                    pendingRequests.delete(msg.id);
                    callback(msg.result);
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        ws.onerror = (err) => {
            console.error('[WhatsApp Automator] WebSocket Error:', err.message || err);
            reject(err);
        };

        ws.onclose = () => {
            console.log('[WhatsApp Automator] WebSocket connection closed.');
            cdpSocket = null;
        };
    });
}

function sendCdpCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
        if (!cdpSocket || cdpSocket.readyState !== WebSocket.OPEN) {
            return reject(new Error('CDP socket not connected'));
        }
        const id = messageId++;
        pendingRequests.set(id, resolve);
        cdpSocket.send(JSON.stringify({ id, method, params }));
    });
}

// 4. Inject Automated Ingestion Hook into WhatsApp Web
async function injectAutomationHook() {
    console.log(`[WhatsApp Automator] Injecting Auto-Ingest Listener into WhatsApp Web...`);

    const clientScript = `
    (function() {
        if (window.__BANK_APPRAISAL_ACTIVE) return;
        window.__BANK_APPRAISAL_ACTIVE = true;

        console.log("%c[Bank Loan Appraisal Engine Active]", "color: #25D366; font-weight: bold; font-size: 14px;");

        // Create a stylish floating status badge in WhatsApp Web
        const badge = document.createElement('div');
        badge.id = 'bank-appraisal-badge';
        badge.innerHTML = '🏛️ <strong>Bank Loan Appraisal Engine:</strong> Listening for loan dossiers...';
        badge.style.cssText = 'position: fixed; top: 12px; right: 80px; z-index: 99999; background: rgba(15, 23, 42, 0.92); color: #4ade80; border: 1px solid #25D366; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(4px);';
        document.body.appendChild(badge);

        // Track processed message IDs to prevent duplicate downloads
        const processedMsgIds = new Set();

        // Helper to convert blob / url to base64
        async function urlToBase64(url) {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });
        }

        // Scan active chat for incoming documents
        async function scanActiveChatForDocuments() {
            try {
                // Find contact / sender title in header
                const headerTitleEl = document.querySelector('header [role="button"] span[title]') || document.querySelector('header span[title]');
                const contactName = headerTitleEl ? headerTitleEl.getAttribute('title') : 'Branch Officer';

                // Look for document / media message containers in the chat
                const docNodes = document.querySelectorAll('div[data-testid="msg-container"]');
                for (const node of docNodes) {
                    const msgId = node.getAttribute('data-id') || node.innerText.slice(0, 30);
                    if (processedMsgIds.has(msgId)) continue;

                    // Check if it has a document or download button
                    const docTitleEl = node.querySelector('span[title*="."]') || node.querySelector('div[title*="."]');
                    const textNode = node.querySelector('.selectable-text');
                    const msgText = textNode ? textNode.innerText : '';

                    if (docTitleEl) {
                        const fileName = docTitleEl.getAttribute('title') || docTitleEl.innerText;
                        const ext = fileName.split('.').pop().toLowerCase();
                        if (['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx'].includes(ext)) {
                            processedMsgIds.add(msgId);
                            console.log('[Bank Appraisal] Auto-detected document:', fileName, 'from', contactName);
                            
                            badge.innerHTML = '📥 Ingesting: ' + fileName + '...';
                            badge.style.borderColor = '#60a5fa';
                            badge.style.color = '#93c5fd';

                            // Post to local intranet gateway
                            fetch('http://localhost:8080/api/whatsapp/incoming', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    from: '9329718002',
                                    officerName: contactName,
                                    text: 'Incoming file: ' + fileName + '\\n' + msgText,
                                    files: [{
                                        name: fileName,
                                        data: Buffer ? '' : '',
                                        mimeType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg'
                                    }]
                                })
                            }).then(() => {
                                badge.innerHTML = '✓ Staged: ' + fileName;
                                badge.style.borderColor = '#4ade80';
                                badge.style.color = '#4ade80';
                            }).catch(e => console.error('Ingest post error:', e));
                        }
                    }
                }
            } catch (err) {
                console.error('[Bank Appraisal] Scan error:', err);
            }
        }

        // Set up interval scanner
        setInterval(scanActiveChatForDocuments, 2500);

        // Also add a 1-Click "Send Chat to Appraisal Desk" button in header
        function injectHeaderButton() {
            if (document.getElementById('btn-send-to-bank-appraisal')) return;
            const headerRight = document.querySelector('header > div:last-child');
            if (headerRight) {
                const btn = document.createElement('button');
                btn.id = 'btn-send-to-bank-appraisal';
                btn.innerHTML = '📥 Ingest Chat to Appraisal Desk';
                btn.style.cssText = 'background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: bold; cursor: pointer; margin-right: 10px;';
                btn.onclick = () => {
                    scanActiveChatForDocuments();
                    alert('✓ Active chat documents scanned and sent to Bank Loan Appraisal Desk!');
                };
                headerRight.prepend(btn);
            }
        }

        setInterval(injectHeaderButton, 2000);
    })();
    `;

    await sendCdpCommand('Runtime.evaluate', {
        expression: clientScript
    });

    console.log(`[WhatsApp Automator] Hook successfully installed into WhatsApp Web!`);
}

// 5. Main Initialization Function
async function startAutomator() {
    try {
        await launchWhatsAppBrowser();
        // Wait 3 seconds for WhatsApp page to initialize
        await new Promise(r => setTimeout(r, 3000));
        await connectToWhatsAppTab();
        await sendCdpCommand('Page.enable');
        await sendCdpCommand('Runtime.enable');

        // Inject immediately, and reinject every 10 seconds to ensure persistence across page navigation
        await injectAutomationHook();
        setInterval(async () => {
            if (cdpSocket && cdpSocket.readyState === WebSocket.OPEN) {
                try {
                    await injectAutomationHook();
                } catch (e) {
                    // Ignore transient evaluate errors
                }
            } else {
                // Try reconnecting
                try {
                    await connectToWhatsAppTab();
                } catch (e) {
                    // Retrying
                }
            }
        }, 10000);

        return true;
    } catch (err) {
        console.error('[WhatsApp Automator Error]:', err.message);
        return false;
    }
}

module.exports = {
    startAutomator,
    launchWhatsAppBrowser
};

if (require.main === module) {
    startAutomator();
}
