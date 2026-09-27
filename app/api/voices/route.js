import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const result = await db().query(
    `SELECT id, name, status, created_at
     FROM voice_clones
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.sub]
  );

  return Response.json({ voices: result.rows });
}
