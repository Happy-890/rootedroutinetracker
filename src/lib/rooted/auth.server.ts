// Project auth middleware: unlike the generated requireSupabaseAuth (which checks
// token claims statelessly), this revalidates the token with the auth server on
// every request, so signing out revokes access immediately instead of letting a
// saved token keep working until it expires.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const requireVerifiedAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase environment variable(s). Connect Supabase in Lovable Cloud.");
    }

    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No bearer token provided");
    }
    const token = authHeader.replace("Bearer ", "");
    if (!token || token.split(".").length !== 3) {
      throw new Error("Unauthorized: Invalid token");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    // getUser revalidates with the auth server: revoked/signed-out sessions fail here.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error("Unauthorized: Session is no longer active");
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: { sub: data.user.id, email: data.user.email },
      },
    });
  },
);
