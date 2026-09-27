import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const r = await db().query(
    "select id,email,created_at,balance_kobo from users where id=$1",
    [user.sub]
  );
  if (!r.rows[0]) return Response.json({ error: "Account not found." }, { status: 401 });

  const usage = await db().query(
    "select count(*)::int as total,count(*) filter(where created_at>=current_date and billing_mode='free' and status in ('processing','completed'))::int as today from generations where user_id=$1",
    [user.sub]
  );

  return Response.json({
    user: r.rows[0],
    balance: Number(r.rows[0].balance_kobo || 0) / 100,
    wallet: {
      currency: "NGN",
      freeDailyGenerations: 10,
      pricing: {
        image: Number(process.env.AI_IMAGE_PRICE_KOBO || 100) / 100,
        video: Number(process.env.AI_VIDEO_PRICE_KOBO || 1500) / 100,
        scene: Number(process.env.AI_SCENE_PRICE_KOBO || 100) / 100,
        storyboard: Number(process.env.AI_STORYBOARD_PRICE_KOBO || 100) / 100,
      },
    },
    usage: {
      total: usage.rows[0].total,
      today: usage.rows[0].today,
      dailyLimit: 10,
    },
  });
}
