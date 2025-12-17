import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
    stabilityEn: string | null;
    stabilityFr: string | null;
    snowQualityEn: string | null;
    snowQualityFr: string | null;
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
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const variant =
    level >= 4 ? "destructive" : level === 3 ? "default" : "secondary";
  return <Badge variant={variant}>Level {level}</Badge>;
}

function getTodayDaily(daily: WeatherData["daily"]) {
  if (!daily) return null;
  const pick = <T,>(arr: T[] | undefined) =>
    Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
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
    .map(({ ts: _ts, ...rest }) => rest);
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

function StatRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default async function Home() {
  let data: DashboardResponse | null = null;
  let loadError: string | null = null;

  try {
    data = await fetchDashboard();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load dashboard";
  }

  const dailyToday = getTodayDaily(data?.weather?.daily ?? null);
  const upcomingHours = getUpcomingHours(data?.weather?.hourly ?? null, 6);
  const altitudeBands = Object.entries(data?.avalanche?.levelByAltitude ?? {});
  const aspectList = (() => {
    const aspects = data?.avalanche?.aspects ?? {};
    if (Array.isArray((aspects as any).all)) return (aspects as any).all as string[];
    const merged = Object.values(aspects).filter(Array.isArray).flat() as string[];
    return merged.length ? merged : [];
  })();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">MontSignal</Badge>
              <span className="text-sm text-muted-foreground">
                Mont Blanc conditions
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/">Refresh</a>
            </Button>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Weather & avalanche dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {data ? formatDate(data.lastUpdated) : "—"}
            </p>
          </div>
        </header>

        {loadError && (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Could not load dashboard</CardTitle>
              <CardDescription>
                The API request failed. Check your env vars and try again.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {loadError}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Weather */}
          <section className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Weather</span>
                      <Badge variant="outline">
                        {data?.weather?.model
                          ? `Model: ${data.weather.model}`
                          : "Model: —"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Source: {data?.weather?.source ?? "—"}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {dailyToday?.date ? formatDate(dailyToday.date) : "Today"}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Daily</p>
                      {data?.weather?.snowfallRecentCm != null && (
                        <Badge variant="outline">
                          Recent snow:{" "}
                          {formatNumber(data.weather.snowfallRecentCm, " cm")}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <StatRow
                        label="Sunrise"
                        value={formatTime(dailyToday?.sunrise ?? null)}
                      />
                      <StatRow
                        label="Sunset"
                        value={formatTime(dailyToday?.sunset ?? null)}
                      />
                      <StatRow
                        label="Daylight"
                        value={formatDurationSeconds(dailyToday?.daylight ?? null)}
                      />
                      <StatRow
                        label="Temp (max / min)"
                        value={
                          <>
                            {formatNumber(dailyToday?.tempMax, "°C")} /{" "}
                            {formatNumber(dailyToday?.tempMin, "°C")}
                          </>
                        }
                      />
                      <StatRow
                        label="Wind / Gust (max)"
                        value={
                          <>
                            {formatNumber(dailyToday?.windSpeedMax, " km/h")} /{" "}
                            {formatNumber(dailyToday?.gustMax, " km/h")}
                          </>
                        }
                      />
                      <StatRow
                        label="Precip (sum)"
                        value={formatNumber(dailyToday?.precipSum, " mm")}
                      />
                      <StatRow
                        label="Snowfall (sum)"
                        value={formatNumber(dailyToday?.snowfallSum, " cm")}
                      />
                      <StatRow
                        label="Precip probability"
                        value={formatNumber(dailyToday?.precipProbMax, "%")}
                      />
                      <StatRow
                        label="UV index (max)"
                        value={formatNumber(dailyToday?.uvIndexMax)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Next hours</p>

                    <div className="divide-y rounded-lg border">
                      {upcomingHours.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          No upcoming hours available.
                        </div>
                      ) : (
                        upcomingHours.map((h) => (
                          <div
                            key={h.label}
                            className="grid grid-cols-[90px_1fr] gap-4 p-3"
                          >
                            <div className="text-sm font-medium tabular-nums">
                              {h.label}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <StatRow
                                label="Temp"
                                value={formatNumber(h.temp, "°C")}
                              />
                              <StatRow
                                label="Cloud"
                                value={formatNumber(h.cloud, "%")}
                              />
                              <StatRow
                                label="Wind"
                                value={formatNumber(h.wind, " km/h")}
                              />
                              <StatRow
                                label="Gust"
                                value={formatNumber(h.gust, " km/h")}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="py-4">
                    <CardHeader className="border-b py-0">
                      <CardTitle className="text-base">
                        Low mountain
                        {data?.weather?.lowAltitude?.name
                          ? ` — ${data.weather.lowAltitude.name}`
                          : ""}
                      </CardTitle>
                      <CardDescription>
                        Elevation:{" "}
                        {formatNumber(data?.weather?.lowAltitude?.elevation, " m")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <StatRow
                        label="Temperature"
                        value={formatNumber(
                          data?.weather?.lowAltitude?.temperature,
                          "°C",
                        )}
                      />
                      <StatRow
                        label="Wind"
                        value={formatNumber(
                          data?.weather?.lowAltitude?.windSpeed,
                          " km/h",
                        )}
                      />
                      <StatRow
                        label="Gust"
                        value={formatNumber(data?.weather?.lowAltitude?.gust, " km/h")}
                      />
                      <StatRow
                        label="Cloud cover"
                        value={formatNumber(data?.weather?.lowAltitude?.cloudiness, "%")}
                      />
                      <StatRow
                        label="Snowfall"
                        value={formatNumber(data?.weather?.lowAltitude?.snowfall, " cm/h")}
                      />
                    </CardContent>
                  </Card>

                  <Card className="py-4">
                    <CardHeader className="border-b py-0">
                      <CardTitle className="text-base">
                        High mountain
                        {data?.weather?.highAltitude?.name
                          ? ` — ${data.weather.highAltitude.name}`
                          : ""}
                      </CardTitle>
                      <CardDescription>
                        Elevation:{" "}
                        {formatNumber(data?.weather?.highAltitude?.elevation, " m")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <StatRow
                        label="Temperature"
                        value={formatNumber(
                          data?.weather?.highAltitude?.temperature,
                          "°C",
                        )}
                      />
                      <StatRow
                        label="Wind"
                        value={formatNumber(
                          data?.weather?.highAltitude?.windSpeed,
                          " km/h",
                        )}
                      />
                      <StatRow
                        label="Gust"
                        value={formatNumber(data?.weather?.highAltitude?.gust, " km/h")}
                      />
                      <StatRow
                        label="Cloud cover"
                        value={formatNumber(data?.weather?.highAltitude?.cloudiness, "%")}
                      />
                      <StatRow
                        label="Snowfall"
                        value={formatNumber(data?.weather?.highAltitude?.snowfall, " cm/h")}
                      />
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Source recaps</CardTitle>
                <CardDescription>
                  Short summaries (translated) from other sources.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="mf" className="w-full">
                  <TabsList>
                    <TabsTrigger value="mf">Météo-France</TabsTrigger>
                    <TabsTrigger value="chx">Chamonix-Météo</TabsTrigger>
                  </TabsList>
                  <TabsContent value="mf" className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Last updated:{" "}
                      {formatDate(data?.sources.meteoFrance?.lastUpdated ?? null)}
                    </p>
                    <p className="text-sm leading-6">
                      {data?.sources.meteoFrance?.textEn ?? "No data yet."}
                    </p>
                  </TabsContent>
                  <TabsContent value="chx" className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Last updated:{" "}
                      {formatDate(data?.sources.chamonixMeteo?.lastUpdated ?? null)}
                    </p>
                    <p className="text-sm leading-6">
                      {data?.sources.chamonixMeteo?.textEn ?? "No data yet."}
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          {/* Right: Avalanche */}
          <section className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Avalanche bulletin</span>
                      <Badge variant="outline">
                        Valid: {data?.avalanche?.validDate ?? "—"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Issued: {formatDate(data?.avalanche?.issuedAt ?? null)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DangerBadge level={data?.avalanche?.levelMax ?? null} />
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Overall risk</p>
                    <div className="mt-3 space-y-2">
                      <StatRow
                        label="Min level"
                        value={<DangerBadge level={data?.avalanche?.levelMin ?? null} />}
                      />
                      <StatRow
                        label="Max level"
                        value={<DangerBadge level={data?.avalanche?.levelMax ?? null} />}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Critical aspects</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {aspectList.length > 0 ? (
                        aspectList.map((aspect) => (
                          <Badge
                            key={aspect}
                            variant="outline"
                            className="uppercase"
                          >
                            {aspect}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Not specified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="flex items-center justify-between gap-3 border-b p-4">
                    <p className="text-sm font-medium">Risk by altitude</p>
                    <span className="text-xs text-muted-foreground">
                      From the bulletin’s risk cartouche
                    </span>
                  </div>
                  <div className="divide-y">
                    {altitudeBands.length > 0 ? (
                      altitudeBands.map(([band, val]) => (
                        <div
                          key={band}
                          className="flex items-center justify-between gap-3 p-4"
                        >
                          <span className="text-sm font-medium">{band}</span>
                          <DangerBadge level={typeof val === "number" ? val : null} />
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        Not provided.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Summary</p>
                  <Tabs defaultValue="en">
                    <TabsList>
                      <TabsTrigger value="en">English</TabsTrigger>
                      <TabsTrigger value="fr">French</TabsTrigger>
                    </TabsList>
                    <TabsContent value="en" className="pt-2">
                      <p className="text-sm leading-6">
                        {data?.avalanche?.summaryEn ?? "No summary available yet."}
                      </p>
                    </TabsContent>
                    <TabsContent value="fr" className="pt-2">
                      <p className="text-sm leading-6">
                        {data?.avalanche?.summaryFr ?? "Aucun résumé disponible."}
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>

                <Accordion type="multiple" className="space-y-2">
                  <AccordionItem value="stability">
                    <AccordionTrigger className="text-sm">
                      Snowpack stability
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <Tabs defaultValue="en">
                        <TabsList>
                          <TabsTrigger value="en">English</TabsTrigger>
                          <TabsTrigger value="fr">French</TabsTrigger>
                        </TabsList>
                        <TabsContent value="en" className="pt-2">
                          <p className="text-sm leading-6">
                            {data?.avalanche?.stabilityEn ?? "No data yet."}
                          </p>
                        </TabsContent>
                        <TabsContent value="fr" className="pt-2">
                          <p className="text-sm leading-6">
                            {data?.avalanche?.stabilityFr ?? "Pas de données."}
                          </p>
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="snow-quality">
                    <AccordionTrigger className="text-sm">
                      Snow quality
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <Tabs defaultValue="en">
                        <TabsList>
                          <TabsTrigger value="en">English</TabsTrigger>
                          <TabsTrigger value="fr">French</TabsTrigger>
                        </TabsList>
                        <TabsContent value="en" className="pt-2">
                          <p className="text-sm leading-6">
                            {data?.avalanche?.snowQualityEn ?? "No data yet."}
                          </p>
                        </TabsContent>
                        <TabsContent value="fr" className="pt-2">
                          <p className="text-sm leading-6">
                            {data?.avalanche?.snowQualityFr ?? "Pas de données."}
                          </p>
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
