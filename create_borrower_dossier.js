/**
 * BANK LOAN APPRAISAL - BORROWER DOSSIER CREATION UTILITY
 * 
 * Creates standardized customer folders under:
 * MASTER_VAULT/DATA/<BRANCH>/<1. Agri | 2. Retail | 3. MSME>/<CUSTOMER_NAME>_<SCHEME>/
 * 
 * Structure:
 * ├── 1_Documents/    -> KYC, Income Proofs, Vehicle Quotation, Bank Statements, CIBIL
 * ├── 2_Assessment/   -> Eligibility sheets, EMI/NMI calculations, Defect Scrutiny
 * ├── 3_Appraisal/    -> Credit Appraisal Note, Underwriter memos
 * ├── 4_Sanction/     -> Sanction Letter, Pre/Post Disbursement Conditions
 * └── DOSSIER_INFO.json
 */

const fs = require('fs');
const path = require('path');

const VAULT_DATA_DIR = path.join(__dirname, 'MASTER_VAULT', 'DATA');

const CATEGORY_MAP = {
    'agri': '1. Agri',
    '1': '1. Agri',
    '1. agri': '1. Agri',
    'agriculture': '1. Agri',
    
    'retail': '2. Retail',
    '2': '2. Retail',
    '2. retail': '2. Retail',
    
    'msme': '3. MSME',
    '3': '3. MSME',
    '3. msme': '3. MSME'
};

function normalizeCategory(cat) {
    if (!cat) return '2. Retail';
    const lower = cat.toLowerCase().trim();
    return CATEGORY_MAP[lower] || '2. Retail';
}

function sanitizeDirName(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
}

/**
 * Creates a borrower dossier folder structure
 */
function createBorrowerDossier({ branchName, category, customerName, scheme = 'Car_Loan', applicantDetails = {} }) {
    if (!branchName || !customerName) {
        throw new Error('Both branchName and customerName are required.');
    }

    const normCategory = normalizeCategory(category);
    
    // Locate branch folder
    let resolvedBranchDir = null;
    const branches = fs.readdirSync(VAULT_DATA_DIR);
    
    // Exact or prefix or case-insensitive match
    const cleanSearch = branchName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const b of branches) {
        const cleanB = b.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanB.includes(cleanSearch) || cleanSearch.includes(cleanB)) {
            resolvedBranchDir = b;
            break;
        }
    }

    if (!resolvedBranchDir) {
        resolvedBranchDir = sanitizeDirName(branchName);
        fs.mkdirSync(path.join(VAULT_DATA_DIR, resolvedBranchDir), { recursive: true });
    }

    const targetBranchPath = path.join(VAULT_DATA_DIR, resolvedBranchDir);
    const targetCategoryPath = path.join(targetBranchPath, normCategory);
    
    if (!fs.existsSync(targetCategoryPath)) {
        fs.mkdirSync(targetCategoryPath, { recursive: true });
    }

    // Format dossier folder: e.g. Badal_Sahu_Car_Loan
    const safeCustomer = sanitizeDirName(customerName);
    const safeScheme = sanitizeDirName(scheme);
    const dossierFolderName = `${safeCustomer}_${safeScheme}`;
    const dossierFullPath = path.join(targetCategoryPath, dossierFolderName);

    // Subfolders
    const subfolders = ['1_Documents', '2_Assessment', '3_Appraisal', '4_Sanction'];
    subfolders.forEach(sub => {
        fs.mkdirSync(path.join(dossierFullPath, sub), { recursive: true });
    });

    // Write Dossier Info JSON
    const dossierInfo = {
        dossierId: 'DOS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        createdAt: new Date().toISOString(),
        branch: resolvedBranchDir,
        category: normCategory,
        scheme: scheme,
        customerName: customerName,
        dossierPath: dossierFullPath,
        subfolders: {
            documents: path.join(dossierFullPath, '1_Documents'),
            assessment: path.join(dossierFullPath, '2_Assessment'),
            appraisal: path.join(dossierFullPath, '3_Appraisal'),
            sanction: path.join(dossierFullPath, '4_Sanction')
        },
        applicantDetails: applicantDetails
    };

    fs.writeFileSync(
        path.join(dossierFullPath, 'DOSSIER_INFO.json'),
        JSON.stringify(dossierInfo, null, 2),
        'utf8'
    );

    return dossierInfo;
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node create_borrower_dossier.js <BranchNameOrCode> <CustomerName> [Category (Agri|Retail|MSME)] [Scheme]');
        console.log('Example: node create_borrower_dossier.js "019710-JABALPUR" "Badal Sahu" "Retail" "Car_Loan"');
        process.exit(0);
    }

    const branch = args[0];
    const customer = args[1];
    const category = args[2] || 'Retail';
    const scheme = args[3] || 'Car_Loan';

    try {
        const result = createBorrowerDossier({
            branchName: branch,
            category: category,
            customerName: customer,
            scheme: scheme
        });
        console.log('Borrower Dossier successfully created!');
        console.log('Folder Path:', result.dossierPath);
        console.log('Subfolders ready for Documents, Assessment, Appraisal & Sanction.');
    } catch (e) {
        console.error('Error creating dossier:', e.message);
    }
}

module.exports = {
    createBorrowerDossier,
    normalizeCategory,
    CATEGORY_MAP
};
