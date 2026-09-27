import { db } from "@/lib/db";

export async function GET() {
  try {
    await db().query("SELECT 1");
    return Response.json({
      status: "ok",
      service: "ai-media-studio",
      version: "0.1.0",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check database error:", error);
    return Response.json({
      status: "degraded",
      service: "ai-media-studio",
      version: "0.1.0",
      database: "error",
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
