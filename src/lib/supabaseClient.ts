import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "@/env";

let browserClient: SupabaseClient<Database> | null = null;
let serviceRoleClient: SupabaseClient<Database> | null = null;

/**
 * Use in browser/client components with the anon key.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return browserClient;
}

/**
 * Use server-side only (Route Handlers, server actions) for write operations.
 * Throws if the service role key is not configured.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient<Database> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; required for server-side writes.");
  }

  if (!serviceRoleClient) {
    serviceRoleClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serviceRoleClient;
}
