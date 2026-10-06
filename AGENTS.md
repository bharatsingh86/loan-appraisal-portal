# BANK LOAN APPRAISAL - AUTONOMOUS AGENT DIRECTIVES

## CORE PROTOCOL: SINGLE INSTRUCTION TRIGGER
Whenever the user issues a short instruction like:
- **"Car loan ka assessment karo"**
- **"Badal Sahu ka assessment karo"**
- or any single command for loan appraisal or system update:

You MUST execute the complete end-to-end autonomous workflow without needing iterative guidance:

---

### Phase 1: Ingestion & Vault Organization (Branch-wise & Customer-wise)
1. **Locate & Ingest Documents**:
   - Check incoming channels: Gmail attachments, WhatsApp queue, `MASTER_VAULT/STAGING_QUEUE`, or user drop folders.
   - Detect Branch (e.g. `001 - CHANDNI CHOWK`, `943600-CHHINDWARA VIP ROAD (MP)`, `660400-JABALPUR RAMPUR CHOWK`, etc.) and Applicant Name (e.g. `Badal_Sahu`).
2. **Directory Structure**:
   - Store strictly under:
     `MASTER_VAULT/DATA/<BRANCH>/<SEGMENT>/<CUSTOMER_NAME>_DOCUMENTS/`
   - Prefix all incoming files with timestamp `YYYY-MM-DD_HH-mm-ss_<OriginalName>.ext`.
   - Calculate SHA-256 checksums and generate `INTAKE_AUDIT_RECEIPT.json`.

---

### Phase 2: Document Scrutiny & Defect Check (Strictly as per PNB Circulars)
Evaluate every document against the mandatory checklist of:
- **RABD 75/2026**: Consolidated Car Loan Guidelines
- **RABD 130/2026**: PNB Car Utsav Campaign (Effective 14.09.2026 to 15.11.2026 / 31.12.2026)
- **RABD 77/2026**: CARDEALM CBS Menu Dealer Verification
- **RABD 128/2026**: Joint Registration Certificate (JRC) Advisory
- **RABD 83/2026**: Sibling Co-borrower Inclusion
- **MSME 77/2026 & 79/2026**: PNB Sampatti (LAP) & MSME Prime Plus
- **Agri Cir. 42/2025 & 58/2025**: Kisan Credit Card (KCC) & Kisan Samriddhi Yojana (KSY)

**Mandatory Document Checks**:
1. **KYC**: PAN Card & Aadhaar Card (Identity & address proof, demographic verification).
2. **Income Proof**:
   - Salaried: Latest 3-6 months salary slips, Form 16 / ITR for 2 years, 6 months bank statement showing regular salary credit.
   - Self-Employed / Business: Last 2-3 years ITR with Computation of Income, Balance Sheet & P&L, 12 months operative bank statement, Udyam certificate.
3. **Vehicle / Asset Details**: Dealer Proforma Invoice / Quotation with full cost breakdown (Ex-showroom, RTO/Registration, Comprehensive Insurance, TCS, Accessories, Total On-Road Price).
4. **Driving License**: Valid Driving License of applicant (or paid driver / family driver deployment declaration).
5. **CIBIL / Credit Bureau Report**: Score verification (cutoff >= 700, check DPD, write-offs, suit filed).
6. **Defect Scrutiny**:
   - Verify dealer registration in CBS under `CARDEALM`.
   - Scrutinize bank statements for check/ECS bounces, EMI deductions of undisclosed liabilities.
   - Cross-check income on salary slips vs bank credits vs ITR.

---

### Phase 3: Scheme Fitment & Financial Eligibility Calculator
1. **Variant Fitment**:
   - **PNB Car Utsav Campaign (RABD 130/2026)**: Current active festival campaign from 14.09.2026 to 15.11.2026 / 31.12.2026.
     - ROI: **7.65% p.a.** (Yuva Vahan age 18-35: 7.60% p.a.; EV: 7.60% p.a.; EV Yuva: 7.55% p.a.).
     - Upfront / Processing Charges: **NIL / Waived**.
     - Documentation Charges: **NIL / Waived**.
     - Margin: **10% of On-Road Price** (NIL on Ex-Showroom under manufacturer tie-ups).
     - Max Tenure: **84 Months (7 Years)**; EV Green Car: **120 Months (10 Years)**.
2. **Quantum of Finance & Deduction Methodology (Strictly as per PNB Circulars)**:
   - **Mandatory Income Bifurcation (Regular vs Invariable / Variable Components)**:
     - In Gross Total Income, ONLY regular and sustainable income components can be considered.
     - **Invariable / Variable Components MUST be EXCLUDED**:
       - Salaried: Exclude annual bonus, one-off overtime, arrears, medical encashments, variable incentive.
       - Business / Self-Employed: Exclude Short-term/Long-term Capital Gains (STCG/LTCG), share trading/speculative profits, unverified private interest, one-off dividends, windfall gains.
       - Only consider regular business operating profit (u/s 44AD or audited P&L) and regular verifiable institutional income.
     - **Mandatory Output**: For every appraisal, generate a detailed **Income Bifurcation Table** breaking down each reported component, its nature (Regular vs Invariable), and Bank Treatment (Included vs Excluded with justification).
   - **Gross Regular Monthly Income (GRMI) Determination**:
     - Compute Gross Regular Annual Income -> Divide by 12 = **GRMI**.
   - **Permissible Deduction Cap: Without Deviation vs With Deviation**:
     - **Without Deviation (Standard Circular Slab on GRMI)**:
       - GRMI <= ₹50,000/month: Max **50% of GRMI**
       - GRMI ₹50,001 to ₹1,00,000/month: Max **60% of GRMI**
       - GRMI ₹1,00,001 to ₹2,00,000/month: Max **65% of GRMI**
       - GRMI > ₹2,00,000/month: Max **70% of GRMI**
     - **With Deviation (Delegated Financial Powers Relaxation)**:
       - Calculate extended deduction cap with permissible deviation (e.g. +5% or +10% deviation approved by Circle Head / Zonal Manager), e.g., 65% or 70% of GRMI, subject to maintaining minimum take-home pay and clean bureau track record.
   - **Step-by-step Deductions & Available Permissible EMI**:
     - Total Permissible Deductions = `(Applicable % of GRMI)`
     - Less: **Statutory Deductions** (Income Tax, TDS, Professional Tax)
     - Less: **Other Fixed Deductions**
     - Less: **Existing Loan EMIs as per CIC (CIBIL/Experian/Equifax/CRIF) Reports**
     - Equals: `Net Available EMI for Proposed Loan = Permissible Deductions - (Statutory + Existing CIC EMIs + Other Deductions)`
     - Present both **Without Deviation** and **With Deviation** available EMI figures.
   - **Mandatory Net Take-Home Pay Check**:
     `Net Monthly Take-Home Pay = GRMI - Total Deductions (including Proposed EMI)`
     Must be >= 40% of GRMI (or minimum take-home cutoff of ₹25,000/month, whichever is higher).
   - **Permissible Loan Quantum**:
     Permissible Loan = Present Value of Net Available EMI over proposed tenure at governing circular ROI.

---

### Phase 4: Output Generation
Generate complete documentation:
1. **Discrepancy / Document Requisition Letter** addressed to Branch Head.
2. **Tabular Eligibility Assessment Sheet**.
3. **Credit Appraisal & Sanction Note** including:
   - Applicant Profile & Vehicle Details
   - Income & CIBIL Assessment
   - Terms of Sanction (Amount, ROI, Margin, Tenure, EMI)
   - Pre-Disbursement Conditions (CARDEALM verification, PDC marking in PNB LenS, insurance with bank clause)
   - Post-Disbursement Conditions (RC with bank hypothecation, invoice & receipt obtention, end-use verification).

---

### Phase 5: Chat History Dual Segregation & Identification Protocol
Every chat session must be analyzed and routed using `chat_classifier.js`:

1. **Category A: Loan Appraisal & Customer Queries (`LOAN_ASSESSMENT`)**:
   - Queries regarding borrowers, circulars, eligibility, sanctions, discrepancy letters, margin, ROI, CIBIL, CARDEALM, etc.
   - **Target Folder**: `MASTER_VAULT/DATA/000-CHAT_HISTORY/`
   - **Filename Format**: `YYYY-MM-DD_HH-mm-ss_<TOPIC>_CHAT.docx`
   - **Interface Visibility**: **VISIBLE** in Web Portal & Mobile App UI under DOCX Chat History tab (fully searchable, filterable, and downloadable).

2. **Category B: Project & Application Development (`PROJECT_DEVELOPMENT`)**:
   - Instructions regarding code updates, GitHub push, Vercel deployment, PWA icons, server configuration, prompt directives, etc.
   - **Target Folder**: `MASTER_VAULT/DATA/PROJECT_DEVELOPMENT_CHATS/`
   - **Filename Format**: `YYYY-MM-DD_HH-mm-ss_<TOPIC>_DEV_CHAT.docx`
   - **Interface Visibility**: **STRICTLY EXCLUDED** from Web Portal & Mobile App UI. Kept strictly on Google Drive/disk for user's manual review and AI prompt context.

---

### Phase 6: Grounded Circular Q&A Protocols (No Generic Gists)
Whenever answering any banking or circular query:
1. **No Keyword Over-Triggering**: Read the user's specific query and answer ONLY what is asked. Do not dump generic 40-line circular overviews.
2. **Mandatory Circular Paragraph Citation**: Every answer MUST quote the governing circular with exact Section and Paragraph/Clause number:
   `> 📜 **Official Circular Authority & Quoted Para:** <Circular Number, Section, Para & Text>`
3. **Interactive Follow-up Suggestions**: Every AI response MUST return an array of **3 Clickable Suggestion Questions** (`suggestions: [q1, q2, q3]`) that allow the user to explore circulars with 1 tap.

---

### Phase 7: PWA Direct Installation & Mobile Offline/Cloud Access
1. Complete PWA assets (`manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`) are maintained at root.
2. Pre-indexed `vault_customers_registry.json` ensures full data accessibility (74 branches, 44 customer proposals, 802 docs, and 91 DOCX chats) even when the laptop is OFF and accessed via mobile 4G/5G on Vercel.

---

### Phase 8: Universal Master Synchronization Engine (Google Drive <-> GitHub <-> Vercel)
**Rule**: All instructions, code updates, customer catalogs, and configuration files must be synchronized across:
1. **Google Drive** (`G:\My Drive\Bank_Loan_Appraisal`)
2. **GitHub** (`https://github.com/bharatsingh86/loan-appraisal-portal` on `main`)
3. **Vercel Production** (`https://loan-appraisal-portal.vercel.app`)
4. **Web Portal & Mobile Application**

**Execution**:
- Run `node auto_sync_all.js` or double-click `SYNC_ALL.bat` to rebuild the vault catalog, archive development logs, and push everything to GitHub in a single step.
