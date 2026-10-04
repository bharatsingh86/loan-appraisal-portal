/**
 * BANK LOAN APPRAISAL - DEDICATED CAR LOAN ASSESSMENT ENGINE
 * Strictly per PNB Circulars:
 * - Master Circular: RABD 75/2026 (Consolidated Car Loan Guidelines)
 * - Festival Campaign: RABD 130/2026 (PNB CAR UTSAV: 14.09.2026 to 15.11.2026)
 * - CBS Menu CARDEALM: RABD 77/2026 (Dealer Due Diligence)
 * - JRC Advisory: RABD 128/2026 (Joint Registration Certificate)
 * - Sibling Inclusion: RABD 83/2026
 */

const fs = require('fs');
const path = require('path');
const ocr = require('./ocr_engine');

// Standard Campaign & Policy Parameters
const CAR_UTSAV_CONFIG = {
    campaignName: 'PNB CAR UTSAV',
    campaignPeriod: '14.09.2026 to 15.11.2026',
    roi: {
        standard: 7.65,
        yuvaVahan: 7.60,
        greenEv: 7.60,
        greenEvYuva: 7.55
    },
    processingCharges: 'NIL / Waived under PNB Car Utsav Campaign',
    documentationCharges: 'NIL / Waived',
    minMarginOnRoad: 10, // 10% on on-road price
    minMarginExShowroomTieUp: 0, // 100% financing on ex-showroom under tie-up
    maxTenureMonths: 84, // 7 years
    cibilCutoff: 700
};

/**
 * Calculates EMI given Principal, Annual Rate, and Tenure in Months
 */
function calculateEmi(principal, annualRatePercent, tenureMonths) {
    const monthlyRate = (annualRatePercent / 12) / 100;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return Math.round(emi);
}

/**
 * Evaluates Permissible EMI / NMI Ratio based on Monthly Income
 */
function getPermissibleDeductionRatio(netMonthlyIncome) {
    if (netMonthlyIncome <= 50000) return 0.50; // 50%
    if (netMonthlyIncome <= 100000) return 0.60; // 60%
    return 0.70; // 70%
}

/**
 * Scrutinizes files in customer directory or staging buffer
 */
function scrutinizeCustomerDossier(files = [], applicantName = 'Badal Sahu', requestedAmount = 2700000) {
    const ocrSummary = ocr.analyzeDossierOcr(files);
    
    // Checklist Audit
    const checklist = {
        panCard: { required: true, submitted: false, details: null },
        aadhaarCard: { required: true, submitted: false, details: null },
        drivingLicense: { required: true, submitted: false, details: null },
        dealerQuotation: { required: true, submitted: false, details: null },
        incomeProof: { required: true, submitted: false, details: null }, // Salary slips / ITR
        bankStatement: { required: true, submitted: false, details: null },
        cibilReport: { required: true, submitted: false, details: null }
    };

    const discrepancies = [];
    const missingDocuments = [];

    // Evaluate OCR findings
    ocrSummary.documents.forEach(doc => {
        const type = doc.classification.type;
        if (type === 'PAN_CARD') {
            checklist.panCard.submitted = true;
            checklist.panCard.details = doc.entities.panNumber;
        } else if (type === 'AADHAAR_CARD') {
            checklist.aadhaarCard.submitted = true;
        } else if (type === 'DRIVING_LICENSE') {
            checklist.drivingLicense.submitted = true;
        } else if (type === 'DEALER_QUOTATION') {
            checklist.dealerQuotation.submitted = true;
            checklist.dealerQuotation.details = {
                model: doc.entities.detectedVehicleModel,
                cost: doc.entities.estimatedCost
            };
        } else if (type === 'SALARY_SLIP' || type === 'ITR_COMPUTATION') {
            checklist.incomeProof.submitted = true;
        } else if (type === 'CIBIL_REPORT') {
            checklist.cibilReport.submitted = true;
            checklist.cibilReport.details = doc.entities.cibilScore;
        }
    });

    // Determine missing documents
    for (const [key, item] of Object.entries(checklist)) {
        if (item.required && !item.submitted) {
            missingDocuments.push(key);
        }
    }

    // Financial & Scheme calculations
    const tenure = CAR_UTSAV_CONFIG.maxTenureMonths;
    const roi = CAR_UTSAV_CONFIG.roi.standard;
    const calculatedEmi = calculateEmi(requestedAmount, roi, tenure);

    // Minimum Required Income calculation
    const requiredNmi = Math.round(calculatedEmi / 0.60); // assuming 60% bracket
    const requiredGrossAnnual = Math.round(requiredNmi * 12 * 1.25);

    return {
        applicantName,
        requestedAmount,
        schemeFitment: {
            recommendedScheme: 'PNB Car Loan (General) / PNB Pride Car Loan',
            campaign: 'PNB CAR UTSAV (RABD 130/2026)',
            effectiveRoi: `${roi}% p.a.`,
            tenure: `${tenure} Months (7 Years)`,
            calculatedEmi: `₹${calculatedEmi.toLocaleString('en-IN')}`,
            processingFee: CAR_UTSAV_CONFIG.processingCharges,
            documentationFee: CAR_UTSAV_CONFIG.documentationCharges,
            marginRequirement: '10% on On-Road Price (Nil on Ex-Showroom for tie-ups)'
        },
        eligibilityAnalysis: {
            minimumNetMonthlyIncomeRequired: `₹${requiredNmi.toLocaleString('en-IN')}`,
            minimumAnnualIncomeRequired: `₹${requiredGrossAnnual.toLocaleString('en-IN')}`,
            repaymentTenure: `${tenure} Months`,
            applicableMaxDeduction: '60% to 70% of Net Monthly Income'
        },
        checklist,
        missingDocuments,
        discrepancies,
        mandatoryCovenants: [
            '1. CARDEALM Compliance: Branch must verify dealer credentials in CBS via menu option "CARDEALM" prior to disbursement (RABD 77/2026).',
            '2. Direct Payment: Disbursement check/NEFT must be made strictly to the verified dealer account.',
            '3. Pre-Disbursement Compliance (PDC): Status and checklist marking mandatory in PNB LenS before sanction & disbursement.',
            '4. Hypothecation & RC: Bank hypothecation charge must be recorded in the Registration Certificate (RC) with RTO and joint registration compliance adhered to (RABD 128/2026).',
            '5. Comprehensive Insurance: Comprehensive insurance policy covering full on-road value with Bank Hypothecation Clause.'
        ]
    };
}

module.exports = {
    CAR_UTSAV_CONFIG,
    calculateEmi,
    getPermissibleDeductionRatio,
    scrutinizeCustomerDossier
};
