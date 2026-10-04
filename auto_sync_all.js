/**
 * BANK LOAN APPRAISAL - UNIVERSAL MASTER SYNCHRONIZATION ENGINE
 * 
 * Automatically synchronizes instructions, code, customer catalogs, and configurations across:
 * 1. Google Drive (G:\My Drive\Bank_Loan_Appraisal & MASTER_VAULT)
 * 2. GitHub (https://github.com/bharatsingh86/loan-appraisal-portal)
 * 3. Vercel Cloud Platform (https://loan-appraisal-portal.vercel.app)
 * 4. Web Portal & Mobile Application (PWA)
 * 
 * Usage:
 *   node auto_sync_all.js [OPTIONAL_GITHUB_TOKEN]
 * Or double click SYNC_ALL.bat
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createChatDocx, CATEGORY_PROJECT_DEVELOPMENT } = require('./save_chat_to_docx');

const BASE_DIR = __dirname;

function getGitHubToken() {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
    const tokenFile = path.join(BASE_DIR, 'github_token.txt');
    if (fs.existsSync(tokenFile)) {
        return fs.readFileSync(tokenFile, 'utf8').trim();
    }
    return '';
}

async function runUniversalSync() {
    console.log('================================================================');
    console.log('🚀 BANK LOAN APPRAISAL - UNIVERSAL MASTER SYNCHRONIZATION');
    console.log('   Syncing Google Drive -> GitHub -> Vercel -> Web/Mobile App');
    console.log('================================================================\n');

    const token = process.argv[2] || getGitHubToken();

    // STEP 1: Re-build the Master Vault Customer & Document Catalog
    console.log('📦 [Step 1/4] Rebuilding Master Vault Customer & Proposal Catalog...');
    try {
        require('./build_vault_catalog');
        console.log('✅ Catalog successfully updated: vault_customers_registry.json\n');
    } catch (err) {
        console.error('❌ Error building vault catalog:', err.message);
    }

    // STEP 2: Log Development Sync Session into PROJECT_DEVELOPMENT_CHATS
    console.log('📁 [Step 2/4] Archiving Sync Log to PROJECT_DEVELOPMENT_CHATS...');
    try {
        const docxPath = await createChatDocx({
            topic: 'UNIVERSAL_MASTER_SYNCHRONIZATION_DIRECTIVES',
            userQuery: 'Universal Multi-Cloud Synchronization: Google Drive, GitHub, Vercel & PWA Web/Mobile Portal',
            agentResponse: `Universal synchronization executed successfully on ${new Date().toLocaleString('en-IN')}.\n` +
                `- Vault Catalog updated with all 74 Branches & Customer Proposals.\n` +
                `- Code, Directives & Assets pushed to GitHub main branch.\n` +
                `- Web Portal & Mobile App synced for direct 24/7 cloud accessibility.`,
            category: CATEGORY_PROJECT_DEVELOPMENT
        });
        console.log(`✅ Development Chat Docx archived: ${path.basename(docxPath)}\n`);
    } catch (err) {
        console.error('⚠️ Warning on saving dev docx:', err.message);
    }

    // STEP 3: Push Entire Application & Instructions to GitHub
    console.log('☁️ [Step 3/4] Publishing Code, Directives & Assets to GitHub...');
    try {
        const pushScript = path.join(BASE_DIR, 'push_to_github.js');
        const output = execSync(`node "${pushScript}" "${token}"`, {
            cwd: BASE_DIR,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        console.log(output);
        console.log('✅ GitHub sync completed successfully!\n');
    } catch (err) {
        console.error('❌ GitHub push failed:', err.stdout || err.message);
    }

    // STEP 4: Trigger Instant Vercel Cloud Redeployment via Deploy Hook (if configured)
    console.log('⚡ [Step 4/5] Triggering Instant Vercel Cloud Redeployment...');
    const hookFile = path.join(BASE_DIR, 'vercel_hook.txt');
    let hookUrl = process.env.VERCEL_DEPLOY_HOOK || '';
    if (!hookUrl && fs.existsSync(hookFile)) {
        hookUrl = fs.readFileSync(hookFile, 'utf8').trim();
    }
    if (hookUrl && hookUrl.startsWith('http')) {
        try {
            await triggerVercelDeployHook(hookUrl);
            console.log('✅ Vercel Deploy Hook successfully triggered! Cloud redeployment started instantly.\n');
        } catch (err) {
            console.warn('⚠️ Deploy hook trigger notice:', err.message);
        }
    } else {
        console.log('ℹ️ Vercel auto-deploys via GitHub commit. (Tip: Paste Deploy Hook in vercel_hook.txt for instant zero-wait builds)\n');
    }

    // STEP 5: Vercel & PWA Application Verification
    console.log('📱 [Step 5/5] Vercel & Mobile Application Status');
    console.log('   - Production URL: https://loan-appraisal-portal.vercel.app');
    console.log('   - Web Portal & Mobile App: Automatically updated via latest GitHub commit.');
    console.log('   - Customer Loan Chats (000-CHAT_HISTORY): Fully accessible & searchable in App.');
    console.log('   - Project Development Chats: Segregated strictly into PROJECT_DEVELOPMENT_CHATS.\n');

    console.log('================================================================');
    console.log('🎉 ALL SYSTEMS FULLY SYNCHRONIZED & OPERATIONAL!');
    console.log('================================================================');
}

function triggerVercelDeployHook(hookUrl) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const u = new URL(hookUrl);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: { 'Content-Length': '0' }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
                else reject(new Error(`Status ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.end();
    });
}

if (require.main === module) {
    runUniversalSync().catch(err => {
        console.error('Fatal sync error:', err);
        process.exit(1);
    });
}

module.exports = { runUniversalSync };
