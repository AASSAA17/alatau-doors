import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const globalDb = globalThis as unknown as { alatauDb?: Database.Database };
export const databasePath = resolve(
  /*turbopackIgnore: true*/ process.env.DATABASE_PATH || '.local/alatau-demo.sqlite',
);
export function getSqlite() {
  if (process.env.VERCEL || process.env.APP_MODE === 'public-demo')
    throw new Error('SQLite is local only.');
  if (
    process.env.APP_MODE === 'production' &&
    (!process.env.DATABASE_PATH || /demo\.sqlite$/i.test(process.env.DATABASE_PATH))
  )
    throw new Error('Production requires an explicit, separate non-demo DATABASE_PATH.');
  if (!globalDb.alatauDb) {
    mkdirSync(dirname(databasePath), { recursive: true });
    const db = new Database(databasePath);
    if (
      process.env.APP_MODE === 'production' &&
      db.prepare("SELECT name FROM sqlite_master WHERE name='app_meta'").get() &&
      db.prepare("SELECT value FROM app_meta WHERE key='seedComplete'").get()
    ) {
      db.close();
      throw new Error('A seeded demonstration database cannot be used in production.');
    }
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    globalDb.alatauDb = db;
  }
  return globalDb.alatauDb;
}
export function migrateSqliteBusiness() {
  const db = getSqlite();
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL);`,
  );
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = 1').get()) db.transaction(() => {
    db.exec(`
      CREATE TABLE products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, sku TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE variants (id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), width INTEGER NOT NULL CHECK(width > 0), height INTEGER NOT NULL CHECK(height > 0), price INTEGER NOT NULL CHECK(price >= 0), stock TEXT NOT NULL CHECK(stock IN ('DEMO_AVAILABLE','DEMO_ORDER','DEMO_UNAVAILABLE')), active INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX variants_product ON variants(productId);
      CREATE TABLE favorites (userId TEXT NOT NULL REFERENCES user(id), productId TEXT NOT NULL REFERENCES products(id), PRIMARY KEY(userId, productId));
      CREATE TABLE drafts (userId TEXT PRIMARY KEY REFERENCES user(id), payload TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE requests (number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, buyerId TEXT NOT NULL REFERENCES user(id), sellerId TEXT REFERENCES user(id), status TEXT NOT NULL CHECK(status IN ('NEW','IN_PROGRESS','QUOTED','COMPLETED','CANCELLED')), note TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX requests_buyer ON requests(buyerId);
      CREATE INDEX requests_seller ON requests(sellerId);
      CREATE TABLE request_items (id TEXT PRIMARY KEY, requestId TEXT NOT NULL REFERENCES requests(id), variantId TEXT NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20), frame INTEGER NOT NULL, hardware INTEGER NOT NULL, installation INTEGER NOT NULL);
      CREATE TABLE quotes (id TEXT PRIMARY KEY, requestId TEXT NOT NULL REFERENCES requests(id), version INTEGER NOT NULL, total INTEGER NOT NULL, payload TEXT NOT NULL, authorId TEXT NOT NULL REFERENCES user(id), authorName TEXT NOT NULL, createdAt TEXT NOT NULL, UNIQUE(requestId, version));
      CREATE TABLE request_events (id TEXT PRIMARY KEY, requestId TEXT NOT NULL REFERENCES requests(id), kind TEXT NOT NULL, status TEXT NOT NULL, authorId TEXT NOT NULL REFERENCES user(id), authorName TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE internal_comments (id TEXT PRIMARY KEY, requestId TEXT NOT NULL REFERENCES requests(id), authorId TEXT NOT NULL REFERENCES user(id), authorName TEXT NOT NULL, text TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE store_settings (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY, actorId TEXT NOT NULL REFERENCES user(id), action TEXT NOT NULL, targetId TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    db.prepare('INSERT INTO store_settings(id,payload) VALUES(1,?)').run(
      JSON.stringify({
        phone: '',
        email: '',
        addressRu: '',
        addressKk: '',
        hoursRu: '',
        hoursKk: '',
        framePrice: 18000,
        hardwarePrice: 12000,
        installationPrice: 20000,
      }),
    );
    db.prepare('INSERT INTO schema_migrations VALUES(1,?)').run(new Date().toISOString());
  })();
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get()) db.transaction(() => {
    db.exec(`CREATE TABLE entry_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX entry_limits_expiry ON entry_limits(expires);
      CREATE TABLE guest_inquiries (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, note TEXT NOT NULL,
      locale TEXT NOT NULL CHECK(locale IN ('ru','kk')), status TEXT NOT NULL CHECK(status IN ('NEW','IN_PROGRESS','COMPLETED','CANCELLED')),
      sellerId TEXT REFERENCES user(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX guest_inquiries_seller ON guest_inquiries(sellerId);`);
    db.prepare('INSERT INTO schema_migrations VALUES(2,?)').run(new Date().toISOString());
  })();
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=3').get()) db.transaction(() => {
    db.exec('CREATE TABLE auth_links (id TEXT PRIMARY KEY, userId TEXT NOT NULL, expiresAt INTEGER NOT NULL); CREATE TABLE mfa_enrollments (userId TEXT PRIMARY KEY REFERENCES user(id), tokenHash TEXT NOT NULL, expiresAt INTEGER NOT NULL);');
    db.prepare('INSERT INTO schema_migrations VALUES(3,?)').run(new Date().toISOString());
  })();
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=4').get()) db.transaction(() => {
    db.exec('CREATE TABLE media(id TEXT PRIMARY KEY, data BLOB NOT NULL, width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 1800), height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 1800), size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1048576), createdBy TEXT NOT NULL REFERENCES user(id), createdAt TEXT NOT NULL);');
    db.prepare('INSERT INTO schema_migrations VALUES(4,?)').run(new Date().toISOString());
  })();
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=5').get()) db.transaction(() => {
    db.exec('CREATE TABLE demo_payments(id TEXT PRIMARY KEY, requestId TEXT NOT NULL REFERENCES requests(id), quoteId TEXT NOT NULL UNIQUE REFERENCES quotes(id), buyerId TEXT NOT NULL REFERENCES user(id), amount INTEGER NOT NULL CHECK(amount >= 0), createdAt TEXT NOT NULL); CREATE INDEX demo_payments_request ON demo_payments(requestId);');
    db.prepare('INSERT INTO schema_migrations VALUES(5,?)').run(new Date().toISOString());
  })();
}
