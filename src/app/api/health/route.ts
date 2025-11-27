import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";
import type { Database } from "@/lib/database.types";

/**
 * Simple health check to verify Supabase connectivity and env wiring.
 */
export async function GET() {
  try {
    const supabase = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const { error, count, status } = await supabase
      .from("avalanche_bulletins")
      .select("id", { head: true, count: "exact" });

    if (error) {
      return NextResponse.json(
        { ok: false, source: "supabase", status, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, source: "supabase", status, count: count ?? 0 },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, source: "supabase", error: message },
      { status: 500 },
    );
  }
}
