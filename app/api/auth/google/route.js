import crypto from "crypto";

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: "Google sign-in is not configured yet." }, { status: 503 });
  }

  const state = crypto.randomBytes(32).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  const response = Response.redirect(url);
  response.headers.set(
    "Set-Cookie",
    "google_oauth_state=" + state + "; Max-Age=600; Path=/; HttpOnly; SameSite=Lax" +
      (process.env.NODE_ENV === "production" ? "; Secure" : "")
  );
  return response;
}
