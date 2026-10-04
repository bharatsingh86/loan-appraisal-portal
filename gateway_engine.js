/**
 * Bank Loan Appraisal - Gateway & Approval Engine
 * Strictly isolated for D:\Bank_Loan_Appraisal
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = __dirname;
const VAULT_DIR = path.join(BASE_DIR, 'MASTER_VAULT');
const STAGING_DIR = path.join(VAULT_DIR, 'STAGING_QUEUE');
const DATA_DIR = path.join(VAULT_DIR, 'DATA');
const AUDIT_DIR = path.join(VAULT_DIR, 'AUDIT_LOGS');

// Ensure base directories exist
[VAULT_DIR, STAGING_DIR, DATA_DIR, AUDIT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Loan Schemes & Segments Reference
const SCHEMES = {
    'Car_Loan': { segment: 'Retail_Lending', keywords: ['car', 'vehicle', 'auto', 'creta', 'swift', 'honda', 'four wheeler', 'quotation', 'proforma', 'chassis', 'rc', 'rabd'] },
    'Housing_Loan': { segment: 'Retail_Lending', keywords: ['home', 'housing', 'flat', 'apartment', 'builder', 'plot', 'mortgage', 'registry', 'b402', 'khata'] },
    'MSME_Loan': { segment: 'MSME_Lending', keywords: ['msme', 'business', 'working capital', 'cash credit', 'cc limit', 'gst', 'turnover', 'udyam', 'sole prop', 'enterprise'] },
    'Education_Loan': { segment: 'Retail_Lending', keywords: ['education', 'college', 'university', 'tuition', 'fee structure', 'degree', 'admission', 'student'] },
    'Personal_Loan': { segment: 'Retail_Lending', keywords: ['personal', 'salary', 'clean loan', 'consumption'] },
    'Agriculture_Loan': { segment: 'Agriculture_Lending', keywords: ['kcc', 'kisan', 'agriculture', 'tractor', 'farmland', 'crop'] }
};

let DEFAULT_BRANCHES = [
    '019710-JABALPUR',
    '380000-CIRCLE OFFICE JABALPUR'
];
try {
    const branchesJsonPath = path.join(__dirname, 'branches.json');
    if (fs.existsSync(branchesJsonPath)) {
        DEFAULT_BRANCHES = JSON.parse(fs.readFileSync(branchesJsonPath, 'utf8'));
    }
} catch (e) {
    // fallback
}

/**
 * Parses message body and file names to detect scheme, branch, and customer
 */
function parseMetadata(text = '', fileNames = [], defaultSender = '') {
    const combined = (text + ' ' + fileNames.join(' ')).toLowerCase();
    
    // 1. Detect Scheme
    let detectedScheme = 'Car_Loan';
    let detectedSegment = 'Retail_Lending';
    for (const [scheme, info] of Object.entries(SCHEMES)) {
        if (info.keywords.some(kw => combined.includes(kw))) {
            detectedScheme = scheme;
            detectedSegment = info.segment;
            break;
        }
    }

    // 2. Detect Branch
    let detectedBranch = DEFAULT_BRANCHES[0] || '019710-JABALPUR';
    for (const b of DEFAULT_BRANCHES) {
        const parts = b.split('-');
        const bCode = (parts[0] || '').trim().toLowerCase();
        const bName = (parts.slice(1).join('-') || '').trim().toLowerCase();
        if ((bCode && combined.includes(bCode)) || (bName && combined.includes(bName))) {
            detectedBranch = b;
            break;
        }
    }

    // 3. Detect Customer / Applicant Name
    let customerName = 'Unknown_Applicant';
    const customerMatch = text.match(/(?:customer|applicant|borrower|name|client)\s*[:=\-]\s*(?:shri|smt\.?|mr\.?|mrs\.?|ms\.?|m\/s\.?)?\s*([a-zA-Z\s]{3,35}?)(?=[\r\n]|$|\b(?:branch|scheme|loan|segment|amount|property|vehicle)\b)/i);
    if (customerMatch && customerMatch[1]) {
        customerName = customerMatch[1].trim().replace(/\s+/g, '_');
    } else {
        // Direct salutation without prefix (e.g., Shri Rohit Verma)
        const salutationMatch = text.match(/(?:shri|smt\.?|mr\.?|mrs\.?|m\/s\.?)\s+([a-zA-Z\s]{3,30}?)(?=[\r\n]|$|\b(?:branch|scheme|loan|segment|amount|property|vehicle)\b)/i);
        if (salutationMatch && salutationMatch[1]) {
            customerName = salutationMatch[1].trim().replace(/\s+/g, '_');
        } else {
            // Try to extract from filename (e.g., Rohit_Verma_ITR.pdf)
            for (const fn of fileNames) {
                const base = path.basename(fn, path.extname(fn));
                const parts = base.split(/[_\-\s]+/);
                if (parts.length >= 2 && !['loan', 'doc', 'cibil', 'itr', 'kyc', 'report', 'agreement', 'salary', 'invoice'].includes(parts[0].toLowerCase())) {
                    customerName = `${parts[0]}_${parts[1]}`;
                    break;
                }
            }
        }
    }

    return {
        scheme: detectedScheme,
        segment: detectedSegment,
        branch: detectedBranch,
        customerName: customerName.replace(/[^a-zA-Z0-9_-]/g, '')
    };
}

/**
 * Calculates SHA-256 of a buffer
 */
function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Stages an incoming packet into MASTER_VAULT/STAGING_QUEUE
 */
function stageIntake({ channel = 'WHATSAPP', sender = '9329718002', officerName = 'Branch Officer', text = '', files = [] }) {
    const intakeId = 'INTAKE_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const intakeFolder = path.join(STAGING_DIR, intakeId);
    fs.mkdirSync(intakeFolder, { recursive: true });

    const fileNames = files.map(f => f.name || 'document.pdf');
    const meta = parseMetadata(text, fileNames, sender);

    const savedFiles = [];
    files.forEach(f => {
        const safeName = (f.name || 'document.pdf').replace(/[^a-zA-Z0-9._\-]/g, '_');
        const filePath = path.join(intakeFolder, safeName);
        let buffer;
        if (Buffer.isBuffer(f.data)) {
            buffer = f.data;
        } else if (typeof f.data === 'string') {
            buffer = Buffer.from(f.data, 'base64');
        } else {
            buffer = Buffer.from(f.data || '');
        }
        fs.writeFileSync(filePath, buffer);

        savedFiles.push({
            name: safeName,
            sizeBytes: buffer.length,
            sha256: sha256(buffer),
            mimeType: f.mimeType || 'application/octet-stream',
            path: filePath
        });
    });

    const manifest = {
        intakeId,
        channel,
        sender,
        officerName,
        receivedAt: new Date().toISOString(),
        status: 'PENDING_APPROVAL',
        text,
        metadata: meta,
        files: savedFiles
    };

    fs.writeFileSync(path.join(intakeFolder, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}

/**
 * Lists all pending intakes
 */
function listPendingIntakes() {
    if (!fs.existsSync(STAGING_DIR)) return [];
    const dirs = fs.readdirSync(STAGING_DIR);
    const results = [];

    dirs.forEach(d => {
        const manifestPath = path.join(STAGING_DIR, d, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                if (manifest.status === 'PENDING_APPROVAL') {
                    results.push(manifest);
                }
            } catch (e) {
                // Ignore corrupt manifests
            }
        }
    });

    return results.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

/**
 * Approves a staged packet and moves files into categorical, timestamped folder
 */
function approveIntake(intakeId, { approvedBy = 'Underwriter', branchOverride, schemeOverride, customerOverride } = {}) {
    const intakeFolder = path.join(STAGING_DIR, intakeId);
    const manifestPath = path.join(intakeFolder, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Intake packet ${intakeId} not found`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Overrides if modified by underwriter
    const branch = branchOverride || manifest.metadata.branch || (DEFAULT_BRANCHES[0] || '019710-JABALPUR');
    const scheme = schemeOverride || manifest.metadata.scheme || 'Car_Loan';
    const segment = SCHEMES[scheme] ? SCHEMES[scheme].segment : 'Retail_Lending';
    const customer = customerOverride || manifest.metadata.customerName || 'Customer';
    const officerId = manifest.sender ? manifest.sender.replace(/[^a-zA-Z0-9_-]/g, '') : 'OFFICER';

    // Map segment to 1. Agri, 2. Retail, 3. MSME
    let categoryDir = '2. Retail';
    const segLower = (segment || '').toLowerCase();
    if (segLower.includes('agri')) categoryDir = '1. Agri';
    else if (segLower.includes('msme')) categoryDir = '3. MSME';
    else categoryDir = '2. Retail';

    // Build Vault Destination
    // MASTER_VAULT/DATA/<BRANCH>/<1. Agri | 2. Retail | 3. MSME>/<CUSTOMER_NAME>_<SCHEME>/1_Documents/
    const cleanBranch = branch.replace(/[\\/:*?"<>|]/g, '_').trim();
    const safeCustomer = customer.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
    const safeScheme = scheme.replace(/[\\/:*?"<>|]/g, '_').trim();

    const customerDossierDir = path.join(DATA_DIR, cleanBranch, categoryDir, `${safeCustomer}_${safeScheme}`);
    const destDir = path.join(customerDossierDir, '1_Documents');

    // Create subfolders: 1_Documents, 2_Assessment, 3_Appraisal, 4_Sanction
    ['1_Documents', '2_Assessment', '3_Appraisal', '4_Sanction'].forEach(sub => {
        fs.mkdirSync(path.join(customerDossierDir, sub), { recursive: true });
    });

    // Timestamp formatting: YYYY-MM-DD_HH-mm-ss
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

    const approvedFiles = [];
    manifest.files.forEach(fileInfo => {
        const srcPath = fileInfo.path;
        if (fs.existsSync(srcPath)) {
            const stampedName = `${timestampStr}_${fileInfo.name}`;
            const targetPath = path.join(destDir, stampedName);
            fs.copyFileSync(srcPath, targetPath);

            approvedFiles.push({
                originalName: fileInfo.name,
                stampedName: stampedName,
                targetPath: targetPath,
                sizeBytes: fileInfo.sizeBytes,
                sha256: fileInfo.sha256
            });
        }
    });

    // Create Audit Receipt
    const auditReceipt = {
        auditId: 'AUDIT_' + timestampStr + '_' + crypto.randomBytes(2).toString('hex').toUpperCase(),
        intakeId,
        channel: manifest.channel,
        senderNumber: manifest.sender,
        officerName: manifest.officerName,
        approvedBy,
        approvalTimestamp: now.toISOString(),
        destinationFolder: destDir,
        branch,
        segment,
        scheme,
        customerName: customer,
        files: approvedFiles
    };

    // Save audit receipt in destination folder and in MASTER_VAULT/AUDIT_LOGS
    const receiptFileName = `INTAKE_AUDIT_RECEIPT_${timestampStr}.json`;
    fs.writeFileSync(path.join(destDir, receiptFileName), JSON.stringify(auditReceipt, null, 2), 'utf8');
    fs.writeFileSync(path.join(AUDIT_DIR, `${safeCustomer}_${receiptFileName}`), JSON.stringify(auditReceipt, null, 2), 'utf8');

    // Also write/update customer proposal summary
    const proposalSummary = {
        customerName: customer,
        branch,
        scheme,
        segment,
        status: 'DOCUMENTS_INGESTED_VERIFIED',
        lastUpdated: now.toISOString(),
        documentsCount: approvedFiles.length,
        vaultLocation: destDir,
        documents: approvedFiles.map(f => f.stampedName)
    };
    fs.writeFileSync(path.join(destDir, `${safeCustomer}_proposal.json`), JSON.stringify(proposalSummary, null, 2), 'utf8');

    // Update manifest status to APPROVED
    manifest.status = 'APPROVED';
    manifest.approvedAt = now.toISOString();
    manifest.approvedBy = approvedBy;
    manifest.vaultPath = destDir;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    return {
        success: true,
        intakeId,
        vaultFolder: destDir,
        savedFiles: approvedFiles,
        auditReceipt
    };
}

/**
 * Rejects a staged packet
 */
function rejectIntake(intakeId, reason = 'Rejected by Underwriter') {
    const intakeFolder = path.join(STAGING_DIR, intakeId);
    const manifestPath = path.join(intakeFolder, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.status = 'REJECTED';
        manifest.rejectedAt = new Date().toISOString();
        manifest.rejectionReason = reason;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        return { success: true, intakeId, status: 'REJECTED' };
    }
    throw new Error(`Intake ${intakeId} not found`);
}

module.exports = {
    SCHEMES,
    DEFAULT_BRANCHES,
    parseMetadata,
    stageIntake,
    listPendingIntakes,
    approveIntake,
    rejectIntake,
    VAULT_DIR,
    STAGING_DIR,
    DATA_DIR,
    AUDIT_DIR
};
