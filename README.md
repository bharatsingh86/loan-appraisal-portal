# Punjab National Bank - Autonomous Loan Appraisal & Multi-Cloud System

Comprehensive Banking Credit Appraisal, Document Scrutiny, Circular Grounded AI Assistant, and Multi-Cloud Web/Mobile Portal.

## 🌟 Core Features

1. **Autonomous Car Loan Appraisal Workflow**:
   - Single command trigger (`"Badal Sahu ka assessment karo"`).
   - Scrutiny across RABD 75/2026, RABD 130/2026 (Car Utsav), RABD 77/2026 (CARDEALM), RABD 128/2026 (JRC), RABD 83/2026 (Sibling Co-borrower).
   - Automated generation of Official Sanction Notes and Branch Manager Discrepancy Letters.

2. **Intelligent Circular Q&A (Grounded Assistant)**:
   - Reads exact user questions (Margin, ROI, CIBIL, CARDEALM, Tenures, Sibling Co-borrowers).
   - Quotes exact circular authorities with Section and Paragraph numbers.
   - Provides **3 Interactive Follow-up Suggestion Chips** for rapid exploration.

3. **Dual Chat History Segregation**:
   - **Loan Appraisal & Customer Chats**: Saved in `MASTER_VAULT/DATA/000-CHAT_HISTORY/` and visible/searchable in the Web Portal & Mobile App.
   - **Project & Application Development Chats**: Saved in `MASTER_VAULT/DATA/PROJECT_DEVELOPMENT_CHATS/` and strictly excluded from the user interface.

4. **Universal Multi-Cloud Synchronization**:
   - Seamless data availability across **Google Drive**, **GitHub**, **Vercel**, and **PWA Mobile App**.
   - 1-Click sync via `node auto_sync_all.js` or double-clicking `SYNC_ALL.bat`.

## 📱 Mobile App (PWA)
- Production URL: `https://loan-appraisal-portal.vercel.app`
- Direct Home Screen Installation support on Android & iOS.
- Full offline catalog pre-indexed across 74 Branches and 44 Customer Proposals.
