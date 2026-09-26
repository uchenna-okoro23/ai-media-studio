import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request, { params }) {
  const user = await getSessionUser();

  if (!user) {
    return new Response("Authentication required.", {
      status: 401,
    });
  }

  try {
    const { id } = await params;

    const result = await db().query(
      `
        SELECT
          output_data,
          output_mime,
          output_url,
          type,
          status
        FROM generations
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [id, user.sub]
    );

    const generation = result.rows[0];

    if (!generation) {
      return new Response("Generation not found.", {
        status: 404,
      });
    }

    if (generation.status !== "completed") {
      return new Response("Media is not available.", {
        status: 404,
      });
    }

    /*
     * NEW:
     * Serve permanently stored image data directly from PostgreSQL.
     */
    if (generation.output_data) {
      const contentType =
        generation.output_mime ||
        (generation.type === "AI Image"
          ? "image/webp"
          : "application/octet-stream");

      return new Response(generation.output_data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition":
            generation.type === "AI Image"
              ? "inline"
              : "attachment",
        },
      });
    }

    /*
     * FALLBACK:
     * Older generations created before persistent storage was added
     * may still have only the temporary provider URL.
     */
    if (generation.output_url) {
      try {
        const upstream = await fetch(generation.output_url, {
          cache: "no-store",
        });

        if (upstream.ok) {
          const contentType =
            upstream.headers.get("content-type") ||
            (generation.type === "AI Image"
              ? "image/webp"
              : "application/octet-stream");

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=3600",
              "Content-Disposition":
                generation.type === "AI Image"
                  ? "inline"
                  : "attachment",
            },
          });
        }
      } catch (error) {
        console.error("Legacy media fetch error:", error);
      }
    }

    return new Response(
      "Generated media has expired or is unavailable.",
      {
        status: 410,
      }
    );
  } catch (error) {
    console.error("Media route error:", error);

    return new Response("Could not load generated media.", {
      status: 500,
    });
  }
}
