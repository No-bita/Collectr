import { sign } from "hono/jwt";
import { getDbClient } from "../db/client.js";

async function hashPassword(password, saltText) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(saltText),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handleRegister(c) {
  const { username, password } = await c.req.json().catch(() => ({}));
  const u = String(username || "").trim();
  const p = String(password || "").trim();

  if (!u || !p || p.length < 6) {
    return c.json({ error: "Username and password (min 6 chars) are required." }, 400);
  }

  const db = getDbClient(c.env);

  try {
    // Check if this is the first user
    const countRes = await db.execute("SELECT COUNT(*) as cnt FROM users");
    const userCount = countRes.rows[0]?.cnt || 0;
    const role = userCount === 0 ? "admin" : "agent";

    const salt = "lekho_salt_" + u.toLowerCase();
    const hashed = await hashPassword(p, salt);

    const id = crypto.randomUUID();
    
    await db.execute({
      sql: "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
      args: [id, u, hashed, role]
    });

    // Automatically log in user after registration by generating JWT
    const secret = c.env.JWT_SECRET || "default_unsafe_secret_for_dev_only";
    const payload = {
      sub: id,
      id: id,
      username: u,
      role: role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
    };
    const token = await sign(payload, secret);

    return c.json({ success: true, message: "Registration successful", authHeader: "Bearer " + token });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
      return c.json({ error: "Username already exists" }, 400);
    }
    console.error("Register Error:", err);
    return c.json({ error: "Failed to register user" }, 500);
  }
}

export async function handleLogin(c) {
  const { username, password } = await c.req.json().catch(() => ({}));
  const u = String(username || "").trim();
  const p = String(password || "").trim();

  if (!u || !p) return c.json({ error: "Username and password required" }, 400);

  const db = getDbClient(c.env);

  try {
    const res = await db.execute({
      sql: "SELECT id, username, password_hash, role FROM users WHERE username = ?",
      args: [u]
    });

    if (res.rows.length === 0) {
      return c.json({ error: "Invalid username or password" }, 401);
    }

    const user = res.rows[0];
    const salt = "lekho_salt_" + user.username.toLowerCase();
    const expectedHash = await hashPassword(p, salt);

    if (user.password_hash !== expectedHash) {
      return c.json({ error: "Invalid username or password" }, 401);
    }

    // Generate JWT
    const secret = c.env.JWT_SECRET || "default_unsafe_secret_for_dev_only";
    const payload = {
      sub: user.id,
      id: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    };
    const token = await sign(payload, secret);

    return c.json({ success: true, authHeader: "Bearer " + token });
  } catch (err) {
    console.error("Login Error:", err);
    return c.json({ error: "Authentication failed" }, 500);
  }
}
