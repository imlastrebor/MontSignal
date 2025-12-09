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

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", { timeZone: "Europe/Paris" });
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
            <CardTitle>Weather snapshot</CardTitle>
            <p className="text-sm text-neutral-500">Source: {data.weather?.source ?? "pending"}</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm text-neutral-800">
            <div>
              <p className="font-semibold">Low altitude</p>
              <p>Temp: {data.weather?.lowAltitude?.temperature ?? "—"}°C</p>
              <p>Wind: {data.weather?.lowAltitude?.windSpeed ?? "—"} km/h</p>
            </div>
            <div>
              <p className="font-semibold">High altitude</p>
              <p>Temp: {data.weather?.highAltitude?.temperature ?? "—"}°C</p>
              <p>Wind: {data.weather?.highAltitude?.windSpeed ?? "—"} km/h</p>
            </div>
            <div className="col-span-2">
              <p>Recent snowfall: {data.weather?.snowfallRecentCm ?? "—"} cm</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
