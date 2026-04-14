'use strict';

// מדרגות מס הכנסה ושווי נקודות זיכוי לשנים 2020-2025
const TAX_DATA = {
  2020: {
    brackets: [
      { min: 0,      max: 75720,   rate: 10 },
      { min: 75720,  max: 108600,  rate: 14 },
      { min: 108600, max: 174360,  rate: 20 },
      { min: 174360, max: 242400,  rate: 31 },
      { min: 242400, max: 504360,  rate: 35 },
      { min: 504360, max: Infinity,rate: 47 }
    ],
    creditPointValue: 2616  // שווי נקודת זיכוי שנתי בש"ח
  },
  2021: {
    brackets: [
      { min: 0,      max: 77400,   rate: 10 },
      { min: 77400,  max: 110880,  rate: 14 },
      { min: 110880, max: 178080,  rate: 20 },
      { min: 178080, max: 247440,  rate: 31 },
      { min: 247440, max: 514920,  rate: 35 },
      { min: 514920, max: Infinity,rate: 47 }
    ],
    creditPointValue: 2676
  },
  2022: {
    brackets: [
      { min: 0,      max: 77400,   rate: 10 },
      { min: 77400,  max: 110880,  rate: 14 },
      { min: 110880, max: 178080,  rate: 20 },
      { min: 178080, max: 247440,  rate: 31 },
      { min: 247440, max: 514920,  rate: 35 },
      { min: 514920, max: Infinity,rate: 47 }
    ],
    creditPointValue: 2676
  },
  2023: {
    brackets: [
      { min: 0,      max: 81480,   rate: 10 },
      { min: 81480,  max: 116760,  rate: 14 },
      { min: 116760, max: 187440,  rate: 20 },
      { min: 187440, max: 260520,  rate: 31 },
      { min: 260520, max: 542160,  rate: 35 },
      { min: 542160, max: Infinity,rate: 47 }
    ],
    creditPointValue: 2820
  },
  2024: {
    brackets: [
      { min: 0,      max: 81480,   rate: 10 },
      { min: 81480,  max: 116760,  rate: 14 },
      { min: 116760, max: 187440,  rate: 20 },
      { min: 187440, max: 260520,  rate: 31 },
      { min: 260520, max: 542160,  rate: 35 },
      { min: 542160, max: Infinity,rate: 47 }
    ],
    creditPointValue: 2904
  },
  2025: {
    brackets: [
      { min: 0,      max: 84120,   rate: 10 },
      { min: 84120,  max: 120720,  rate: 14 },
      { min: 120720, max: 193800,  rate: 20 },
      { min: 193800, max: 269280,  rate: 31 },
      { min: 269280, max: 558960,  rate: 35 },
      { min: 558960, max: Infinity,rate: 47 }
    ],
    creditPointValue: 2988
  }
};

// מגבלת ניכוי לקרן השתלמות (מהכנסה חייבת) לפי שנה
const STUDY_FUND_LIMIT = {
  2020: 18480, 2021: 18480, 2022: 18480,
  2023: 19800, 2024: 19800, 2025: 20520
};

// סף מינימום תרומות מוכרות
const DONATION_MIN = 190;
// שיעור זיכוי תרומות
const DONATION_CREDIT_RATE = 0.35;
