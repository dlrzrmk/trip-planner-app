const { createClient } = require('@libsql/client');

// Local dev: falls back to a local SQLite file if no Turso credentials are set.
// Production (Render): set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN so data
// survives restarts/redeploys (Render's own disk is wiped on every deploy).
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function init() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        locale TEXT NOT NULL DEFAULT 'tr',
        email_verified INTEGER NOT NULL DEFAULT 0,
        verification_code TEXT,
        verification_code_expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        total_days INTEGER NOT NULL DEFAULT 1,
        destination_lat REAL,
        destination_lng REAL,
        destination_label TEXT,
        currency TEXT NOT NULL DEFAULT 'TRY',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS trip_items (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        time TEXT,
        cost REAL NOT NULL DEFAULT 0,
        lat REAL,
        lng REAL,
        location_label TEXT,
        notes TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        memory_note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS trip_members (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        invited_email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(trip_id, invited_email)
      )`,
      `CREATE TABLE IF NOT EXISTS trip_item_photos (
        id TEXT PRIMARY KEY,
        trip_item_id TEXT NOT NULL REFERENCES trip_items(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        public_id TEXT,
        caption TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_trip_items_trip ON trip_items(trip_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trip_members_email ON trip_members(invited_email)`,
      `CREATE INDEX IF NOT EXISTS idx_trip_item_photos_item ON trip_item_photos(trip_item_id)`,
    ],
    'write'
  );

  // Migration: add columns for installs whose tables already existed
  // before a given feature shipped. Safe to run on every startup.
  async function ensureColumns(table, wantedCols) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const existingCols = new Set(info.rows.map((r) => r.name));
    for (const [col, def] of wantedCols) {
      if (!existingCols.has(col)) {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      }
    }
  }

  await ensureColumns('users', [
    ["phone", "TEXT NOT NULL DEFAULT ''"],
    ['locale', "TEXT NOT NULL DEFAULT 'tr'"],
    ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
    ['verification_code', 'TEXT'],
    ['verification_code_expires_at', 'TEXT'],
  ]);
  // Any account created before this migration is treated as already
  // verified so existing users aren't locked out.
  await client.execute(
    "UPDATE users SET email_verified = 1 WHERE email_verified = 0 AND verification_code IS NULL"
  );

  await ensureColumns('trip_items', [
    ['is_favorite', 'INTEGER NOT NULL DEFAULT 0'],
    ['memory_note', 'TEXT'],
  ]);
}

module.exports = { client, init };
