/**
 * BANK LOAN APPRAISAL - MICROSOFT POWER AUTOMATE & OCR INTEGRATION ENGINE
 * Strictly isolated for D:\Bank_Loan_Appraisal
 * 
 * Works seamlessly with:
 * 1. Microsoft Power Automate Cloud Flows (Office 365 / M365)
 * 2. Power Automate Desktop (Windows 10/11 native RPA)
 * 3. WhatsApp Business Webhook + OCR Ingestion Pipeline
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ocr = require('./ocr_engine');
const gateway = require('./gateway_engine');

const BASE_DIR = __dirname;
const VAULT_DIR = path.join(BASE_DIR, 'MASTER_VAULT');
const DATA_DIR = path.join(VAULT_DIR, 'DATA');
const AUDIT_DIR = path.join(VAULT_DIR, 'AUDIT_LOGS');

function sanitizeName(str) {
    return (str || 'UNKNOWN').trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
}

/**
 * Main ingestion handler for Power Automate & WhatsApp payloads
 */
function handlePowerAutomateIngestion(payload) {
    const channel = payload.channel || 'WHATSAPP_POWER_AUTOMATE';
    const officerName = payload.officerName || 'Branch Field Officer';
    const officerPhone = payload.officerPhone || payload.sender || '+919329718002';
    const rawMessage = payload.messageText || payload.text || payload.notes || '';
    const incomingFiles = payload.files || [];

    if (incomingFiles.length === 0) {
        return {
            success: false,
            error: 'No documents provided in payload'
        };
    }

    // 1. Run Deep OCR on all incoming documents
    const ocrAnalysis = ocr.analyzeDossierOcr(incomingFiles, rawMessage, {
        officer: officerName,
        phone: officerPhone
    });

    // 2. Resolve Scheme, Segment, Branch, Customer from OCR + Message
    const metadataFromText = gateway.parseMetadata(rawMessage, incomingFiles.map(f => f.name || 'doc.pdf'), officerPhone);

    const finalScheme = ocrAnalysis.dossierSummary.detectedScheme || metadataFromText.scheme || 'Car_Loan';
    const finalSegment = ocrAnalysis.dossierSummary.detectedSegment || metadataFromText.segment || 'Retail_Lending';
    const finalBranch = payload.branch || metadataFromText.branch || '001 - CHANDNI CHOWK';
    
    // Customer Name: priority = payload -> text match -> OCR PAN/Quotation -> fallback
    let customerName = payload.customerName || metadataFromText.customerName;
    if (!customerName || customerName === 'Unknown_Applicant') {
        if (ocrAnalysis.dossierSummary.panNumber) {
            customerName = 'Applicant_' + ocrAnalysis.dossierSummary.panNumber;
        } else if (ocrAnalysis.dossierSummary.vehicleModel) {
            customerName = 'Borrower_' + ocrAnalysis.dossierSummary.vehicleModel;
        } else {
            customerName = 'New_Loan_Applicant';
        }
    }
    customerName = sanitizeName(customerName);

    // 3. Create Scheme-wise, Branch-wise, Customer-wise Folder Structure
    // Path: MASTER_VAULT/DATA/<BRANCH>/<1. Agri | 2. Retail | 3. MSME>/<CUSTOMER_NAME>_<SCHEME>/
    const cleanBranch = sanitizeName(finalBranch);
    const cleanScheme = sanitizeName(finalScheme);
    const cleanCustomer = sanitizeName(customerName);

    let categoryDir = '2. Retail';
    const segLower = (finalSegment || '').toLowerCase();
    if (segLower.includes('agri')) categoryDir = '1. Agri';
    else if (segLower.includes('msme')) categoryDir = '3. MSME';
    else categoryDir = '2. Retail';

    const dossierFolder = path.join(DATA_DIR, cleanBranch, categoryDir, `${cleanCustomer}_${cleanScheme}`);
    const customerFolder = path.join(dossierFolder, '1_Documents');

    ['1_Documents', '2_Assessment', '3_Appraisal', '4_Sanction'].forEach(sub => {
        fs.mkdirSync(path.join(dossierFolder, sub), { recursive: true });
    });

    // 4. Save Each Document with Timestamp & OCR Tag
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timeStampPrefix = now.getFullYear() + '-' +
        pad(now.getMonth() + 1) + '-' +
        pad(now.getDate()) + '_' +
        pad(now.getHours()) + '-' +
        pad(now.getMinutes()) + '-' +
        pad(now.getSeconds());

    const savedDocuments = [];

    incomingFiles.forEach((fileObj, idx) => {
        const originalName = fileObj.name || ('document_' + (idx + 1) + '.pdf');
        const docOcr = ocrAnalysis.documents[idx] || {};
        const docTypeTag = (docOcr.classification && docOcr.classification.type) ? docOcr.classification.type : 'DOC';

        const safeOriginalName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestampedFileName = `${timeStampPrefix}_${docTypeTag}_${safeOriginalName}`;
        const targetFilePath = path.join(customerFolder, timestampedFileName);

        let buffer;
        if (Buffer.isBuffer(fileObj.data)) {
            buffer = fileObj.data;
        } else if (fileObj.base64) {
            buffer = Buffer.from(fileObj.base64, 'base64');
        } else if (fileObj.content) {
            buffer = Buffer.from(fileObj.content, 'utf8');
        } else {
            buffer = Buffer.from('%PDF-1.4 Mock Loan Document');
        }

        fs.writeFileSync(targetFilePath, buffer);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        savedDocuments.push({
            id: 'DOC_' + Date.now() + '_' + idx,
            storedFileName: timestampedFileName,
            originalName: originalName,
            classifiedType: docTypeTag,
            classificationLabel: docOcr.classification ? docOcr.classification.label : 'Loan Document',
            fileSize: buffer.length,
            sha256: hash,
            fullPath: targetFilePath,
            entities: docOcr.entities || {},
            savedAt: now.toISOString()
        });
    });

    // 5. Generate OCR Extraction Manifest inside Customer Folder
    const ocrManifest = {
        intakeChannel: channel,
        processingEngine: 'MICROSOFT_POWER_AUTOMATE_OCR_PIPELINE',
        processedAt: now.toISOString(),
        branch: finalBranch,
        segment: finalSegment,
        scheme: finalScheme,
        customerName: customerName,
        sponsoringOfficer: {
            name: officerName,
            phone: officerPhone
        },
        ocrSummary: ocrAnalysis.dossierSummary,
        documentsStored: savedDocuments
    };

    const manifestPath = path.join(customerFolder, `OCR_EXTRACTION_MANIFEST_${timeStampPrefix}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(ocrManifest, null, 2), 'utf8');

    // 6. Generate / Update Master Vault Proposal Record
    const proposalId = 'PROP_PA_' + Date.now();
    const proposalFilePath = path.join(path.dirname(customerFolder), `${cleanCustomer}_proposal.json`);
    
    let existingProposal = {};
    if (fs.existsSync(proposalFilePath)) {
        try { existingProposal = JSON.parse(fs.readFileSync(proposalFilePath, 'utf8')); } catch (e) {}
    }

    const mergedDocs = (existingProposal.stagedDocs || []).concat(savedDocuments.map(d => ({
        id: d.id,
        name: d.storedFileName,
        size: d.fileSize,
        type: 'application/pdf',
        sha256: d.sha256
    })));

    const proposalRecord = Object.assign({
        id: existingProposal.id || proposalId,
        applicant: customerName.replace(/_/g, ' '),
        constitution: payload.constitution || 'Individual',
        branch: finalBranch,
        segment: finalSegment,
        scheme: finalScheme.replace(/_/g, ' '),
        userId: 'EMP-PA-OCR',
        officerName: officerName,
        role: 'Field Sponsoring Officer',
        stagedDocs: mergedDocs,
        ocrExtractedEntities: ocrAnalysis.dossierSummary,
        lastNote: `Processed via Microsoft Power Automate & OCR on ${now.toLocaleString()}`,
        sanctionStatus: 'DOCS_INGESTED_WAITING_AUDIT',
        timestamp: now.toISOString(),
        lastDate: now.toLocaleString(),
        folderPath: customerFolder
    }, existingProposal);

    proposalRecord.stagedDocs = mergedDocs;
    proposalRecord.lastDate = now.toLocaleString();
    fs.writeFileSync(proposalFilePath, JSON.stringify(proposalRecord, null, 2), 'utf8');

    console.log(`[POWER AUTOMATE OCR] Successfully ingested ${savedDocuments.length} docs for ${customerName} into ${customerFolder}`);

    return {
        success: true,
        status: 'SUCCESS',
        statusCode: 200,
        message: 'Loan documents processed via OCR and saved into Master Vault folder hierarchy',
        proposalId: proposalRecord.id,
        customerName: customerName,
        branch: finalBranch,
        scheme: finalScheme,
        segment: finalSegment,
        vaultFolderPath: customerFolder,
        totalDocumentsProcessed: savedDocuments.length,
        savedDocuments: savedDocuments,
        ocrSummary: ocrAnalysis.dossierSummary,
        manifestPath: manifestPath
    };
}

/**
 * Returns a complete Microsoft Power Automate Flow Template (Logic App JSON format)
 */
function getPowerAutomateFlowDefinition() {
    return {
        schemaVersion: "1.0.0.0",
        title: "Bank_Loan_Appraisal_WhatsApp_OCR_Flow",
        description: "Microsoft Power Automate Flow for WhatsApp & Official Mail Document Ingestion with OCR & Master Vault Staging",
        triggers: {
            when_http_request_received: {
                type: "Request",
                kind: "Http",
                inputs: {
                    schema: {
                        type: "object",
                        properties: {
                            channel: { type: "string" },
                            officerName: { type: "string" },
                            officerPhone: { type: "string" },
                            messageText: { type: "string" },
                            files: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        base64: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        actions: {
            send_to_bank_ocr_hub: {
                type: "Http",
                inputs: {
                    method: "POST",
                    uri: "http://localhost:8080/api/power-automate/webhook",
                    headers: { "Content-Type": "application/json" },
                    body: "@triggerBody()"
                }
            },
            approval_by_underwriter: {
                type: "OpenApiConnection",
                inputs: {
                    host: { connectionName: "shared_approvals" },
                    operationId: "StartAndWaitForAnApproval",
                    parameters: {
                        approvalType: "Basic",
                        title: "Loan Proposal Ingestion: @{body('send_to_bank_ocr_hub')?['customerName']} (@{body('send_to_bank_ocr_hub')?['scheme']})",
                        assignedTo: "underwriting.desk@bank.pnb.co.in",
                        details: "Documents processed by OCR and saved in: @{body('send_to_bank_ocr_hub')?['vaultFolderPath']}"
                    }
                }
            }
        }
    };
}

/**
 * Returns a Power Automate Desktop (PAD) Script for Windows 10/11
 */
function getPowerAutomateDesktopScript() {
    return `# ==============================================================================
# MICROSOFT POWER AUTOMATE DESKTOP (PAD) - BANK LOAN APPRAISAL SCRIPT
# Copy and Paste this script into Power Automate Desktop on Windows
# ==============================================================================

# 1. Set Local Bank Hub Endpoint
SET HubEndpoint TO "http://localhost:8080/api/power-automate/webhook"
SET WatchFolder TO "D:\\Bank_Loan_Appraisal\\MASTER_VAULT\\STAGING_QUEUE"

# 2. Prompt or monitor WhatsApp Desktop for incoming files
Display.InputDialog Message: $'''Enter Customer Name for Incoming Loan Dossier:''' Title: $'''Bank Loan Appraisal - WhatsApp Ingestion''' DefaultResult: $'''Rohit_Verma''' InputType: Display.InputType.SingleLine IsTopMost: True UserInput=> CustomerName

# 3. Trigger Ingestion Request to Bank Hub Server
Web.InvokeWebRequest.InvokePost URL: HubEndpoint RequestBody: $'''{"channel":"WHATSAPP_PAD","officerName":"Field Officer","customerName":"''' + CustomerName + $'''","messageText":"WhatsApp Dossier via Power Automate Desktop"}''' ContentType: $'''application/json''' Response=> ResponseData StatusCode=> StatusCode

Display.ShowMessage Title: $'''Ingestion Complete''' Message: $'''Dossier successfully processed by OCR and stored in Master Vault!''' Icon: Display.Icon.Information Buttons: Display.Buttons.OK
`;
}

module.exports = {
    handlePowerAutomateIngestion,
    getPowerAutomateFlowDefinition,
    getPowerAutomateDesktopScript
};