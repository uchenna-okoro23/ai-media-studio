import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const pool = db();

  const [wallet, transactions] = await Promise.all([
    pool.query("SELECT balance_kobo FROM users WHERE id = $1", [user.sub]),
    pool.query(
      `
        SELECT
          id,
          reference,
          type,
          amount_kobo,
          status,
          generation_id,
          created_at
        FROM wallet_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [user.sub]
    ),
  ]);

  return Response.json({
    balance: Number(wallet.rows[0]?.balance_kobo || 0) / 100,
    transactions: transactions.rows.map((row) => ({
      ...row,
      amount: Number(row.amount_kobo || 0) / 100,
    })),
  });
}
