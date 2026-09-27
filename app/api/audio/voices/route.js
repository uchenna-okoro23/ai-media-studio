export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ voices: [], providerConfigured: false });

  try {
    const url = new URL("https://api.elevenlabs.io/v2/voices");
    url.searchParams.set("page_size", "50");
    url.searchParams.set("voice_type", "default");
    const response = await fetch(url, {
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("voice list unavailable");
    const data = await response.json();
    const voices = (data.voices || [])
      .filter(v => v.voice_id && (!Array.isArray(v.available_for_tiers) || v.available_for_tiers.length === 0 || v.available_for_tiers.includes("free")))
      .map(v => ({
        id: v.voice_id,
        name: v.name,
        description: v.description || "Premade narration voice",
      }));
    return Response.json({ voices, providerConfigured: true });
  } catch (error) {
    console.error("Voice catalog error:", error);
    return Response.json({ voices: [], providerConfigured: true });
  }
}
