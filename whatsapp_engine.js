/**
 * Bank Loan Appraisal - WhatsApp Integration Engine for +91 9329718002
 * Strictly isolated for D:\Bank_Loan_Appraisal
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gateway = require('./gateway_engine');

const CONFIG_FILE = path.join(__dirname, 'MASTER_VAULT', 'whatsapp_config.json');

// Default configuration tailored for 9329718002
const DEFAULT_CONFIG = {
    targetPhoneNumber: '9329718002',
    countryCode: '+91',
    fullNumber: '+919329718002',
    webhookVerifyToken: 'PNB_CREDIT_SECURE_TOKEN_2026',
    status: 'PAIRING_READY', // 'DISCONNECTED', 'PAIRING_READY', 'CONNECTED'
    lastConnectedAt: null,
    pairingCode: 'PNB9-7180',
    pairingCodeExpiresAt: Date.now() + 15 * 60 * 1000,
    registeredOfficers: [
        { name: 'Officer Rajesh Kumar', phone: '+919811002233', branch: '001 - CHANDNI CHOWK' },
        { name: 'Officer Priya Sharma', phone: '+919876543210', branch: '002 - CONNAUGHT PLACE' },
        { name: 'Officer Amit Verma', phone: '+919412345678', branch: '003 - NOIDA SECTOR 18' },
        { name: 'Field Desk Self', phone: '+919329718002', branch: '001 - CHANDNI CHOWK' }
    ]
};

// Load or initialize config
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) {
            return DEFAULT_CONFIG;
        }
    }
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

/**
 * Generates an 8-character WhatsApp pairing code for 9329718002
 * Format: XXXX-XXXX
 */
function generatePairingCode(phoneNumber = '9329718002') {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
        code += chars[bytes[i] % chars.length];
        if (i === 3) code += '-';
    }
    const cfg = loadConfig();
    cfg.targetPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    cfg.fullNumber = (phoneNumber.startsWith('+') ? '' : '+91') + cfg.targetPhoneNumber;
    cfg.pairingCode = code;
    cfg.pairingCodeExpiresAt = Date.now() + 15 * 60 * 1000;
    cfg.status = 'PAIRING_READY';
    saveConfig(cfg);
    return code;
}

/**
 * Confirm device linking
 */
function confirmDeviceLinked(status = 'CONNECTED') {
    const cfg = loadConfig();
    cfg.status = status;
    cfg.lastConnectedAt = new Date().toISOString();
    saveConfig(cfg);
    return cfg;
}

/**
 * Generates an SVG representation of a QR code placeholder or visual matrix
 */
function generateQrSvg(text) {
    // Generate a clean 25x25 visual QR matrix SVG deterministic from text
    const size = 25;
    const cellSize = 10;
    const totalSize = size * cellSize;
    const hash = crypto.createHash('sha256').update(text).digest();

    let rects = '';
    // Finder patterns (top-left, top-right, bottom-left)
    function drawFinder(x, y) {
        rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="#0f172a" />`;
        rects += `<rect x="${(x + 1) * cellSize}" y="${(y + 1) * cellSize}" width="${5 * cellSize}" height="${5 * cellSize}" fill="#ffffff" />`;
        rects += `<rect x="${(x + 2) * cellSize}" y="${(y + 2) * cellSize}" width="${3 * cellSize}" height="${3 * cellSize}" fill="#0f172a" />`;
    }

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    // Data dots
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            // Skip finder areas
            if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8)) continue;
            const bitIndex = (r * size + c) % (hash.length * 8);
            const byte = hash[Math.floor(bitIndex / 8)];
            const isDark = ((byte >> (bitIndex % 8)) & 1) === 1 || (r % 2 === 0 && c % 3 === 0);
            if (isDark) {
                rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="240" height="240">
        <rect width="100%" height="100%" fill="#ffffff" rx="8"/>
        <g transform="translate(0, 0)">${rects}</g>
    </svg>`;
}

/**
 * Ingests an incoming WhatsApp message payload and routes it to Gateway Quarantine
 */
function handleIncomingWhatsApp({ from, text, files = [], officerName = null }) {
    const cfg = loadConfig();
    const cleanSender = from ? from.replace(/[^0-9]/g, '') : cfg.targetPhoneNumber;

    // Resolve Officer Name from registered directory if not provided
    let matchedOfficer = officerName;
    if (!matchedOfficer) {
        const found = cfg.registeredOfficers.find(o => o.phone.includes(cleanSender.slice(-10)));
        matchedOfficer = found ? `${found.name} (${found.branch})` : `Officer +91 ${cleanSender.slice(-10)}`;
    }

    const stagedManifest = gateway.stageIntake({
        channel: 'WHATSAPP',
        sender: `+91 ${cleanSender.slice(-10)}`,
        officerName: matchedOfficer,
        text: text || '',
        files: files
    });

    return stagedManifest;
}

/**
 * Creates realistic sample loan dossiers for WhatsApp testing
 */
function simulateWhatsAppDossier(preset = 'car_loan') {
    const cfg = loadConfig();
    if (preset === 'housing_loan') {
        const text = `Subject: PNB Housing Loan Proposal\nApplicant: Smt. Sunita Sharma\nBranch: 002 - CONNAUGHT PLACE\nLoan Amount: ₹65,00,000\nProperty: Flat 402, Royal Residency\nPlease review and approve loan dossier.`;
        const dummyPdf = (title) => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Author (Branch 002) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`);
        return handleIncomingWhatsApp({
            from: '+919876543210',
            officerName: 'Officer Priya Sharma (002 - CONNAUGHT PLACE)',
            text,
            files: [
                { name: 'Agreement_For_Sale_Flat402.pdf', data: dummyPdf('Sale Agreement Flat 402'), mimeType: 'application/pdf' },
                { name: 'Salary_Slips_Last_6_Months.pdf', data: dummyPdf('Salary Slips'), mimeType: 'application/pdf' },
                { name: 'Legal_Search_Report_Property.pdf', data: dummyPdf('Title Search Report'), mimeType: 'application/pdf' }
            ]
        });
    } else if (preset === 'msme_loan') {
        const text = `Subject: MSME Cash Credit Limit ₹40 Lakhs\nApplicant: M/s Apex Tech Solutions\nBranch: 003 - NOIDA SECTOR 18\nSegment: MSME_Lending\nAttached GST Returns, audited balance sheet and Udyam certificate.`;
        const dummyPdf = (title) => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Author (Branch 003) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`);
        return handleIncomingWhatsApp({
            from: '+919412345678',
            officerName: 'Officer Amit Verma (003 - NOIDA SECTOR 18)',
            text,
            files: [
                { name: 'Udyam_Registration_Certificate.pdf', data: dummyPdf('Udyam Cert'), mimeType: 'application/pdf' },
                { name: 'GSTR_3B_Last_12_Months.pdf', data: dummyPdf('GST 3B Returns'), mimeType: 'application/pdf' },
                { name: 'Audited_Balance_Sheet_FY24-25.pdf', data: dummyPdf('Balance Sheet'), mimeType: 'application/pdf' }
            ]
        });
    } else {
        // Default Car Loan
        const text = `WhatsApp Dossier for PNB Car Loan Scheme\nCustomer: Shri Rohit Verma\nBranch: 001 - CHANDNI CHOWK\nVehicle: Hyundai Creta SX (O)\nQuotation Amount: ₹16,50,000\nDocuments enclosed for sanction appraisal.`;
        const dummyPdf = (title) => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Author (Branch 001) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`);
        return handleIncomingWhatsApp({
            from: '+919329718002',
            officerName: 'Officer Rajesh Kumar (001 - CHANDNI CHOWK)',
            text,
            files: [
                { name: 'Dealer_Proforma_Invoice_Hyundai_Creta.pdf', data: dummyPdf('Car Invoice'), mimeType: 'application/pdf' },
                { name: 'Applicant_PAN_Aadhar_KYC.pdf', data: dummyPdf('KYC Documents'), mimeType: 'application/pdf' },
                { name: 'ITR_Computation_2_Years.pdf', data: dummyPdf('Income Tax Returns'), mimeType: 'application/pdf' },
                { name: 'CIBIL_Report_Score_784.pdf', data: dummyPdf('CIBIL Report'), mimeType: 'application/pdf' }
            ]
        });
    }
}

module.exports = {
    loadConfig,
    saveConfig,
    generatePairingCode,
    confirmDeviceLinked,
    generateQrSvg,
    handleIncomingWhatsApp,
    simulateWhatsAppDossier
};
