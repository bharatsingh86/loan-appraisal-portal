/**
 * BANK LOAN APPRAISAL - CHAT CLASSIFIER & SEGREGATION ENGINE
 * 
 * Automatically classifies every conversation / interaction into:
 * 1. CATEGORY_LOAN_ASSESSMENT:
 *    - Loan Appraisals, Customer Document Scrutiny, Scheme Eligibility,
 *      Circular Inquiries (RABD, MSME, AGRI, IRMD), BM Letters, Sanction Notes.
 *    - Stored strictly in: MASTER_VAULT/DATA/000-CHAT_HISTORY/
 *    - Visibility: Visible, searchable, and downloadable in Web Portal & Mobile App UI.
 * 
 * 2. CATEGORY_PROJECT_DEVELOPMENT:
 *    - Application Code Updates, GitHub sync, Vercel deployments, Bug fixes,
 *      PWA enhancements, Server & API configurations, Architecture directives.
 *    - Stored strictly in: MASTER_VAULT/DATA/PROJECT_DEVELOPMENT_CHATS/
 *    - Visibility: Excluded from Web Portal UI (Kept for manual audit & AI instructions).
 */

const fs = require('fs');
const path = require('path');

const CATEGORY_LOAN_ASSESSMENT = 'LOAN_ASSESSMENT';
const CATEGORY_PROJECT_DEVELOPMENT = 'PROJECT_DEVELOPMENT';

const BASE_DIR = __dirname;
const VAULT_DATA_DIR = path.join(BASE_DIR, 'MASTER_VAULT', 'DATA');
const LOAN_CHAT_DIR = path.join(VAULT_DATA_DIR, '000-CHAT_HISTORY');
const DEV_CHAT_DIR = path.join(VAULT_DATA_DIR, 'PROJECT_DEVELOPMENT_CHATS');

// Ensure both vault target directories exist
[LOAN_CHAT_DIR, DEV_CHAT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Keywords strongly indicating Application / Project Development
const DEV_KEYWORDS = [
    'github', 'vercel', 'render', 'deploy', 'deployment', 'push', 'commit',
    'repository', 'repo', 'pwa', 'manifest', 'sw.js', 'service worker',
    'server.js', 'server', 'port', 'localhost', 'tunnel', 'ngrok', 'localtunnel',
    'html', 'css', 'javascript', 'node', 'npm', 'package.json', 'api',
    'bug', 'fix', 'debug', 'install app', 'add to home screen', 'icon-192',
    'icon-512', 'endpoint', 'frontend', 'backend', 'code', 'coding',
    'instruction', 'instructions', 'segregate', 'classifier', 'identification',
    'auto_sync', 'sync', 'dockerfile', 'webhook', 'token', 'audit_receipt',
    'script', 'powershell', 'cmd', 'batch', 'redeploy', 'domain'
];

// Keywords strongly indicating Loan Appraisal / Banking / Circular Query
const LOAN_KEYWORDS = [
    'loan', 'car loan', 'vahan', 'kcc', 'ksy', 'tractor', 'msme', 'sampatti',
    'prime plus', 'cibil', 'score', 'dpd', 'cutoff', 'margin', 'down payment',
    'roi', 'byaj', 'byaaj', 'interest', 'permissible deduction', 'nmi',
    'take home', 'cardealm', 'udc', 'dealer', 'jrc', 'joint registration',
    'pdc', 'lens', 'pool account', '3191101', 'hladisb', 'driving license',
    'dl', 'salary', 'itr', 'form 16', 'quotation', 'proforma', 'invoice',
    'sanction', 'appraisal', 'assessment', 'discrepancy', 'patrata', 'eligibility',
    'branch manager', 'chcac', 'circle head', 'circular', 'rabd', 'irmd',
    'badal', 'sahu', 'nishant', 'dubey', 'shaligram', 'afsari', 'begam',
    'vikrant', 'choudhary', 'sunil', 'patel', 'gautam', 'khetan', 'imrat'
];

/**
 * Classifies an incoming chat or command
 * @param {Object} params
 * @param {string} params.userQuery
 * @param {string} params.topic
 * @param {string} params.agentResponse
 * @param {string} [params.explicitCategory]
 * @returns {Object} classification result
 */
function classifyChat({ userQuery = '', topic = '', agentResponse = '', explicitCategory = null }) {
    if (explicitCategory === CATEGORY_LOAN_ASSESSMENT || explicitCategory === CATEGORY_PROJECT_DEVELOPMENT) {
        return buildResult(explicitCategory, 'Explicitly declared by caller');
    }

    const text = `${userQuery} ${topic}`.toLowerCase();

    // Check for explicit dev tags in topic
    const topicUpper = (topic || '').toUpperCase();
    if (topicUpper.startsWith('DEV_') || topicUpper.startsWith('PROJECT_') || topicUpper.startsWith('SYSTEM_') || topicUpper.startsWith('DEPLOY_') || topicUpper.startsWith('GITHUB_') || topicUpper.startsWith('FIX_')) {
        return buildResult(CATEGORY_PROJECT_DEVELOPMENT, `Topic prefix matches development: ${topicUpper}`);
    }

    // Check for explicit loan appraisal tags in topic
    if (topicUpper.startsWith('CAR_') || topicUpper.startsWith('LOAN_') || topicUpper.startsWith('KCC_') || topicUpper.startsWith('KSY_') || topicUpper.startsWith('MSME_') || topicUpper.startsWith('APPRAISAL_') || topicUpper.startsWith('CIBIL_') || topicUpper.startsWith('MARGIN_') || topicUpper.startsWith('ROI_') || topicUpper.startsWith('CUSTOMER_') || topicUpper.startsWith('BORROWER_')) {
        return buildResult(CATEGORY_LOAN_ASSESSMENT, `Topic prefix matches loan appraisal: ${topicUpper}`);
    }

    // Calculate match scores
    let devScore = 0;
    let loanScore = 0;

    DEV_KEYWORDS.forEach(kw => {
        if (text.includes(kw)) devScore += 2;
    });

    LOAN_KEYWORDS.forEach(kw => {
        if (text.includes(kw)) loanScore += 2;
    });

    // Specific contextual weighting:
    // If user query mentions "instructions update", "github", "vercel", "pwa", "segregate"
    if (text.includes('instruction') || text.includes('github') || text.includes('vercel') || text.includes('segregate') || text.includes('install')) {
        devScore += 5;
    }

    // If user query mentions a known customer or borrower name, boost loan score
    if (text.includes('badal') || text.includes('nishant') || text.includes('afsari') || text.includes('shaligram') || text.includes('vikrant')) {
        loanScore += 6;
    }

    // Default to LOAN_ASSESSMENT if loan keywords exceed dev keywords
    if (loanScore > devScore) {
        return buildResult(CATEGORY_LOAN_ASSESSMENT, `Loan keywords dominant (Loan: ${loanScore}, Dev: ${devScore})`);
    } else if (devScore > loanScore) {
        return buildResult(CATEGORY_PROJECT_DEVELOPMENT, `Dev keywords dominant (Dev: ${devScore}, Loan: ${loanScore})`);
    } else {
        // Tie breaker: Check response text or default to LOAN_ASSESSMENT for safety
        const respLower = (agentResponse || '').toLowerCase();
        if (respLower.includes('circular') || respLower.includes('sanction') || respLower.includes('cibil')) {
            return buildResult(CATEGORY_LOAN_ASSESSMENT, 'Fallback: Response contains banking terms');
        }
        return buildResult(CATEGORY_LOAN_ASSESSMENT, 'Default fallback: Standard banking appraisal session');
    }
}

function buildResult(category, reason) {
    const isLoan = category === CATEGORY_LOAN_ASSESSMENT;
    return {
        category,
        isLoanAssessment: isLoan,
        isProjectDevelopment: !isLoan,
        folderName: isLoan ? '000-CHAT_HISTORY' : 'PROJECT_DEVELOPMENT_CHATS',
        targetDir: isLoan ? LOAN_CHAT_DIR : DEV_CHAT_DIR,
        fileSuffix: isLoan ? '_CHAT.docx' : '_DEV_CHAT.docx',
        showInWebPortal: isLoan, // Strictly false for Project Development!
        reason
    };
}

module.exports = {
    CATEGORY_LOAN_ASSESSMENT,
    CATEGORY_PROJECT_DEVELOPMENT,
    classifyChat,
    LOAN_CHAT_DIR,
    DEV_CHAT_DIR
};

// CLI testing mode
if (require.main === module) {
    const query = process.argv.slice(2).join(' ') || 'Badal Sahu ka assessment karo';
    const res = classifyChat({ userQuery: query, topic: 'CLI_TEST' });
    console.log('[*] Testing Query:', query);
    console.log('[*] Classification Result:', JSON.stringify(res, null, 2));
}
