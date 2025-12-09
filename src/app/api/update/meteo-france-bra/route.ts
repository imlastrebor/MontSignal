import { NextResponse } from "next/server";

import { env } from "@/env";
import { ingestMeteoFranceBra } from "@/lib/ingestMeteoFranceBra";
import { MASSIF_ID_MONT_BLANC } from "@/lib/meteoFrance";

function authorize(req: Request): boolean {
  const allowedSecrets = [env.INTERNAL_UPDATE_SECRET, env.CRON_SECRET].filter(Boolean);
  if (allowedSecrets.length === 0) return true; // allow if not configured

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

  const url = new URL(req.url);
  const massifParam = url.searchParams.get("massifId");
  const massifId = massifParam ? Number(massifParam) : MASSIF_ID_MONT_BLANC;

  try {
    const result = await ingestMeteoFranceBra(massifId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// GET for convenience during development.
export const GET = POST;
