import { NextResponse } from "next/server";

import { getSupabaseServiceRoleClient } from "@/lib/supabaseClient";
import { ingestMeteoFranceBra } from "@/lib/ingestMeteoFranceBra";
import { MASSIF_ID_MONT_BLANC } from "@/lib/meteoFrance";
import { ingestOpenMeteoWeather } from "@/lib/ingestOpenMeteoWeather";

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
    model: string | null;
    lowAltitude: {
      name: string | null;
      elevation: number | null;
      temperature: number | null;
      windSpeed: number | null;
      windDirectionDeg: number | null;
      cloudiness: number | null;
      gust: number | null;
      snowfall: number | null;
    } | null;
    highAltitude: {
      name: string | null;
      elevation: number | null;
      temperature: number | null;
      windSpeed: number | null;
      windDirectionDeg: number | null;
      cloudiness: number | null;
      gust: number | null;
      snowfall: number | null;
    } | null;
    snowfallRecentCm: number | null;
    daily:
      | {
          time: string[];
          sunrise: string[];
          sunset: string[];
          daylight_duration: number[];
          wind_speed_10m_max: number[];
          wind_gusts_10m_max: number[];
          wind_direction_10m_dominant: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          uv_index_max: number[];
          precipitation_probability_max: number[];
          snowfall_sum: number[];
          precipitation_sum: number[];
        }
      | null;
    hourly:
      | {
          time: string[];
          temperature_2m: number[];
          precipitation: number[];
          rain: number[];
          snowfall: number[];
          cloud_cover: number[];
          wind_gusts_10m: number[];
          wind_speed_10m: number[];
          temperature_20m: number[];
          wind_direction_10m: number[];
          wind_speed_100m: number[];
          wind_direction_100m: number[];
        }
      | null;
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
const STALE_WEATHER_HOURS = 3;

function isStale(issuedAt: string | null): boolean {
  if (!issuedAt) return true;
  const issued = new Date(issuedAt).getTime();
  if (Number.isNaN(issued)) return true;
  const diffHours = (Date.now() - issued) / (1000 * 60 * 60);
  return diffHours > STALE_HOURS;
}

function isWeatherStale(timestamp: string | null): boolean {
  if (!timestamp) return true;
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return true;
  const diffHours = (Date.now() - ts) / (1000 * 60 * 60);
  return diffHours > STALE_WEATHER_HOURS;
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

  if ((forceRefresh || isWeatherStale(weatherRow?.timestamp ?? null)) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await ingestOpenMeteoWeather();
      const { data: refetchedWeather } = await supabase
        .from("weather_snapshots")
        .select("*")
        .order("valid_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (refetchedWeather) {
        (weatherRowResult as { data: typeof refetchedWeather | null }).data = refetchedWeather;
      }
    } catch (e) {
      console.error("Failed to refresh Open-Meteo weather", e);
    }
  }

  const effectiveWeatherRow = weatherRowResult.data ?? weatherRow;

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

  const weather = effectiveWeatherRow
    ? (() => {
        const data = (effectiveWeatherRow.data as Record<string, unknown>) || {};
        const normalizeArray = <T>(val: unknown): T[] => (Array.isArray(val) ? (val as T[]) : []);
        const normalizeAltitude = (val: unknown) => {
          const obj = (val as Record<string, unknown>) || {};
          return {
            name: typeof obj.name === "string" ? obj.name : null,
            elevation: typeof obj.elevation === "number" ? obj.elevation : null,
            temperature: typeof obj.temperature === "number" ? obj.temperature : null,
            windSpeed: typeof obj.windSpeed === "number" ? obj.windSpeed : null,
            windDirectionDeg:
              typeof obj.windDirectionDeg === "number" ? obj.windDirectionDeg : null,
            cloudiness: typeof obj.cloudiness === "number" ? obj.cloudiness : null,
            gust: typeof obj.gust === "number" ? obj.gust : null,
            snowfall: typeof obj.snowfall === "number" ? obj.snowfall : null,
          };
        };
        const daily = data.daily
          ? {
              time: normalizeArray<string>((data.daily as any).time),
              sunrise: normalizeArray<string>((data.daily as any).sunrise),
              sunset: normalizeArray<string>((data.daily as any).sunset),
              daylight_duration: normalizeArray<number>((data.daily as any).daylight_duration),
              wind_speed_10m_max: normalizeArray<number>((data.daily as any).wind_speed_10m_max),
              wind_gusts_10m_max: normalizeArray<number>((data.daily as any).wind_gusts_10m_max),
              wind_direction_10m_dominant: normalizeArray<number>(
                (data.daily as any).wind_direction_10m_dominant,
              ),
              temperature_2m_max: normalizeArray<number>((data.daily as any).temperature_2m_max),
              temperature_2m_min: normalizeArray<number>((data.daily as any).temperature_2m_min),
              uv_index_max: normalizeArray<number>((data.daily as any).uv_index_max),
              precipitation_probability_max: normalizeArray<number>(
                (data.daily as any).precipitation_probability_max,
              ),
              snowfall_sum: normalizeArray<number>((data.daily as any).snowfall_sum),
              precipitation_sum: normalizeArray<number>((data.daily as any).precipitation_sum),
            }
          : null;

        const hourly = data.hourly
          ? {
              time: normalizeArray<string>((data.hourly as any).time),
              temperature_2m: normalizeArray<number>((data.hourly as any).temperature_2m),
              precipitation: normalizeArray<number>((data.hourly as any).precipitation),
              rain: normalizeArray<number>((data.hourly as any).rain),
              snowfall: normalizeArray<number>((data.hourly as any).snowfall),
              cloud_cover: normalizeArray<number>((data.hourly as any).cloud_cover),
              wind_gusts_10m: normalizeArray<number>((data.hourly as any).wind_gusts_10m),
              wind_speed_10m: normalizeArray<number>((data.hourly as any).wind_speed_10m),
              temperature_20m: normalizeArray<number>((data.hourly as any).temperature_20m),
              wind_direction_10m: normalizeArray<number>((data.hourly as any).wind_direction_10m),
              wind_speed_100m: normalizeArray<number>((data.hourly as any).wind_speed_100m),
              wind_direction_100m: normalizeArray<number>((data.hourly as any).wind_direction_100m),
            }
          : null;

        return {
          source: effectiveWeatherRow.source ?? null,
          model: typeof data.model === "string" ? data.model : null,
          lowAltitude: data.lowAltitude ? normalizeAltitude(data.lowAltitude) : null,
          highAltitude: data.highAltitude ? normalizeAltitude(data.highAltitude) : null,
          snowfallRecentCm:
            typeof data.snowfallRecentCm === "number" ? data.snowfallRecentCm : null,
          daily,
          hourly,
        };
      })()
    : null;

  const response: DashboardResponse = {
    lastUpdated: avalanche?.issuedAt ?? effectiveWeatherRow?.timestamp ?? null,
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
