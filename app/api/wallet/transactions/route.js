import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const r = await db().query(
    "select id,reference,type,amount_kobo,status,provider,created_at from wallet_transactions where user_id=$1 order by created_at desc limit 25",
    [user.sub]
  );
  return Response.json({ transactions: r.rows.map(x => ({ ...x, amount: Number(x.amount_kobo || 0) / 100 })) });
}
