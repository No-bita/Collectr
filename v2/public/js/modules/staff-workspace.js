import { el, escapeHtml } from '../core/dom.js';

// PREVIEW ONLY: fictional fixtures, no API calls, tokens, files or persistence.
// TODO #2: replace fixtures with authenticated, firm-scoped requests/checklists.
// TODO #5: read confirmed document/version metadata; never infer receipt from a filename.
// TODO #8: replace collectionState() with the server's authoritative progress projection.
// Request lifecycle (draft/open/closed/cancelled) is separate from collection state.
// TODO #10: connect review actions only after authenticated review endpoints exist.
const requests = [
  { id: 'DEMO-001', client: 'Sample Client A', title: 'Quarterly GST documents', service: 'GST filing', period: 'Sample quarter', due: '18 Oct (sample)', lifecycle: 'Open', items: [
    { title: 'Sales register', description: 'Sales for the filing period.', status: 'missing', required: true },
    { title: 'Purchase register', description: 'Purchases for the filing period.', status: 'received', required: true, file: 'sample-purchases.pdf' },
    { title: 'Bank statement', description: 'Statement covering the full period.', status: 'accepted', required: true, file: 'sample-statement.pdf' },
  ] },
  { id: 'DEMO-002', client: 'Sample Client B', title: 'Income tax documents', service: 'ITR preparation', period: 'Sample financial year', due: '20 Oct (sample)', lifecycle: 'Open', items: [
    { title: 'Form 16', description: 'Employer-issued tax certificate.', status: 'received', required: true, file: 'sample-form16.pdf' },
    { title: 'Bank statement', description: 'Statement for the financial year.', status: 'under_review', required: true, file: 'sample-bank.pdf' },
  ] },
  { id: 'DEMO-003', client: 'Sample Client C', title: 'Loan application checklist', service: 'Loan intake', period: 'Sample application', due: '22 Oct (sample)', lifecycle: 'Open', items: [
    { title: 'Identity document', description: 'A clear copy of the requested identity document.', status: 'accepted', required: true, file: 'sample-identity.pdf' },
    { title: 'Income proof', description: 'Latest income proof.', status: 'accepted', required: true, file: 'sample-income.pdf' },
    { title: 'Additional statement', description: 'Waived by staff in this fictional example.', status: 'waived', required: true },
  ] },
  { id: 'DEMO-004', client: 'Sample Client D', title: 'Business onboarding', service: 'Client intake', period: 'Sample business', due: '24 Oct (sample)', lifecycle: 'Open', items: [
    { title: 'Registration certificate', description: 'Replacement requested: please provide a readable copy.', status: 'needs_replacement', required: true, file: 'sample-blurred-copy.jpg' },
    { title: 'Address proof', description: 'Current business address.', status: 'missing', required: true },
    { title: 'Supporting note', description: 'Optional context for staff.', status: 'missing', required: false },
  ] },
];
const labels = { missing: 'Missing', received: 'Received', under_review: 'Under review', accepted: 'Accepted', needs_replacement: 'Needs replacement', waived: 'Waived' };
let activeFilter = 'all';
let query = '';

function collectionState(request) {
  const required = request.items.filter(item => item.required);
  // Empty requirements must not appear completed.
  if (!required.length || required.some(item => ['missing', 'needs_replacement'].includes(item.status))) return 'missing';
  if (required.every(item => ['accepted', 'waived'].includes(item.status))) return 'accepted';
  return 'received';
}
function progress(request) {
  const required = request.items.filter(item => item.required);
  return `${required.filter(item => ['accepted', 'waived'].includes(item.status)).length} / ${required.length}`;
}
function badge(status) {
  return `<span class="state-badge state-${escapeHtml(status)}">${escapeHtml(labels[status])}</span>`;
}
function renderList() {
  el('request-stats').innerHTML = ['all', 'missing', 'received', 'accepted'].map(filter => {
    const count = filter === 'all' ? requests.length : requests.filter(request => collectionState(request) === filter).length;
    return `<button type="button" class="stat-filter" data-filter="${filter}" aria-pressed="${activeFilter === filter}"><strong>${count}</strong><span>${filter === 'all' ? 'All requests' : labels[filter]}</span></button>`;
  }).join('');
  const visible = requests.filter(request => (activeFilter === 'all' || collectionState(request) === activeFilter) && `${request.client} ${request.title} ${request.service} ${request.id}`.toLowerCase().includes(query));
  el('result-count').textContent = `${visible.length} of ${requests.length} sample requests shown`;
  el('request-rows').innerHTML = visible.map(request => `<tr>
    <td><strong>${escapeHtml(request.client)}</strong><small>${escapeHtml(request.title)} / ${escapeHtml(request.id)}</small></td>
    <td data-label="Service">${escapeHtml(request.service)}<small>${escapeHtml(request.period)}</small></td>
    <td data-label="Due">${escapeHtml(request.due)}</td>
    <td data-label="Accepted / waived">${progress(request)}<small>required items</small></td>
    <td data-label="Collection state">${badge(collectionState(request))}</td>
    <td><a class="detail-link" href="#request/${escapeHtml(request.id)}" aria-label="Open ${escapeHtml(request.client)} request ${escapeHtml(request.id)}">Open request</a></td>
  </tr>`).join('');
  el('empty-state').hidden = visible.length > 0;
  document.querySelector('.table-wrap').hidden = visible.length === 0;
}
function renderDetail(request) {
  el('detail-view').innerHTML = `<a class="back-link" href="#requests">← All requests</a>
    <div class="page-heading"><div><p class="eyebrow">${escapeHtml(request.id)} / ${escapeHtml(request.client)}</p><h1 id="detail-heading" tabindex="-1">${escapeHtml(request.title)}</h1><p>${escapeHtml(request.service)} / ${escapeHtml(request.period)}</p></div>${badge(collectionState(request))}</div>
    <div class="detail-meta"><span>Due: ${escapeHtml(request.due)}</span><span>Request lifecycle: ${escapeHtml(request.lifecycle)}</span><span>${progress(request)} required items accepted or waived</span></div>
    <div class="detail-grid"><section class="detail-card" aria-labelledby="checklist-heading"><h2 id="checklist-heading">Document checklist</h2><p>Receipt means a file arrived. Acceptance requires staff review.</p><ul class="checklist">${request.items.map(item => `<li><div class="item-heading"><div><h3>${escapeHtml(item.title)}</h3><small>${item.required ? 'Required' : 'Optional'}</small></div>${badge(item.status)}</div><p class="item-description">${escapeHtml(item.description)}</p><span class="file-label">${item.file ? `Sample filename: ${escapeHtml(item.file)} / file not available in this preview` : 'No sample file'}</span></li>`).join('')}</ul></section>
    <aside class="detail-card" aria-labelledby="next-heading"><h2 id="next-heading">Next steps</h2><p>This is a read-only preview. No link or document has been created.</p><dl><dt>Client upload link</dt><dd>Not connected</dd><dt>Staff review</dt><dd>Not connected</dd></dl><button type="button" disabled aria-describedby="share-help">Create / share link</button><small id="share-help">Requires the secure link backend (#3 / #4).</small><button type="button" disabled aria-describedby="review-help">Review documents</button><small id="review-help">Requires stored documents and review endpoints (#5 / #10). No automatic verification.</small></aside></div>`;
}
function route(focus = false) {
  const hash = window.location.hash;
  const id = hash.startsWith('#request/') ? hash.slice('#request/'.length) : null;
  const request = requests.find(request => request.id === id);
  el('requests-view').hidden = Boolean(id);
  el('detail-view').hidden = !id;
  if (id && request) renderDetail(request);
  else if (id) el('detail-view').innerHTML = '<a class="back-link" href="#requests">← All requests</a><h1 id="detail-heading" tabindex="-1">Request not found</h1><p>This preview only contains sample requests.</p>';
  const nav = document.querySelectorAll('.workspace-header nav a');
  nav.forEach(link => link.removeAttribute('aria-current'));
  nav[hash === '#guide' ? 1 : 0].setAttribute('aria-current', 'page');
  if (focus) {
    const target = hash === '#guide' ? el('guide-heading') : id ? el('detail-heading') : el('requests-heading');
    target.focus();
    target.scrollIntoView({ block: 'start' });
  }
}
el('request-search').addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); renderList(); });
el('request-stats').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  renderList();
  // Keep keyboard focus after replacing filter buttons.
  document.querySelector(`[data-filter="${activeFilter}"]`).focus();
});
el('reset-filters').addEventListener('click', () => { activeFilter = 'all'; query = ''; el('request-search').value = ''; renderList(); el('request-search').focus(); });
window.addEventListener('hashchange', () => route(true));
renderList();
route();
