import { NextResponse } from "next/server";

import { env } from "@/env";
import { ingestMeteoFranceBra } from "@/lib/ingestMeteoFranceBra";
import { MASSIF_ID_MONT_BLANC } from "@/lib/meteoFrance";

function authorize(req: Request): boolean {
  if (!env.INTERNAL_UPDATE_SECRET) return true; // allow if not configured
  const provided = req.headers.get("x-internal-secret");
  return provided === env.INTERNAL_UPDATE_SECRET;
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
