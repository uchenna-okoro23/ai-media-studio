import { generateMedia } from "@/lib/providers";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { error: "Please sign in before generating." },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const type = String(body.type || "AI Image");
  const prompt = String(body.prompt || "").trim();

  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return Response.json({ error: "Prompt is too long." }, { status: 400 });
  }

  const pool = db();
  const client = await pool.connect();

  let id;
  let used;

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      String(user.sub),
    ]);

    const count = await client.query(
      "select count(*)::int as count from generations where user_id=$1 and created_at>=current_date",
      [user.sub]
    );
    used = count.rows[0].count;

    if (used >= 10) {
      await client.query("rollback");
      return Response.json(
        {
          error: "Daily free limit reached. Try again tomorrow.",
          used,
          limit: 10,
        },
        { status: 429 }
      );
    }

    const inserted = await client.query(
      "insert into generations(user_id,type,prompt,status) values($1,$2,$3,'processing') returning id",
      [user.sub, type, prompt]
    );
    id = inserted.rows[0].id;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    client.release();
    return Response.json(
      { error: error.message || "Could not reserve a generation." },
      { status: 500 }
    );
  }

  client.release();

  try {
    const result = await generateMedia({ type, prompt });

    await pool.query(
      "update generations set status=$1,output_url=$2 where id=$3",
      [result.status, result.url || null, id]
    );

    return Response.json(
      { ...result, id, usage: { used: used + 1, limit: 10 } },
      { status: result.status === "provider_not_configured" ? 503 : 200 }
    );
  } catch (error) {
    await pool
      .query("update generations set status='failed' where id=$1", [id])
      .catch(() => {});

    return Response.json(
      { error: error.message || "Generation failed.", id },
      { status: 502 }
    );
  }
}
