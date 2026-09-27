import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
]);

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "Voice cloning provider is not configured yet." }, { status: 503 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const name = String(form.get("name") || "").trim();
  const consent = form.get("consent") === "true";
  const files = form.getAll("files").filter((item) => item && typeof item.arrayBuffer === "function");

  if (!name || name.length > 80) {
    return Response.json({ error: "Voice name is required and must be 80 characters or fewer." }, { status: 400 });
  }

  if (!consent) {
    return Response.json({ error: "Confirm that you own the voice or have permission to use it." }, { status: 400 });
  }

  if (!files.length) {
    return Response.json({ error: "Upload at least one audio sample." }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.append("name", name);
  outbound.append("description", "Voice clone created in AI Media Studio.");
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "Each audio sample must be 25 MB or smaller." }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: "Unsupported audio format. Use MP3, WAV, M4A, OGG, or WebM." }, { status: 400 });
    }
    outbound.append("files[]", file, file.name || "voice-sample");
  }

  try {
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: outbound,
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok || !data.voice_id) {
      console.error("ElevenLabs clone error:", upstream.status, data);
      return Response.json(
        { error: data?.detail?.message || data?.detail || "Voice cloning failed." },
        { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 }
      );
    }

    const result = await db().query(
      `INSERT INTO voice_clones (user_id, name, provider, provider_voice_id, status, consent_confirmed)
       VALUES ($1, $2, 'elevenlabs', $3, 'ready', TRUE)
       RETURNING id, name, provider, provider_voice_id, status, created_at`,
      [user.sub, name, data.voice_id]
    );

    return Response.json({ voice: result.rows[0] });
  } catch (error) {
    console.error("Voice clone error:", error);
    return Response.json({ error: "Could not create the voice clone." }, { status: 500 });
  }
}
