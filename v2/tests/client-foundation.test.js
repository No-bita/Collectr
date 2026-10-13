import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sign } from 'hono/jwt';
import { app } from '../src/index.js';
import { transitionItem, closeRequest } from '../src/db/request-state.js';
let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch {}
const skip = DatabaseSync ? false : 'node:sqlite requires Node 22.5+';
const secret = 'test-only-client-foundation-secret';
const migrationDir = fileURLToPath(new URL('../migrations/', import.meta.url));
function fixture({ beforeFoundation = false } = {}) {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON');
  const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files.filter(f => f < '0007')) raw.exec(fs.readFileSync(migrationDir + f, 'utf8'));
  raw.exec(`INSERT INTO users(id,username,password_hash) VALUES ('u1','one','x'),('u2','two','x');
    INSERT INTO firms(id,name) VALUES ('f1','Firm One'),('f2','Firm Two');
    INSERT INTO firm_members(firm_id,user_id) VALUES ('f1','u1'),('f2','u2');
    INSERT INTO contacts(id,user_id,firm_id,name,phone_number,email,company,notes)
    VALUES ('c1','u1','f1','Client One','919999999999','one@example.test','Firm Co','private CRM notes'),
    ('c2','u2','f2','Client Two','918888888888',NULL,NULL,NULL);
    INSERT INTO requests(id,user_id,contact_id,firm_id,title) VALUES ('r1','u1','c1','f1','GST');
    INSERT INTO request_items(id,request_id,firm_id,title,status) VALUES ('i1','r1','f1','PAN','missing');
    INSERT INTO activities(id,user_id,contact_id,request_id,firm_id,activity_type,title,metadata)
    VALUES ('a1','u1','c1','r1','f1','request_created','Original event','{"original":true}');
    INSERT INTO client_links(id,firm_id,request_id,token_hash,expires_at)
    VALUES ('l1','f1','r1','existing-hash','2099-01-01T00:00:00Z');`);
  if (!beforeFoundation) raw.exec(fs.readFileSync(migrationDir + '0007_firm_owned_clients.sql', 'utf8'));
  const db = {
    async execute(q) {
      const sql = typeof q === 'string' ? q : q.sql;
      const args = typeof q === 'string' ? [] : q.args || [];
      const stmt = raw.prepare(sql);
      if (/^\s*(SELECT|WITH)/i.test(sql)) return { rows: stmt.all(...args).map(r => ({ ...r })) };
      return { rows: [], changes: Number(stmt.run(...args).changes) };
    },
    async batch(qs) {
      raw.exec('BEGIN');
      try { const out=[]; for (const q of qs) out.push(await this.execute(q)); raw.exec('COMMIT'); return out; }
      catch(e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
  async function call(path, { user='u1', method='GET', body }={}) {
    const headers = { 'Content-Type':'application/json' };
    if (user) headers.Authorization = `Bearer ${await sign({ id:user, exp:Math.floor(Date.now()/1000)+3600 },secret)}`;
    const res = await app.request('https://collectr.test'+path, { method, headers, ...(body !== undefined ? {body:JSON.stringify(body)} : {}) }, {DB:db,JWT_SECRET:secret,ENVIRONMENT:'production'});
    return { status:res.status, body:await res.json() };
  }
  return {raw,db,call};
}

test('Foundation migration copies identity and preserves contacts, requests, audit events and links', {skip}, () => {
  const {raw}=fixture({beforeFoundation:true});
  try {
    const tables=['contacts','requests','request_items','activities','client_links'];
    const before=Object.fromEntries(tables.map(t=>[t,raw.prepare(`SELECT * FROM ${t}`).all().map(r=>({...r}))]));
    raw.exec(fs.readFileSync(migrationDir+'0007_firm_owned_clients.sql','utf8'));
    for(const table of tables) {
      const after=raw.prepare(`SELECT * FROM ${table}`).all().map(r=>{const {client_id,...original}=r;return original;});
      assert.deepEqual(after,before[table]);
    }
    assert.equal(raw.prepare('SELECT client_id FROM requests WHERE id=?').get('r1').client_id,'c1');
    assert.equal(raw.prepare('SELECT client_id FROM activities WHERE id=?').get('a1').client_id,'c1');
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {raw.close();}
});

test('Dedicated clients routes authenticate, firm-scope and create atomically', {skip},async()=>{
  const {raw,call}=fixture();
  try {
    assert.equal((await call('/api/clients',{user:null})).status,401);
    const list=await call('/api/clients');
    assert.deepEqual(list.body.clients.map(c=>c.id),['c1']);
    assert.ok(!('notes' in list.body.clients[0]));
    const created=await call('/api/clients',{method:'POST',body:{name:'New Client',phoneNumber:'+917777777777',email:'new@example.test'}});
    assert.equal(created.status,201);
    const id=created.body.client.id;
    assert.equal(raw.prepare('SELECT firm_id FROM clients WHERE id=?').get(id).firm_id,'f1');
    assert.equal(raw.prepare('SELECT firm_id FROM contacts WHERE id=?').get(id).firm_id,'f1');
    assert.equal((await call('/api/clients',{method:'POST',body:{name:'Duplicate',phoneNumber:'917777777777'}})).status,409);
    assert.equal((await call('/api/clients',{method:'POST',body:{name:'Wrong',phoneNumber:'bad'}})).status,400);
    assert.equal(raw.prepare('SELECT count(*) AS n FROM clients').get().n,3);
    const req=await call(`/api/clients/${id}/requests`,{method:'POST',body:{title:'GST docs',items:['PAN']}});
    assert.equal(req.status,201);
    assert.equal(req.body.request.clientId,id);
    assert.equal(raw.prepare('SELECT client_id FROM requests WHERE id=?').get(req.body.request.id).client_id,id);
    assert.equal((await call('/api/clients/c2/requests',{method:'POST',body:{title:'Cross firm'}})).status,404);
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{raw.close();}
});

test('Client API rolls back client insert when compatibility contact insert fails', {skip},async()=>{
  const {raw,call}=fixture();
  try {
    raw.exec("CREATE TRIGGER fail_contact BEFORE INSERT ON contacts BEGIN SELECT RAISE(ABORT,'forced_failure'); END;");
    assert.equal((await call('/api/clients',{method:'POST',body:{name:'Failure',phoneNumber:'917777777777'}})).status,500);
    assert.equal(raw.prepare('SELECT count(*) AS n FROM clients').get().n,2);
  }finally{raw.close();}
});

test('Firm guards reject cross-firm or mismatched request and activity ownership', {skip},()=>{
  const {raw}=fixture();
  try {
    assert.throws(()=>raw.exec("INSERT INTO requests(id,user_id,firm_id,contact_id,client_id,title) VALUES('bad','u1','f1','c2','c2','bad')"),/invalid_request_client/);
    assert.throws(()=>raw.exec("UPDATE requests SET client_id='c2' WHERE id='r1'"),/invalid_request_client/);
    assert.throws(()=>raw.exec("UPDATE activities SET firm_id='f2' WHERE id='a1'"),/invalid_activity_client/);
  }finally{raw.close();}
});

test('Public sessions use dedicated identity and transitions preserve the audit ledger', {skip},async()=>{
  const {raw,db,call}=fixture();
  try {
    raw.exec("UPDATE contacts SET name='CRM changed' WHERE id='c1'; UPDATE clients SET name='Dedicated Identity' WHERE id='c1';");
    const link=await call('/api/requests/r1/links',{method:'POST'});
    assert.equal(link.status,201);
    const session=await call('/api/session/'+link.body.token,{user:null});
    assert.equal(session.status,200);
    assert.equal(session.body.client_name,'Dedicated Identity');
    await transitionItem(db,'i1','waived',{type:'staff',userId:'u1'},'Not needed',{firmId:'f1',requestId:'r1'});
    await closeRequest(db,'r1',{firmId:'f1',userId:'u1'});
    const events=raw.prepare("SELECT client_id FROM activities WHERE request_id='r1'").all();
    assert.ok(events.length>=3);
    assert.ok(events.every(r=>r.client_id==='c1'));
    assert.equal(raw.prepare("SELECT metadata FROM activities WHERE id='a1'").get().metadata,'{"original":true}');
  }finally{raw.close();}
});
