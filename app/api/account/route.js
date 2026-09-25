import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const r = await db().query(
    "select id,email,created_at from users where id=$1",
    [user.sub]
  );
  if (!r.rows[0]) {
    return Response.json({ error: "Account not found." }, { status: 401 });
  }

  const usage = await db().query(
    "select count(*)::int as total,count(*) filter(where created_at>=current_date)::int as today from generations where user_id=$1",
    [user.sub]
  );

  return Response.json({
    user: r.rows[0],
    usage: {
      total: usage.rows[0].total,
      today: usage.rows[0].today,
      dailyLimit: 10,
    },
  });
}
