import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = fs.existsSync(path.join(process.cwd(), 'public')) ? process.cwd() : path.join(process.cwd(), 'v2');
const html = fs.readFileSync(path.join(rootDir, 'public', 'upload.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeNode(id) {
  return {
    id, hidden: false, style: {}, dataset: {}, textContent: '', innerHTML: '', children: [],
    addEventListener() {}, appendChild(c) { this.children.push(c); }, click() {},
  };
}

// Runs the page script against a stub DOM and a stubbed /api/session response.
async function loadPage({ search, session }) {
  const nodes = {};
  // Mirror the markup: ids that start hidden in upload.html start hidden here.
  const startsHidden = (id) => new RegExp(`id="${id}"[^>]*\\bhidden\\b`).test(html);
  const document = {
    readyState: 'complete',
    addEventListener() {},
    getElementById(id) {
      if (!nodes[id]) { nodes[id] = makeNode(id); nodes[id].hidden = startsHidden(id); }
      return nodes[id];
    },
    createElement() { return makeNode('row'); },
  };
  const fetch = async () => ({
    ok: session.ok !== false,
    json: async () => session.body,
  });
  const ctx = {
    document, fetch, URLSearchParams, console, setTimeout, clearTimeout, encodeURIComponent,
    window: { location: { search } },
    navigator: { userAgent: 'node' },
  };
  vm.createContext(ctx);
  vm.runInContext(script.replace('const params = new URLSearchParams(window.location.search);', 'const params = new URLSearchParams(window.location.search);'), ctx);
  await new Promise((r) => setTimeout(r, 20));
  return { nodes: (id) => document.getElementById(id) };
}

const visible = (n) => !n.hidden && n.style.display !== 'none';
const item = (over = {}) => ({ id: 'i1', title: 'PAN Card', description: 'ID proof', required: true, status: 'missing', allowed_types: 'pdf', max_bytes: 1048576, upload_count: 0, ...over });

test('completed request leads with the receipt and hides every upload invitation', async () => {
  const p = await loadPage({ search: '?t=abc', session: { body: { firm_name: 'Shah & Co', client_name: 'Test', items: [item({ status: 'received', upload_count: 1 })] } } });
  assert.ok(visible(p.nodes('allDoneBanner')));
  assert.ok(!visible(p.nodes('dropzoneBox')));
  assert.ok(!visible(p.nodes('nextUpCard')));
  assert.ok(!visible(p.nodes('recoveryCard')));
});

test('a count-only upload (status still missing) is treated as received', async () => {
  const p = await loadPage({ search: '?t=abc', session: { body: { items: [item({ status: 'missing', upload_count: 1 })] } } });
  assert.ok(visible(p.nodes('allDoneBanner')));
  assert.ok(!visible(p.nodes('dropzoneBox')));
});

test('missing items lead with the next task and keep the upload path', async () => {
  const p = await loadPage({ search: '?t=abc', session: { body: { items: [item(), item({ id: 'i2', title: 'Bank statement', status: 'received', upload_count: 1 })] } } });
  assert.ok(!visible(p.nodes('allDoneBanner')));
  assert.ok(visible(p.nodes('nextUpCard')));
  assert.strictEqual(p.nodes('nextUpTitle').textContent, 'PAN Card');
  assert.ok(visible(p.nodes('dropzoneBox')));
});

test('no token shows recovery only', async () => {
  const p = await loadPage({ search: '', session: { body: {} } });
  assert.ok(visible(p.nodes('recoveryCard')));
  assert.match(p.nodes('recoveryStep').textContent, /WhatsApp/);
  for (const id of ['dropzoneBox', 'docStack', 'allDoneBanner', 'nextUpCard', 'progressContainer']) assert.ok(!visible(p.nodes(id)), id);
});

test('rejected token shows recovery only', async () => {
  const p = await loadPage({ search: '?t=bad', session: { ok: false, body: { error: 'not_found' } } });
  assert.ok(visible(p.nodes('recoveryCard')));
  assert.ok(!visible(p.nodes('dropzoneBox')));
  assert.ok(!visible(p.nodes('docStack')));
});
