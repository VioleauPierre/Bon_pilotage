import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";

export function createAdminAuthClient(cookies: CookieMethodsServer, purpose: "admin" | "invitation" = "admin") {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies,
    cookieOptions: {
      name: `bon-pilotage-${purpose}`,
      path: purpose === "invitation" ? "/admin/invitation" : "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" &&
        (process.env.VERCEL === "1" || process.env.ADMIN_LOCAL_HTTP !== "1"),
    },
  });
}
