import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is not configured");

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
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

    ALTER TABLE generations ADD COLUMN IF NOT EXISTS output_data BYTEA;
    ALTER TABLE generations ADD COLUMN IF NOT EXISTS output_mime TEXT;
    CREATE INDEX IF NOT EXISTS idx_generations_user_created ON generations(user_id, created_at DESC);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_kobo BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE generations ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'free';
    ALTER TABLE generations ADD COLUMN IF NOT EXISTS cost_kobo BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE generations ADD COLUMN IF NOT EXISTS wallet_transaction_id UUID;

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

    ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS generation_id UUID REFERENCES generations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_status ON wallet_transactions(user_id, status, created_at DESC);

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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_clones_provider_voice ON voice_clones(provider, provider_voice_id);
    CREATE INDEX IF NOT EXISTS idx_voice_clones_user_created ON voice_clones(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS user_brand_kits (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      tagline TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#ffffff',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

  `);

  const repairClient = await pool.connect();
  try {
    await repairClient.query("BEGIN");
    const repairs = await repairClient.query(`
      SELECT w.id AS transaction_id, w.user_id, w.amount_kobo, g.id AS generation_id
      FROM wallet_transactions w
      JOIN generations g ON g.wallet_transaction_id = w.id
      WHERE w.type = 'usage'
        AND w.status = 'completed'
        AND w.amount_kobo < 0
        AND g.status IN ('failed', 'provider_not_configured')
      FOR UPDATE OF w
    `);
    for (const row of repairs.rows) {
      const refund = Math.abs(Number(row.amount_kobo || 0));
      if (!refund) continue;
      await repairClient.query("UPDATE users SET balance_kobo = balance_kobo + $1 WHERE id = $2", [refund, row.user_id]);
      await repairClient.query("UPDATE wallet_transactions SET status = 'refunded' WHERE id = $1 AND status = 'completed'", [row.transaction_id]);
      await repairClient.query("UPDATE generations SET billing_mode = 'refunded' WHERE id = $1", [row.generation_id]);
    }
    await repairClient.query("COMMIT");
    if (repairs.rowCount) console.log("Repaired " + repairs.rowCount + " historical failed usage charge(s).");
  } catch (error) {
    await repairClient.query("ROLLBACK");
    throw error;
  } finally {
    repairClient.release();
  }

  console.log("Database schema ready.");
} finally {
  await pool.end();
}
