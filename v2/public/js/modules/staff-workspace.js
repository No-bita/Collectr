import { el, escapeHtml } from '../core/dom.js';

// DEMO WORKSPACE: a clickable simulation of the staff product. Nothing here talks to a backend.
// All state lives in this browser (localStorage). "Reset demo data" restores the seed below.
// The status transitions mirror v2/src/domain/states.js so the demo behaves like the real thing.
const STORE_KEY = 'collectr-demo-workspace-v1';
const FIRM = 'Rao & Associates';
const labels = { missing: 'Missing', received: 'Received', under_review: 'Under review', accepted: 'Accepted', needs_replacement: 'Needs replacement', waived: 'Waived', closed: 'Closed' };
const TRANSITIONS = {
  missing: ['received', 'waived'],
  received: ['under_review', 'accepted', 'needs_replacement'],
  under_review: ['accepted', 'needs_replacement'],
  needs_replacement: ['received', 'waived'],
};
const TEMPLATES = {
  'GST filing': [['Sales register', 'Sales for the filing period.'], ['Purchase register', 'Purchases for the filing period.'], ['GSTR-2A / 2B reconciliation', 'Download from the GST portal for the period.'], ['Bank statement', 'Statement covering the full period.']],
  'ITR preparation': [['PAN and Aadhaar', 'Masked Aadhaar is fine.'], ['Form 16', 'Employer-issued tax certificate.'], ['Bank statement', 'Statement for the financial year.'], ['Form 26AS / AIS', 'Download from the income tax portal.'], ['Rent receipts', 'Only if you claim HRA.', false]],
  'Statutory audit': [['Trial balance', 'Final trial balance for the year.'], ['Fixed asset register', 'With additions and disposals.'], ['Bank confirmations', 'Year-end balance confirmation letters.'], ['Stock statement', 'Closing stock with valuation.']],
  'GST annual return': [['GSTR-1 summary', 'All twelve months.'], ['GSTR-3B summary', 'All twelve months.'], ['Books of accounts', 'Ledger export for the year.']],
};
const FILE_SIZES = ['184 KB', '412 KB', '1.2 MB', '2.6 MB', '730 KB'];

const it = (title, description, status, file, extra = {}) => ({ id: `i${Math.random().toString(36).slice(2, 8)}`, title, description, status, required: extra.required !== false, file: file || '', reason: extra.reason || '', size: file ? FILE_SIZES[(file.length) % FILE_SIZES.length] : '', uploaded: file ? extra.uploaded || '12 Oct, 4:10 pm' : '' });
function seed() {
  return [
    { id: 'REQ-2041', client: 'Sharma Textiles Pvt Ltd', contact: 'Vikram Sharma', phone: '+91 98200 11452', title: 'GSTR-3B, September 2026', service: 'GST filing', period: 'Sep 2026', due: '2026-10-20', lifecycle: 'open', token: 'xk3p9qd2', items: [
      it('Sales register', 'Sales for the filing period.', 'accepted', 'sales-register-sep26.xlsx', { uploaded: '9 Oct, 11:32 am' }),
      it('Purchase register', 'Purchases for the filing period.', 'received', 'purchase-register-sep26.xlsx', { uploaded: '13 Oct, 10:05 am' }),
      it('GSTR-2A / 2B reconciliation', 'Download from the GST portal for the period.', 'missing', ''),
      it('Bank statement', 'Statement covering the full period.', 'needs_replacement', 'hdfc-stmt-sep.pdf', { reason: 'Pages 3 and 4 are cut off. Please send the full statement.', uploaded: '10 Oct, 6:48 pm' }),
    ], log: ['13 Oct, 10:05 am|Client uploaded Purchase register', '12 Oct, 9:15 am|Reminder sent on WhatsApp', '10 Oct, 7:30 pm|Asked for a replacement: Bank statement', '10 Oct, 6:48 pm|Client uploaded Bank statement', '9 Oct, 2:10 pm|Accepted Sales register', '9 Oct, 11:32 am|Client uploaded Sales register', '8 Oct, 5:00 pm|Request created and link shared'] },
    { id: 'REQ-2040', client: 'Priya Nair', contact: 'Priya Nair', phone: '+91 98450 22871', title: 'ITR, AY 2026-27', service: 'ITR preparation', period: 'AY 2026-27', due: '2026-10-31', lifecycle: 'open', token: 'mq7r1zt8', items: [
      it('PAN and Aadhaar', 'Masked Aadhaar is fine.', 'accepted', 'pan-aadhaar-priya.pdf', { uploaded: '7 Oct, 8:20 pm' }),
      it('Form 16', 'Employer-issued tax certificate.', 'received', 'form16-2025-26.pdf', { uploaded: '13 Oct, 9:40 am' }),
      it('Bank statement', 'Statement for the financial year.', 'under_review', 'sbi-stmt-fy26.pdf', { uploaded: '12 Oct, 7:02 pm' }),
      it('Form 26AS / AIS', 'Download from the income tax portal.', 'missing', ''),
      it('Rent receipts', 'Only if you claim HRA.', 'missing', '', { required: false }),
    ], log: ['13 Oct, 9:40 am|Client uploaded Form 16', '12 Oct, 7:02 pm|Client uploaded Bank statement', '7 Oct, 8:20 pm|Client uploaded PAN and Aadhaar', '7 Oct, 10:00 am|Request created and link shared'] },
    { id: 'REQ-2039', client: 'Kapoor & Sons', contact: 'Arun Kapoor', phone: '+91 99100 76310', title: 'Statutory audit FY 2025-26', service: 'Statutory audit', period: 'FY 2025-26', due: '2026-11-15', lifecycle: 'open', token: 'b8w4nc6e', items: [
      it('Trial balance', 'Final trial balance for the year.', 'received', 'tb-fy26-final.xlsx', { uploaded: '13 Oct, 12:20 pm' }),
      it('Fixed asset register', 'With additions and disposals.', 'received', 'far-fy26.xlsx', { uploaded: '13 Oct, 12:24 pm' }),
      it('Bank confirmations', 'Year-end balance confirmation letters.', 'missing', ''),
      it('Stock statement', 'Closing stock with valuation.', 'missing', ''),
    ], log: ['13 Oct, 12:24 pm|Client uploaded Fixed asset register', '13 Oct, 12:20 pm|Client uploaded Trial balance', '11 Oct, 3:00 pm|Request created and link shared'] },
    { id: 'REQ-2038', client: 'Rahul Menon', contact: 'Rahul Menon', phone: '+91 98765 40021', title: 'ITR, AY 2026-27', service: 'ITR preparation', period: 'AY 2026-27', due: '2026-10-25', lifecycle: 'open', token: 'd5h2yv9a', items: [
      it('PAN and Aadhaar', 'Masked Aadhaar is fine.', 'accepted', 'pan-aadhaar-rm.pdf', { uploaded: '4 Oct, 10:10 am' }),
      it('Form 16', 'Employer-issued tax certificate.', 'accepted', 'form16-rm.pdf', { uploaded: '4 Oct, 10:12 am' }),
      it('Bank statement', 'Statement for the financial year.', 'accepted', 'icici-fy26.pdf', { uploaded: '5 Oct, 6:30 pm' }),
      it('Form 26AS / AIS', 'Download from the income tax portal.', 'waived', '', { reason: 'AIS pulled by the firm directly.' }),
    ], log: ['12 Oct, 4:45 pm|Waived Form 26AS / AIS: AIS pulled by the firm directly.', '12 Oct, 4:40 pm|Accepted Bank statement', '5 Oct, 6:30 pm|Client uploaded Bank statement', '4 Oct, 10:00 am|Request created and link shared'] },
    { id: 'REQ-2042', client: 'Anand Logistics', contact: 'Deepa Anand', phone: '+91 98111 90456', title: 'GSTR-3B, September 2026', service: 'GST filing', period: 'Sep 2026', due: '2026-10-20', lifecycle: 'open', token: 'r2k8ms4j', items: TEMPLATES['GST filing'].map(([t, d, r]) => it(t, d, 'missing', '', { required: r !== false })), log: ['13 Oct, 1:10 pm|Request created and link shared'] },
    { id: 'REQ-2037', client: 'Verma Pharma', contact: 'Sanjay Verma', phone: '+91 97300 55218', title: 'GSTR-9, FY 2025-26', service: 'GST annual return', period: 'FY 2025-26', due: '2026-12-31', lifecycle: 'open', token: 'z9c3tf1u', items: [
      it('GSTR-1 summary', 'All twelve months.', 'accepted', 'gstr1-fy26.pdf', { uploaded: '2 Oct, 3:15 pm' }),
      it('GSTR-3B summary', 'All twelve months.', 'under_review', 'gstr3b-fy26.pdf', { uploaded: '11 Oct, 5:05 pm' }),
      it('Books of accounts', 'Ledger export for the year.', 'received', 'ledger-export-fy26.xlsx', { uploaded: '12 Oct, 11:50 am' }),
    ], log: ['12 Oct, 11:50 am|Client uploaded Books of accounts', '11 Oct, 5:05 pm|Client uploaded GSTR-3B summary', '2 Oct, 3:15 pm|Client uploaded GSTR-1 summary', '1 Oct, 9:00 am|Request created and link shared'] },
    { id: 'REQ-2036', client: 'Meera Iyer Studio', contact: 'Meera Iyer', phone: '+91 98860 31407', title: 'GSTR-3B, August 2026', service: 'GST filing', period: 'Aug 2026', due: '2026-09-20', lifecycle: 'closed', token: 'p6j1ge5w', items: [
      it('Sales register', 'Sales for the filing period.', 'accepted', 'sales-aug.xlsx', { uploaded: '12 Sep, 1:00 pm' }),
      it('Purchase register', 'Purchases for the filing period.', 'accepted', 'purchases-aug.xlsx', { uploaded: '12 Sep, 1:02 pm' }),
      it('Bank statement', 'Statement covering the full period.', 'accepted', 'axis-aug.pdf', { uploaded: '13 Sep, 9:30 am' }),
    ], log: ['18 Sep, 11:00 am|Request closed', '16 Sep, 4:00 pm|Accepted Bank statement', '1 Sep, 10:00 am|Request created and link shared'] },
  ];
}

let requests = load();
let activeFilter = 'all';
let query = '';
let clientOpenFor = null;

function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* storage blocked: run in memory */ }
  return seed();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(requests)); } catch (e) { /* in-memory only */ } }
const find = (id) => requests.find(r => r.id === id);
const nowLabel = () => new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', ',').replace(/\b(am|pm)\b/i, m => m.toLowerCase());
const fmtDue = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const addLog = (r, text) => r.log.unshift(`${nowLabel()}|${text}`);

function collectionState(r) {
  if (r.lifecycle === 'closed') return 'closed';
  const req = r.items.filter(i => i.required);
  if (!req.length || req.some(i => ['missing', 'needs_replacement'].includes(i.status))) return 'missing';
  if (req.every(i => ['accepted', 'waived'].includes(i.status))) return 'accepted';
  return 'received';
}
const progress = (r) => { const req = r.items.filter(i => i.required); return `${req.filter(i => ['accepted', 'waived'].includes(i.status)).length} / ${req.length}`; };
const badge = (s) => `<span class="state-badge state-${escapeHtml(s)}">${escapeHtml(labels[s])}</span>`;

function transition(r, item, to, text, reason = '') {
  if (!(TRANSITIONS[item.status] || []).includes(to)) return false;
  item.status = to;
  item.reason = reason; // a new decision replaces the old note
  addLog(r, text);
  save();
  return true;
}
function toast(msg) {
  const t = el('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}
const shareLink = (r) => `https://collectr.demo/upload?t=${r.token}`;

/* ---------- list ---------- */
function renderList() {
  const filters = ['all', 'missing', 'received', 'accepted', 'closed'];
  el('request-stats').innerHTML = filters.map(f => {
    const n = f === 'all' ? requests.length : requests.filter(r => collectionState(r) === f).length;
    return `<button type="button" class="stat-filter" data-filter="${f}" aria-pressed="${activeFilter === f}"><strong>${n}</strong><span>${f === 'all' ? 'All requests' : labels[f]}</span></button>`;
  }).join('');
  const visible = requests.filter(r => (activeFilter === 'all' || collectionState(r) === activeFilter) && `${r.client} ${r.title} ${r.service} ${r.id}`.toLowerCase().includes(query));
  el('result-count').textContent = `${visible.length} of ${requests.length} requests shown`;
  el('request-rows').innerHTML = visible.map(r => `<tr>
    <td><strong>${escapeHtml(r.client)}</strong><small>${escapeHtml(r.title)} / ${escapeHtml(r.id)}</small></td>
    <td data-label="Service">${escapeHtml(r.service)}<small>${escapeHtml(r.period)}</small></td>
    <td data-label="Due">${escapeHtml(fmtDue(r.due))}</td>
    <td data-label="Accepted / waived">${progress(r)}<small>required items</small></td>
    <td data-label="Collection state">${badge(collectionState(r))}</td>
    <td><a class="detail-link" href="#request/${escapeHtml(r.id)}" aria-label="Open ${escapeHtml(r.client)} request ${escapeHtml(r.id)}">Open request</a></td>
  </tr>`).join('');
  el('empty-state').hidden = visible.length > 0;
  document.querySelector('.table-wrap').hidden = visible.length === 0;
}

/* ---------- detail ---------- */
function itemActions(r, i) {
  if (r.lifecycle === 'closed') return '';
  const a = (act, label, cls = '') => `<button type="button" class="${cls}" data-act="${act}" data-item="${escapeHtml(i.id)}">${label}</button>`;
  if (i.status === 'missing') return `<div class="item-actions">${a('remind', 'Send reminder')}${a('waive', 'Waive')}</div>`;
  if (i.status === 'needs_replacement') return `<div class="item-actions">${a('remind', 'Send reminder')}${a('waive', 'Waive')}</div>`;
  if (['received', 'under_review'].includes(i.status)) return `<div class="item-actions">${a('review', 'Review document', 'primary')}</div>`;
  return `<div class="item-actions">${a('view', 'View file')}</div>`;
}
function renderDetail(r) {
  const state = collectionState(r);
  const closed = r.lifecycle === 'closed';
  const canClose = !closed && state === 'accepted';
  const items = r.items.map(i => `<li id="item-${escapeHtml(i.id)}"><div class="item-heading"><div><h3>${escapeHtml(i.title)}</h3><small>${i.required ? 'Required' : 'Optional'}</small></div>${badge(i.status)}</div>
    <p class="item-description">${escapeHtml(i.description)}</p>
    ${i.reason ? `<p class="item-reason">${i.status === 'needs_replacement' ? 'Replacement requested: ' : i.status === 'waived' ? 'Waived: ' : 'Note: '}${escapeHtml(i.reason)}</p>` : ''}
    <span class="file-label">${i.file ? `${escapeHtml(i.file)} / ${escapeHtml(i.size)} / uploaded ${escapeHtml(i.uploaded)}` : 'Nothing uploaded yet'}</span>
    ${itemActions(r, i)}<div class="inline-slot" data-slot="${escapeHtml(i.id)}"></div></li>`).join('');
  const log = r.log.map(l => { const [t, ...rest] = l.split('|'); return `<li><time>${escapeHtml(t)}</time><span>${escapeHtml(rest.join('|'))}</span></li>`; }).join('');
  el('detail-view').innerHTML = `<a class="back-link" href="#requests">← All requests</a>
    <div class="page-heading"><div><p class="eyebrow">${escapeHtml(r.id)} / ${escapeHtml(r.client)}</p><h1 id="detail-heading" tabindex="-1">${escapeHtml(r.title)}</h1><p>${escapeHtml(r.service)} / ${escapeHtml(r.period)} / ${escapeHtml(r.contact)}, ${escapeHtml(r.phone)}</p></div>${badge(state)}</div>
    <div class="detail-meta"><span>Due: ${escapeHtml(fmtDue(r.due))}</span><span>Request: ${closed ? 'Closed' : 'Open'}</span><span>${progress(r)} required items accepted or waived</span></div>
    <div class="detail-grid"><section class="detail-card" aria-labelledby="checklist-heading"><h2 id="checklist-heading">Document checklist</h2><p>Receipt means a file arrived. Acceptance requires staff review.</p><ul class="checklist">${items}</ul></section>
    <div class="side-stack"><aside class="detail-card" aria-labelledby="next-heading"><h2 id="next-heading">Client link</h2>
      ${closed ? '<p>This request is closed, so the client link no longer takes uploads.</p>' : `<p>The client opens this on their phone. No account needed.</p><div class="link-box"><code>${escapeHtml(shareLink(r))}</code></div>
      <button type="button" data-act="copy-link">Copy link</button><button type="button" data-act="share-wa">Share on WhatsApp</button><button type="button" data-act="client-view" class="primary">Preview client upload</button>`}
      <h2 class="side-h">Close request</h2>
      ${closed ? '<p>Closed. Nothing more to do here.</p>' : `<p>${canClose ? 'Every required item is accepted or waived.' : 'Available once every required item is accepted or waived.'}</p><button type="button" data-act="close" ${canClose ? '' : 'disabled'}>Close request</button>`}
    </aside>
    <aside class="detail-card" aria-labelledby="activity-heading"><h2 id="activity-heading">Activity</h2><ol class="activity">${log}</ol></aside></div></div>`;
}

/* ---------- routing ---------- */
function route(focus = false) {
  const hash = window.location.hash;
  const id = hash.startsWith('#request/') ? hash.slice('#request/'.length) : null;
  const r = find(id);
  el('requests-view').hidden = Boolean(id);
  el('detail-view').hidden = !id;
  if (id && r) renderDetail(r);
  else if (id) el('detail-view').innerHTML = '<a class="back-link" href="#requests">← All requests</a><h1 id="detail-heading" tabindex="-1">Request not found</h1><p>No request with that ID in this demo workspace.</p>';
  else renderList();
  const nav = document.querySelectorAll('.workspace-header nav a');
  nav.forEach(l => l.removeAttribute('aria-current'));
  nav[hash === '#guide' ? 1 : 0].setAttribute('aria-current', 'page');
  if (focus) {
    const t = hash === '#guide' ? el('guide-heading') : id ? el('detail-heading') : el('requests-heading');
    t.focus(); t.scrollIntoView({ block: 'start' });
  }
}
const refresh = () => { route(false); if (clientOpenFor) renderClient(); };

/* ---------- modal ---------- */
function openModal(html) {
  const m = el('modal'); m.innerHTML = html;
  if (!m.open) m.showModal();
}
function closeModal() { const m = el('modal'); if (m.open) m.close(); clientOpenFor = null; }
el('modal').addEventListener('click', e => { if (e.target === el('modal') || e.target.closest('[data-close]')) closeModal(); });
el('modal').addEventListener('cancel', () => { clientOpenFor = null; });

/* ---------- new request ---------- */
function newRequestForm() {
  const services = Object.keys(TEMPLATES);
  openModal(`<form id="new-form" class="modal-body" method="dialog"><h2 id="modal-title">New document request</h2><p>Pick a service and Collectr drafts the checklist. Edit it before you share the link.</p>
    <label>Client name<input name="client" required placeholder="e.g. Gupta Traders" autocomplete="off" /></label>
    <label>Contact person<input name="contact" placeholder="e.g. Neha Gupta" autocomplete="off" /></label>
    <label>WhatsApp number<input name="phone" required inputmode="tel" placeholder="+91 98XXX XXXXX" autocomplete="off" /></label>
    <label>Service<select name="service">${services.map(s => `<option>${escapeHtml(s)}</option>`).join('')}</select></label>
    <label>Period<input name="period" required placeholder="e.g. Oct 2026" /></label>
    <label>Due date<input name="due" type="date" required value="2026-11-05" /></label>
    <fieldset><legend>Checklist</legend><div id="nf-items"></div><button type="button" id="nf-add" class="link-button">+ Add a document</button></fieldset>
    <div class="modal-actions"><button type="button" data-close>Cancel</button><button type="submit" class="primary">Create request and get link</button></div></form>`);
  const form = el('new-form');
  const fill = () => {
    const tpl = TEMPLATES[form.service.value];
    el('nf-items').innerHTML = tpl.map(([t, , req]) => checkRow(t, req !== false)).join('');
  };
  const checkRow = (t, on) => `<label class="check-row"><input type="checkbox" ${on ? 'checked' : ''} data-title="${escapeHtml(t)}" /> ${escapeHtml(t)}</label>`;
  fill();
  form.service.addEventListener('change', fill);
  el('nf-add').addEventListener('click', () => {
    const name = window.prompt('Document name');
    if (name && name.trim()) el('nf-items').insertAdjacentHTML('beforeend', checkRow(name.trim(), true));
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const tpl = TEMPLATES[fd.get('service')];
    const picked = [...form.querySelectorAll('#nf-items input:checked')].map(c => c.dataset.title);
    if (!picked.length) { toast('Pick at least one document.'); return; }
    const n = Math.max(...requests.map(x => Number(x.id.slice(4)))) + 1;
    const r = { id: `REQ-${n}`, client: fd.get('client').trim(), contact: (fd.get('contact') || fd.get('client')).trim(), phone: fd.get('phone').trim(), title: `${fd.get('service')}, ${fd.get('period').trim()}`, service: fd.get('service'), period: fd.get('period').trim(), due: fd.get('due'), lifecycle: 'open', token: Math.random().toString(36).slice(2, 10), items: picked.map(t => { const m = tpl.find(x => x[0] === t); return it(t, m ? m[1] : 'Added by your CA team.', 'missing', ''); }), log: [] };
    addLog(r, 'Request created');
    requests.unshift(r); save();
    shareDialog(r);
  });
}
function shareDialog(r) {
  openModal(`<div class="modal-body"><h2 id="modal-title">Request created</h2><p>Share this link with ${escapeHtml(r.contact)}. They open it on their phone, no login needed.</p>
    <div class="link-box"><code>${escapeHtml(shareLink(r))}</code></div>
    <p class="wa-preview">Hi ${escapeHtml(r.contact.split(' ')[0])}, ${escapeHtml(FIRM)} needs a few documents for ${escapeHtml(r.title)}. Upload them here: ${escapeHtml(shareLink(r))}</p>
    <div class="modal-actions"><button type="button" data-act="copy-link" data-req="${escapeHtml(r.id)}">Copy link</button><button type="button" data-act="mark-shared" data-req="${escapeHtml(r.id)}">Mark as shared on WhatsApp</button><button type="button" class="primary" data-act="open-created" data-req="${escapeHtml(r.id)}">Open request</button></div>
    <p class="demo-hint">Demo only: this link is not live. Use "Preview client upload" on the request to see what the client sees.</p></div>`);
}

/* ---------- client simulation ---------- */
function renderClient() {
  const r = find(clientOpenFor); if (!r) return;
  const req = r.items.filter(i => i.status !== 'waived');
  const done = req.filter(i => ['received', 'under_review', 'accepted'].includes(i.status));
  const next = r.items.find(i => ['missing', 'needs_replacement'].includes(i.status));
  const all = !next;
  const rows = r.items.map(i => {
    const open = ['missing', 'needs_replacement'].includes(i.status);
    const tag = { missing: 'Upload file', needs_replacement: 'Upload a new file', received: '✓ Received', under_review: '✓ Received', accepted: '✓ Accepted', waived: 'Not needed' }[i.status];
    return `<li class="phone-row ${open ? 'open' : 'done'}"><div><strong>${escapeHtml(i.title)}</strong>${i.required ? '' : ' <small>optional</small>'}<small>${escapeHtml(i.status === 'needs_replacement' ? `Your CA team asked for another copy: ${i.reason}` : i.description)}</small></div>
      ${open && !all ? `<label class="upload-btn">${tag}<input type="file" hidden data-upload="${escapeHtml(i.id)}" accept="image/*,application/pdf" /></label>` : `<span class="phone-tag">${tag}</span>`}</li>`;
  }).join('');
  openModal(`<div class="modal-body client-sim"><div class="sim-bar"><span>Client view (simulation)</span><button type="button" data-close>Close</button></div>
    <div class="phone"><p class="phone-brand">${escapeHtml(FIRM)}</p><h2 id="modal-title">Namaste ${escapeHtml(r.contact.split(' ')[0])},</h2><p>${escapeHtml(FIRM)} would like a few documents by ${escapeHtml(fmtDue(r.due))}.</p>
    ${r.lifecycle === 'closed' ? '<div class="phone-receipt"><strong>This request is closed.</strong><span>Uploads are paused. Ask your CA team if you need anything else.</span></div>' : all ? '<div class="phone-receipt"><strong>Everything\'s sent. Nicely done.</strong><span>Nothing else to send. Your CA team will take it from here.</span></div>' : `<div class="phone-next"><small>Next up</small><strong>${escapeHtml(next.title)}</strong></div><p class="phone-progress">${done.length} of ${req.length} sent</p>`}
    <ul class="phone-list">${rows}</ul></div></div>`);
}

/* ---------- review ---------- */
function reviewDialog(r, i) {
  if (i.status === 'received') transition(r, i, 'under_review', `Started review: ${i.title}`);
  refreshBehind(r);
  openModal(`<div class="modal-body"><h2 id="modal-title">Review: ${escapeHtml(i.title)}</h2><p>${escapeHtml(r.client)} / ${escapeHtml(r.title)}</p>
    <div class="doc-preview" role="img" aria-label="Document preview placeholder"><div class="doc-page"><span></span><span></span><span></span><span></span><span></span></div><div><strong>${escapeHtml(i.file)}</strong><small>${escapeHtml(i.size)} / uploaded ${escapeHtml(i.uploaded)}</small><small>Preview is a placeholder in this demo.</small></div></div>
    <p>Check it is the right document and readable. Collectr does not read or verify the contents for you.</p>
    <label>If you need another copy, tell the client why<textarea id="rv-reason" rows="2" placeholder="e.g. The last page is cut off."></textarea></label>
    <div class="modal-actions"><button type="button" data-close>Decide later</button><button type="button" data-act="replace" data-req="${escapeHtml(r.id)}" data-item="${escapeHtml(i.id)}">Ask for replacement</button><button type="button" class="primary" data-act="accept" data-req="${escapeHtml(r.id)}" data-item="${escapeHtml(i.id)}">Accept</button></div></div>`);
}
const refreshBehind = (r) => { if (window.location.hash === `#request/${r.id}`) renderDetail(r); else route(false); };

/* ---------- inline waive form ---------- */
function waiveForm(i) {
  const slot = document.querySelector(`[data-slot="${i.id}"]`);
  slot.innerHTML = `<form class="inline-form" data-waive="${escapeHtml(i.id)}"><label>Why is this not needed?<input name="reason" required placeholder="e.g. Firm already has it" autocomplete="off" /></label><button type="submit" class="primary">Waive</button><button type="button" data-act="cancel-inline">Cancel</button></form>`;
  slot.querySelector('input').focus();
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  const id = t.dataset.req || (window.location.hash.startsWith('#request/') ? window.location.hash.slice(9) : null);
  const r = find(id);
  const item = r && r.items.find(x => x.id === t.dataset.item);
  const copy = async (txt) => { try { await navigator.clipboard.writeText(txt); toast('Link copied.'); } catch (err) { toast('Copy is blocked in this browser. Select the link and copy it.'); } };
  if (act === 'copy-link' && r) copy(shareLink(r));
  else if (act === 'share-wa' && r) { addLog(r, 'Shared the link on WhatsApp'); save(); renderDetail(r); toast('Marked as shared. In the real product this opens WhatsApp.'); }
  else if (act === 'mark-shared' && r) { addLog(r, 'Shared the link on WhatsApp'); save(); toast('Marked as shared.'); }
  else if (act === 'open-created' && r) { closeModal(); window.location.hash = `#request/${r.id}`; }
  else if (act === 'client-view' && r) { clientOpenFor = r.id; renderClient(); }
  else if (act === 'remind' && r && item) { addLog(r, `Reminder sent on WhatsApp: ${item.title}`); save(); renderDetail(r); toast('Reminder logged. In the real product it goes out on WhatsApp.'); }
  else if (act === 'waive' && item) waiveForm(item);
  else if (act === 'cancel-inline') t.closest('.inline-slot').innerHTML = '';
  else if (act === 'review' && r && item) reviewDialog(r, item);
  else if (act === 'view' && r && item) { openModal(`<div class="modal-body"><h2 id="modal-title">${escapeHtml(item.title)}</h2><div class="doc-preview"><div class="doc-page"><span></span><span></span><span></span><span></span><span></span></div><div><strong>${escapeHtml(item.file)}</strong><small>${escapeHtml(item.size)} / uploaded ${escapeHtml(item.uploaded)}</small><small>Preview is a placeholder in this demo.</small></div></div><div class="modal-actions"><button type="button" class="primary" data-close>Done</button></div></div>`); }
  else if (act === 'accept' && r && item) { if (transition(r, item, 'accepted', `Accepted ${item.title}`)) toast(`${item.title} accepted.`); closeModal(); refreshBehind(r); }
  else if (act === 'replace' && r && item) {
    const reason = (el('rv-reason').value || '').trim();
    if (!reason) { el('rv-reason').focus(); toast('Add a short reason so the client knows what to fix.'); return; }
    if (transition(r, item, 'needs_replacement', `Asked for a replacement: ${item.title}`, reason)) toast('Replacement requested. In the real product the client is told on WhatsApp.');
    closeModal(); refreshBehind(r);
  }
  else if (act === 'close' && r) { if (collectionState(r) === 'accepted') { r.lifecycle = 'closed'; addLog(r, 'Request closed'); save(); renderDetail(r); toast('Request closed.'); } }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-waive]'); if (!f) return;
  e.preventDefault();
  const r = find(window.location.hash.slice(9)); const i = r && r.items.find(x => x.id === f.dataset.waive);
  const reason = f.reason.value.trim();
  if (i && reason && transition(r, i, 'waived', `Waived ${i.title}: ${reason}`, reason)) { renderDetail(r); toast(`${i.title} waived.`); }
});
document.addEventListener('change', e => {
  const inp = e.target.closest('[data-upload]'); if (!inp || !inp.files.length) return;
  const r = find(clientOpenFor); const i = r && r.items.find(x => x.id === inp.dataset.upload);
  if (!i || r.lifecycle === 'closed') return;
  const f = inp.files[0];
  // Only the filename and size are read, the file itself never leaves the browser.
  i.file = f.name; i.size = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`; i.uploaded = nowLabel();
  if (transition(r, i, 'received', `Client uploaded ${i.title}`)) toast('Sent! Thank you. (Staff see it in the request now.)');
  refresh();
});
el('new-request').addEventListener('click', newRequestForm);
el('reset-demo').addEventListener('click', () => { requests = seed(); save(); activeFilter = 'all'; query = ''; el('request-search').value = ''; window.location.hash = '#requests'; route(false); toast('Demo data reset.'); });
el('request-search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderList(); });
el('request-stats').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  activeFilter = b.dataset.filter; renderList();
  document.querySelector(`[data-filter="${activeFilter}"]`).focus();
});
el('reset-filters').addEventListener('click', () => { activeFilter = 'all'; query = ''; el('request-search').value = ''; renderList(); el('request-search').focus(); });
window.addEventListener('hashchange', () => route(true));
route();
