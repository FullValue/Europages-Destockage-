// Stockage de la base Compack.
// - Local : fichier data/db.json (aucune configuration).
// - Vercel : Postgres (variable DATABASE_URL ou POSTGRES_URL, ex. Neon). Toute la base tient dans une ligne JSONB,
//   verrouillée (SELECT … FOR UPDATE) pendant chaque écriture : deux requêtes simultanées ne s'écrasent jamais.
const fs = require("fs");
const path = require("path");
const { buildSeed } = require("../seed.js");

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const KEY = "db";

// Une requête à la fois par instance : la base est chargée dans un objet partagé pendant le traitement.
let queue = Promise.resolve();
const serial = fn => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

/* ---------- fichier ---------- */
let fileDb = null;
function fileLoad() {
  if (fileDb) return fileDb;
  if (process.env.VERCEL) throw new Error("Base de données non configurée : ajoutez Postgres (Neon) au projet Vercel pour définir DATABASE_URL.");
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(buildSeed(), null, 1));
  }
  return (fileDb = JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
}
function fileSave(db) {
  fs.writeFileSync(DB_FILE + ".tmp", JSON.stringify(db, null, 1));
  fs.renameSync(DB_FILE + ".tmp", DB_FILE);
}

/* ---------- Postgres ---------- */
let pool = null, ready = null;
function pg() {
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: DB_URL, max: 3, ssl: /sslmode=(require|verify)/.test(DB_URL) ? { rejectUnauthorized: false } : undefined });
    ready = pool.query("CREATE TABLE IF NOT EXISTS compack_store (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");
  }
  return pool;
}
async function pgRun(write, fn) {
  const client = await pg().connect();
  try {
    await ready;
    await client.query("BEGIN");
    const lock = write ? " FOR UPDATE" : "";
    let r = await client.query(`SELECT value FROM compack_store WHERE key = $1${lock}`, [KEY]);
    if (!r.rows.length) {
      await client.query("INSERT INTO compack_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [KEY, JSON.stringify(buildSeed())]);
      r = await client.query(`SELECT value FROM compack_store WHERE key = $1${lock}`, [KEY]);
    }
    const ctx = { db: r.rows[0].value, dirty: false };
    const out = await fn(ctx);
    if (write && ctx.dirty) await client.query("UPDATE compack_store SET value = $2, updated_at = now() WHERE key = $1", [KEY, JSON.stringify(ctx.db)]);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Exécute fn({ db, dirty }) avec la base chargée ; si fn met dirty à true, la base est enregistrée. */
function withDb(write, fn) {
  return serial(async () => {
    if (DB_URL) return pgRun(write, fn);
    const ctx = { db: fileLoad(), dirty: false };
    const out = await fn(ctx);
    if (ctx.dirty) fileSave(ctx.db);
    return out;
  });
}

module.exports = { withDb, mode: DB_URL ? "postgres" : "fichier" };
