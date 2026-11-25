import { NextResponse, type NextRequest } from "next/server";
import { createAdminAuthClient } from "@/lib/admin-auth-client";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createAdminAuthClient({
    getAll: () => request.cookies.getAll(),
    setAll: (values) => {
      for (const { name, value } of values) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of values) {
        response.cookies.set(name, value, options);
      }
    },
  });

  // Maintient le cookie dans la requête que les pages serveur vont lire.
  if (client && request.cookies.getAll().some(({ name }) => name.startsWith("bon-pilotage-admin"))) {
    await client.auth.getClaims().catch(() => undefined);
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
