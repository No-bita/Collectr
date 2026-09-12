/**
 * Collectrr Persona Variant Copy Matrix
 * Supports 'ca' (Chartered Accountant) and 'loan_agent' (Loan Broker / DSA) personas.
 */

window.VARIANT_COPY = {
  ca: {
    id: 'ca',
    name: 'Chartered Accountant',
    navLinkText: 'Built for CAs',
    heroBadge: 'Built for ITR season',
    heroTitleLead: 'Collect documents from ',
    heroTitleItalic: 'hundreds of clients',
    heroTitleTail: ' without endless follow ups.',
    heroSubtitle: 'Send one request, automatically follow up, and receive filing-ready submissions without chasing clients across WhatsApp and email.',
    bullet1: 'No client logins',
    bullet2: 'WhatsApp + Email reminders',
    bullet3: 'Reusable checklists',
    previewCardTitle: 'Collection: ITR FY 2024-25',
    problemBadge: 'The problem',
    problemTitle: 'ITR season shouldn\'t feel like running a call centre.',
    problem1Title: 'Documents arrive in fragments',
    problem1Body: 'Form 16 today, bank statement next week, capital gains never. You stitch the puzzle yourself.',
    problem2Title: 'Staff spends hours following up',
    problem2Body: 'Your team writes the same WhatsApp message to 200 clients. That\'s not accounting work.',
    problem3Title: 'Deadlines become chaotic',
    problem3Body: '31st July arrives and half your clients are still missing PAN copies or rental receipts.',
    ctaHeading: 'Ready to stop reminding clients?',
    ctaSubheading: 'Start your next collection in under 2 minutes.',
    ctaBtnText: 'Start collecting',
    dashboardPageTitle: 'Your Clients — Collectrr',
    dashboardHeader: 'Your Clients',
    dashboardNewBtn: '+ New Client',
    dashboardSearchPlaceholder: 'Search clients',
    filterAllCategories: 'All Categories',
    thCategory: 'Filing',
    wizardTitle: 'New Client',
    lblCategorySelect: 'Filing',
    optSelectCategory: 'Select Filing...',
    lblCustomCategory: 'New Custom Filing Name',
    btnCreateRequest: 'Create Request →',
    matrixTitle: 'Document Rules Matrix',
    matrixSubtitle: 'Configure which documents are recommended for each category.',
    matrixHeaderCategory: 'Filing',
    lblBackToCases: '← Back',
    lblLoanType: 'Filing',
    lblEditCaseBtn: 'Edit',
    lblEditModalTitle: 'Edit Client',
    lblBorrowerName: 'Client Name',
    lblDocProgress: 'Collection Progress',
    lblUploadLink: 'Collection Link',
    templates: [
      { name: 'GST — Monthly (GSTR-1 & 3B)', count: 4, active: true },
      { name: 'GST — Annual Return (GSTR-9 & 9C)', count: 6 },
      { name: 'GST — Registration Intake', count: 5 },
      { name: 'ITR — Salaried (ITR-1 / 2)', count: 6 },
      { name: 'ITR — Business (ITR-3 / 4)', count: 11 },
      { name: 'ITR — Capital Gains & NRI', count: 8 },
      { name: 'ITR — Tax Audit (Form 3CD)', count: 18 }
    ],
    sampleDocs: ['Form 16', 'PAN copy', 'Bank statement', 'Rent receipts', 'Interest certificate', 'Investment proofs']
  },
  loan_agent: {
    id: 'loan_agent',
    name: 'Loan Agent / DSA',
    navLinkText: 'Built for Loan Agents',
    heroBadge: 'Built for Loan Brokers & DSAs',
    heroTitleLead: 'Collect loan documents from ',
    heroTitleItalic: 'borrower clients',
    heroTitleTail: ' without endless follow ups.',
    heroSubtitle: 'Send one request link, automatically follow up, and collect income, KYC & property papers for faster loan sanctions.',
    bullet1: 'No borrower app install',
    bullet2: 'WhatsApp + Email reminders',
    bullet3: 'Pre-built loan checklists',
    previewCardTitle: 'Collection: Home Loan Sanction',
    problemBadge: 'The problem',
    problemTitle: 'Loan sanctioning shouldn\'t be stalled by missing papers.',
    problem1Title: 'Papers arrive in fragments',
    problem1Body: 'Payslips today, 6-month bank statement next week, ITR V never. You chase every paper yourself.',
    problem2Title: 'Agents spend hours chasing borrowers',
    problem2Body: 'Your team calls the same borrower 10 times for salary slips and Form 26AS. That delays payouts.',
    problem3Title: 'Bank login deadlines get missed',
    problem3Body: 'File login date arrives and bank rejects the application due to missing property chains or vintage proofs.',
    ctaHeading: 'Ready to speed up loan turnarounds?',
    ctaSubheading: 'Create your first loan collection in under 2 minutes.',
    ctaBtnText: 'Start collecting',
    dashboardPageTitle: 'Loan Collections — Collectrr',
    dashboardHeader: 'Loan Collections',
    dashboardNewBtn: '+ New Collection',
    dashboardSearchPlaceholder: 'Search borrower, loan ID, mobile...',
    filterAllCategories: 'All Collection Types',
    thCategory: 'Collection Type',
    wizardTitle: 'New Loan Collection',
    lblCategorySelect: 'Collection Type',
    optSelectCategory: 'Select Collection Type...',
    lblCustomCategory: 'New Custom Collection Type Name',
    btnCreateRequest: 'Create Collection →',
    matrixTitle: 'Document Collection Rules Matrix',
    matrixSubtitle: 'Configure which documents are recommended for each collection type.',
    matrixHeaderCategory: 'Loan Product',
    lblBackToCases: '← Back',
    lblLoanType: 'Collection Type',
    lblEditCaseBtn: 'Edit',
    lblEditModalTitle: 'Edit Client',
    lblBorrowerName: 'Borrower Name',
    lblDocProgress: 'Collection Progress',
    lblUploadLink: 'Collection Link',
    templates: [
      { name: 'Home Loan Pack', count: 8, active: true },
      { name: 'LAP (Property Loan)', count: 10 },
      { name: 'Business Loan', count: 7 },
      { name: 'Personal Loan Pack', count: 4 }
    ],
    sampleDocs: ['3-Mo Payslips', 'PAN & Aadhaar', '6-Mo Bank Stmt', 'Form 16 / ITR V', 'Property Title Deed', 'GST Return / Business Proof']
  },
  direct_outreach: {
    id: 'direct_outreach',
    name: 'Direct Outreach / Broadcast',
    navLinkText: 'Direct Outreach',
    heroBadge: 'Direct Target Outreach',
    heroTitleLead: 'Send direct messages to ',
    heroTitleItalic: 'your targets',
    heroTitleTail: ' without document links.',
    heroSubtitle: 'Upload target name, contact, and message template — no document collection link required.',
    bullet1: 'Direct WhatsApp outreach',
    bullet2: 'Custom message templates',
    bullet3: 'No document collection links',
    previewCardTitle: 'Campaign: Direct Client Notice',
    problemBadge: 'The problem',
    problemTitle: 'Manual message broadcasting takes hours.',
    problem1Title: 'High manual effort',
    problem1Body: 'Typing individual WhatsApp messages to hundreds of targets is slow.',
    problem2Title: 'No central delivery tracking',
    problem2Body: 'Hard to track which contact received your message.',
    problem3Title: 'Messy phone history',
    problem3Body: 'Personal phone threads blend together without a clean log.',
    ctaHeading: 'Ready to send direct messages?',
    ctaSubheading: 'Upload target name and contact to dispatch in seconds.',
    ctaBtnText: 'Start outreach',
    dashboardPageTitle: 'Direct Outreach — Collectrr',
    dashboardHeader: 'Direct Outreach',
    dashboardNewBtn: '+ New Target Outreach',
    dashboardSearchPlaceholder: 'Search target name or contact...',
    filterAllCategories: 'All Message Templates',
    thCategory: 'Message Template',
    wizardTitle: 'New Direct Outreach',
    lblCategorySelect: 'Message Template',
    optSelectCategory: 'Select Message Template...',
    lblCustomCategory: 'New Template Name',
    btnCreateRequest: 'Send Message →',
    matrixTitle: 'Message Templates Matrix',
    matrixSubtitle: 'Configure template definitions for direct outreach.',
    matrixHeaderCategory: 'Template',
    lblBackToCases: '← Back',
    lblLoanType: 'Template',
    lblEditCaseBtn: 'Edit',
    lblEditModalTitle: 'Edit Target',
    lblBorrowerName: 'Target Name',
    lblDocProgress: 'Delivery Status',
    lblUploadLink: 'Contact Phone',
    noDocsRequired: true,
    templates: [
      { name: 'General Announcement (hello_world)', count: 0, active: true },
      { name: 'Client Update Notice (new_convo_1)', count: 0 }
    ],
    sampleDocs: []
  }
};

window.getVariantKey = function () {
  const isDevHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  let isAdmin = isDevHost;
  try {
    const tokenHeader = localStorage.getItem('collectrr_auth');
    if (tokenHeader) {
      const rawToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();
      const parts = rawToken.split('.');
      if (parts.length === 3) {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const userObj = JSON.parse(payloadJson);
        isAdmin = userObj && (userObj.role === 'admin' || userObj.role === 'Admin');
      }
    }
  } catch (e) {}

  const urlParams = new URLSearchParams(window.location.search);
  const paramVariant = urlParams.get('variant');
  if (paramVariant && window.VARIANT_COPY[paramVariant]) {
    if (paramVariant === 'direct_outreach' && !isAdmin && !isDevHost) {
      // Fallback for non-admin users on production
    } else {
      localStorage.setItem('collectr_variant', paramVariant);
      return paramVariant;
    }
  }

  const path = window.location.pathname.toLowerCase();
  if ((path.includes('/direct-outreach') || path.includes('/outreach')) && (isAdmin || isDevHost)) {
    localStorage.setItem('collectr_variant', 'direct_outreach');
    return 'direct_outreach';
  }
  if (path.includes('/loan-agent')) {
    localStorage.setItem('collectr_variant', 'loan_agent');
    return 'loan_agent';
  }
  if (path.includes('/ca')) {
    localStorage.setItem('collectr_variant', 'ca');
    return 'ca';
  }

  const saved = localStorage.getItem('collectr_variant');
  if (saved && window.VARIANT_COPY[saved]) {
    if (saved === 'direct_outreach' && !isAdmin && !isDevHost) {
      localStorage.setItem('collectr_variant', 'ca');
      return 'ca';
    }
    return saved;
  }

  return 'ca'; // Default persona
};

window.setVariantKey = function (key) {
  const isDevHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  let isAdmin = isDevHost;
  try {
    const tokenHeader = localStorage.getItem('collectrr_auth');
    if (tokenHeader) {
      const rawToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();
      const parts = rawToken.split('.');
      if (parts.length === 3) {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const userObj = JSON.parse(payloadJson);
        isAdmin = userObj && (userObj.role === 'admin' || userObj.role === 'Admin');
      }
    }
  } catch (e) {}

  if (key === 'direct_outreach' && !isAdmin && !isDevHost) {
    return; // Block non-admin users from setting direct_outreach on production
  }

  if (window.VARIANT_COPY[key]) {
    localStorage.setItem('collectr_variant', key);
    window.applyVariantToDOM();
    if (typeof load === 'function') load();
  }
};

window.getVariantCopy = function (key) {
  const vKey = key || window.getVariantKey();
  return window.VARIANT_COPY[vKey] || window.VARIANT_COPY.ca;
};

window.applyVariantToDOM = function () {
  const copy = window.getVariantCopy();

  // Elements using data-variant-key attribute
  const elemMap = {
    heroBadge: copy.heroBadge,
    heroSubtitle: copy.heroSubtitle,
    bullet1: copy.bullet1,
    bullet2: copy.bullet2,
    bullet3: copy.bullet3,
    previewCardTitle: copy.previewCardTitle,
    problemBadge: copy.problemBadge,
    problemTitle: copy.problemTitle,
    problem1Title: copy.problem1Title,
    problem1Body: copy.problem1Body,
    problem2Title: copy.problem2Title,
    problem2Body: copy.problem2Body,
    problem3Title: copy.problem3Title,
    problem3Body: copy.problem3Body,
    ctaHeading: copy.ctaHeading,
    ctaSubheading: copy.ctaSubheading,
    dashboardHeader: copy.dashboardHeader,
    dashboardNewBtn: copy.dashboardNewBtn,
    filterAllCategories: copy.filterAllCategories,
    thCategory: copy.thCategory,
    wizardTitle: copy.wizardTitle,
    lblCategorySelect: copy.lblCategorySelect,
    optSelectCategory: copy.optSelectCategory,
    lblCustomCategory: copy.lblCustomCategory,
    btnCreateRequest: copy.btnCreateRequest,
    matrixTitle: copy.matrixTitle,
    matrixSubtitle: copy.matrixSubtitle,
    matrixHeaderCategory: copy.matrixHeaderCategory,
    lblBackToCases: copy.lblBackToCases,
    lblLoanType: copy.lblLoanType,
    lblEditCaseBtn: copy.lblEditCaseBtn,
    lblEditModalTitle: copy.lblEditModalTitle,
    lblBorrowerName: copy.lblBorrowerName,
    lblDocProgress: copy.lblDocProgress,
    lblUploadLink: copy.lblUploadLink
  };

  Object.keys(elemMap).forEach((key) => {
    const elems = document.querySelectorAll(`[data-variant-key="${key}"]`);
    elems.forEach((el) => {
      if (el) el.textContent = elemMap[key];
    });
  });

  // Dynamic Hero Title
  const heroHeading = document.getElementById('variantHeroTitle');
  if (heroHeading) {
    heroHeading.innerHTML = `${copy.heroTitleLead}<span class="font-display italic text-primary">${copy.heroTitleItalic}</span>${copy.heroTitleTail}`;
  }

  // Dashboard Page Title
  if (copy.dashboardPageTitle && document.title.includes('Collectrr')) {
    document.title = copy.dashboardPageTitle;
  }

  // Search input placeholder
  const searchInput = document.getElementById('search');
  if (searchInput && copy.dashboardSearchPlaceholder) {
    searchInput.placeholder = copy.dashboardSearchPlaceholder;
  }

  // Active persona toggle buttons
  const caToggleBtn = document.getElementById('personaToggleCA');
  const loanToggleBtn = document.getElementById('personaToggleLoan');
  const outreachToggleBtn = document.getElementById('personaToggleOutreach');

  [caToggleBtn, loanToggleBtn, outreachToggleBtn].forEach(btn => {
    if (btn) {
      btn.style.background = 'transparent';
      btn.style.color = '#6E6A62';
      btn.style.fontWeight = '500';
    }
  });

  if (copy.id === 'ca' && caToggleBtn) {
    caToggleBtn.style.background = '#171717';
    caToggleBtn.style.color = '#ffffff';
    caToggleBtn.style.fontWeight = '600';
  } else if (copy.id === 'loan_agent' && loanToggleBtn) {
    loanToggleBtn.style.background = '#171717';
    loanToggleBtn.style.color = '#ffffff';
    loanToggleBtn.style.fontWeight = '600';
  } else if (copy.id === 'direct_outreach' && outreachToggleBtn) {
    outreachToggleBtn.style.background = '#171717';
    outreachToggleBtn.style.color = '#ffffff';
    outreachToggleBtn.style.fontWeight = '600';
  }

  // Direct Outreach has no document requirements - hide Document Rules configurator, hide Category/Loan Product, show WhatsApp Message Template
  const btnDocMapping = document.getElementById('btnOpenDocMappingModal');
  const loanProductGroup = document.getElementById('loanProductGroup');
  const outreachTemplateGroup = document.getElementById('outreachTemplateGroup');
  const amountRequiredGroup = document.getElementById('amountRequiredGroup');

  if (copy.id === 'direct_outreach') {
    if (btnDocMapping) {
      btnDocMapping.hidden = true;
      btnDocMapping.style.setProperty('display', 'none', 'important');
    }
    if (loanProductGroup) {
      loanProductGroup.hidden = true;
      loanProductGroup.style.setProperty('display', 'none', 'important');
    }
    if (outreachTemplateGroup) {
      outreachTemplateGroup.hidden = false;
      outreachTemplateGroup.style.setProperty('display', 'flex', 'important');
    }
    if (amountRequiredGroup) {
      amountRequiredGroup.hidden = true;
      amountRequiredGroup.style.setProperty('display', 'none', 'important');
    }
  } else {
    if (btnDocMapping) {
      btnDocMapping.hidden = false;
      btnDocMapping.style.removeProperty('display');
    }
    if (loanProductGroup) {
      loanProductGroup.hidden = false;
      loanProductGroup.style.removeProperty('display');
    }
    if (outreachTemplateGroup) {
      outreachTemplateGroup.hidden = true;
      outreachTemplateGroup.style.setProperty('display', 'none', 'important');
    }
    if (amountRequiredGroup) {
      const showAmount = (copy.id === 'loan_agent');
      amountRequiredGroup.hidden = !showAmount;
      if (showAmount) {
        amountRequiredGroup.style.removeProperty('display');
      } else {
        amountRequiredGroup.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // Triage cards: 2 cards (Docs Pending, Ready for Review) for standard modes, 4 cards (Sent, Delivered, Read, Replied) for Direct Outreach
  const triagePending = document.getElementById('triageCardPending');
  const triageReview = document.getElementById('triageCardReview');
  const outreachTriageCards = ['triageCardSent', 'triageCardDelivered', 'triageCardRead', 'triageCardReplied'].map(id => document.getElementById(id));

  if (copy.id === 'direct_outreach') {
    if (triagePending) {
      triagePending.hidden = true;
      triagePending.classList.add('is-hidden');
    }
    if (triageReview) {
      triageReview.hidden = true;
      triageReview.classList.add('is-hidden');
    }
    outreachTriageCards.forEach(c => {
      if (c) {
        c.hidden = false;
        c.classList.remove('is-hidden');
      }
    });
  } else {
    if (triagePending) {
      triagePending.hidden = false;
      triagePending.classList.remove('is-hidden');
    }
    if (triageReview) {
      triageReview.hidden = false;
      triageReview.classList.remove('is-hidden');
    }
    outreachTriageCards.forEach(c => {
      if (c) {
        c.hidden = true;
        c.classList.add('is-hidden');
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.applyVariantToDOM();
});
