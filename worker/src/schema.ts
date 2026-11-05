import type { Database } from "./types";

const SONG_COLUMNS: Record<string, string> = {
  b2_key: "TEXT",
  mime_type: "TEXT",
  file_size: "INTEGER",
  uploaded_by: "TEXT",
};

/**
 * Non-destructive, idempotent migrations. PRAGMA is checked before every ALTER
 * so existing tables and password hashes are never recreated or rewritten.
 */
export async function migrateDatabase(database: Database): Promise<void> {
  await database.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
  )`);
  await database.query(`CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    duration INTEGER,
    cover_url TEXT,
    added_at INTEGER,
    b2_key TEXT,
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by TEXT
  )`);

  const userColumns = await database.query("PRAGMA table_info(users)");
  if (!userColumns.rows.some((column) => column.name === "role")) {
    await database.query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  const songColumns = await database.query("PRAGMA table_info(songs)");
  const existing = new Set(songColumns.rows.map((column) => String(column.name)));
  for (const [name, type] of Object.entries(SONG_COLUMNS)) {
    if (!existing.has(name)) await database.query(`ALTER TABLE songs ADD COLUMN ${name} ${type}`);
  }

  await database.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`);
  await database.query(
    "CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id)",
  );
  await database.query(
    "CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at)",
  );
  await database.query(`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_started INTEGER NOT NULL,
    hits INTEGER NOT NULL
  )`);
}
