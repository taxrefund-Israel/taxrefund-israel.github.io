'use strict';

/**
 * חישוב מס הכנסה לפי מדרגות עבור שנה נתונה
 * @param {number} income - הכנסה חייבת שנתית בש"ח
 * @param {number} year - שנת המס
 * @returns {number} - סכום המס בש"ח
 */
function calculateIncomeTax(income, year) {
  const data = TAX_DATA[year];
  if (!data || income <= 0) return 0;

  let tax = 0;
  for (const bracket of data.brackets) {
    if (income <= bracket.min) break;
    const upper = bracket.max === Infinity ? income : Math.min(income, bracket.max);
    tax += (upper - bracket.min) * (bracket.rate / 100);
  }
  return Math.round(tax);
}

/**
 * חישוב מספר נקודות הזיכוי לפי פרטים אישיים
 * @param {Object} pd - personalData
 * @param {number} taxYear
 * @returns {number} - מספר נקודות זיכוי
 */
function calculateCreditPoints(pd, taxYear) {
  let points = 0;

  // בסיס: תושב ישראלי
  points += pd.gender === 'female' ? 2.75 : 2.25;

  // הורה חד-הורי
  if (pd.maritalStatus === 'single_parent') points += 1.0;

  // ילדים - לאמא או לאבא עיקרי
  const isEntitled = pd.gender === 'female' || pd.isPrimaryCaregiver || pd.maritalStatus === 'single_parent';
  if (isEntitled) {
    points += (pd.children05 || 0) * 2.0;
    points += (pd.children617 || 0) * 2.0;
  }

  // נכות מוכרת
  if (pd.disabilityLevel === 'full')    points += 2.0;
  else if (pd.disabilityLevel === 'partial') points += 1.0;

  // עולה חדש
  if (pd.isNewImmigrant && pd.immigrantYear) {
    const diff = taxYear - parseInt(pd.immigrantYear);
    if (diff === 0)      points += 3.0;
    else if (diff === 1) points += 2.0;
    else if (diff === 2) points += 1.0;
  }

  return Math.round(points * 100) / 100;
}

/**
 * חישוב שווי זיכוי נקודות הזיכוי בש"ח
 */
function calcCreditValue(points, year) {
  const data = TAX_DATA[year];
  if (!data) return 0;
  return Math.round(points * data.creditPointValue);
}

/**
 * חישוב מרכזי - מחזיר את כל נתוני החישוב
 * @param {Object} formData
 * @returns {Object} - תוצאות מלאות
 */
function calculateRefund(formData) {
  const { taxYear, personalData: pd, employerIncome: ei, additionalIncome: ai, deductions: ded } = formData;

  const n = v => parseFloat(v) || 0;

  // ---- הכנסות ----
  const emp1Gross   = n(ei.grossIncome);
  const emp2Gross   = n(ai.employer2Gross);
  const niAmount    = n(ai.niAmount);
  const otherIncome = n(ai.otherIncome);
  const exemptIncome = n(ei.exemptIncome);

  const totalGross    = emp1Gross + emp2Gross + niAmount + otherIncome;
  const totalTaxable  = Math.max(0, totalGross - exemptIncome);

  // ---- ניכויים ----
  const pensionDed       = n(ei.pensionDeduction);
  const addPension       = n(ded.additionalPension);
  const studyFundRaw     = n(ded.studyFund);
  const studyFundLimit   = STUDY_FUND_LIMIT[taxYear] || 18480;
  const studyFundDed     = Math.min(studyFundRaw, studyFundLimit);

  const totalDeductions  = pensionDed + addPension + studyFundDed;
  const netTaxableIncome = Math.max(0, totalTaxable - totalDeductions);

  // ---- מס לפי מדרגות ----
  const taxByBrackets = calculateIncomeTax(netTaxableIncome, taxYear);

  // ---- נקודות זיכוי ----
  const creditPoints = calculateCreditPoints(pd, taxYear);
  const taxCredit    = calcCreditValue(creditPoints, taxYear);

  // ---- חבות מס נטו ----
  const netTaxLiability = Math.max(0, taxByBrackets - taxCredit);

  // ---- מס שנוכה ----
  const emp1TaxWithheld  = n(ei.taxWithheld);
  const emp2TaxWithheld  = n(ai.employer2TaxWithheld);
  const niTaxWithheld    = n(ai.niTaxWithheld);
  const totalTaxWithheld = emp1TaxWithheld + emp2TaxWithheld + niTaxWithheld;

  // ---- זיכוי תרומות ----
  const donationAmount = n(ded.donations);
  const donationCredit = donationAmount >= DONATION_MIN
    ? Math.round(donationAmount * DONATION_CREDIT_RATE) : 0;

  // ---- תוצאה ----
  const refund = Math.round(totalTaxWithheld - netTaxLiability + donationCredit);

  const effectiveRate = netTaxableIncome > 0
    ? Math.round((netTaxLiability / netTaxableIncome) * 1000) / 10 : 0;

  return {
    taxYear,
    totalGross,
    totalTaxable,
    exemptIncome,
    totalDeductions,
    netTaxableIncome,
    taxByBrackets,
    creditPoints,
    taxCredit,
    netTaxLiability,
    totalTaxWithheld,
    donationCredit,
    refund,
    isRefund: refund > 0,
    effectiveRate
  };
}
