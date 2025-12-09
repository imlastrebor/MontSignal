import { NextResponse } from "next/server";

import { env } from "@/env";
import { ingestOpenMeteoWeather } from "@/lib/ingestOpenMeteoWeather";

function authorize(req: Request): boolean {
  const allowedSecrets = [env.INTERNAL_UPDATE_SECRET, env.CRON_SECRET].filter(Boolean);
  if (allowedSecrets.length === 0) return true;

  const headerSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  return allowedSecrets.some((secret) => secret && (secret === headerSecret || secret === bearerSecret));
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestOpenMeteoWeather();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = POST;
