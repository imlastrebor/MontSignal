import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type WeatherData = NonNullable<DashboardResponse["weather"]>;

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", { timeZone: "Europe/Paris" });
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 10) / 10}${suffix}`;
}

function formatDurationSeconds(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function DangerBadge({ level }: { level: number | null }) {
  if (level == null) return <Badge variant="outline">n/a</Badge>;
  const colors: Record<number, string> = {
    1: "bg-green-100 text-green-800",
    2: "bg-yellow-100 text-yellow-800",
    3: "bg-orange-100 text-orange-800",
    4: "bg-red-100 text-red-800",
    5: "bg-black text-white",
  };
  const color = colors[level] ?? "bg-slate-100 text-slate-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-sm font-semibold ${color}`}
    >
      Lvl {level}
    </span>
  );
}

function getTodayDaily(daily: WeatherData["daily"]) {
  if (!daily) return null;
  const pick = <T>(arr: T[] | undefined) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : null);
  return {
    date: pick(daily.time),
    sunrise: pick(daily.sunrise),
    sunset: pick(daily.sunset),
    daylight: pick(daily.daylight_duration),
    windSpeedMax: pick(daily.wind_speed_10m_max),
    gustMax: pick(daily.wind_gusts_10m_max),
    windDirection: pick(daily.wind_direction_10m_dominant),
    tempMax: pick(daily.temperature_2m_max),
    tempMin: pick(daily.temperature_2m_min),
    uvIndexMax: pick(daily.uv_index_max),
    precipProbMax: pick(daily.precipitation_probability_max),
    snowfallSum: pick(daily.snowfall_sum),
    precipSum: pick(daily.precipitation_sum),
  };
}

function getUpcomingHours(
  hourly: WeatherData["hourly"],
  count: number = 6,
): {
  label: string;
  temp: number | null;
  wind: number | null;
  windDir: number | null;
  gust: number | null;
  cloud: number | null;
  snow: number | null;
}[] {
  if (!hourly) return [];
  const now = Date.now();
  const entries = hourly.time.map((t, idx) => {
    const ts = new Date(t).getTime();
    return {
      ts,
      label: formatTime(t),
      temp: hourly.temperature_2m?.[idx] ?? null,
      wind: hourly.wind_speed_10m?.[idx] ?? null,
      windDir: hourly.wind_direction_10m?.[idx] ?? null,
      gust: hourly.wind_gusts_10m?.[idx] ?? null,
      cloud: hourly.cloud_cover?.[idx] ?? null,
      snow: hourly.snowfall?.[idx] ?? null,
    };
  });

  return entries
    .filter((e) => !Number.isNaN(e.ts) && e.ts >= now)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, count)
    .map(({ ts, ...rest }) => ({ ...rest, label: formatTime(new Date(ts).toISOString()) }));
}

async function fetchDashboard(): Promise<DashboardResponse> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${base}/api/dashboard`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load dashboard data");
  }
  return res.json();
}

export default async function Home() {
  const data = await fetchDashboard();
  const dailyToday = getTodayDaily(data.weather?.daily ?? null);
  const upcomingHours = getUpcomingHours(data.weather?.hourly ?? null, 6);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-blue-800">MontSignal</p>
        <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-5xl">
          Mont Blanc weather & avalanche dashboard
        </h1>
        <p className="text-sm text-neutral-600">Last updated: {formatDate(data.lastUpdated)}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Avalanche danger
              <div className="flex gap-2">
                <DangerBadge level={data.avalanche?.levelMin ?? null} />
                <DangerBadge level={data.avalanche?.levelMax ?? null} />
              </div>
            </CardTitle>
            <p className="text-sm text-neutral-500">
              Valid: {data.avalanche?.validDate ?? "—"} • Issued:{" "}
              {formatDate(data.avalanche?.issuedAt ?? null)}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-neutral-800">
              {data.avalanche?.summaryEn ?? "No summary available yet."}
            </p>
            <div className="h-px w-full bg-neutral-200" />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-neutral-500">Risk by altitude</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.avalanche?.levelByAltitude ?? {}).map(([band, val]) => (
                  <Badge key={band} variant="secondary">
                    {band}: {val ?? "n/a"}
                  </Badge>
                ))}
                {Object.keys(data.avalanche?.levelByAltitude ?? {}).length === 0 && (
                  <span className="text-sm text-neutral-500">Not provided</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Weather snapshot
              <Badge variant="outline">
                {data.weather?.model ? `Model: ${data.weather.model}` : "Model: —"}
              </Badge>
            </CardTitle>
            <p className="text-sm text-neutral-500">Source: {data.weather?.source ?? "pending"}</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm text-neutral-800">
            <div>
              <p className="font-semibold">
                Low altitude{data.weather?.lowAltitude?.name ? ` – ${data.weather.lowAltitude.name}` : ""}
              </p>
              <p className="text-xs text-neutral-500">
                Elevation: {formatNumber(data.weather?.lowAltitude?.elevation, " m")}
              </p>
              <p>Temp: {formatNumber(data.weather?.lowAltitude?.temperature, "°C")}</p>
              <p>Wind: {formatNumber(data.weather?.lowAltitude?.windSpeed, " km/h")}</p>
              <p>Gust: {formatNumber(data.weather?.lowAltitude?.gust, " km/h")}</p>
              <p>Cloud: {formatNumber(data.weather?.lowAltitude?.cloudiness, "%")}</p>
              <p>Snowfall: {formatNumber(data.weather?.lowAltitude?.snowfall, " cm/h")}</p>
            </div>
            <div>
              <p className="font-semibold">
                High altitude
                {data.weather?.highAltitude?.name ? ` – ${data.weather.highAltitude.name}` : ""}
              </p>
              <p className="text-xs text-neutral-500">
                Elevation: {formatNumber(data.weather?.highAltitude?.elevation, " m")}
              </p>
              <p>Temp: {formatNumber(data.weather?.highAltitude?.temperature, "°C")}</p>
              <p>Wind: {formatNumber(data.weather?.highAltitude?.windSpeed, " km/h")}</p>
              <p>Gust: {formatNumber(data.weather?.highAltitude?.gust, " km/h")}</p>
              <p>Cloud: {formatNumber(data.weather?.highAltitude?.cloudiness, "%")}</p>
              <p>Snowfall: {formatNumber(data.weather?.highAltitude?.snowfall, " cm/h")}</p>
            </div>
            <div className="col-span-2">
              <p>Recent snowfall: {formatNumber(data.weather?.snowfallRecentCm, " cm")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast details</CardTitle>
          <p className="text-sm text-neutral-500">
            Today: {dailyToday?.date ? formatDate(dailyToday.date) : "—"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-neutral-500">Daily summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800">
                <span>Sunrise</span>
                <span className="text-right">{formatTime(dailyToday?.sunrise ?? null)}</span>
                <span>Sunset</span>
                <span className="text-right">{formatTime(dailyToday?.sunset ?? null)}</span>
                <span>Daylight</span>
                <span className="text-right">
                  {formatDurationSeconds(dailyToday?.daylight ?? null)}
                </span>
                <span>Temp max/min</span>
                <span className="text-right">
                  {formatNumber(dailyToday?.tempMax, "°C")} / {formatNumber(dailyToday?.tempMin, "°C")}
                </span>
                <span>Wind / Gust</span>
                <span className="text-right">
                  {formatNumber(dailyToday?.windSpeedMax, " km/h")} /{" "}
                  {formatNumber(dailyToday?.gustMax, " km/h")}
                </span>
                <span>Wind dir</span>
                <span className="text-right">{formatNumber(dailyToday?.windDirection, "°")}</span>
                <span>Snowfall (day)</span>
                <span className="text-right">
                  {formatNumber(dailyToday?.snowfallSum, " cm")}
                </span>
                <span>Precipitation</span>
                <span className="text-right">
                  {formatNumber(dailyToday?.precipSum, " mm")}
                </span>
                <span>Precip prob</span>
                <span className="text-right">
                  {formatNumber(dailyToday?.precipProbMax, "%")}
                </span>
                <span>UV index</span>
                <span className="text-right">{formatNumber(dailyToday?.uvIndexMax)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-neutral-500">Next hours</p>
              <div className="overflow-auto rounded-md border border-neutral-200">
                <table className="w-full text-left text-sm text-neutral-800">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Temp</th>
                      <th className="px-3 py-2">Wind / Gust</th>
                      <th className="px-3 py-2">Cloud</th>
                      <th className="px-3 py-2">Snow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingHours.length === 0 && (
                      <tr>
                        <td className="px-3 py-3 text-neutral-500" colSpan={5}>
                          No upcoming hours available.
                        </td>
                      </tr>
                    )}
                    {upcomingHours.map((h) => (
                      <tr key={h.label} className="odd:bg-white even:bg-neutral-50/60">
                        <td className="px-3 py-2">{h.label}</td>
                        <td className="px-3 py-2">{formatNumber(h.temp, "°C")}</td>
                        <td className="px-3 py-2">
                          {formatNumber(h.wind, " km/h")} / {formatNumber(h.gust, " km/h")}
                        </td>
                        <td className="px-3 py-2">{formatNumber(h.cloud, "%")}</td>
                        <td className="px-3 py-2">{formatNumber(h.snow, " cm/h")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source recaps</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="mf" className="w-full">
            <TabsList>
              <TabsTrigger value="mf">Météo-France</TabsTrigger>
              <TabsTrigger value="chx">Chamonix-Météo</TabsTrigger>
            </TabsList>
            <TabsContent value="mf" className="space-y-2">
              <p className="text-xs text-neutral-500">
                Last updated: {formatDate(data.sources.meteoFrance?.lastUpdated ?? null)}
              </p>
              <p className="text-sm leading-6 text-neutral-800">
                {data.sources.meteoFrance?.textEn ?? "No data yet."}
              </p>
            </TabsContent>
            <TabsContent value="chx" className="space-y-2">
              <p className="text-xs text-neutral-500">
                Last updated: {formatDate(data.sources.chamonixMeteo?.lastUpdated ?? null)}
              </p>
              <p className="text-sm leading-6 text-neutral-800">
                {data.sources.chamonixMeteo?.textEn ?? "No data yet."}
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
