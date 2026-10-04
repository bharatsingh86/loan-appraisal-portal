/**
 * BANK LOAN APPRAISAL - HYBRID GOOGLE DRIVE SERVICE
 * Seamlessly supports both:
 * 1. LOCAL MODE (When running on laptop: reads/writes directly to G:\My Drive\Bank_Loan_Appraisal)
 * 2. CLOUD 24/7 MODE (When laptop is OFF: interacts directly with Google Drive API via Service Account / OAuth)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = __dirname;
const CIRCULARS_DIR = path.join(BASE_DIR, 'Bank Circulars forms formats and Annexures');
const MASTER_VAULT_DIR = path.join(BASE_DIR, 'MASTER_VAULT');
const DATA_DIR = path.join(MASTER_VAULT_DIR, 'DATA');
const CHAT_HISTORY_DIR = path.join(DATA_DIR, '000-CHAT_HISTORY');
const FEEDBACK_DIR = path.join(MASTER_VAULT_DIR, 'FEEDBACK_AND_ISSUES');
const FEEDBACK_TICKETS_DIR = path.join(FEEDBACK_DIR, 'tickets');
const FEEDBACK_REGISTER_FILE = path.join(FEEDBACK_DIR, 'feedback_register.json');
const BRANCHES_FILE = path.join(BASE_DIR, 'branches.json');
const REGISTRY_FILE = path.join(BASE_DIR, 'vault_customers_registry.json');
let vaultRegistry = null;

function getVaultRegistry() {
    if (vaultRegistry) return vaultRegistry;
    if (fs.existsSync(REGISTRY_FILE)) {
        try {
            vaultRegistry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        } catch (e) {}
    }
    return vaultRegistry || { branches: {} };
}

// Ensure all core vault directories exist
[MASTER_VAULT_DIR, DATA_DIR, CHAT_HISTORY_DIR, FEEDBACK_DIR, FEEDBACK_TICKETS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Check if Google Drive API credentials exist for Cloud Mode
const SERVICE_ACCOUNT_FILE = path.join(BASE_DIR, 'service_account.json');
const HAS_GDRIVE_API = fs.existsSync(SERVICE_ACCOUNT_FILE) || !!process.env.GDRIVE_SERVICE_ACCOUNT_KEY;

// Multi-user concurrency mutex lock map
const folderWriteLocks = new Map();

async function acquireFolderLock(folderKey) {
    while (folderWriteLocks.get(folderKey)) {
        await new Promise(res => setTimeout(res, 25));
    }
    folderWriteLocks.set(folderKey, true);
}

function releaseFolderLock(folderKey) {
    folderWriteLocks.delete(folderKey);
}

function calculateSha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getFormattedTimestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Get full branch list (72+ branches of Jabalpur Circle)
 */
function getBranchList() {
    let branches = [];
    if (fs.existsSync(BRANCHES_FILE)) {
        try {
            branches = JSON.parse(fs.readFileSync(BRANCHES_FILE, 'utf8'));
        } catch (e) {}
    }
    // Also include branches from vaultRegistry
    const reg = getVaultRegistry();
    if (reg && reg.branches) {
        Object.keys(reg.branches).forEach(b => {
            if (!branches.includes(b)) branches.push(b);
        });
    }
    // Also include any branches present in MASTER_VAULT/DATA that might not be in branches.json
    if (fs.existsSync(DATA_DIR)) {
        try {
            const nonBranchDirs = ['000-CHAT_HISTORY', 'PROJECT_DEVELOPMENT_CHATS', 'STAGING_QUEUE', 'AUDIT_LOGS', 'FEEDBACK_AND_ISSUES'];
            const vaultBranches = fs.readdirSync(DATA_DIR).filter(b => !nonBranchDirs.includes(b) && !b.startsWith('.'));
            vaultBranches.forEach(vb => {
                if (!branches.includes(vb)) branches.push(vb);
            });
        } catch (e) {}
    }
    return branches.sort();
}

/**
 * Standard segments in 1, 2, 3 sequence
 */
function getSegmentList() {
    return [
        { id: '1. Agri', name: '1. Agri (Agriculture, KCC, KSY, Tractor)' },
        { id: '2. MSME', name: '2. MSME (Sampatti LAP, Prime Plus, Business)' },
        { id: '3. Retail', name: '3. Retail (Car Loan, Housing, Personal)' }
    ];
}

/**
 * List all customer folders for a branch & segment
 */
function getCustomers(branchName, segment) {
    if (!branchName || !segment) return [];
    const searchDirs = [path.join(DATA_DIR, branchName.trim(), segment.trim())];
    
    // Backwards-compatible check for legacy Retail folders
    if (segment.includes('Retail')) {
        const legacy2 = path.join(DATA_DIR, branchName.trim(), '2. Retail');
        const legacyLending = path.join(DATA_DIR, branchName.trim(), 'Retail_Lending');
        if (fs.existsSync(legacy2) && !searchDirs.includes(legacy2)) searchDirs.push(legacy2);
        if (fs.existsSync(legacyLending) && !searchDirs.includes(legacyLending)) searchDirs.push(legacyLending);
    } else if (segment.includes('MSME')) {
        const legacy3 = path.join(DATA_DIR, branchName.trim(), '3. MSME');
        if (fs.existsSync(legacy3) && !searchDirs.includes(legacy3)) searchDirs.push(legacy3);
    }

    const customers = [];

    searchDirs.forEach(segDir => {
        if (!fs.existsSync(segDir)) return;
        try {
            const entries = fs.readdirSync(segDir, { withFileTypes: true });

            entries.forEach(ent => {
                if (!ent.isDirectory() || ent.name.startsWith('.')) return;
                
                const subPath = path.join(segDir, ent.name);
                const subEntries = fs.readdirSync(subPath);
                const hasFiles = subEntries.some(f => !fs.statSync(path.join(subPath, f)).isDirectory());
                
                if (hasFiles || ent.name.includes('_DOCUMENTS')) {
                    if (!customers.includes(ent.name)) customers.push(ent.name);
                } else {
                    subEntries.forEach(sub => {
                        const deepPath = path.join(subPath, sub);
                        if (fs.statSync(deepPath).isDirectory()) {
                            const compound = `${ent.name}/${sub}`;
                            if (!customers.includes(compound)) customers.push(compound);
                        }
                    });
                    if (subEntries.length === 0 && !customers.includes(ent.name)) {
                        customers.push(ent.name);
                    }
                }
            });
        } catch (e) {}
    });

    // Fallback to vault registry for cloud / Vercel execution
    if (customers.length === 0) {
        const reg = getVaultRegistry();
        const bData = findBranchInRegistry(reg, branchName);
        if (bData) {
            let canonSeg = '3. Retail';
            if (segment.includes('Agri')) canonSeg = '1. Agri';
            else if (segment.includes('MSME')) canonSeg = '2. MSME';
            else if (segment.includes('Retail')) canonSeg = '3. Retail';

            const segCusts = bData[canonSeg];
            if (segCusts) {
                Object.keys(segCusts).forEach(c => {
                    if (!customers.includes(c)) customers.push(c);
                });
            }
        }
    }

    return customers;
}

function findBranchInRegistry(reg, branchName) {
    if (!reg || !reg.branches || !branchName) return null;
    const trimmed = branchName.trim();
    if (reg.branches[trimmed]) return reg.branches[trimmed];
    if (reg.branches[branchName]) return reg.branches[branchName];

    const norm = branchName.replace(/[\s_\-]+/g, '').toLowerCase();
    for (const [k, v] of Object.entries(reg.branches)) {
        if (k.replace(/[\s_\-]+/g, '').toLowerCase() === norm) {
            return v;
        }
    }
    return null;
}

function findCustomerInBranch(segObj, customerName) {
    if (!segObj || !customerName) return null;
    const trimmed = customerName.trim();
    if (segObj[trimmed]) return segObj[trimmed];
    if (segObj[customerName]) return segObj[customerName];

    const norm = customerName.replace(/[\s_\-]+/g, '').toLowerCase();
    for (const [k, v] of Object.entries(segObj)) {
        if (k.replace(/[\s_\-]+/g, '').toLowerCase() === norm) {
            return v;
        }
    }
    return null;
}

/**
 * List files inside a specific customer folder
 */
function getCustomerFiles(branchName, segment, customerName) {
    if (!branchName || !segment || !customerName) return [];
    
    const possibleDirs = [
        path.join(DATA_DIR, branchName.trim(), segment.trim(), customerName.trim())
    ];

    if (segment.includes('Retail')) {
        possibleDirs.push(path.join(DATA_DIR, branchName.trim(), '2. Retail', customerName.trim()));
        possibleDirs.push(path.join(DATA_DIR, branchName.trim(), 'Retail_Lending', customerName.trim()));
        possibleDirs.push(path.join(DATA_DIR, branchName.trim(), 'Retail_Lending', 'Car_Loan', customerName.trim()));
        possibleDirs.push(path.join(DATA_DIR, branchName.trim(), '3. Retail', 'Car_Loan', customerName.trim()));
    } else if (segment.includes('MSME')) {
        possibleDirs.push(path.join(DATA_DIR, branchName.trim(), '3. MSME', customerName.trim()));
    }

    let custDir = possibleDirs.find(d => fs.existsSync(d));
    if (custDir) {
        try {
            const files = fs.readdirSync(custDir).filter(f => !f.endsWith('.json') && !f.startsWith('.'));
            if (files.length > 0) {
                return files.map(f => {
                    const fullPath = path.join(custDir, f);
                    const stat = fs.statSync(fullPath);
                    return {
                        name: f,
                        sizeBytes: stat.size,
                        modifiedAt: stat.mtime
                    };
                });
            }
        } catch (e) {}
    }

    // Fallback to vault registry for cloud / Vercel execution
    const reg = getVaultRegistry();
    const bData = findBranchInRegistry(reg, branchName);
    if (bData) {
        let canonSeg = '3. Retail';
        if (segment.includes('Agri')) canonSeg = '1. Agri';
        else if (segment.includes('MSME')) canonSeg = '2. MSME';
        else if (segment.includes('Retail')) canonSeg = '3. Retail';

        const custObj = findCustomerInBranch(bData[canonSeg], customerName);
        if (custObj && custObj.files) {
            return custObj.files;
        }
    }

    return [];
}

/**
 * Ingest document into Branch & Customer Master Vault (Direct without scheme dependency)
 */
async function saveCustomerDocument({
    branchName = '943600-CHHINDWARA  VIP ROAD (MP)',
    segment = '3. Retail',
    customerName = 'New_Customer',
    fileName = 'document.pdf',
    fileBuffer = Buffer.from('')
}) {
    const cleanBranch = branchName.trim();
    const cleanSegment = segment.trim();
    let cleanCustomer = customerName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '_');
    if (!cleanCustomer) cleanCustomer = 'Customer';

    // Find or create target directory
    let targetDir = path.join(DATA_DIR, cleanBranch, cleanSegment, cleanCustomer);
    if (!fs.existsSync(targetDir)) {
        // If not existing, append _DOCUMENTS if not present
        if (!cleanCustomer.includes('_DOCUMENTS') && !cleanCustomer.includes(' - ')) {
            cleanCustomer = `${cleanCustomer}_DOCUMENTS`;
            targetDir = path.join(DATA_DIR, cleanBranch, cleanSegment, cleanCustomer);
        }
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const timestamp = getFormattedTimestamp();
    const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const safeFileName = `${timestamp}_${uniqueSuffix}_${path.basename(fileName).replace(/\s+/g, '_')}`;
    const targetFilePath = path.join(targetDir, safeFileName);

    await acquireFolderLock(targetDir);
    try {
        fs.writeFileSync(targetFilePath, fileBuffer);
        const checksum = calculateSha256(fileBuffer);

        // Update INTAKE_AUDIT_RECEIPT.json
        const receiptPath = path.join(targetDir, 'INTAKE_AUDIT_RECEIPT.json');
        let receipt = { customerName: cleanCustomer, branch: cleanBranch, segment: cleanSegment, files: [] };
        if (fs.existsSync(receiptPath)) {
            try {
                receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
            } catch (e) {}
        }

        receipt.files.push({
            fileName: safeFileName,
            originalName: fileName,
            sizeBytes: fileBuffer.length,
            sha256: checksum,
            ingestedAt: new Date().toISOString()
        });

        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

        return {
            success: true,
            customerName: cleanCustomer,
            filePath: targetFilePath,
            fileName: safeFileName,
            checksum,
            relativeDrivePath: `MASTER_VAULT/DATA/${cleanBranch}/${cleanSegment}/${cleanCustomer}/${safeFileName}`
        };
    } finally {
        releaseFolderLock(targetDir);
    }
}

/**
 * Save new circular into Bank Circulars folder
 */
async function saveCircular({
    fileName = 'RABD_NEW_CIRCULAR.pdf',
    fileBuffer = Buffer.from(''),
    division = 'RABD',
    num = '999',
    year = '2026',
    subject = 'NEW CIRCULAR'
}) {
    if (!fs.existsSync(CIRCULARS_DIR)) {
        fs.mkdirSync(CIRCULARS_DIR, { recursive: true });
    }

    const cleanSubject = subject.toUpperCase().replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    const standardizedName = `${division} - ${year} - ${num} - ${cleanSubject}.pdf`;
    const targetPath = path.join(CIRCULARS_DIR, standardizedName);

    fs.writeFileSync(targetPath, fileBuffer);

    // Update metadata JSON
    const metaPath = path.join(BASE_DIR, 'circular_metadata_db.json');
    let meta = {};
    if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) {}
    }

    const id = Date.now().toString();
    meta[id] = {
        id,
        num,
        year,
        division,
        subject: cleanSubject,
        date: new Date().toLocaleDateString('en-IN'),
        status: 'Operative',
        filename: standardizedName,
        standard_title: `${division} - ${year} - ${num} - ${cleanSubject}`
    };

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    return {
        success: true,
        filename: standardizedName,
        filePath: targetPath
    };
}

/**
 * List all proposals currently in Master Vault
 */
function listMasterVaultProposals() {
    let proposals = [];
    if (fs.existsSync(DATA_DIR)) {
        try {
            const branches = fs.readdirSync(DATA_DIR);
            branches.forEach(branch => {
                if (branch === '000-CHAT_HISTORY' || branch.startsWith('.')) return;
                const branchPath = path.join(DATA_DIR, branch);
                if (!fs.statSync(branchPath).isDirectory()) return;

                const segments = fs.readdirSync(branchPath);
                segments.forEach(segment => {
                    const segPath = path.join(branchPath, segment);
                    if (!fs.statSync(segPath).isDirectory()) return;

                    const custDirs = fs.readdirSync(segPath);
                    custDirs.forEach(cust => {
                        const custPath = path.join(segPath, cust);
                        if (fs.statSync(custPath).isDirectory()) {
                            const files = fs.readdirSync(custPath).filter(f => !f.endsWith('.json') && !f.endsWith('.txt'));
                            proposals.push({
                                branch,
                                segment,
                                customerName: cust.replace('_DOCUMENTS', ''),
                                folderPath: custPath,
                                fileCount: files.length,
                                files
                            });
                        }
                    });
                });
            });
        } catch (e) {}
    }

    // Fallback to vault registry for cloud / Vercel execution
    if (proposals.length === 0) {
        const reg = getVaultRegistry();
        if (reg && reg.proposals && reg.proposals.length > 0) {
            proposals = reg.proposals.map(p => ({
                branch: p.branch,
                segment: p.segment,
                customerName: p.displayName || p.customerName,
                folderPath: `${p.branch}/${p.segment}/${p.customerName}`,
                fileCount: p.filesCount || (p.files ? p.files.length : 0),
                files: (p.files || []).map(f => typeof f === 'string' ? f : f.name)
            }));
        }
    }

    return proposals;
}

/**
  * Multi-User Feedback & Issue Management
  */
async function saveFeedback({
    staffName = 'Staff Member',
    branch = 'Circle Office',
    category = 'General Feedback',
    screen = 'General',
    severity = 'Normal',
    message = '',
    deviceInfo = {}
}) {
    await acquireFolderLock(FEEDBACK_DIR);
    try {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
        const ticketId = `TKT-${dateStr}-${randomHex}`;

        const ticketData = {
            ticketId,
            createdAt: new Date().toISOString(),
            displayTime: new Date().toLocaleString('en-IN'),
            staffName: staffName.trim() || 'Anonymous Officer',
            branch: branch.trim() || 'General',
            category: category.trim(),
            screen: screen.trim(),
            severity: severity.trim(),
            message: message.trim(),
            deviceInfo,
            status: 'OPEN',
            resolutionNotes: '',
            resolvedAt: null,
            resolvedBy: null
        };

        // Write ticket JSON
        const ticketFile = path.join(FEEDBACK_TICKETS_DIR, `${ticketId}.json`);
        fs.writeFileSync(ticketFile, JSON.stringify(ticketData, null, 2), 'utf8');

        // Update master feedback register
        let register = [];
        if (fs.existsSync(FEEDBACK_REGISTER_FILE)) {
            try {
                register = JSON.parse(fs.readFileSync(FEEDBACK_REGISTER_FILE, 'utf8'));
            } catch (e) {}
        }
        register.unshift(ticketData);
        fs.writeFileSync(FEEDBACK_REGISTER_FILE, JSON.stringify(register, null, 2), 'utf8');

        return {
            success: true,
            ticketId,
            ticket: ticketData
        };
    } finally {
        releaseFolderLock(FEEDBACK_DIR);
    }
}

function getFeedbackList() {
    if (!fs.existsSync(FEEDBACK_REGISTER_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(FEEDBACK_REGISTER_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

async function resolveFeedback({ ticketId, status = 'RESOLVED', resolutionNotes = '', resolvedBy = 'Admin / IT Underwriter' }) {
    await acquireFolderLock(FEEDBACK_DIR);
    try {
        if (!ticketId) return { success: false, error: 'Ticket ID required' };
        
        let register = [];
        if (fs.existsSync(FEEDBACK_REGISTER_FILE)) {
            try {
                register = JSON.parse(fs.readFileSync(FEEDBACK_REGISTER_FILE, 'utf8'));
            } catch (e) {}
        }

        const ticketIndex = register.findIndex(t => t.ticketId === ticketId);
        if (ticketIndex === -1) {
            return { success: false, error: 'Ticket not found' };
        }

        register[ticketIndex].status = status;
        register[ticketIndex].resolutionNotes = resolutionNotes;
        register[ticketIndex].resolvedAt = new Date().toISOString();
        register[ticketIndex].resolvedBy = resolvedBy;

        fs.writeFileSync(FEEDBACK_REGISTER_FILE, JSON.stringify(register, null, 2), 'utf8');

        // Also update individual ticket file
        const ticketFile = path.join(FEEDBACK_TICKETS_DIR, `${ticketId}.json`);
        if (fs.existsSync(ticketFile)) {
            fs.writeFileSync(ticketFile, JSON.stringify(register[ticketIndex], null, 2), 'utf8');
        }

        return { success: true, ticket: register[ticketIndex] };
    } finally {
        releaseFolderLock(FEEDBACK_DIR);
    }
}

module.exports = {
    getBranchList,
    getSegmentList,
    getCustomers,
    getCustomerFiles,
    getVaultRegistry,
    saveCustomerDocument,
    saveCircular,
    listMasterVaultProposals,
    saveFeedback,
    getFeedbackList,
    resolveFeedback,
    HAS_GDRIVE_API,
    CIRCULARS_DIR,
    MASTER_VAULT_DIR,
    DATA_DIR,
    CHAT_HISTORY_DIR,
    FEEDBACK_DIR,
    FEEDBACK_TICKETS_DIR
};
