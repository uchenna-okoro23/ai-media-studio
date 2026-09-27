import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      output_url TEXT,
      output_data BYTEA,
      output_mime TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE generations
      ADD COLUMN IF NOT EXISTS output_data BYTEA;

    ALTER TABLE generations
      ADD COLUMN IF NOT EXISTS output_mime TEXT;

    CREATE INDEX IF NOT EXISTS idx_generations_user_created
      ON generations(user_id, created_at DESC);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_kobo BIGINT NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reference TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      amount_kobo BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
      ON wallet_transactions(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS voice_clones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_voice_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_clones_provider_voice
      ON voice_clones(provider, provider_voice_id);

    CREATE INDEX IF NOT EXISTS idx_voice_clones_user_created
      ON voice_clones(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_updated
      ON projects(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS user_brand_kits (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      tagline TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#ffffff',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Database schema ready.");
} finally {
  await pool.end();
}
