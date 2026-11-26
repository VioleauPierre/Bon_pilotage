import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminAuthClient } from "@/lib/admin-auth-client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { z } from "zod";

const adminUserId = z.string().trim().toLowerCase().pipe(z.uuid());

export function getSecondAdminUserId() {
  const primary = adminUserId.safeParse(process.env.ADMIN_SUPABASE_USER_ID).data;
  const second = adminUserId.safeParse(process.env.ADMIN_SUPABASE_SECOND_USER_ID).data;
  return second !== primary ? second : undefined;
}

export function isAllowedAdminUserId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const primary = adminUserId.safeParse(process.env.ADMIN_SUPABASE_USER_ID).data;
  return id === primary || id === getSecondAdminUserId();
}

export async function adminAuthClient(purpose: "admin" | "invitation" = "admin") {
  const store = await cookies();
  return createAdminAuthClient({
    getAll: () => store.getAll(),
    setAll: (values) => {
      for (const { name, value, options } of values) {
        store.set(name, value, purpose === "invitation" && options.maxAge !== 0
          ? { ...options, maxAge: 600 }
          : options);
      }
    },
  }, purpose);
}

export const getAdminSession = cache(async () => {
  const client = await adminAuthClient();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getClaims();
    const claims = data?.claims;
    const sessionId = z.uuid().safeParse(claims?.session_id);
    if (error || !isAllowedAdminUserId(claims?.sub) || !sessionId.success) return null;

    const { data: active, error: sessionError } = await getSupabaseAdminClient()
      .rpc("bp_admin_session_active", { p_user: claims.sub, p_session: sessionId.data });

    if (sessionError) throw sessionError;
    return active === true ? { client } : null;
  } catch {
    console.error("Admin session verification unavailable");
    return null;
  }
});

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin");
  return session;
}

export async function allowAdminLogin() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;

  const vercelIp = process.env.VERCEL === "1"
    ? (await headers()).get("x-vercel-forwarded-for")?.trim()
    : undefined;
  const ip = vercelIp && isIP(vercelIp) ? vercelIp : "shared";
  const bucket = createHmac("sha256", secret).update(`admin-login:${ip}`).digest("hex");
  const { data, error } = await getSupabaseAdminClient()
    .rpc("bp_admin_allow_login", { p_bucket: bucket });
  if (error) throw error;
  return data === true;
}

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function privateError(message: string, status: number) {
  return Response.json({ message }, { status, headers: privateHeaders });
}
