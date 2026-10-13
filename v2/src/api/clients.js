import { getDbClient } from '../db/client.js';

// Dedicated Collectr identity API. Contact rows below are a temporary physical
// FK bridge, not the source of client identity. Removal belongs to eviction.
export async function handleListClients(c) {
  const firmId = c.get('firmId');
  if (!firmId) return c.json({ error: 'Firm membership required.' }, 403);
  const db = getDbClient(c.env);
  try {
    const result = await db.execute({
      sql: 'SELECT id, name, phone_number, email, company FROM clients WHERE firm_id = ? ORDER BY name, id',
      args: [firmId],
    });
    return c.json({ clients: result.rows });
  } catch {
    return c.json({ error: 'Unable to list clients.' }, 500);
  }
}

export async function handleCreateClient(c) {
  const firmId = c.get('firmId');
  if (!firmId) return c.json({ error: 'Firm membership required.' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'Invalid client.' }, 400);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim().replace(/^\+/, '') : '';
  if (!name || name.length > 200 || !/^[1-9][0-9]{6,14}$/.test(phone)) {
    return c.json({ error: 'Name and phoneNumber (7-15 digits, including country code) are required.' }, 400);
  }
  for (const field of ['email', 'company']) {
    if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > 320)) {
      return c.json({ error: `Invalid ${field}.` }, 400);
    }
  }
  const email = body.email?.trim() || null;
  const company = body.company?.trim() || null;
  const id = 'cli_' + crypto.randomUUID();
  const db = getDbClient(c.env);
  try {
    await db.batch([
      { sql: 'INSERT INTO clients (id, firm_id, name, phone_number, email, company) VALUES (?, ?, ?, ?, ?, ?)', args: [id, firmId, name, phone, email, company] },
      // Kept atomically with the client until requests/activities lose their
      // legacy NOT NULL contact_id foreign keys in the later eviction migration.
      { sql: 'INSERT INTO contacts (id, user_id, firm_id, name, phone_number, email, company) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [id, c.get('user').id, firmId, name, phone, email, company] },
    ]);
    return c.json({ client: { id, name, phone_number: phone, email, company } }, 201);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return c.json({ error: 'A client with this phone number already exists.' }, 409);
    return c.json({ error: 'Unable to create client.' }, 500);
  }
}
