import { db } from "@/lib/db";

export const FREE_DAILY_GENERATIONS = 10;

const DEFAULT_PRICES = {
  "AI Image": 100,
  "AI Video": 1500,
  "Scene Generator": 100,
  "Storyboard": 100,
};

export function getGenerationPriceKobo(type) {
  const envKey = {
    "AI Image": "AI_IMAGE_PRICE_KOBO",
    "AI Video": "AI_VIDEO_PRICE_KOBO",
    "Scene Generator": "AI_SCENE_PRICE_KOBO",
    "Storyboard": "AI_STORYBOARD_PRICE_KOBO",
  }[type];

  const value = envKey ? Number(process.env[envKey]) : NaN;
  if (Number.isFinite(value) && value >= 0) return Math.round(value);
  return DEFAULT_PRICES[type] ?? 100;
}

export async function reserveGenerationCharge(client, { userId, generationId, type, billingMode = "free" }) {
  const requestedMode = billingMode === "wallet" ? "wallet" : "free";
  const freeResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM generations
      WHERE user_id = $1
        AND billing_mode = 'free'
        AND status IN ('processing', 'completed')
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
    `,
    [userId]
  );

  const freeUsed = Number(freeResult.rows[0]?.count || 0);

  if (requestedMode === "free" && freeUsed < FREE_DAILY_GENERATIONS) {
    await client.query(
      `
        UPDATE generations
        SET billing_mode = 'free', cost_kobo = 0
        WHERE id = $1 AND user_id = $2
      `,
      [generationId, userId]
    );

    return {
      mode: "free",
      costKobo: 0,
      balanceKobo: null,
    };
  }

  if (requestedMode === "free") {
    return {
      mode: "free_unavailable",
      costKobo: getGenerationPriceKobo(type),
      balanceKobo: null,
    };
  }

  const costKobo = getGenerationPriceKobo(type);

  const userResult = await client.query(
    "SELECT balance_kobo FROM users WHERE id = $1 FOR UPDATE",
    [userId]
  );

  const balanceKobo = Number(userResult.rows[0]?.balance_kobo || 0);

  if (balanceKobo < costKobo) {
    return {
      mode: "insufficient_balance",
      costKobo,
      balanceKobo,
    };
  }

  const reference = `GEN-${generationId}`;

  await client.query(
    `
      UPDATE users
      SET balance_kobo = balance_kobo - $1
      WHERE id = $2
    `,
    [costKobo, userId]
  );

  const transaction = await client.query(
    `
      INSERT INTO wallet_transactions (
        user_id, reference, type, amount_kobo, status, provider, generation_id
      )
      VALUES ($1, $2, 'usage', $3, 'reserved', 'ai-provider', $4)
      RETURNING id
    `,
    [userId, reference, -costKobo, generationId]
  );

  await client.query(
    `
      UPDATE generations
      SET
        billing_mode = 'wallet',
        cost_kobo = $1,
        wallet_transaction_id = $2
      WHERE id = $3 AND user_id = $4
    `,
    [costKobo, transaction.rows[0].id, generationId, userId]
  );

  return {
    mode: "wallet",
    costKobo,
    balanceKobo: balanceKobo - costKobo,
    transactionId: transaction.rows[0].id,
  };
}

export async function completeGenerationCharge(transactionId) {
  if (!transactionId) return;
  await db().query(
    "UPDATE wallet_transactions SET status = 'completed' WHERE id = $1 AND status = 'reserved'",
    [transactionId]
  );
}

export async function refundGenerationCharge({ userId, generationId, transactionId }) {
  if (!transactionId) return;

  const client = await db().connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT amount_kobo, status
        FROM wallet_transactions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [transactionId, userId]
    );

    const transaction = result.rows[0];

    if (transaction?.status === "reserved") {
      const refundKobo = Math.abs(Number(transaction.amount_kobo || 0));

      await client.query(
        "UPDATE users SET balance_kobo = balance_kobo + $1 WHERE id = $2",
        [refundKobo, userId]
      );

      await client.query(
        "UPDATE wallet_transactions SET status = 'refunded' WHERE id = $1",
        [transactionId]
      );

      await client.query(
        `
          UPDATE generations
          SET billing_mode = 'refunded'
          WHERE id = $1 AND user_id = $2
        `,
        [generationId, userId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
