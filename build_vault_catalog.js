/**
 * Comprehensive Master Vault Customer, Proposal & Document Catalog Builder
 * Indexes all branches, segments, customers, documents, proposals and DOCX chat history
 * across G:\My Drive\Bank_Loan_Appraisal\MASTER_VAULT\DATA
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'MASTER_VAULT', 'DATA');
const CHAT_HISTORY_DIR = path.join(DATA_DIR, '000-CHAT_HISTORY');
const OUTPUT_FILE = path.join(__dirname, 'vault_customers_registry.json');
const BRANCHES_FILE = path.join(__dirname, 'branches.json');

function buildCatalog() {
    console.log('[*] Building comprehensive Master Vault catalog...');
    const catalog = {
        generatedAt: new Date().toISOString(),
        branches: {},
        proposals: [],
        chatHistoryDocx: [],
        totalCustomers: 0,
        totalFiles: 0
    };

    if (!fs.existsSync(DATA_DIR)) {
        console.error('[-] DATA_DIR not found:', DATA_DIR);
        return;
    }

    const NON_BRANCH_DIRS = [
        '000-CHAT_HISTORY',
        'PROJECT_DEVELOPMENT_CHATS',
        'STAGING_QUEUE',
        'AUDIT_LOGS',
        'FEEDBACK_AND_ISSUES'
    ];

    const branchDirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && !NON_BRANCH_DIRS.includes(d.name) && !d.name.startsWith('.'));

    for (const b of branchDirs) {
        const branchName = b.name;
        catalog.branches[branchName] = {
            '1. Agri': {},
            '2. MSME': {},
            '3. Retail': {}
        };

        const branchPath = path.join(DATA_DIR, branchName);
        const segDirs = fs.readdirSync(branchPath, { withFileTypes: true }).filter(d => d.isDirectory());

        for (const s of segDirs) {
            let targetSeg = '3. Retail';
            if (s.name.includes('Agri')) targetSeg = '1. Agri';
            else if (s.name.includes('MSME')) targetSeg = '2. MSME';
            else if (s.name.includes('Retail')) targetSeg = '3. Retail';

            const segPath = path.join(branchPath, s.name);
            scanSegmentForCustomers(segPath, catalog.branches[branchName][targetSeg]);
        }
    }

    // Build proposals list & calculate totals
    let totalCust = 0;
    let totalF = 0;
    for (const [bName, segs] of Object.entries(catalog.branches)) {
        for (const [sName, custs] of Object.entries(segs)) {
            for (const [cKey, cData] of Object.entries(custs)) {
                totalCust++;
                const count = (cData.files || []).length;
                totalF += count;

                catalog.proposals.push({
                    branch: bName,
                    segment: sName,
                    customerName: cKey,
                    displayName: cData.displayName || cKey,
                    filesCount: count,
                    files: cData.files || []
                });
            }
        }
    }

    // Index DOCX Chat History files
    if (fs.existsSync(CHAT_HISTORY_DIR)) {
        try {
            const docxEntries = fs.readdirSync(CHAT_HISTORY_DIR, { withFileTypes: true });
            for (const ent of docxEntries) {
                if (!ent.isDirectory() && ent.name.toLowerCase().endsWith('.docx') && !ent.name.startsWith('~')) {
                    const full = path.join(CHAT_HISTORY_DIR, ent.name);
                    const st = fs.statSync(full);
                    catalog.chatHistoryDocx.push({
                        name: ent.name,
                        sizeBytes: st.size,
                        modifiedAt: st.mtime,
                        displayTime: new Date(st.mtime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    });
                }
            }
            catalog.chatHistoryDocx.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
        } catch (e) {}
    }

    catalog.totalCustomers = totalCust;
    catalog.totalFiles = totalF;

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2), 'utf8');
    console.log(`[+] Catalog build complete!`);
    console.log(`    Branches: ${Object.keys(catalog.branches).length}`);
    console.log(`    Customers/Proposals: ${totalCust}`);
    console.log(`    Vault Documents: ${totalF}`);
    console.log(`    DOCX Chat History Files: ${catalog.chatHistoryDocx.length}`);
}

function scanSegmentForCustomers(segDir, targetMap) {
    if (!fs.existsSync(segDir)) return;

    function walk(currentDir) {
        let entries = [];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (e) {
            return;
        }

        const files = entries.filter(e => !e.isDirectory() && !e.name.startsWith('.') && !e.name.endsWith('.json') && !e.name.endsWith('.gitkeep'));
        const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
        const folderName = path.basename(currentDir);

        const isIntermediate = /^(Car_Loan|Retail_Lending|1\. Agri|2\. MSME|3\. Retail)$/i.test(folderName);
        const isCustomerFolder = !isIntermediate && (folderName.includes('_DOCUMENTS') || folderName.includes(' - ') || folderName.includes('_Loan') || files.length > 0);

        if (isCustomerFolder) {
            const cleanCustName = folderName.replace(/_DOCUMENTS$/i, '').replace(/_/g, ' ');
            const allFiles = [];

            function collectFiles(d, subPrefix) {
                try {
                    const subEntries = fs.readdirSync(d, { withFileTypes: true });
                    for (const sub of subEntries) {
                        const full = path.join(d, sub.name);
                        if (sub.isDirectory()) {
                            collectFiles(full, subPrefix + sub.name + '/');
                        } else if (!sub.name.startsWith('.') && !sub.name.endsWith('.json') && !sub.name.endsWith('.gitkeep')) {
                            const st = fs.statSync(full);
                            allFiles.push({
                                name: subPrefix + sub.name,
                                sizeBytes: st.size,
                                modifiedAt: st.mtime
                            });
                        }
                    }
                } catch (e) {}
            }

            collectFiles(currentDir, '');

            targetMap[folderName] = {
                displayName: cleanCustName,
                folderName: folderName,
                filesCount: allFiles.length,
                files: allFiles
            };
            return;
        }

        for (const d of dirs) {
            walk(path.join(currentDir, d.name));
        }
    }

    walk(segDir);
}

buildCatalog();
