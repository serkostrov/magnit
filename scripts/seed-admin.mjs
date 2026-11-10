import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const login = process.env.ADMIN_LOGIN || "admin";
const password = process.env.ADMIN_PASSWORD;
if (!process.env.DATABASE_URL || !password) {
  console.error("DATABASE_URL and ADMIN_PASSWORD are required");
  process.exit(1);
}
const hash = crypto.scryptSync(password, process.env.ADMIN_PASSWORD_SALT || "site-magnit-admin", 64).toString("hex");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(`INSERT INTO admin_users (login, password_hash) VALUES ($1, $2)
    ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true`, [login, hash]);
  console.log(`admin user ready: ${login}`);
} finally {
  await pool.end();
}
