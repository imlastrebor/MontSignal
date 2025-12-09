import { NextResponse } from "next/server";

import { getSupabaseServiceRoleClient } from "@/lib/supabaseClient";
import { ingestMeteoFranceBra } from "@/lib/ingestMeteoFranceBra";
import { MASSIF_ID_MONT_BLANC } from "@/lib/meteoFrance";

type DashboardResponse = {
  lastUpdated: string | null;
  avalanche: {
    levelMin: number | null;
    levelMax: number | null;
    levelByAltitude: Record<string, number | null>;
    aspects: Record<string, string[]>;
    summaryEn: string | null;
    summaryFr: string | null;
    issuedAt: string | null;
    validDate: string | null;
  } | null;
  weather: {
    source: string | null;
    lowAltitude: {
      elevation: number | null;
      temperature: number | null;
      windSpeed: number | null;
      windDirectionDeg: number | null;
      cloudiness: number | null;
    } | null;
    highAltitude: {
      elevation: number | null;
      temperature: number | null;
      windSpeed: number | null;
      windDirectionDeg: number | null;
      cloudiness: number | null;
    } | null;
    snowfallRecentCm: number | null;
  } | null;
  sources: {
    meteoFrance: {
      textEn: string | null;
      textFr: string | null;
      lastUpdated: string | null;
    } | null;
    chamonixMeteo: {
      textEn: string | null;
      textFr: string | null;
      lastUpdated: string | null;
    } | null;
  };
};

const STALE_HOURS = 18;

function isStale(issuedAt: string | null): boolean {
  if (!issuedAt) return true;
  const issued = new Date(issuedAt).getTime();
  if (Number.isNaN(issued)) return true;
  const diffHours = (Date.now() - issued) / (1000 * 60 * 60);
  return diffHours > STALE_HOURS;
}

export async function GET(req: Request) {
  const supabase = getSupabaseServiceRoleClient();
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const [{ data: braRows, error: braError }] = await Promise.all([
    supabase
      .from("avalanche_bulletins")
      .select("*")
      .order("valid_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (braError) {
    return NextResponse.json({ ok: false, error: braError.message }, { status: 500 });
  }

  let bra = braRows?.[0];

  if ((forceRefresh || isStale(bra?.issued_at ?? null)) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await ingestMeteoFranceBra(MASSIF_ID_MONT_BLANC);
      const { data: refetched } = await supabase
        .from("avalanche_bulletins")
        .select("*")
        .order("valid_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      bra = refetched?.[0] ?? bra;
    } catch (e) {
      // Ignore soft failures so dashboard still returns existing data.
      console.error("Failed to refresh BRA", e);
    }
  }

  const [meteoFranceText, chamonixText, weatherRowResult] = await Promise.all([
    supabase
      .from("text_sources")
      .select("*")
      .eq("source", "meteo-france-bra")
      .order("valid_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("text_sources")
      .select("*")
      .eq("source", "chamonix-meteo")
      .order("valid_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weather_snapshots")
      .select("*")
      .order("valid_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const weatherRow = weatherRowResult.data ?? null;

  const avalanche = bra
    ? (() => {
        const levelByAltitude =
          (bra.danger_level_by_altitude as Record<string, unknown>) ?? {};
        const aspects = (bra.danger_aspects as Record<string, unknown>) ?? {};
        return {
          levelMin: bra.danger_level_min,
          levelMax: bra.danger_level_max,
          levelByAltitude: Object.fromEntries(
            Object.entries(levelByAltitude).map(([k, v]) => [k, typeof v === "number" ? v : null]),
          ),
          aspects: Object.fromEntries(
            Object.entries(aspects).map(([k, v]) => [
              k,
              Array.isArray(v) ? (v as string[]) : [],
            ]),
          ),
          summaryEn: bra.english_text,
          summaryFr: bra.french_text,
          issuedAt: bra.issued_at ?? null,
          validDate: bra.valid_date ?? null,
        };
      })()
    : null;

  const weather = weatherRow
    ? (() => {
        const data = (weatherRow.data as Record<string, unknown>) || {};
        const normalizeAltitude = (val: unknown) => {
          const obj = (val as Record<string, unknown>) || {};
          return {
            elevation: typeof obj.elevation === "number" ? obj.elevation : null,
            temperature: typeof obj.temperature === "number" ? obj.temperature : null,
            windSpeed: typeof obj.windSpeed === "number" ? obj.windSpeed : null,
            windDirectionDeg:
              typeof obj.windDirectionDeg === "number" ? obj.windDirectionDeg : null,
            cloudiness: typeof obj.cloudiness === "number" ? obj.cloudiness : null,
          };
        };
        return {
          source: weatherRow.source ?? null,
          lowAltitude: data.lowAltitude ? normalizeAltitude(data.lowAltitude) : null,
          highAltitude: data.highAltitude ? normalizeAltitude(data.highAltitude) : null,
          snowfallRecentCm:
            typeof data.snowfallRecentCm === "number" ? data.snowfallRecentCm : null,
        };
      })()
    : null;

  const response: DashboardResponse = {
    lastUpdated: avalanche?.issuedAt ?? weatherRow?.timestamp ?? null,
    avalanche,
    weather,
    sources: {
      meteoFrance: meteoFranceText.data
        ? {
            textEn: meteoFranceText.data.english_text,
            textFr: meteoFranceText.data.french_text,
            lastUpdated: meteoFranceText.data.updated_at,
          }
        : null,
      chamonixMeteo: chamonixText.data
        ? {
            textEn: chamonixText.data.english_text,
            textFr: chamonixText.data.french_text,
            lastUpdated: chamonixText.data.updated_at,
          }
        : null,
    },
  };

  return NextResponse.json(response);
}
