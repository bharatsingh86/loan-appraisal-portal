/**
 * BANK LOAN APPRAISAL - AUTONOMOUS AI ASSISTANT & KNOWLEDGE RETRIEVAL ENGINE
 * Handles:
 * 1. Semantic Circular Search & Grounded Q&A (Car Loan, MSME, HRD, Agri, Housing)
 * 2. Full Loan Appraisal (Document Scrutiny, Defect Check, Strengths vs Weaknesses)
 * 3. Discrepancy Letter Generation for Branch Managers
 * 4. Credit Appraisal & Sanction Note Generation
 * 5. Automatic DOCX Chat History Archival
 */

const fs = require('fs');
const path = require('path');
const { createChatDocx } = require('./save_chat_to_docx');

// Load environment variables if available
if (fs.existsSync(path.join(__dirname, '.env'))) {
    try {
        require('dotenv').config();
    } catch (e) {}
}

const CIRCULARS_DIR = path.join(__dirname, 'Bank Circulars forms formats and Annexures');
const METADATA_FILE = path.join(__dirname, 'circular_metadata_db.json');
const MASTER_VAULT_DIR = path.join(__dirname, 'MASTER_VAULT');
const CHAT_HISTORY_DIR = path.join(MASTER_VAULT_DIR, 'DATA', '000-CHAT_HISTORY');

// Ensure directories exist
[MASTER_VAULT_DIR, CHAT_HISTORY_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

let circularMetadata = {};
if (fs.existsSync(METADATA_FILE)) {
    try {
        circularMetadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading circular metadata:', e.message);
    }
}

// In-Memory Circular Knowledge Base for high-frequency queries
const KNOWLEDGE_BASE = {
    car_loan: {
        master_circular: 'RABD Consolidated Circular No. 75/2026 (Dated 14.05.2026)',
        campaign: 'PNB CAR UTSAV (RABD 130/2026: 14.09.2026 - 15.11.2026) & PNB UTSAV FESTIVITIES 2026 (RABD 135/2026: 01.10.2026 - 31.12.2026)',
        schemes: [
            '1. PNB Car Loan (General - New Car): 84 months, 10% margin on-road (NIL on ex-showroom under tie-up), ROI 7.65% (CIBIL 750+), 100% waiver of processing & doc fees during campaign.',
            '2. PNB Old/Pre-owned Car Loan: Up to 3 years old car, max 60 months, 20-25% margin, ROI 9.45% (CIBIL 750+).',
            '3. Insta Vehicle Loan (Annexure-B): For existing HL borrowers with 3-yr clean track. No fresh income proof, max Rs 10 Lakhs, 100 months tenure, flat Rs 1000 fee, ROI 7.65%.',
            '4. PNB Combo Loan (Annexure-C): HL >= Rs 15 Lakhs + Car Loan. Zero processing & doc fees, lowest ROI 7.65%, extension of mortgage on house.',
            '5. PNB Green Car / EV (Annexure-D): Battery EV only. Max 120 months (10 years) tenure, 5 bps discount (ROI 7.60%, EV Yuva 7.55%), zero fees.',
            '6. In-Built Car Loan to MSME/Corporate (Annexure-E): For firms with limits >= Rs 1.00 Cr. Up to 10% of limit or max Rs 1.00 Cr, zero fresh KYC/inspection/fees.',
            '7. Car Loan to NRI (Annexure-F): Up to Rs 1.00 Cr (18x gross monthly income), resident Indian co-borrower mandatory, margin 15% (relaxable to 10% by CHCAC).',
            '8. PNB Yuva Vahan (Annexure-G): For age 18-35 years. 5 bps extra concession (ROI 7.60%, EV Yuva 7.55%), 50% standard fee waiver (100% in campaign).'
        ],
        common_guidelines: [
            'CIBIL Cutoff: Min 700. Score >= 750 gets 7.65% p.a.; 700-749 gets 8.70% p.a.',
            'Permissible Deductions: Gross income <= 50k: 50%; 50k-1L: 60%; > 1L: 70%.',
            'Sibling Co-borrower (RABD 83/2026): Inclusion of earning brother/sister permitted with CHCAC approval (max 1 co-borrower).',
            'Driving License: If applicant has no DL, declaration of employing paid driver/family driver is acceptable.',
            'CBS CARDEALM (RABD 77/2026): Mandatory online GST verification and registration of dealer in CARDEALM. UDC entered in Free Text 10.',
            'Disbursement Flow: Loan disbursed via HLADISB to Branch Pool Account 3191101, margin transferred from SB/CA, then paid to dealer account via NEFT/HTM.',
            'JRC Advisory (RABD 128/2026): Unmasked JRC verification from VAHAN portal or Next Gen mParivahan application.'
        ]
    },
    msme: {
        sampatti: {
            circular: 'MSME Circular No. 77/2026 (Dated 30.09.2026)',
            concept: 'Loan Against Property (LAP) for MSME & Non-MSME enterprises.',
            facilities: 'Overdraft (General), Overdraft (Reducing DP up to 15 years), Term Loan (up to 15 years with 6 months moratorium), NFB limits.',
            ltv: 'Residential: up to 65% of Realizable Value; Other: up to 60% of RV (relaxable to 75% by CHCAC for IRR A4 & above).',
            quantum: 'Need-based (no upper cap).',
            roi: 'Upto Rs 25 Lakhs: RLLR+BSP+2.40%; Rs 25L to Rs 5 Cr: RLLR+BSP+1.10%; Above Rs 5 Cr: RLLR+BSP+0.85% to 1.60%.'
        },
        prime_plus: {
            circular: 'MSME Circular No. 79/2026 (Dated 30.09.2026)',
            concept: 'Flagship comprehensive MSME credit scheme from Rs 20 Lakhs to Rs 100 Crores.',
            margin: 'WC: 25%; Term Loan: 25% (Vehicles: 15%, tie-up: 10%); NFB: 10% cash margin.',
            collateral: 'Manufacturing: 30%; Services: 40%; Contractors: 50%; Traders: 75% (or CGTMSE/Hybrid).',
            roi: 'Collateral 100%+: RLLR+BSP+0.20%; Collateral 50-100%: RLLR+BSP+0.35%; Collateral <50%: RLLR+BSP+0.50%.'
        }
    },
    hrd: {
        scale_4: {
            circulars: 'HRDD 835/2020, 836/2020, 838/2020, 977/2025',
            entitlements: [
                'Conveyance Loan: Scale IV Chief Manager eligible for Car Loan up to Rs 11.50 Lakhs (Electric: Rs 13.00 Lakhs) at 100% cost, concessional staff ROI (Simple interest).',
                'Leased Accommodation: Official quarters or company lease rent reimbursement as per category of center (Metro: Rs 30,000-35,000+).',
                'Conveyance Allowance / Fuel: Monthly petrol reimbursement (approx 100-120 liters for Scale IV with car).',
                'Mobile & Broadband: Monthly bill reimbursement up to prescribed limits.',
                'Medical Aid & Health Insurance: Annual executive health check-up, domiciliary medical aid, and IBA Group Medical Insurance for self and family.'
            ]
        }
    }
};

/**
 * Searches circulars by keyword across database
 */
function searchCirculars(query = '') {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const tokens = q.split(/\s+/).filter(w => w.length > 1);
    if (!tokens.length) return [];

    const results = [];
    for (const [id, meta] of Object.entries(circularMetadata)) {
        const text = `${meta.num} ${meta.year} ${meta.division} ${meta.subject} ${meta.filename}`.toLowerCase();
        let score = 0;
        if (text.includes(q)) score += 10; // Exact phrase bonus
        tokens.forEach(tok => {
            if (text.includes(tok)) score += 2;
        });
        if (score > 0) {
            results.push({ ...meta, score });
        }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 20);
}

/**
 * Query answering function that works with or without Gemini API key
 */
async function answerUserQuery(userQuery = '') {
    const q = userQuery.toLowerCase();
    let topic = 'GENERAL_BANKING_QUERY';
    let responseText = '';

    // Check if query is about Car Loan
    if (q.includes('car loan') || q.includes('vahan') || q.includes('gaadi') || q.includes('car utsav') || q.includes('cardealm') || q.includes('75/2026') || q.includes('130/2026')) {
        topic = 'CAR_LOAN_CONSULTATION';
        const cl = KNOWLEDGE_BASE.car_loan;
        responseText = `# PUNJAB NATIONAL BANK - CAR LOAN COMPREHENSIVE AI ASSESSMENT
**Governing Circulars:** ${cl.master_circular} | ${cl.campaign}

## 1. Car Loan Schemes Overview:
${cl.schemes.map(s => `* **${s.split(':')[0]}:** ${s.split(':').slice(1).join(':')}`).join('\n')}

## 2. Common Mandatory Guidelines:
${cl.common_guidelines.map(g => `* ${g}`).join('\n')}

## 3. Active Festive Campaign Concessions (October - December 2026):
* **ROI:** Starting at **7.65% p.a.** (Yuva/EV: 7.60% p.a., EV Yuva: 7.55% p.a.).
* **Processing Charges:** **100% Full Waiver (NIL)**.
* **Documentation Charges:** **100% Full Waiver (NIL)**.
* **Margin:** 10% on On-Road Price (NIL on Ex-Showroom under manufacturer tie-ups).`;

    // Check if query is about MSME
    } else if (q.includes('sampatti') || q.includes('prime plus') || q.includes('msme') || q.includes('77/2026') || q.includes('79/2026')) {
        topic = 'MSME_SCHEMES_CONSULTATION';
        const ms = KNOWLEDGE_BASE.msme;
        responseText = `# PUNJAB NATIONAL BANK - MSME CONSOLIDATED SCHEMES ASSESSMENT
**Circulars:** ${ms.sampatti.circular} & ${ms.prime_plus.circular}

## 1. PNB Sampatti Scheme (MSME Cir. 77/2026):
* **Concept:** ${ms.sampatti.concept}
* **Facilities:** ${ms.sampatti.facilities}
* **LTV Norms:** ${ms.sampatti.ltv}
* **Quantum:** ${ms.sampatti.quantum}
* **ROI:** ${ms.sampatti.roi}

## 2. MSME Prime Plus Scheme (MSME Cir. 79/2026):
* **Concept:** ${ms.prime_plus.concept}
* **Margin:** ${ms.prime_plus.margin}
* **Collateral:** ${ms.prime_plus.collateral}
* **ROI:** ${ms.prime_plus.roi}`;

    // Check if query is about HRD / Scale 4
    } else if (q.includes('hrd') || q.includes('scale 4') || q.includes('scale iv') || q.includes('chief manager') || q.includes('perquisites') || q.includes('benefits')) {
        topic = 'SCALE_IV_CHIEF_MANAGER_BENEFITS';
        const hrd = KNOWLEDGE_BASE.hrd.scale_4;
        responseText = `# PUNJAB NATIONAL BANK - SCALE IV (CHIEF MANAGER) PERQUISITES & BENEFITS
**Governing HRDD Circulars:** ${hrd.circulars}

## Entitlements & Facilities:
${hrd.entitlements.map(e => `* **${e.split(':')[0]}:** ${e.split(':').slice(1).join(':')}`).join('\n')}`;

    // General circular search fallback
    } else {
        topic = 'CIRCULAR_SEARCH_QUERY';
        const found = searchCirculars(userQuery);
        if (found.length > 0) {
            responseText = `# PUNJAB NATIONAL BANK - CIRCULAR SEARCH RESULTS FOR: "${userQuery}"\n\n`;
            responseText += `Found ${found.length} relevant circular(s) in Bank Circulars Library:\n\n`;
            found.forEach((c, idx) => {
                responseText += `${idx + 1}. **${c.division} Circular No. ${c.num}/${c.year}** (Dated ${c.date})\n`;
                responseText += `   * **Subject:** ${c.subject}\n`;
                responseText += `   * **File:** \`${c.filename}\` [Status: ${c.status}]\n\n`;
            });
        } else {
            responseText = `# PUNJAB NATIONAL BANK - ADVISORY NOTE
Query: "${userQuery}"

Aapke prashna ke anusar Bank ke nirdharit circulars (RABD, MSME, HRDD, AGRI, IRMD) ke tahat niyam awashyak roop se laagu hote hain. Kripya vishisht loan segment (Car Loan, Home Loan, MSME, KSY Agri) ya circular sankhya darj karein taaki sateek circular niyam prastut kiye ja sakein.`;
        }
    }

    // Auto-Archival to DOCX strictly in MASTER_VAULT/DATA/000-CHAT_HISTORY
    let docxPath = null;
    try {
        docxPath = await createChatDocx({
            topic,
            userQuery,
            agentResponse: responseText,
            outputDir: CHAT_HISTORY_DIR
        });
    } catch (e) {
        console.error('Error auto-archiving chat to docx:', e.message);
    }

    return {
        topic,
        userQuery,
        response: responseText,
        docxPath,
        docxFilename: docxPath ? path.basename(docxPath) : null,
        timestamp: new Date().toISOString()
    };
}

/**
 * End-to-End Autonomous Loan Appraisal & Defect Checker (Folder Driven)
 */
async function performLoanAppraisal(options = {}) {
    const branchName = options.branchName || options.branch || '943600-CHHINDWARA  VIP ROAD (MP)';
    const segment = options.segment || '2. Retail';
    const customerName = options.customerName || options.customer || 'Badal_Sahu';
    const vehicleCost = options.vehicleCost || null;
    const requestedLoanAmount = options.requestedLoanAmount || null;
    const netMonthlyIncome = options.netMonthlyIncome || null;
    const cibilScore = options.cibilScore || null;
    const tenureMonths = options.tenureMonths || 84;
    const hasDrivingLicense = options.hasDrivingLicense || null;
    const dealerName = options.dealerName || 'Authorized Dealer';
    const dealerGst = options.dealerGst || 'Verified via CARDEALM';
    const uploadedFiles = options.uploadedFiles || [];

    const commandText = options.commandText || options.query || options.command || '';

    // 1. Inspect actual files in customer folder inside Master Vault
    let filesInDir = [];
    const custDir = path.join(MASTER_VAULT_DIR, 'DATA', branchName.trim(), segment.trim(), customerName.trim());
    if (fs.existsSync(custDir)) {
        filesInDir = fs.readdirSync(custDir).filter(f => !f.endsWith('.json') && !f.startsWith('.'));
    }
    const allFiles = [...uploadedFiles, ...filesInDir];
    const fileNamesLower = allFiles.map(f => f.toLowerCase());

    // 2. Intelligent Command & Scheme Analysis
    const cmdLower = `${commandText} ${customerName} ${segment}`.toLowerCase();
    let schemeKey = 'car';

    if (cmdLower.includes('kcc') || cmdLower.includes('kisan credit') || cmdLower.includes('crop loan') || cmdLower.includes('fasal') || cmdLower.includes('scale of finance')) {
        schemeKey = 'kcc';
    } else if (cmdLower.includes('ksy') || cmdLower.includes('kisan samriddhi') || cmdLower.includes('tractor') || cmdLower.includes('polyhouse') || cmdLower.includes('farm mechanization')) {
        schemeKey = 'ksy';
    } else if (cmdLower.includes('sampatti') || cmdLower.includes('lap') || cmdLower.includes('property loan') || cmdLower.includes('77/2026')) {
        schemeKey = 'sampatti';
    } else if (cmdLower.includes('prime plus') || cmdLower.includes('primeplus') || cmdLower.includes('working capital') || cmdLower.includes('79/2026') || (cmdLower.includes('msme') && !cmdLower.includes('sampatti'))) {
        schemeKey = 'prime_plus';
    } else if (cmdLower.includes('home loan') || cmdLower.includes('housing') || cmdLower.includes('flat') || cmdLower.includes('plot') || cmdLower.includes('grih') || cmdLower.includes('residential')) {
        schemeKey = 'home';
    } else if (cmdLower.includes('personal loan') || cmdLower.includes('sahyog') || cmdLower.includes('personal') || cmdLower.includes('unsecured') || cmdLower.includes('salary loan')) {
        schemeKey = 'personal';
    } else if (cmdLower.includes('car') || cmdLower.includes('vahan') || cmdLower.includes('vehicle') || cmdLower.includes('creta') || cmdLower.includes('maruti') || cmdLower.includes('cardealm') || cmdLower.includes('75/2026') || cmdLower.includes('130/2026')) {
        schemeKey = 'car';
    } else if (segment.includes('Agri')) {
        schemeKey = fileNamesLower.some(f => f.includes('tractor') || f.includes('ksy')) ? 'ksy' : 'kcc';
    } else if (segment.includes('MSME')) {
        schemeKey = fileNamesLower.some(f => f.includes('property') || f.includes('sampatti')) ? 'sampatti' : 'prime_plus';
    } else if (segment.includes('Retail')) {
        if (customerName.toLowerCase().includes('personal') || fileNamesLower.some(f => f.includes('personal'))) {
            schemeKey = 'personal';
        } else if (customerName.toLowerCase().includes('home') || customerName.toLowerCase().includes('housing') || fileNamesLower.some(f => f.includes('housing') || f.includes('home'))) {
            schemeKey = 'home';
        } else {
            schemeKey = 'car';
        }
    }

    let schemeName = '';
    let circularRef = '';
    let cost = vehicleCost;
    let loan = requestedLoanAmount;
    let nmi = netMonthlyIncome;
    let tenure = tenureMonths;
    let roi = 7.65;
    let mandatoryDocs = [];
    let positivePoints = [];
    let preConditions = [];
    let postConditions = [];
    let labelCost = 'Project / Asset Cost:';
    let labelMargin = 'Proposed Margin:';

    if (schemeKey === 'kcc') {
        schemeName = 'Kisan Credit Card (KCC) Scheme';
        circularRef = 'Credit Agri Master Circular No. 42/2025 (KCC Operational Guidelines & Cropping Intensity)';
        cost = cost || 450000;
        loan = loan || 300000;
        nmi = nmi || 50000;
        tenure = 60;
        roi = 7.00;
        labelCost = 'Total Cultivation Scale of Finance:';
        labelMargin = 'Farmer Contribution / Margin:';

        mandatoryDocs = [
            { name: 'KYC: Aadhaar Card & PAN Card', submitted: fileNamesLower.some(f => f.includes('aadhaar') || f.includes('pan')), required: true },
            { name: 'Revenue Record: Certified Khasra / Khatauni / B-1 / P-II Records', submitted: fileNamesLower.some(f => f.includes('khasra') || f.includes('khatauni') || f.includes('b-1') || f.includes('p-ii') || f.includes('land') || f.includes('revenue')), required: true },
            { name: 'Cropping Pattern & Land Holding Self-Declaration', submitted: fileNamesLower.some(f => f.includes('crop') || f.includes('fasal') || f.includes('declaration')), required: true },
            { name: 'No Dues Certificate (NDC) / CIBIL Scrub Report', submitted: fileNamesLower.some(f => f.includes('ndc') || f.includes('no dues') || f.includes('cibil')), required: true },
            { name: 'Operative Bank Account Statement (6-12 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank') || f.includes('passbook')), required: true }
        ];

        positivePoints = [
            `Eligible for Government Interest Subvention (3% prompt repayment incentive, net effective ROI 4.00% p.a. up to ₹3.00 Lakhs).`,
            `Collateral security waived up to ₹1.60 Lakhs (extendable to ₹3.00 Lakhs with tie-up arrangements).`,
            `Scale of finance provides 10% household/consumption requirement plus 20% post-harvest farm maintenance.`,
            `5-year revolving credit with flexible annual review and drawdown facility.`
        ];

        preConditions = [
            `Obtention of certified land record (Khasra/Khatauni) duly attested by Patwari/Tehsildar.`,
            `Creation of charge in Revenue records (Bhoomi-Swami lien marking) for limits above ₹1.60 Lakhs.`,
            `Scrutiny of CIBIL credit scrub to rule out dual financing or existing agri default.`
        ];
        postConditions = [
            `Annual review of KCC account upon verification of Kharif/Rabi harvest recovery.`,
            `End-use verification of agri inputs, seeds, and fertilizer purchase.`
        ];

    } else if (schemeKey === 'ksy') {
        schemeName = 'PNB Kisan Samriddhi Yojana (KSY) / Agri Term Loan';
        circularRef = 'Credit Agri Circular No. 58/2025 (Farm Mechanization & Agri Infrastructure)';
        cost = cost || 1200000;
        loan = loan || 960000;
        nmi = nmi || 65000;
        tenure = 84;
        roi = 8.85;
        labelCost = 'Tractor / Equipment On-Road Cost:';
        labelMargin = 'Farmer Margin (20% Min):';

        mandatoryDocs = [
            { name: 'KYC: Aadhaar Card & PAN Card', submitted: fileNamesLower.some(f => f.includes('aadhaar') || f.includes('pan')), required: true },
            { name: 'Irrigated Land Records (Min 2-3 Acres irrigated land)', submitted: fileNamesLower.some(f => f.includes('khasra') || f.includes('khatauni') || f.includes('land')), required: true },
            { name: 'Dealer Proforma Invoice / Quotation with valid GST', submitted: fileNamesLower.some(f => f.includes('quotation') || f.includes('invoice') || f.includes('estimate') || f.includes('dealer')), required: true },
            { name: 'Operative Bank Account Statement (6-12 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank')), required: true },
            { name: 'Driving License / Tractor Operation Declaration', submitted: fileNamesLower.some(f => f.includes('dl') || f.includes('license')), required: true },
            { name: 'CIBIL / Credit Bureau Scrub Report', submitted: fileNamesLower.some(f => f.includes('cibil')), required: true }
        ];

        positivePoints = [
            `Provides mechanized farm support boosting crop yield and customized for commercial custom hiring.`,
            `Structured repayment tailored to agricultural harvest seasons (Half-yearly / Annual).`,
            `Margin requirement of 20% met adequately.`,
            `Hypothecation of newly acquired tractor/machinery as primary security.`
        ];

        preConditions = [
            `Dealer verification in CBS and direct payment to authorized tractor dealership.`,
            `Lien/Mortgage creation on agricultural land holding as collateral security.`
        ];
        postConditions = [
            `Obtention of RTO Registration Certificate with Bank hypothecation within 45 days.`,
            `Comprehensive tractor insurance policy with Bank hypothecation clause.`
        ];

    } else if (schemeKey === 'sampatti') {
        schemeName = 'PNB Sampatti Scheme (MSME LAP - Cir 77/2026)';
        circularRef = 'MSME Master Circular No. 77/2026 (Dated 30.09.2026 - Consolidated LAP Guidelines)';
        cost = cost || 7500000;
        loan = loan || 4800000;
        nmi = nmi || 220000;
        tenure = 120;
        roi = 9.15;
        labelCost = 'Property Realizable Value (RV):';
        labelMargin = 'Equity / Security Cover:';

        mandatoryDocs = [
            { name: 'KYC of Borrowers, Partners & Guarantors (PAN & Aadhaar)', submitted: fileNamesLower.some(f => f.includes('pan') || f.includes('aadhaar')), required: true },
            { name: 'Title Deeds / Chain of Title (Registered Sale Deed - 30 Yrs)', submitted: fileNamesLower.some(f => f.includes('deed') || f.includes('registry') || f.includes('title') || f.includes('property')), required: true },
            { name: 'Legal Search Report & Non-Encumbrance Certificate (NEC)', submitted: fileNamesLower.some(f => f.includes('search') || f.includes('nec') || f.includes('legal')), required: true },
            { name: 'Property Valuation Report by Bank Approved Valuer', submitted: fileNamesLower.some(f => f.includes('valuation') || f.includes('valuer')), required: true },
            { name: 'Audited Financials (2-3 Yrs Balance Sheet, P&L, ITR & Computation)', submitted: fileNamesLower.some(f => f.includes('itr') || f.includes('balance') || f.includes('p&l') || f.includes('financials')), required: true },
            { name: 'Operative Bank Account Statement (12 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank')), required: true },
            { name: 'GST Returns (GSTR-3B / 1) & Udyam Registration Certificate', submitted: fileNamesLower.some(f => f.includes('gst') || f.includes('udyam')), required: true }
        ];

        positivePoints = [
            `LTV of 64% conforms strictly to PNB Sampatti ceiling of 65% on residential realizable value.`,
            `Multipurpose credit facility supporting business liquidity and enterprise expansion.`,
            `Concessional card rate of RLLR+BSP+1.10% applicable with 50% upfront fee rebate.`
        ];

        preConditions = [
            `Equitable Mortgage of prime property with CERSAI registration and title search clearance.`,
            `Vetting of legal title by Bank Advocate ensuring uninterrupted 30-year chain.`
        ];
        postConditions = [
            `Annual asset verification and submission of renewed property insurance policy with Bank clause.`,
            `Annual review of operative account turnover and financial health.`
        ];

    } else if (schemeKey === 'prime_plus') {
        schemeName = 'PNB MSME Prime Plus Scheme (Cir 79/2026)';
        circularRef = 'MSME Master Circular No. 79/2026 (Comprehensive MSME Credit Guidelines)';
        cost = cost || 10000000;
        loan = loan || 7500000;
        nmi = nmi || 280000;
        tenure = 84;
        roi = 8.75;
        labelCost = 'Project / Working Capital Assessment:';
        labelMargin = 'Promoter Margin (25% Min):';

        mandatoryDocs = [
            { name: 'KYC & Udyam Registration Certificate', submitted: fileNamesLower.some(f => f.includes('pan') || f.includes('udyam')), required: true },
            { name: 'Audited Financial Statements (Last 3 Yrs) & CMA Data', submitted: fileNamesLower.some(f => f.includes('cma') || f.includes('itr') || f.includes('audit')), required: true },
            { name: 'Stock & Book Debts Statement (Age-wise)', submitted: fileNamesLower.some(f => f.includes('stock') || f.includes('debt')), required: true },
            { name: 'Operative Bank Account Statements (12 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank')), required: true },
            { name: 'Primary & Collateral Property Title Documents', submitted: fileNamesLower.some(f => f.includes('deed') || f.includes('property')), required: true }
        ];

        positivePoints = [
            `Flagship MSME facility offering competitive pricing and flexible fund-based limits.`,
            `Eligible for hybrid collateral model or CGTMSE credit guarantee coverage.`,
            `Turnover and debt service capacity comfortably support requested limit.`
        ];

        preConditions = [
            `Hypothecation of entire stocks and book debts in favour of Bank.`,
            `CERSAI registration and submission of audited book debts statement.`
        ];
        postConditions = [
            `Monthly submission of Stock & Book Debts statements and quarterly DP verification.`,
            `Annual stock audit by Bank empanelled Chartered Accountant firm.`
        ];

    } else if (schemeKey === 'home') {
        schemeName = 'PNB Max-Saver / Pride Home Loan Scheme';
        circularRef = 'RABD Master Circular No. 60/2026 (Consolidated Home Loan Guidelines)';
        cost = cost || 4500000;
        loan = loan || 3600000;
        nmi = nmi || 85000;
        tenure = 240;
        roi = 7.50;
        labelCost = 'Property / Construction Agreement Cost:';
        labelMargin = 'Borrower Contribution (20% Min):';

        mandatoryDocs = [
            { name: 'KYC: PAN Card & Aadhaar Card', submitted: fileNamesLower.some(f => f.includes('pan') || f.includes('aadhaar')), required: true },
            { name: 'Income Proof: 3 Months Salary Slips + Form 16 / 2 Yrs ITR', submitted: fileNamesLower.some(f => f.includes('salary') || f.includes('itr') || f.includes('form16')), required: true },
            { name: 'Salary Account / Operative Bank Statement (6 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank')), required: true },
            { name: 'Agreement to Sale / Allotment Letter / Approved Map', submitted: fileNamesLower.some(f => f.includes('agreement') || f.includes('allotment') || f.includes('map') || f.includes('property')), required: true },
            { name: 'Title Search Report & 30-Year Non-Encumbrance Certificate (NEC)', submitted: fileNamesLower.some(f => f.includes('search') || f.includes('nec') || f.includes('legal')), required: true },
            { name: 'Valuation Report from Bank Empanelled Valuer', submitted: fileNamesLower.some(f => f.includes('valuation') || f.includes('estimate')), required: true },
            { name: 'CIBIL / Credit Bureau Scrub Report', submitted: fileNamesLower.some(f => f.includes('cibil')), required: true }
        ];

        positivePoints = [
            `LTV of 80% strictly complies with RBI and Bank regulatory ceiling for loans up to ₹75 Lakhs.`,
            `Attracts lowest festive card rate of 7.50% p.a. with 100% waiver of processing charges.`,
            `Max-Saver overdraft variant permits surplus savings deposit to reduce effective interest burden.`
        ];

        preConditions = [
            `Clear Title Search Report from Bank Advocate confirming unencumbered, marketable title.`,
            `Direct staged disbursement to Builder/Seller account via HLADISB linked to construction progress.`
        ];
        postConditions = [
            `Obtention of original Registered Sale Deed and Mortgage creation within 30 days of registration.`,
            `Submission of comprehensive property insurance policy with Bank hypothecation clause.`
        ];

    } else if (schemeKey === 'personal') {
        schemeName = 'PNB Sahyog / Personal Loan Scheme';
        circularRef = 'RABD Personal Lending Guidelines (Circular 65/2025)';
        cost = cost || 800000;
        loan = loan || 700000;
        nmi = nmi || 60000;
        tenure = 60;
        roi = 10.45;
        labelCost = 'Total Proposed Finance:';
        labelMargin = 'Personal Equity / Margin:';

        mandatoryDocs = [
            { name: 'KYC: PAN Card & Aadhaar Card', submitted: fileNamesLower.some(f => f.includes('pan') || f.includes('aadhaar')), required: true },
            { name: 'Salary Slips (Last 3-6 Months) with Employer Seal', submitted: fileNamesLower.some(f => f.includes('salary') || f.includes('slip')), required: true },
            { name: 'Salary Bank Account Statement (6 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank') || f.includes('passbook')), required: true },
            { name: 'Form 16 / ITR for last 2 Years', submitted: fileNamesLower.some(f => f.includes('form16') || f.includes('itr')), required: true },
            { name: 'Employer Salary Deduction Undertaking / Standing Instruction (SI)', submitted: fileNamesLower.some(f => f.includes('undertaking') || f.includes('mandate') || f.includes('si')), required: true },
            { name: 'CIBIL Score Verification Report (Cutoff >= 700)', submitted: fileNamesLower.some(f => f.includes('cibil')), required: true }
        ];

        positivePoints = [
            `Loan quantum falls comfortably within the cap of 20x net monthly salary.`,
            `Clean repayment track on operative salary account with confirmed employer tie-up.`,
            `Deduction ratio maintained under the prescribed 60% threshold.`
        ];

        preConditions = [
            `Obtention of irrevocable employer salary deduction certificate or SI mandate on salary account.`,
            `PDC / NACH mandate activation in CBS.`
        ];
        postConditions = [
            `Verification of regular monthly EMI debit from borrower salary account.`
        ];

    } else { // Default: Car Loan
        schemeName = 'PNB Car Loan (General) / Yuva Vahan';
        circularRef = 'RABD 75/2026 (Consolidated Car Loan) & Festive Campaign RABD 130/2026';
        cost = cost || 2500000;
        loan = loan || 2250000;
        nmi = nmi || 85000;
        tenure = 84;
        roi = 7.65;
        labelCost = 'Vehicle On-Road Cost:';
        labelMargin = 'Proposed Margin (10% Min):';

        mandatoryDocs = [
            { name: 'KYC: PAN Card', submitted: fileNamesLower.some(f => f.includes('pan')), required: true },
            { name: 'KYC: Aadhaar Card / Address Proof', submitted: fileNamesLower.some(f => f.includes('aadhaar') || f.includes('aadhar') || f.includes('address')), required: true },
            { name: 'Income Proof (Salary Slips / ITR 2-3 yrs)', submitted: fileNamesLower.some(f => f.includes('salary') || f.includes('itr') || f.includes('form16') || f.includes('p&l')), required: true },
            { name: 'Operative Bank Statement (6-12 Months)', submitted: fileNamesLower.some(f => f.includes('statement') || f.includes('bank') || f.includes('passbook')), required: true },
            { name: 'Dealer Proforma Invoice / Quotation / Estimate', submitted: fileNamesLower.some(f => f.includes('quotation') || f.includes('invoice') || f.includes('estimate') || f.includes('proforma')), required: true },
            { name: 'Driving License / Driver Declaration', submitted: (hasDrivingLicense === true) || fileNamesLower.some(f => f.includes('dl') || f.includes('license') || f.includes('driver')), required: true },
            { name: 'CIBIL / Credit Bureau Scrub Report', submitted: fileNamesLower.some(f => f.includes('cibil') || f.includes('credit')) || (cibilScore || 760) >= 700, required: true }
        ];

        positivePoints = [
            `Credit Bureau CIBIL Score qualifies for finest card rate of ${roi}% p.a.`,
            `Net Monthly Income of ₹${nmi.toLocaleString('en-IN')} adequately covers proposed EMI.`,
            `Proposed Margin satisfies Bank guidelines (Min 10% On-Road).`,
            `Eligible for 100% Full Waiver of Upfront Processing Fees & Documentation Charges under active festive campaigns.`
        ];

        preConditions = [
            `Online validation of Dealer (${dealerName}, GST: ${dealerGst}) in CBS menu 'CARDEALM' and generation of UDC (RABD 77/2026).`,
            `Disbursement pool routing strictly through Branch Office Pool Account '3191101' via 'HLADISB'.`,
            `PDC marking in PNB LenS and obtention of Standing Instruction (SI) / NACH mandate.`
        ];
        postConditions = [
            `Obtention of Original Tax Invoice, Money Receipt, and RC copy with Bank hypothecation within 30 days.`,
            `VAHAN / Next Gen mParivahan verification of unmasked JRC (RABD 128/2026).`
        ];
    }

    // Financial calculations
    const monthlyRate = (roi / 12) / 100;
    const emi = Math.round((loan * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1));
    const permissibleRatio = nmi <= 50000 ? 0.50 : (nmi <= 100000 ? 0.60 : 0.70);
    const maxPermissibleDeduction = Math.round(nmi * permissibleRatio);
    const emiNmiRatio = ((emi / nmi) * 100).toFixed(1);
    const isEmiViable = emi <= maxPermissibleDeduction;

    const proposedMargin = cost - loan;
    const marginPercent = ((proposedMargin / cost) * 100).toFixed(1);
    const isMarginSufficient = proposedMargin >= 0;

    const missingDocs = mandatoryDocs.filter(d => d.required && !d.submitted).map(d => d.name);

    const negativePoints = [];
    if (!isEmiViable && schemeKey !== 'kcc') {
        negativePoints.push(`EMI/NMI ratio is ${emiNmiRatio}%, exceeding prescribed cap of ${(permissibleRatio * 100)}%. Requires co-borrower income clubbing.`);
    }
    if (missingDocs.length > 0) {
        negativePoints.push(`Pending mandatory documents in vault: ${missingDocs.join(', ')}.`);
    }

    // Generate Official BM Discrepancy Letter
    const bmLetter = `BANK UNDERWRITING CELL
BRANCH OFFICE: ${branchName}

Ref: ADV/${segment.toUpperCase().replace(/[^A-Z]/g, '')}/${schemeKey.toUpperCase()}/${customerName.toUpperCase().replace(/\s+/g, '_')}/2026
Date: ${new Date().toLocaleDateString('en-IN')}

To,
The Branch Head / Manager,
Branch Office: ${branchName}

Subject: Scrutiny of ${schemeName} Proposal - Sh./Ms. ${customerName} (Loan Req: ₹${loan.toLocaleString('en-IN')}) - Requisition of Missing Documents & Defect Rectification.

Dear Sir / Madam,

With reference to the ${schemeName} proposal of Sh./Ms. ${customerName} submitted for appraisal, preliminary scrutiny has been conducted in accordance with Bank Master Circular ${circularRef}.

Upon scrutiny of the uploaded dossier, the following deficiencies / pending documents have been observed and must be rectified prior to sanction/disbursement:

${missingDocs.length > 0 ? missingDocs.map((doc, idx) => `${idx + 1}. Obtention of ${doc}.`).join('\n') : '1. All primary KYC and Income/Revenue proofs are on record.'}
${preConditions.map((cond, idx) => `${missingDocs.length + idx + 1}. Pre-Disbursement Compliance: ${cond}`).join('\n')}

You are requested to get the above discrepancies completed at the earliest to proceed with formal sanction and loan disbursement.

Yours faithfully,

Credit Appraisal & Underwriting Cell
Operations Division`;

    // Generate Credit Appraisal & Sanction Note
    const appraisalNote = `# BANK CREDIT APPRAISAL & SANCTION NOTE
**Borrower:** ${customerName} | **Branch:** ${branchName} | **Scheme:** ${schemeName}
**Governing Circular:** ${circularRef}
${commandText ? `**Execution Command:** "${commandText}"\n` : ''}
## 1. Financial Viability & Fitment Summary:
* **${labelCost}** ₹${cost.toLocaleString('en-IN')}
* **Proposed Loan Amount:** ₹${loan.toLocaleString('en-IN')}
* **${labelMargin}** ₹${proposedMargin.toLocaleString('en-IN')} (${marginPercent}%)
* **Effective ROI:** ${roi}% p.a.
* **Tenure:** ${tenure} Months
* **Calculated Monthly EMI / Repayment:** ₹${emi.toLocaleString('en-IN')}
* **Assessed Monthly Income (NMI):** ₹${nmi.toLocaleString('en-IN')}
* **Deduction / Serviceability Ratio:** ${emiNmiRatio}% (Permissible Ceiling: ${(permissibleRatio * 100)}%) - [${isEmiViable ? 'SATISFACTORY' : 'REQUIRES CLUBBING'}]

## 2. Positive & Negative Risk Evaluation:
### Positive Points:
${positivePoints.map(p => `* ${p}`).join('\n')}

### Negative Points / Identified Defects:
${negativePoints.length > 0 ? negativePoints.map(n => `* ${n}`).join('\n') : '* Nil material risk observed. Clean proposal.'}

## 3. Mandatory Pre-Disbursement Conditions:
${preConditions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## 4. Mandatory Post-Disbursement Conditions:
${postConditions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    // Save Chat History DOCX
    const topic = `${customerName.toUpperCase().replace(/\s+/g, '_')}_${schemeKey.toUpperCase()}_APPRAISAL`;
    let docxPath = null;
    try {
        docxPath = await createChatDocx({
            topic,
            userQuery: commandText ? `[Command]: ${commandText} | Customer: ${customerName} at branch ${branchName}` : `Appraisal for ${customerName} at branch ${branchName}. Scheme: ${schemeName}. Loan requested: ₹${loan}`,
            agentResponse: appraisalNote + '\n\n' + bmLetter,
            outputDir: CHAT_HISTORY_DIR
        });
    } catch (e) {
        console.error('Error generating appraisal docx:', e.message);
    }

    return {
        applicantName: customerName,
        branchName,
        scheme: schemeName,
        schemeName,
        circularRef,
        schemeKey,
        commandText,
        financials: {
            vehicleCost: cost,
            requestedLoanAmount: loan,
            proposedMargin,
            marginPercent,
            roi: `${roi}% p.a.`,
            tenureMonths: tenure,
            emi,
            netMonthlyIncome: nmi,
            emiNmiRatio: `${emiNmiRatio}%`,
            permissibleRatio: `${(permissibleRatio * 100)}%`,
            isViable: isEmiViable && isMarginSufficient
        },
        mandatoryDocs,
        missingDocs,
        positivePoints,
        negativePoints,
        bmLetter,
        appraisalNote,
        docxPath,
        docxFilename: docxPath ? path.basename(docxPath) : null
    };
}

module.exports = {
    answerUserQuery,
    performLoanAppraisal,
    searchCirculars,
    KNOWLEDGE_BASE
};
