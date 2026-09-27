import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const DAILY_LIMIT = 10;
const MAX_TEXT = 12000;

async function resolveVoice(voiceId, userId, apiKey) {
  try {
    const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100&voice_type=default", {
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      const catalogVoice = Array.isArray(data.voices)
        ? data.voices.find((item) => item.voice_id === voiceId)
        : null;
      if (catalogVoice) return { provider_voice_id: catalogVoice.voice_id, name: catalogVoice.name || "Production Voice", type: "catalog" };
    }
  } catch (error) {
    console.error("Voice catalog lookup error:", error);
  }

  const voiceResult = await db().query(
    `SELECT id, name, provider_voice_id
     FROM voice_clones
     WHERE id = $1 AND user_id = $2 AND provider = 'elevenlabs' AND status = 'ready'
     LIMIT 1`,
    [voiceId, userId]
  );
  return voiceResult.rows[0] ? { ...voiceResult.rows[0], type: "clone" } : null;
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "Audio generation is not available right now." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = String(body.text || "").trim();
  const voiceId = String(body.voiceId || "").trim();

  if (!text) return Response.json({ error: "Narration text is required." }, { status: 400 });
  if (text.length > MAX_TEXT) return Response.json({ error: `Narration is limited to ${MAX_TEXT.toLocaleString()} characters per generation.` }, { status: 400 });
  if (!voiceId) return Response.json({ error: "Select a voice." }, { status: 400 });

  const voice = await resolveVoice(voiceId, user.sub, apiKey);
  if (!voice) return Response.json({ error: "Voice not found." }, { status: 404 });

  const pool = db();
  const client = await pool.connect();
  let generationId = null;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`generation-limit:${user.sub}`]);

    const usage = await client.query(
      `SELECT COUNT(*)::int AS count FROM generations
       WHERE user_id = $1 AND created_at >= CURRENT_DATE
       AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [user.sub]
    );
    const used = usage.rows[0]?.count || 0;

    if (used >= DAILY_LIMIT) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Daily generation limit reached.", limit: DAILY_LIMIT, used, remaining: 0 }, { status: 429 });
    }

    const inserted = await client.query(
      `INSERT INTO generations (user_id, type, prompt, status)
       VALUES ($1, 'AI Audio', $2, 'processing') RETURNING id`,
      [user.sub, text]
    );
    generationId = inserted.rows[0].id;
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("Audio reservation error:", error);
    return Response.json({ error: "Could not start audio generation." }, { status: 500 });
  } finally {
    client.release();
  }

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.provider_voice_id)}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", output_format: "mp3_44100_128" }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      console.error("Audio generation service error:", upstream.status);
      throw new Error("Audio generation could not be completed.");
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (!audio.length) throw new Error("Audio generation returned empty audio.");

    await pool.query(
      `UPDATE generations
       SET status = 'completed', output_data = $1, output_mime = 'audio/mpeg', output_url = NULL
       WHERE id = $2 AND user_id = $3`,
      [audio, generationId, user.sub]
    );

    const usage = await pool.query(
      `SELECT COUNT(*)::int AS count FROM generations
       WHERE user_id = $1 AND created_at >= CURRENT_DATE
       AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [user.sub]
    );
    const used = usage.rows[0]?.count || 0;

    return Response.json({ id: generationId, status: "completed", url: `/api/generations/${generationId}/media`, usage: { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) } });
  } catch (error) {
    await pool.query(
      `UPDATE generations SET status = 'failed', output_data = NULL, output_mime = NULL, output_url = NULL
       WHERE id = $1 AND user_id = $2`,
      [generationId, user.sub]
    );
    return Response.json({ error: error instanceof Error ? error.message : "Audio generation failed.", id: generationId }, { status: 502 });
  }
}
