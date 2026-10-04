/**
 * Bank Loan Appraisal - HTTP Server & WhatsApp Hub
 * Strictly isolated for D:\Bank_Loan_Appraisal
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const gateway = require('./gateway_engine');
const whatsapp = require('./whatsapp_engine');
const ocr = require('./ocr_engine');
const powerAutomate = require('./power_automate_engine');
const automator = require('./whatsapp_automator');
const aiAssistant = require('./ai_assistant_engine');
const gdrive = require('./gdrive_service');
const os = require('os');

function getLocalIp() {
    try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
                    return iface.address;
                }
            }
        }
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
    } catch (e) {}
    return '127.0.0.1';
}

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Helper to parse JSON body
function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            // Prevent too large payloads (max 50MB)
            if (body.length > 50 * 1024 * 1024) {
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// Helper to parse multipart/form-data
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!boundaryMatch) {
            return resolve({ fields: {}, files: [] });
        }
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const boundaryBuffer = Buffer.from('--' + boundary);
            const parts = [];
            let start = 0;

            while ((start = buffer.indexOf(boundaryBuffer, start)) !== -1) {
                start += boundaryBuffer.length;
                if (buffer.slice(start, start + 2).toString() === '--') break; // end of multipart
                if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;
                
                const next = buffer.indexOf(boundaryBuffer, start);
                if (next === -1) break;
                
                const partBuffer = buffer.slice(start, next - 2); // strip trailing \r\n
                parts.push(partBuffer);
                start = next;
            }

            const fields = {};
            const files = [];

            parts.forEach(part => {
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd === -1) return;
                const headerStr = part.slice(0, headerEnd).toString('utf8');
                const bodyBuffer = part.slice(headerEnd + 4);

                const nameMatch = headerStr.match(/name="([^"]+)"/);
                const filenameMatch = headerStr.match(/filename="([^"]+)"/);
                const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

                if (filenameMatch) {
                    files.push({
                        fieldName: nameMatch ? nameMatch[1] : 'file',
                        name: path.basename(filenameMatch[1]),
                        mimeType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
                        data: bodyBuffer
                    });
                } else if (nameMatch) {
                    fields[nameMatch[1]] = bodyBuffer.toString('utf8');
                }
            });

            resolve({ fields, files });
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data, null, 2));
}

function sendHtml(res, filePath) {
    if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
    }
}

// Tree view of Vault
function getVaultTree(dir = gateway.DATA_DIR) {
    if (!fs.existsSync(dir)) return [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    return items.map(item => {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            return {
                name: item.name,
                type: 'directory',
                children: getVaultTree(fullPath)
            };
        } else {
            const stats = fs.statSync(fullPath);
            return {
                name: item.name,
                type: 'file',
                sizeBytes: stats.size,
                modifiedAt: stats.mtime
            };
        }
    });
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:8080'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    try {
        // --- Static UI Routes ---
        if (pathname === '/' || pathname === '/index.html' || pathname === '/portal') {
            return sendHtml(res, path.join(__dirname, 'pnb_portal.html'));
        }
        if (pathname === '/appraisal' || pathname === '/appraisal_desk.html') {
            return sendHtml(res, path.join(__dirname, 'appraisal_desk.html'));
        }
        if (pathname === '/manifest.json') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return fs.createReadStream(path.join(__dirname, 'manifest.json')).pipe(res);
        }
        if (pathname === '/api/public-url' && method === 'GET') {
            const urlFile = path.join(__dirname, 'public_url.txt');
            const pubUrl = fs.existsSync(urlFile) ? fs.readFileSync(urlFile, 'utf8').trim() : null;
            const localIp = getLocalIp();
            const hostName = os.hostname();
            return sendJson(res, 200, {
                publicUrl: pubUrl,
                wifiUrl: `http://${localIp}:8080/`,
                mDnsUrl: `http://${hostName}.local:8080/`,
                localUrl: 'http://localhost:8080/',
                hostname: hostName,
                localIp: localIp
            });
        }
        if (pathname === '/officer-drop' || pathname === '/officer_drop.html') {
            return sendHtml(res, path.join(__dirname, 'officer_drop.html'));
        }

        // --- AI Loan Appraisal & Circular Query APIs ---
        if (pathname === '/api/ai/query' && method === 'POST') {
            const body = await parseJsonBody(req);
            const result = await aiAssistant.answerUserQuery(body.query || '');
            return sendJson(res, 200, result);
        }

        if (pathname === '/api/ai/appraise' && method === 'POST') {
            const body = await parseJsonBody(req);
            const result = await aiAssistant.performLoanAppraisal(body);
            return sendJson(res, 200, result);
        }

        // --- Dynamic Branches, Segments & Customers ---
        if (pathname === '/api/vault/branches' && method === 'GET') {
            const branches = gdrive.getBranchList();
            return sendJson(res, 200, { success: true, count: branches.length, branches });
        }

        if (pathname === '/api/vault/segments' && method === 'GET') {
            const segments = gdrive.getSegmentList();
            return sendJson(res, 200, { success: true, count: segments.length, segments });
        }

        if (pathname === '/api/vault/customers' && method === 'GET') {
            const branch = queryParams.branch || '';
            const segment = queryParams.segment || '';
            const customers = gdrive.getCustomers(branch, segment);
            return sendJson(res, 200, { success: true, count: customers.length, customers });
        }

        if (pathname === '/api/vault/customer-files' && method === 'GET') {
            const branch = queryParams.branch || '';
            const segment = queryParams.segment || '';
            const customer = queryParams.customer || '';
            const files = gdrive.getCustomerFiles(branch, segment, customer);
            return sendJson(res, 200, { success: true, count: files.length, files });
        }

        // --- Vault Customer Document View / Preview / Download ---
        if (pathname === '/api/vault/file' && method === 'GET') {
            const branch = queryParams.branch || '';
            const segment = queryParams.segment || '';
            const customer = queryParams.customer || '';
            const fileName = queryParams.file || '';

            if (!branch || !segment || !customer || !fileName) {
                return sendJson(res, 400, { error: 'Missing parameters (branch, segment, customer, file)' });
            }

            const safeBranch = path.basename(branch);
            const safeSegment = path.basename(segment);
            const safeCustomer = path.basename(customer);
            const safeFile = path.basename(fileName);

            let filePath = path.join(gateway.DATA_DIR, safeBranch, safeSegment, safeCustomer, safeFile);
            if (!fs.existsSync(filePath)) {
                if (safeSegment.includes('Retail')) {
                    const fb1 = path.join(gateway.DATA_DIR, safeBranch, '2. Retail', safeCustomer, safeFile);
                    const fb2 = path.join(gateway.DATA_DIR, safeBranch, 'Retail_Lending', safeCustomer, safeFile);
                    if (fs.existsSync(fb1)) filePath = fb1;
                    else if (fs.existsSync(fb2)) filePath = fb2;
                }
            }
            if (!fs.existsSync(filePath)) {
                return sendJson(res, 404, { error: 'File not found in vault' });
            }

            const ext = path.extname(safeFile).toLowerCase();
            const mimeMap = {
                '.pdf': 'application/pdf',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.txt': 'text/plain; charset=utf-8',
                '.json': 'application/json',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.zip': 'application/zip'
            };
            const contentType = mimeMap[ext] || 'application/octet-stream';
            const inlineExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.txt'];
            const disposition = inlineExts.includes(ext) ? 'inline' : `attachment; filename="${safeFile}"`;

            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Disposition': disposition,
                'Access-Control-Allow-Origin': '*'
            });
            return fs.createReadStream(filePath).pipe(res);
        }

        // --- Master Vault Upload from Web / Mobile ---
        if (pathname === '/api/vault/upload' && method === 'POST') {
            const { fields, files } = await parseMultipart(req);
            const branch = fields.branch || '943600-CHHINDWARA  VIP ROAD (MP)';
            const segment = fields.segment || '2. Retail';
            const customerName = fields.customerName || 'New_Customer';

            const saved = [];
            for (const file of files) {
                const resSave = await gdrive.saveCustomerDocument({
                    branchName: branch,
                    segment,
                    customerName,
                    fileName: file.name,
                    fileBuffer: file.data
                });
                saved.push(resSave);
            }
            return sendJson(res, 200, { success: true, count: saved.length, files: saved });
        }

        // --- Master Vault Proposals List ---
        if (pathname === '/api/vault/proposals' && method === 'GET') {
            const proposals = gdrive.listMasterVaultProposals();
            return sendJson(res, 200, { success: true, count: proposals.length, proposals });
        }

        // --- Multi-User Feedback & Issue Management APIs ---
        if (pathname === '/api/feedback' && method === 'POST') {
            const body = await parseJsonBody(req);
            const result = await gdrive.saveFeedback(body);
            return sendJson(res, 200, result);
        }

        if (pathname === '/api/feedback' && method === 'GET') {
            const tickets = gdrive.getFeedbackList();
            return sendJson(res, 200, { success: true, count: tickets.length, tickets });
        }

        if (pathname === '/api/feedback/resolve' && method === 'POST') {
            const body = await parseJsonBody(req);
            const result = await gdrive.resolveFeedback(body);
            return sendJson(res, 200, result);
        }

        // --- System Health & Multi-User Status ---
        if (pathname === '/api/system/status' && method === 'GET') {
            return sendJson(res, 200, {
                status: 'HEALTHY',
                engine: 'Multi-User High-Concurrency Engine v2.4',
                uptimeSeconds: Math.round(process.uptime()),
                memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
                timestamp: new Date().toISOString()
            });
        }

        // --- Circulars List & Search ---
        if (pathname === '/api/circulars/list' && method === 'GET') {
            const metaFile = path.join(__dirname, 'circular_metadata_db.json');
            let circulars = [];
            if (fs.existsSync(metaFile)) {
                try {
                    const data = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                    circulars = Object.values(data);
                } catch (e) {}
            }
            return sendJson(res, 200, { success: true, count: circulars.length, circulars });
        }

        // --- Circular Upload ---
        if (pathname === '/api/circulars/upload' && method === 'POST') {
            const { fields, files } = await parseMultipart(req);
            const file = files && files[0];
            if (!file) {
                return sendJson(res, 400, { error: 'No PDF file uploaded' });
            }
            const resCir = await gdrive.saveCircular({
                fileName: file.name,
                fileBuffer: file.data,
                division: fields.division || 'RABD',
                num: fields.num || '999',
                year: fields.year || '2026',
                subject: fields.subject || file.name.replace('.pdf', '')
            });
            return sendJson(res, 200, resCir);
        }

        // --- DOCX Chat History List ---
        if (pathname === '/api/chat/history' && method === 'GET') {
            const historyDir = path.join(gateway.DATA_DIR, '000-CHAT_HISTORY');
            const q = (queryParams.q || '').toLowerCase().trim();
            let files = [];
            if (fs.existsSync(historyDir)) {
                files = fs.readdirSync(historyDir)
                    .filter(f => f.endsWith('.docx') && !f.startsWith('~$'))
                    .filter(f => !q || f.toLowerCase().includes(q))
                    .map(f => {
                        const s = fs.statSync(path.join(historyDir, f));
                        return { name: f, size: s.size, mtime: s.mtime };
                    })
                    .sort((a, b) => b.mtime - a.mtime);
            }
            return sendJson(res, 200, { success: true, count: files.length, files });
        }

        // --- DOCX Chat Download ---
        if (pathname === '/api/chat/download' && method === 'GET') {
            const fileName = queryParams.file;
            if (!fileName) return sendJson(res, 400, { error: 'Missing file parameter' });
            const filePath = path.join(gateway.DATA_DIR, '000-CHAT_HISTORY', path.basename(fileName));
            if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'File not found' });

            res.writeHead(200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`
            });
            return fs.createReadStream(filePath).pipe(res);
        }

        // --- WhatsApp API Endpoints for 9329718002 ---

        // 1. Status of WhatsApp for 9329718002
        if (pathname === '/api/whatsapp/status' && method === 'GET') {
            const cfg = whatsapp.loadConfig();
            return sendJson(res, 200, {
                targetPhoneNumber: cfg.targetPhoneNumber,
                fullNumber: cfg.fullNumber,
                status: cfg.status,
                lastConnectedAt: cfg.lastConnectedAt,
                pairingCode: cfg.pairingCode,
                pairingCodeExpiresAt: cfg.pairingCodeExpiresAt,
                registeredOfficers: cfg.registeredOfficers
            });
        }

        // 2. Generate new 8-digit Pairing Code for 9329718002
        if (pathname === '/api/whatsapp/pair_code' && method === 'POST') {
            const body = await parseJsonBody(req);
            const targetPhone = body.phone || '9329718002';
            const code = whatsapp.generatePairingCode(targetPhone);
            return sendJson(res, 200, {
                success: true,
                targetPhoneNumber: targetPhone,
                pairingCode: code,
                instructions: [
                    `1. Open WhatsApp on your phone (${targetPhone}).`,
                    `2. Tap 3 dots (Menu) or Settings -> 'Linked Devices'.`,
                    `3. Tap 'Link a Device'.`,
                    `4. Tap 'Link with phone number instead' at the bottom of the screen.`,
                    `5. Enter this 8-digit code: ${code}`
                ]
            });
        }

        // 3. QR Code SVG generator
        if (pathname === '/api/whatsapp/qr' && method === 'GET') {
            const cfg = whatsapp.loadConfig();
            const qrSvg = whatsapp.generateQrSvg(`WAPAIR:${cfg.fullNumber}:${cfg.pairingCode}:${Date.now()}`);
            res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
            return res.end(qrSvg);
        }

        // 4. Confirm / Toggle device linked
        if (pathname === '/api/whatsapp/link_confirm' && method === 'POST') {
            const body = await parseJsonBody(req);
            const status = body.status || 'CONNECTED';
            const updated = whatsapp.confirmDeviceLinked(status);
            return sendJson(res, 200, { success: true, config: updated });
        }

        // 5. Ingest WhatsApp message & files directly
        if (pathname === '/api/whatsapp/incoming' && method === 'POST') {
            const body = await parseJsonBody(req);
            const staged = whatsapp.handleIncomingWhatsApp({
                from: body.from || '9329718002',
                officerName: body.officerName,
                text: body.text || '',
                files: body.files || []
            });
            return sendJson(res, 200, { success: true, staged });
        }

        // 6. Meta Cloud API Webhook Verification & Listener
        if (pathname === '/api/whatsapp/webhook') {
            if (method === 'GET') {
                const mode = queryParams['hub.mode'];
                const token = queryParams['hub.verify_token'];
                const challenge = queryParams['hub.challenge'];
                const cfg = whatsapp.loadConfig();

                if (mode === 'subscribe' && token === cfg.webhookVerifyToken) {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    return res.end(challenge);
                } else {
                    return sendJson(res, 403, { error: 'Invalid verification token' });
                }
            } else if (method === 'POST') {
                const body = await parseJsonBody(req);
                // Handle entry
                try {
                    const entry = body.entry && body.entry[0];
                    const change = entry && entry.changes && entry.changes[0];
                    const value = change && change.value;
                    const message = value && value.messages && value.messages[0];
                    if (message) {
                        const from = message.from;
                        const text = (message.text && message.text.body) || '';
                        whatsapp.handleIncomingWhatsApp({ from, text, files: [] });
                    }
                } catch (e) {
                    console.error('Webhook error:', e.message);
                }
                return sendJson(res, 200, { status: 'EVENT_RECEIVED' });
            }
        }

        // 6.5. Launch Native Chrome / WhatsApp Automator
        if (pathname === '/api/whatsapp/launch_automator' && method === 'POST') {
            automator.startAutomator().then(success => {
                console.log('[Automator] Started status:', success);
            }).catch(e => console.error('[Automator Error]', e));

            return sendJson(res, 200, {
                success: true,
                message: 'WhatsApp Web Automation Browser is launching. Please link your phone once if not already linked.'
            });
        }

        // 7. Simulate incoming WhatsApp dossier for test/demo
        if (pathname === '/api/whatsapp/simulate' && method === 'POST') {
            const body = await parseJsonBody(req);
            const preset = body.preset || 'car_loan';
            const staged = whatsapp.simulateWhatsAppDossier(preset);
            return sendJson(res, 200, { success: true, message: `Simulated WhatsApp dossier created for ${preset}`, staged });
        }

        // --- Intake & Approval APIs ---

        // 8. List pending intakes
        if (pathname === '/api/intake/pending' && method === 'GET') {
            const pending = gateway.listPendingIntakes();
            return sendJson(res, 200, { count: pending.length, items: pending });
        }

        // 9. Document Preview
        if (pathname === '/api/intake/preview' && method === 'GET') {
            const intakeId = queryParams.intakeId;
            const fileName = queryParams.fileName;
            if (!intakeId || !fileName) {
                return sendJson(res, 400, { error: 'Missing intakeId or fileName' });
            }
            const filePath = path.join(gateway.STAGING_DIR, intakeId, path.basename(fileName));
            if (!fs.existsSync(filePath)) {
                return sendJson(res, 404, { error: 'File not found in staging' });
            }

            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.pdf': 'application/pdf',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.txt': 'text/plain',
                '.json': 'application/json'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${path.basename(filePath)}"`
            });
            return fs.createReadStream(filePath).pipe(res);
        }

        // 10. Approve Intake
        if (pathname === '/api/intake/approve' && method === 'POST') {
            const body = await parseJsonBody(req);
            if (!body.intakeId) {
                return sendJson(res, 400, { error: 'Missing intakeId' });
            }
            const result = gateway.approveIntake(body.intakeId, {
                approvedBy: body.approvedBy || 'Underwriter',
                branchOverride: body.branch,
                schemeOverride: body.scheme,
                customerOverride: body.customerName
            });
            return sendJson(res, 200, result);
        }

        // 11. Reject Intake
        if (pathname === '/api/intake/reject' && method === 'POST') {
            const body = await parseJsonBody(req);
            if (!body.intakeId) {
                return sendJson(res, 400, { error: 'Missing intakeId' });
            }
            const result = gateway.rejectIntake(body.intakeId, body.reason);
            return sendJson(res, 200, result);
        }

        // 11.5 List Branches (Circle Office Jabalpur)
        if (pathname === '/api/branches' && method === 'GET') {
            const branchesFile = path.join(__dirname, 'branches.json');
            let branches = [];
            if (fs.existsSync(branchesFile)) {
                branches = JSON.parse(fs.readFileSync(branchesFile, 'utf8'));
            }
            return sendJson(res, 200, { success: true, count: branches.length, branches });
        }

        // 11.6 Create Borrower Dossier in Branch Vault
        if (pathname === '/api/borrower/create' && method === 'POST') {
            const body = await parseJsonBody(req);
            const dossierCreator = require('./create_borrower_dossier');
            const dossier = dossierCreator.createBorrowerDossier({
                branchName: body.branch,
                category: body.category || 'Retail',
                customerName: body.customerName,
                scheme: body.scheme || 'Car_Loan',
                applicantDetails: body.applicantDetails || {}
            });
            return sendJson(res, 200, { success: true, dossier });
        }

        // 12. Vault tree
        if (pathname === '/api/vault/tree' && method === 'GET') {
            const tree = getVaultTree();
            return sendJson(res, 200, { tree });
        }

        // 13. Mobile Officer Drop Form Upload
        if (pathname === '/api/officer-drop/upload' && method === 'POST') {
            const { fields, files } = await parseMultipart(req);
            const staged = gateway.stageIntake({
                channel: 'OFFICER_PORTAL',
                sender: fields.officerPhone || 'Branch Officer',
                officerName: fields.officerName || 'Field Officer',
                text: `Officer Drop: Branch=${fields.branch || ''} Scheme=${fields.scheme || ''} Customer=${fields.customerName || ''}\nRemarks: ${fields.remarks || ''}`,
                files: files
            });
            return sendJson(res, 200, { success: true, staged });
        }

        
        // --- Microsoft Power Automate & OCR Endpoints ---

        // 14. Microsoft Power Automate Webhook (With Automatic OCR & Categorical Storage)
        if (pathname === '/api/power-automate/webhook' && method === 'POST') {
            const body = await parseJsonBody(req);
            const result = powerAutomate.handlePowerAutomateIngestion(body);
            return sendJson(res, result.success ? 200 : 400, result);
        }

        // 15. Power Automate Test Simulation
        if (pathname === '/api/power-automate/test' && method === 'POST') {
            const body = await parseJsonBody(req);
            const sampleCustomer = body.customerName || 'Vikram_Malhotra';
            const sampleBranch = body.branch || '001 - CHANDNI CHOWK';
            
            const result = powerAutomate.handlePowerAutomateIngestion({
                channel: 'WHATSAPP_POWER_AUTOMATE',
                officerName: body.officerName || 'Officer Rajesh Kumar',
                officerPhone: body.officerPhone || '+919811002233',
                branch: sampleBranch,
                customerName: sampleCustomer,
                messageText: 'Car Loan Proposal for ' + sampleCustomer + '. Dealer quotation for Hyundai Creta, Driving License and PAN Card attached.',
                files: [
                    {
                        name: 'Quotation_Hyundai_Creta_' + sampleCustomer + '.pdf',
                        content: '%PDF-1.4 BT (Hyundai Creta SX Dealer Proforma Quotation On-Road Rs 14,85,000) Tj ET'
                    },
                    {
                        name: 'Driving_License_' + sampleCustomer + '.pdf',
                        content: '%PDF-1.4 BT (Transport Department Driving Licence DL-0420220098765) Tj ET'
                    },
                    {
                        name: 'PAN_Card_' + sampleCustomer + '.pdf',
                        content: '%PDF-1.4 BT (Income Tax Department Permanent Account Number BKJPM7765Q) Tj ET'
                    }
                ]
            });

            return sendJson(res, 200, {
                success: true,
                message: 'Power Automate WhatsApp OCR test simulation executed successfully!',
                result: result
            });
        }

        // 16. Download / Export Power Automate Cloud Flow Template
        if (pathname === '/api/power-automate/flow-template' && method === 'GET') {
            const flowDef = powerAutomate.getPowerAutomateFlowDefinition();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="Bank_Loan_Appraisal_WhatsApp_OCR_Flow.json"'
            });
            return res.end(JSON.stringify(flowDef, null, 2));
        }

        // 17. Download / View Power Automate Desktop (PAD) Script
        if (pathname === '/api/power-automate/desktop-script' && method === 'GET') {
            const script = powerAutomate.getPowerAutomateDesktopScript();
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end(script);
        }

        // 18. Direct OCR Analysis Endpoint
        if (pathname === '/api/ocr/analyze' && method === 'POST') {
            const body = await parseJsonBody(req);
            const files = body.files || [];
            const text = body.text || '';
            const analysis = ocr.analyzeDossierOcr(files, text);
            return sendJson(res, 200, { success: true, analysis });
        }

        // Fallback 404
        sendJson(res, 404, { error: 'Endpoint not found' });
    } catch (err) {
        console.error('Server error:', err);
        sendJson(res, 500, { error: err.message || 'Internal Server Error' });
    }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxConnections = 500;

process.on('uncaughtException', (err) => {
    console.error('Unhandled server exception caught safely:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection caught safely:', reason);
});

if (!process.env.VERCEL) {
    server.listen(PORT, HOST, () => {
        console.log(`=======================================================`);
        console.log(` Bank Loan Appraisal & WhatsApp Hub`);
        console.log(` Mode: MULTI-USER HIGH-CONCURRENCY ENGINE (v2.4)`);
        console.log(` Target Active WhatsApp: +91 9329718002`);
        console.log(` Local Underwriter Desk: http://localhost:${PORT}`);
        console.log(` Field Officer Drop:     http://localhost:${PORT}/officer-drop`);
        console.log(` Workspace Directory:    ${__dirname}`);
        console.log(`=======================================================`);
    });
}

module.exports = server;
