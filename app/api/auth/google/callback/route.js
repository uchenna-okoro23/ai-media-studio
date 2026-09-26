import { db } from "@/lib/db";
import { signUser, sessionCookie } from "@/lib/auth";

function redirect(request, path) {
  return Response.redirect(new URL(path, request.url));
}

function setSession(response, user) {
  const c = sessionCookie(signUser(user));
  response.headers.set(
    "Set-Cookie",
    c.name + "=" + encodeURIComponent(c.value) + "; Max-Age=" + c.maxAge + "; Path=/; HttpOnly; SameSite=Lax" +
      (c.secure ? "; Secure" : "")
  );
  return response;
}

export async function GET(request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString();

    if (!clientId || !clientSecret) {
      return redirect(request, "/?google=not_configured");
    }

    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const error = requestUrl.searchParams.get("error");

    const cookieHeader = request.headers.get("cookie") || "";
    const stateCookie = cookieHeader.match(/(?:^|; )google_oauth_state=([^;]+)/)?.[1];

    if (error || !code || !returnedState || !stateCookie || returnedState !== stateCookie) {
      return redirect(request, "/?google=cancelled");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      console.error("Google token exchange failed:", await tokenResponse.text());
      return redirect(request, "/?google=failed");
    }

    const tokens = await tokenResponse.json();
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + tokens.access_token },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      console.error("Google profile lookup failed:", await profileResponse.text());
      return redirect(request, "/?google=failed");
    }

    const profile = await profileResponse.json();
    const email = String(profile.email || "").trim().toLowerCase();

    if (!email || profile.email_verified !== true) {
      return redirect(request, "/?google=unverified");
    }

    const existing = await db().query(
      "select id,email,created_at from users where email=$1",
      [email]
    );

    let user = existing.rows[0];

    if (!user) {
      const created = await db().query(
        "insert into users(email,password_hash) values($1,$2) returning id,email,created_at",
        [email, "GOOGLE:" + String(profile.sub)]
      );
      user = created.rows[0];
    }

    const response = redirect(request, "/");
    setSession(response, user);
    response.headers.set(
      "Set-Cookie",
      "google_oauth_state=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax" +
        (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );
    return response;
  } catch (error) {
    console.error("Google authentication error:", error);
    return redirect(request, "/?google=failed");
  }
}
