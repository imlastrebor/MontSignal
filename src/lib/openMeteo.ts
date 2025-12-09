import { env } from "@/env";

import type { Json } from "@/lib/database.types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const MODEL = "meteofrance_seamless";
const TIMEZONE = "Europe/Paris";

const LOW_ALT = {
  latitude: 45.9237,
  longitude: 6.8693,
  elevation: 1035, // Chamonix valley
};

const HIGH_ALT = {
  latitude: 45.8789,
  longitude: 6.887,
  elevation: 3842, // Aiguille du Midi
};

const HOURLY_FIELDS = [
  "temperature_2m",
  "precipitation",
  "rain",
  "snowfall",
  "cloud_cover",
  "wind_gusts_10m",
  "wind_speed_10m",
  "temperature_20m",
  "wind_direction_10m",
  "wind_speed_100m",
  "wind_direction_100m",
];

const DAILY_FIELDS = [
  "sunrise",
  "sunset",
  "daylight_duration",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "temperature_2m_max",
  "temperature_2m_min",
  "uv_index_max",
  "precipitation_probability_max",
  "snowfall_sum",
  "precipitation_sum",
];

type HourlySeries = {
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
};

type DailySeries = {
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
};

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
  generationtime_ms: number;
  hourly: HourlySeries;
  daily: DailySeries;
};

function toSearchParams(base: Record<string, string | number | string[]>): string {
  const params = new URLSearchParams();
  Object.entries(base).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

async function fetchForecast(coords: {
  latitude: number;
  longitude: number;
  elevation: number;
}): Promise<OpenMeteoResponse> {
  const url = `${OPEN_METEO_URL}?${toSearchParams({
    latitude: coords.latitude,
    longitude: coords.longitude,
    elevation: coords.elevation,
    timezone: TIMEZONE,
    models: MODEL,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
  })}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Open-Meteo fetch failed (${res.status}): ${text}`);
  }

  return (await res.json()) as OpenMeteoResponse;
}

function nearestIndex(times: string[], now: Date): number {
  if (!times?.length) return 0;
  const nowTs = now.getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  times.forEach((t, idx) => {
    const ts = new Date(t).getTime();
    if (Number.isNaN(ts)) return;
    const diff = Math.abs(ts - nowTs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parisTodayIso(): string {
  // en-CA yields YYYY-MM-DD format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clampValidDate(candidate: string | undefined | null): string {
  const today = parisTodayIso();
  if (!candidate) return today;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return today;
  const diffDays = Math.abs((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diffDays > 2 ? today : candidate.slice(0, 10);
}

function pickHourlySnapshot(hourly: HourlySeries | undefined, now: Date) {
  if (!hourly) return null;
  const idx = nearestIndex(hourly.time, now);
  return {
    time: hourly.time[idx],
    temperature2m: numberOrNull(hourly.temperature_2m?.[idx]),
    precipitation: numberOrNull(hourly.precipitation?.[idx]),
    rain: numberOrNull(hourly.rain?.[idx]),
    snowfall: numberOrNull(hourly.snowfall?.[idx]),
    cloudCover: numberOrNull(hourly.cloud_cover?.[idx]),
    windGusts10m: numberOrNull(hourly.wind_gusts_10m?.[idx]),
    windSpeed10m: numberOrNull(hourly.wind_speed_10m?.[idx]),
    temperature20m: numberOrNull(hourly.temperature_20m?.[idx]),
    windDirection10m: numberOrNull(hourly.wind_direction_10m?.[idx]),
    windSpeed100m: numberOrNull(hourly.wind_speed_100m?.[idx]),
    windDirection100m: numberOrNull(hourly.wind_direction_100m?.[idx]),
  };
}

export type OpenMeteoSnapshot = {
  source: string;
  location: string;
  validDate: string;
  timestamp: string;
  data: {
    model: string;
    lowAltitude: {
      name: string | null;
      elevation: number | null;
      temperature: number | null;
      windSpeed: number | null;
      windDirectionDeg: number | null;
      gust: number | null;
      cloudiness: number | null;
      snowfall: number | null;
    };
    highAltitude: {
      name: string | null;
      elevation: number | null;
      temperature: number | null;
      windSpeed: number | null;
      windDirectionDeg: number | null;
      gust: number | null;
      cloudiness: number | null;
      snowfall: number | null;
    };
    snowfallRecentCm: number | null;
    daily: DailySeries;
    hourly: HourlySeries;
  };
};

/**
 * Fetches Open-Meteo (Météo-France model) for low- and high-altitude points and
 * returns a structured snapshot ready to persist as weather_snapshots.data.
 */
export async function fetchOpenMeteoSnapshot(): Promise<OpenMeteoSnapshot> {
  // env import retained to align with other libs (and future per-env switching)
  void env;
  const [low, high] = await Promise.all([fetchForecast(LOW_ALT), fetchForecast(HIGH_ALT)]);
  const now = new Date();

  const lowHour = pickHourlySnapshot(low.hourly, now);
  const highHour = pickHourlySnapshot(high.hourly, now);

  const validDate = clampValidDate(
    low.daily?.time?.[0] ?? high.daily?.time?.[0] ?? new Date().toISOString(),
  );

  const snowfallRecentCm =
    numberOrNull(low.daily?.snowfall_sum?.[0]) ?? numberOrNull(high.daily?.snowfall_sum?.[0]);

  return {
    source: "open-meteo-meteofrance",
    location: "Mont-Blanc",
    validDate,
    timestamp: new Date().toISOString(),
    data: {
      model: MODEL,
      lowAltitude: {
        name: "Chamonix",
        elevation: numberOrNull(low.elevation),
        temperature: lowHour?.temperature2m ?? null,
        windSpeed: lowHour?.windSpeed10m ?? null,
        windDirectionDeg: lowHour?.windDirection10m ?? null,
        gust: lowHour?.windGusts10m ?? null,
        cloudiness: lowHour?.cloudCover ?? null,
        snowfall: lowHour?.snowfall ?? null,
      },
      highAltitude: {
        name: "Aiguille du Midi",
        elevation: numberOrNull(high.elevation),
        temperature: highHour?.temperature2m ?? null,
        windSpeed: highHour?.windSpeed100m ?? highHour?.windSpeed10m ?? null,
        windDirectionDeg: highHour?.windDirection100m ?? highHour?.windDirection10m ?? null,
        gust: highHour?.windGusts10m ?? null,
        cloudiness: highHour?.cloudCover ?? null,
        snowfall: highHour?.snowfall ?? null,
      },
      snowfallRecentCm,
      daily: low.daily ?? high.daily,
      hourly: low.hourly ?? high.hourly,
    },
  };
}

export type OpenMeteoSnapshotJson = OpenMeteoSnapshot["data"] extends infer D
  ? D extends object
    ? D & Json
    : Json
  : Json;
