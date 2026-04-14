'use strict';

/* =========================================================
   סימולטור החזר מס לשכירים — לוגיקת אפליקציה
   ========================================================= */

// ---- EmailJS תצורה ----
// החלף את הערכים הבאים לאחר הרשמה ל-EmailJS (emailjs.com)
const EMAILJS_CONFIG = {
  serviceId:  'YOUR_SERVICE_ID',   // Service ID מ-EmailJS
  templateId: 'YOUR_TEMPLATE_ID',  // Template ID מ-EmailJS
  publicKey:  'YOUR_PUBLIC_KEY'    // Public Key מ-EmailJS
};

// ---- State ----
let currentStep = 1;
const TOTAL_STEPS = 6;

let formData = {
  taxYear: 2024,
  personalData:    {},
  employerIncome:  {},
  additionalIncome: {},
  deductions:      {},
  contact:         {}
};

let calculationResult = null;

// =========================================================
// WIZARD NAVIGATION
// =========================================================
function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;

  const current = document.querySelector('.step-content.active');
  if (current) current.classList.remove('active');

  currentStep = step;

  const next = document.querySelector(`.step-content[data-step="${currentStep}"]`);
  if (next) next.classList.add('active');

  updateProgress();
  updateNavButtons();

  const calcEl = document.getElementById('calculator');
  if (calcEl) {
    const y = calcEl.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  collectStepData(currentStep);

  if (currentStep === 4) {
    // לפני שלב התוצאות — מחשבים
    collectStepData(currentStep);
    calculateAndShowResults();
    goToStep(5);
  } else {
    goToStep(currentStep + 1);
  }
}

function prevStep() {
  goToStep(currentStep - 1);
}

function updateProgress() {
  const fill = document.getElementById('progress-fill');
  if (fill) {
    const pct = Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100);
    fill.style.width = `${pct}%`;
  }

  document.querySelectorAll('.step-indicator').forEach((el, i) => {
    const sn = i + 1;
    el.classList.toggle('active',    sn === currentStep);
    el.classList.toggle('completed', sn < currentStep);
  });
}

function updateNavButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (!prevBtn || !nextBtn) return;

  // מונה שלבים
  const counter = document.getElementById('step-counter');
  if (counter) counter.textContent = `שלב ${currentStep} מתוך ${TOTAL_STEPS}`;

  // כפתור חזרה
  prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';

  // כפתור קדימה
  if (currentStep === TOTAL_STEPS) {
    nextBtn.textContent = 'שלח פרטים ✉';
    nextBtn.onclick = submitContact;
  } else if (currentStep === 4) {
    nextBtn.textContent = 'חשב את ההחזר ›';
    nextBtn.onclick = nextStep;
  } else if (currentStep === 5) {
    nextBtn.textContent = 'השאר פרטים ליצירת קשר';
    nextBtn.onclick = nextStep;
  } else {
    nextBtn.textContent = 'הבא ›';
    nextBtn.onclick = nextStep;
  }
}

// =========================================================
// VALIDATION
// =========================================================
function validateStep(step) {
  clearErrors();
  let valid = true;

  if (step === 1) {
    const year = document.getElementById('tax-year')?.value;
    if (!year) { markError('tax-year', 'יש לבחור שנת מס'); valid = false; }

    const gender = document.querySelector('input[name="gender"]:checked');
    if (!gender) { markError('gender-group', 'יש לבחור מין'); valid = false; }
  }

  if (step === 2) {
    const gross = document.getElementById('gross-income')?.value;
    if (!gross || parseFloat(gross) < 0) {
      markError('gross-income', 'יש להזין הכנסה ברוטו (אפשר 0 אם לא עבדת)');
      valid = false;
    }
    const tax = document.getElementById('tax-withheld')?.value;
    if (tax === '' || tax === undefined || parseFloat(tax) < 0) {
      markError('tax-withheld', 'יש להזין מס שנוכה (0 אם לא נוכה מס)');
      valid = false;
    }
  }

  if (step === 6) {
    const name  = document.getElementById('contact-name')?.value?.trim();
    const phone = document.getElementById('contact-phone')?.value?.trim();
    if (!name)  { markError('contact-name',  'יש להזין שם'); valid = false; }
    if (!phone) { markError('contact-phone', 'יש להזין טלפון'); valid = false; }
  }

  return valid;
}

function markError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('error');
  const err = document.createElement('div');
  err.className = 'field-error';
  err.textContent = '⚠ ' + msg;
  el.parentNode.appendChild(err);
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.remove());
  document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
}

// =========================================================
// DATA COLLECTION
// =========================================================
function collectStepData(step) {
  const v = id => document.getElementById(id)?.value ?? '';
  const n = id => parseFloat(document.getElementById(id)?.value) || 0;
  const b = id => document.getElementById(id)?.checked ?? false;

  if (step === 1) {
    formData.taxYear = parseInt(v('tax-year')) || 2024;
    formData.personalData = {
      gender:           document.querySelector('input[name="gender"]:checked')?.value || 'male',
      maritalStatus:    v('marital-status'),
      children05:       parseInt(v('children-05'))  || 0,
      children617:      parseInt(v('children-617')) || 0,
      isPrimaryCaregiver: b('primary-caregiver'),
      disabilityLevel:  v('disability-level'),
      isNewImmigrant:   b('new-immigrant'),
      immigrantYear:    parseInt(v('immigrant-year')) || null
    };
  }

  if (step === 2) {
    formData.employerIncome = {
      grossIncome:      v('gross-income'),
      taxWithheld:      v('tax-withheld'),
      monthsWorked:     v('months-worked'),
      exemptIncome:     v('exempt-income')   || '0',
      pensionDeduction: v('pension-deduction') || '0'
    };
  }

  if (step === 3) {
    formData.additionalIncome = {
      niAmount:            v('ni-amount')           || '0',
      niTaxWithheld:       v('ni-tax-withheld')     || '0',
      employer2Gross:      v('employer2-gross')     || '0',
      employer2TaxWithheld:v('employer2-tax')       || '0',
      otherIncome:         v('other-income')        || '0'
    };
  }

  if (step === 4) {
    formData.deductions = {
      additionalPension: v('additional-pension') || '0',
      studyFund:         v('study-fund')         || '0',
      donations:         v('donations')          || '0'
    };
  }

  if (step === 6) {
    formData.contact = {
      name:  document.getElementById('contact-name')?.value?.trim()  || '',
      phone: document.getElementById('contact-phone')?.value?.trim() || '',
      email: document.getElementById('contact-email')?.value?.trim() || '',
      notes: document.getElementById('contact-notes')?.value?.trim() || ''
    };
  }
}

// =========================================================
// CALCULATION & RESULTS
// =========================================================
function calculateAndShowResults() {
  calculationResult = calculateRefund(formData);
  const r = calculationResult;

  const fmt = n => new Intl.NumberFormat('he-IL').format(Math.round(n));
  const sign = r.refund >= 0 ? '' : '-';

  const refundClass = r.refund > 0 ? 'positive' : r.refund < 0 ? 'negative' : 'zero';
  const refundLabel = r.refund > 0 ? 'החזר מס משוער'
                    : r.refund < 0 ? 'חוב מס משוער'
                    : 'אין יתרה';

  const container = document.getElementById('results-container');
  if (!container) return;

  container.innerHTML = `
    <div class="result-summary ${refundClass}" role="region" aria-label="תוצאת חישוב">
      <div class="result-amount">${fmt(Math.abs(r.refund))} ₪</div>
      <div class="result-label">${refundLabel}</div>
      ${r.isRefund ? '<p class="result-note">* הסכום הוא הערכה. הגשה רשמית תקבע את הסכום המדויק.</p>' : ''}
    </div>

    <div class="card card--bordered">
      <h3 style="margin-bottom:16px;font-size:1.05rem;">📊 פירוט מלא — שנת ${r.taxYear}</h3>
      <table class="result-table" aria-label="פירוט חישוב מס">
        <tbody>
          <tr><td>סה"כ הכנסות ברוטו</td><td>${fmt(r.totalGross)} ₪</td></tr>
          ${r.exemptIncome > 0 ? `<tr><td>הכנסה פטורה ממס</td><td>− ${fmt(r.exemptIncome)} ₪</td></tr>` : ''}
          ${r.totalDeductions > 0 ? `<tr><td>ניכויים (פנסיה, קרן השתלמות)</td><td>− ${fmt(r.totalDeductions)} ₪</td></tr>` : ''}
          <tr class="highlight-row"><td><strong>הכנסה חייבת במס</strong></td><td><strong>${fmt(r.netTaxableIncome)} ₪</strong></td></tr>
          <tr><td>מס לפי מדרגות (${r.taxYear})</td><td>${fmt(r.taxByBrackets)} ₪</td></tr>
          <tr><td>זיכוי נקודות זיכוי (${r.creditPoints} נקודות × ${fmt(TAX_DATA[r.taxYear]?.creditPointValue)} ₪)</td><td>− ${fmt(r.taxCredit)} ₪</td></tr>
          ${r.donationCredit > 0 ? `<tr><td>זיכוי בגין תרומות</td><td>− ${fmt(r.donationCredit)} ₪</td></tr>` : ''}
          <tr class="highlight-row"><td><strong>מס לתשלום לפי חישוב</strong></td><td><strong>${fmt(r.netTaxLiability)} ₪</strong></td></tr>
          <tr><td>מס שנוכה בפועל במקור</td><td>${fmt(r.totalTaxWithheld)} ₪</td></tr>
          <tr class="highlight-row ${refundClass}">
            <td><strong>${r.refund > 0 ? '✅ החזר מס' : r.refund < 0 ? '⚠ חוב מס' : 'ללא יתרה'}</strong></td>
            <td><strong>${sign}${fmt(Math.abs(r.refund))} ₪</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="result-info-box" role="note">
      <div>
        <strong>שיעור מס אפקטיבי: ${r.effectiveRate}%</strong><br>
        <span class="disclaimer">⚠️ חישוב זה הינו הערכה בלבד ואינו מהווה ייעוץ מס. הנתונים מבוססים על מדרגות מס הכנסה הרשמיות לשנת ${r.taxYear}. לצורך הגשת הדו"ח, מומלץ לפנות למומחה מס.</span>
      </div>
    </div>

    <div class="text-center mt-16">
      <p style="color:var(--text-mid);font-size:.9rem;margin-bottom:12px;">
        ${r.isRefund ? '💡 נראה שמגיע לך החזר מס! השאר פרטים ונחזור אליך.' : '💡 השאר פרטים ואנחנו נבדוק יחד.'}
      </p>
    </div>
  `;
}

// =========================================================
// CONTACT FORM → EmailJS
// =========================================================
async function submitContact() {
  if (!validateStep(6)) return;
  collectStepData(6);

  const { name, phone, email, notes } = formData.contact;
  const nextBtn = document.getElementById('next-btn');
  nextBtn.textContent = 'שולח...';
  nextBtn.disabled = true;

  const r = calculationResult;
  const summary = r
    ? `שנת מס: ${r.taxYear} | הכנסה: ${new Intl.NumberFormat('he-IL').format(r.totalGross)} ₪ | ${r.isRefund ? 'החזר' : 'חוב'}: ${new Intl.NumberFormat('he-IL').format(Math.abs(r.refund))} ₪`
    : 'לא בוצע חישוב';

  try {
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      {
        from_name:   name,
        phone:       phone,
        reply_to:    email || 'לא הוזן',
        message:     notes || 'אין הערות',
        tax_summary: summary,
        tax_year:    formData.taxYear
      },
      EMAILJS_CONFIG.publicKey
    );

    document.getElementById('contact-form-content').innerHTML = `
      <div class="success-message">
        <div class="success-icon">✓</div>
        <h3>הפרטים נשלחו בהצלחה!</h3>
        <p>קיבלנו את פנייתך ונחזור אליך בהקדם האפשרי.</p>
        <p style="color:var(--text-mid);margin-top:8px;">שם: <strong>${name}</strong> | טלפון: <strong>${phone}</strong></p>
      </div>
    `;
    document.getElementById('wizard-nav').style.display = 'none';

  } catch (err) {
    console.error('EmailJS error:', err);
    markError('contact-name', 'שגיאה בשליחה — בדוק חיבור אינטרנט ונסה שוב');
    nextBtn.textContent = 'שלח פרטים ✉';
    nextBtn.disabled = false;
  }
}

// =========================================================
// PDF UPLOAD — FORM 106
// =========================================================
async function handleForm106Upload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    showUploadStatus('form106', 'warning', 'יש להעלות קובץ PDF בלבד');
    return;
  }

  showUploadStatus('form106', 'loading', 'מעבד את הקובץ...');

  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const buf  = await file.arrayBuffer();
    const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;

    let text = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }

    const parsed = parseForm106Text(text);
    let filled = 0;

    const setField = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) { el.value = val; filled++; }
    };

    setField('gross-income',      parsed.grossIncome);
    setField('tax-withheld',      parsed.taxWithheld);
    setField('exempt-income',     parsed.exemptIncome);
    setField('pension-deduction', parsed.pensionDeduction);

    showUploadStatus('form106', filled > 0 ? 'success' : 'warning',
      filled > 0
        ? `✓ זוהו ${filled} שדות אוטומטית — אנא בדוק ותקן במידת הצורך`
        : '⚠ לא זוהו שדות — הטופס עשוי להיות מוגן. הזן ידנית.'
    );
  } catch (e) {
    console.warn('PDF parse error:', e);
    showUploadStatus('form106', 'warning', '⚠ לא ניתן לעבד את הקובץ. הזן את הנתונים ידנית.');
  }
}

function parseForm106Text(text) {
  const clean  = t => t.replace(/,/g, '').replace(/\s/g, '');
  const match  = (patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) return clean(m[1]);
    }
    return null;
  };

  return {
    grossIncome: match([
      /158\s*[:\-]?\s*([\d,]+)/,
      /הכנס[תה]\s*עבודה\s*[:\-]?\s*([\d,]+)/,
      /שכר\s*ברוטו\s*[:\-]?\s*([\d,]+)/
    ]),
    taxWithheld: match([
      /042\s*[:\-]?\s*([\d,]+)/,
      /מס\s*שנוכה\s*[:\-]?\s*([\d,]+)/,
      /ניכוי\s*מס\s*[:\-]?\s*([\d,]+)/
    ]),
    exemptIncome: match([
      /048\s*[:\-]?\s*([\d,]+)/,
      /הכנסה\s*פטורה\s*[:\-]?\s*([\d,]+)/
    ]),
    pensionDeduction: match([
      /045[ab]?\s*[:\-]?\s*([\d,]+)/,
      /קרן\s*פנסיה\s*[:\-]?\s*([\d,]+)/,
      /גמל\s*[:\-]?\s*([\d,]+)/
    ])
  };
}

// =========================================================
// PDF UPLOAD — NATIONAL INSURANCE CERTIFICATE
// =========================================================
async function handleNIUpload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    showUploadStatus('ni', 'warning', 'יש להעלות קובץ PDF בלבד');
    return;
  }

  showUploadStatus('ni', 'loading', 'מעבד...');

  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const buf  = await file.arrayBuffer();
    const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;

    let text = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }

    const cleanNum = s => s.replace(/,/g, '').replace(/\s/g, '');

    const incomePatterns = [
      /דמי\s*אבטלה\s*ברוטו\s*בסך\s*[:\-]?\s*([\d,]+)/,
      /שילמנו\s*לך[^:]*בסך\s*[:\-]?\s*([\d,]+)/,
      /סה"כ\s*לתשלום\s*[:\-]?\s*([\d,]+)/,
      /סכום\s*שנתי\s*[:\-]?\s*([\d,]+)/,
      /סכום\s*ברוטו\s*[:\-]?\s*([\d,]+)/,
      /תשלום\s*שנתי\s*[:\-]?\s*([\d,]+)/
    ];

    const taxPatterns = [
      /נוכה\s*מס\s*הכנסה\s*בסך\s*[:\-]?\s*([\d,]+)/,
      /מס\s*הכנסה\s*[:\-]?\s*([\d,]+)/,
      /ניכוי\s*מס\s*[:\-]?\s*([\d,]+)/
    ];

    let filled = 0;

    for (const p of incomePatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const val = cleanNum(m[1]);
        if (parseInt(val) > 500) {
          document.getElementById('ni-amount').value = val;
          filled++;
          break;
        }
      }
    }

    for (const p of taxPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const val = cleanNum(m[1]);
        if (parseInt(val) >= 0) {
          const el = document.getElementById('ni-tax-withheld');
          if (el) { el.value = val; filled++; }
          break;
        }
      }
    }

    if (filled > 0) {
      showUploadStatus('ni', 'success', `✓ זוהו ${filled} שדות אוטומטית — אנא בדוק ותקן במידת הצורך`);
      return;
    }

    showUploadStatus('ni', 'warning', '⚠ לא זוהה סכום — הזן ידנית');
  } catch (e) {
    showUploadStatus('ni', 'warning', '⚠ שגיאה בעיבוד הקובץ');
  }
}

function showUploadStatus(type, status, msg) {
  const id = type === 'form106' ? 'upload-status' : 'ni-upload-status';
  const el = document.getElementById(id);
  if (!el) return;

  if (status === 'loading') {
    el.innerHTML = `<span class="spinner"></span> ${msg}`;
  } else if (status === 'success') {
    el.innerHTML = `<span class="success-text">${msg}</span>`;
  } else {
    el.innerHTML = `<span class="warning-text">${msg}</span>`;
  }
}

// =========================================================
// ACCESSIBILITY WIDGET
// =========================================================
const A11y = {
  state: { fontSize: 0, highContrast: false, underlineLinks: false, grayscale: false },

  init() {
    this._load();

    // If previously dismissed, hide widget and show restore link
    if (this._isDismissed()) {
      document.getElementById('acc-widget')?.classList.add('hidden');
      document.getElementById('restore-a11y-btn')?.classList.remove('hidden');
    }

    this._apply();

    const $ = id => document.getElementById(id);

    $('accessibility-toggle')?.addEventListener('click', () => this.toggle());
    $('acc-close')?.addEventListener('click',    () => this.close());
    $('acc-font-up')?.addEventListener('click',   () => this._font(1));
    $('acc-font-down')?.addEventListener('click', () => this._font(-1));
    $('acc-font-reset')?.addEventListener('click',() => this._font(0, true));
    $('acc-contrast')?.addEventListener('click',  () => this._toggle('highContrast', 'acc-contrast'));
    $('acc-links')?.addEventListener('click',     () => this._toggle('underlineLinks', 'acc-links'));
    $('acc-grayscale')?.addEventListener('click', () => this._toggle('grayscale', 'acc-grayscale'));
    $('acc-reset-all')?.addEventListener('click', () => this._reset());
    $('acc-dismiss')?.addEventListener('click',   () => this.dismiss());
    $('restore-a11y-btn')?.addEventListener('click', () => this.restore());

    this._syncButtons();
  },

  toggle() {
    const panel = document.getElementById('acc-panel');
    const btn   = document.getElementById('accessibility-toggle');
    const isOpen = panel?.classList.toggle('open');
    btn?.setAttribute('aria-expanded', String(!!isOpen));
  },
  close() {
    document.getElementById('acc-panel')?.classList.remove('open');
    document.getElementById('accessibility-toggle')?.setAttribute('aria-expanded', 'false');
  },

  dismiss() {
    this.close();
    document.getElementById('acc-widget')?.classList.add('hidden');
    document.getElementById('restore-a11y-btn')?.classList.remove('hidden');
    try { localStorage.setItem('a11y_dismissed', '1'); } catch {}
  },

  restore() {
    document.getElementById('acc-widget')?.classList.remove('hidden');
    document.getElementById('restore-a11y-btn')?.classList.add('hidden');
    try { localStorage.removeItem('a11y_dismissed'); } catch {}
  },

  _isDismissed() {
    try { return localStorage.getItem('a11y_dismissed') === '1'; } catch { return false; }
  },

  _font(delta, reset = false) {
    this.state.fontSize = reset ? 0 : Math.max(-2, Math.min(5, this.state.fontSize + delta));
    this._apply();
    this._save();
  },

  _toggle(key, btnId) {
    this.state[key] = !this.state[key];
    document.getElementById(btnId)?.classList.toggle('active', this.state[key]);
    this._apply();
    this._save();
  },

  _reset() {
    this.state = { fontSize: 0, highContrast: false, underlineLinks: false, grayscale: false };
    this._apply();
    this._save();
    this._syncButtons();
  },

  _apply() {
    const root = document.documentElement;
    const size = 16 + this.state.fontSize * 2;
    root.style.fontSize = `${size}px`;

    root.classList.toggle('high-contrast',  this.state.highContrast);
    root.classList.toggle('underline-links',this.state.underlineLinks);
    root.classList.toggle('grayscale',       this.state.grayscale);

    const disp = document.getElementById('acc-font-size-display');
    if (disp) disp.textContent = `${size}px`;
  },

  _syncButtons() {
    const map = { highContrast:'acc-contrast', underlineLinks:'acc-links', grayscale:'acc-grayscale' };
    for (const [key, id] of Object.entries(map)) {
      document.getElementById(id)?.classList.toggle('active', this.state[key]);
    }
  },

  _save() {
    try { localStorage.setItem('a11y', JSON.stringify(this.state)); } catch {}
  },
  _load() {
    try {
      const s = localStorage.getItem('a11y');
      if (s) this.state = { ...this.state, ...JSON.parse(s) };
    } catch {}
  }
};

// =========================================================
// FAQ ACCORDION
// =========================================================
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

// =========================================================
// CONDITIONAL FIELDS
// =========================================================
function initConditionalFields() {
  // כפתור "הורה ראשי" - רק לגברים
  document.querySelectorAll('input[name="gender"]').forEach(r => {
    r.addEventListener('change', () => {
      const male = document.querySelector('input[name="gender"]:checked')?.value === 'male';
      document.getElementById('primary-caregiver-row')?.classList.toggle('hidden', !male);
    });
  });

  // שנת עלייה - רק לעולים
  document.getElementById('new-immigrant')?.addEventListener('change', function () {
    document.getElementById('immigrant-year-row')?.classList.toggle('hidden', !this.checked);
  });

  // הכנסות נוספות — show/hide sub-sections
  document.getElementById('has-ni')?.addEventListener('change', function () {
    document.getElementById('ni-section')?.classList.toggle('hidden', !this.checked);
  });

  document.getElementById('has-employer2')?.addEventListener('change', function () {
    document.getElementById('employer2-section')?.classList.toggle('hidden', !this.checked);
  });
}

// =========================================================
// FILE UPLOAD — Drag & Drop
// =========================================================
function initDropzones() {
  [
    { zoneId: 'form106-dropzone', inputId: 'form106-file', handler: handleForm106Upload },
    { zoneId: 'ni-dropzone',     inputId: 'ni-file',     handler: handleNIUpload }
  ].forEach(({ zoneId, inputId, handler }) => {
    const zone  = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { if (input.files[0]) handler(input.files[0]); });

    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handler(file);
    });
  });
}

// =========================================================
// SMOOTH SCROLL CTA
// =========================================================
function initCTA() {
  document.getElementById('start-btn')?.addEventListener('click', () => {
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// =========================================================
// INIT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  A11y.init();
  initConditionalFields();
  initDropzones();
  initFAQ();
  initCTA();

  document.getElementById('prev-btn')?.addEventListener('click', prevStep);

  updateProgress();
  updateNavButtons();
});
