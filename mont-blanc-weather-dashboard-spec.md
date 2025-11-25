
# Mont Blanc Weather & Avalanche Dashboard – Project Spec

This document describes the **Mont Blanc Weather & Avalanche Dashboard** web app and provides a **step‑by‑step implementation plan** suitable for driving an AI coding assistant (e.g. “Codex” in VS Code).

The key goals:
- Build a **Next.js + TypeScript** app
- Use **Tailwind CSS** and **shadcn/ui** for UI
- Use **Supabase** (Postgres) for data storage + caching
- Fetch and combine data from:
  - **Météo-France** (official API) – Avalanche bulletin (Mont-Blanc massif) + optionally weather
  - **Chamonix-Météo** (web scraping, no API)
- Translate French bulletins into **English** using **OpenAI** (minimising cost via caching)
- Optimise for **mobile** but work well on desktop
- Keep everything as **cheap and robust** as reasonably possible for a hobby project


---

## 1. High-Level Architecture

### 1.1. Stack Overview

- **Frontend**: Next.js (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Backend**:
  - Next.js Route Handlers / API routes (Node + TypeScript)
  - Logic to call external APIs and scrape HTML server-side
- **Database / Auth**: Supabase (Postgres)
- **Background jobs**: (For later) Vercel cron jobs or external scheduler to call your APIs
- **AI Translation**: OpenAI API, used rarely and in a cached way


### 1.2. Data Sources

1. **Météo-France (Portail-API)**  
   - Use for **avalanche bulletin (BRA)** for **Mont-Blanc** massif.
   - Optional: use for additional weather parameters.

2. **Open-Meteo (Météo-France model)** (optional)  
   - Free source for high-altitude weather (wind, temperature, cloudiness, precipitation).

3. **Chamonix-Météo website**  
   - No official API → we **scrape** selected information from HTML.
   - Must **respect robots.txt** and avoid high frequency requests.

4. **OpenAI**  
   - Translate **French → English** for textual bulletins (BRA + Chamonix-Météo narrative).
   - Cache translations by original French text to avoid repeated usage.


### 1.3. Data Flow

1. Browser hits `/` (dashboard).
2. Next.js server component / route handler calls an internal API `/api/dashboard`.
3. `/api/dashboard`:
   - Loads **latest records** from Supabase:
     - Avalanche bulletin
     - Weather snapshots
     - Chamonix-Météo text
   - If any data is missing / stale:
     - Fetches from external sources (Météo-France, Open-Meteo, Chamonix-Météo)
     - Transforms and stores results in Supabase
     - Uses cached translations when possible; otherwise calls OpenAI.
4. `/api/dashboard` returns aggregated, frontend-friendly JSON:
   - Avalanche level, aspects, main text (EN), last update
   - Key weather metrics (wind, temperature low/high, cloudiness, snow, etc.)
   - Translated summaries from each source
5. Frontend renders using shadcn components & Tailwind, optimised for mobile.

Later, background jobs (cron) can pre‑fetch data early in the morning so user gets instant load.


---

## 2. Data Model

### 2.1. Tables (Supabase / Postgres)

#### 2.1.1. `avalanche_bulletins`

Stores Bra (Bulletin Risque Avalanche) for Mont-Blanc.

- `id` (uuid, primary key)
- `source` (text, e.g. `'meteo-france'`)
- `massif` (text, e.g. `'Mont-Blanc'`)
- `valid_date` (date) – date for which bulletin is valid
- `issued_at` (timestamptz) – when bulletin was published
- `danger_level_min` (int) – min risk level (1‑5)
- `danger_level_max` (int) – max risk level (1‑5)
- `danger_level_by_altitude` (jsonb) – e.g. `{ "0-2000": 2, "2000+": 3 }`
- `danger_aspects` (jsonb) – aspects per altitude band
- `french_text` (text) – original bulletin summary / analysis
- `english_text` (text) – translated text
- `raw_json` (jsonb) – full raw bulletin as JSON for debugging
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

#### 2.1.2. `weather_snapshots`

Stores weather snapshots for today’s forecast/conditions.

- `id` (uuid)
- `source` (text) – `'meteo-france-api'`, `'open-meteo'`, etc.
- `timestamp` (timestamptz) – when this snapshot was fetched
- `valid_date` (date)
- `location` (text) – `'Mont-Blanc'` or `'Chamonix'`
- `data` (jsonb) – shaped with keys like:
  - `temperature_low_alt`
  - `temperature_high_alt`
  - `wind_speed_low_alt`
  - `wind_speed_high_alt`
  - `wind_direction_low_alt`
  - `wind_direction_high_alt`
  - `cloudiness`
  - `precipitation`
  - `snowfall_recent`
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

#### 2.1.3. `text_sources`

Generic table for scraped narrative text (e.g. Chamonix-Météo).

- `id` (uuid)
- `source` (text) – `'chamonix-meteo'`, `'meteo-france-bra'` (optional)
- `valid_date` (date)
- `french_text` (text)
- `english_text` (text)
- `raw_html` (text) – optionally store HTML for debugging
- `created_at` (timestamptz)
- `updated_at` (timestamptz)


---

## 3. API Endpoints

These are implemented as **Next.js Route Handlers** under `app/api/...`.

### 3.1. `/api/dashboard`

Returns one JSON containing all the data the frontend needs for the dashboard:

```ts
type DashboardResponse = {
  lastUpdated: string;
  avalanche: {
    levelMin: number;
    levelMax: number;
    levelByAltitude: Record<string, number>;
    aspects: Record<string, string[]>;
    summaryEn: string;
    summaryFr?: string;
    issuedAt: string;
    validDate: string;
  };
  weather: {
    source: string;
    lowAltitude: {
      elevation: number;
      temperature: number;
      windSpeed: number;
      windDirectionDeg: number;
      cloudiness: number;
    };
    highAltitude: {
      elevation: number;
      temperature: number;
      windSpeed: number;
      windDirectionDeg: number;
      cloudiness: number;
    };
    snowfallRecentCm: number | null;
  };
  sources: {
    meteoFrance: {
      textEn: string;
      textFr?: string;
      lastUpdated: string;
    };
    chamonixMeteo: {
      textEn: string;
      textFr?: string;
      lastUpdated: string;
    };
  };
};
```

Responsibilities:
1. Fetch latest records from Supabase.
2. Optionally trigger “on-demand update” if data missing/stale.
3. Assemble final `DashboardResponse` object.
4. Return as JSON.

### 3.2. `/api/update/meteo-france-bra`

Internal endpoint that:
1. Calls Météo-France BRA API for Mont-Blanc.
2. Parses response into structured data.
3. Checks if the French text already exists (identical) in `avalanche_bulletins` / `text_sources`.
4. If new:
   - Calls OpenAI to translate French → English.
   - Stores new record in Supabase.

Used either:
- Manually during development
- As a target of cron job in production

### 3.3. `/api/update/chamonix-meteo`

Internal endpoint that:
1. Fetches HTML from `https://chamonix-meteo.com/` on the server.
2. Parses relevant sections with `cheerio` (or similar).
3. Produces `french_text` summary string.
4. Looks up cached translation in `text_sources`:

   - If existing `french_text` already has an `english_text` → reuse.
   - Otherwise call OpenAI → store translation.

### 3.4. `/api/update/weather`

Internal endpoint that:
1. Calls desired weather source(s) (e.g. Open-Meteo using Météo-France model).
2. Extracts key metrics for today’s morning / daytime.
3. Stores as a new row in `weather_snapshots`.


---

## 4. Frontend UI

### 4.1. Layout

We use **shadcn/ui** + Tailwind, mobile-first.

Sections:

1. **Header**  
   - App title, date, last update times.
   - Style: `flex`, small logo/emoji, `text-sm` for metadata.

2. **Critical Summary Cards**  
   - Avalanche danger level (min/max) with color-coded badge (1–5).
   - Forecast summary: wind, recent snowfall, freezing level.
   - Use shadcn `Card` and `Badge` components.

3. **Avalanche Details**  
   - Use `Tabs` or `Accordion`:
     - “Overview” – English summary text.
     - “By altitude” – card per elevation band with risk level + aspects.
   - Optionally show a small schematic of aspects (N, NE, E, …) as grid.

4. **Weather Overview**  
   - Simple summary of:
     - Low-alt vs high-alt temperature
     - Wind speed/direction
     - Cloudiness and recent snowfall
   - Could use a small chart later (e.g. Recharts) for time series.

5. **Source Recaps**  
   - Two cards:
     - **Météo-France bulletin recap**
     - **Chamonix-Météo recap**
   - Each card has:
     - Source name + icon
     - “Last updated …”
     - English text with optional toggle to show original French text.

6. **Footer**  
   - Disclaimer (“Always cross-check official bulletins”, etc.).


### 4.2. Styling / Responsiveness

- Mobile: one-column layout, full-width cards, comfortable padding.
- Tablet/desktop:
  - `grid-cols-2` for summary + details.
  - `md:grid`, `lg:grid-cols-3` where appropriate.
- Tailwind utility classes with shadcn tokens for consistent spacing and typography.


---

## 5. Implementation Plan (Step-by-Step for Codex)

Below is a **step-by-step implementation sequence** you can follow with Codex in VS Code.  
Each step describes what the coding assistant should do.

### 5.1. Project Bootstrapping

1. **Create Next.js App (TypeScript, App Router)**  
   - Command (manual, not for Codex):  
     ```bash
     npx create-next-app@latest mont-blanc-dashboard --typescript --eslint --tailwind --app
     ```
   - Ensure Tailwind is already configured by the template.

2. **Configure ESLint + Prettier (optional but recommended)**  
   - Add Prettier config.
   - Ensure consistent formatting (Codex can help autofix).

3. **Install Dependencies**  
   In the project root, install:
   - `@supabase/supabase-js` (client for Supabase)
   - `pg` (if needed for server-side direct connection; optional)
   - `cheerio` (for HTML parsing)
   - `zod` (for type-safe schemas; optional but helpful)
   - `openai` (official OpenAI client)
   - `@tanstack/react-query` (if you choose to use it)
   - `lucide-react` (icons, used by shadcn)
   - `clsx` and `tailwind-merge` (usually added by shadcn template)  

   Example:
   ```bash
   pnpm add @supabase/supabase-js cheerio openai @tanstack/react-query lucide-react
   ```

### 5.2. Setup Supabase

4. **Create a Supabase project** (via web UI).  
   - Note `SUPABASE_URL` and `SUPABASE_ANON_KEY`

5. **Create database tables** using SQL in Supabase UI:
   - `avalanche_bulletins`
   - `weather_snapshots`
   - `text_sources`

   You can copy the schema definitions from section 2 into SQL. Codex can generate the SQL given the fields.

6. **Set environment variables** in Next.js (`.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...  # if you use service key server-side
   OPENAI_API_KEY=...
   METEO_FRANCE_API_KEY=...       # when available
   ```

7. **Create a Supabase client helper**  
   - File: `lib/supabaseClient.ts` for browser (using anon key)
   - File: `lib/supabaseServer.ts` or similar for server-side (optionally using service key).

### 5.3. Integrate shadcn/ui

8. **Check shadcn installation**  
   - Confirm that `shadcn/ui` is installed (via your MCP setup).
   - Ensure Tailwind config and alias `@/components` are set correctly.

9. **Generate basic UI components using shadcn CLI**  
   - `button`, `card`, `tabs`, `accordion`, `badge`, `skeleton`, `toggle` components.
   - Codex can assist in wiring them up with your design.

### 5.4. Backend: External Data Fetching

10. **Create generic fetch helpers** under `lib/`:
    - `lib/meteoFrance.ts` – functions to:
      - Fetch BRA for Mont-Blanc from Météo-France API
      - Parse raw response into TypeScript interfaces
    - `lib/openMeteo.ts` (optional) – functions to call Open-Meteo for weather.
    - `lib/chamonixMeteo.ts` – server-side HTML fetch + `cheerio` parsing to extract narrative text.

    Each helper should:
    - Accept minimal parameters (e.g. massif code, lat/long)
    - Return typed objects with only relevant data for the app.

11. **Create translation helper using OpenAI**  
    - File: `lib/translate.ts`
    - Export a function `translateFrenchToEnglish(french: string): Promise<string>`.
    - Inside:
      - Check DB (Supabase) or a simple hash-based cache before calling OpenAI.
      - If translation exists, return it.
      - If not, call OpenAI with system prompt emphasising accurate avalanche/weather translation, store result, then return.

12. **Create data ingestion functions**  
    - File: `lib/ingestMeteoFranceBra.ts`:
      - Fetch BRA → parse → store into `avalanche_bulletins` and `text_sources` (if you want both).
      - Use translation helper for text fields.
    - File: `lib/ingestChamonixMeteo.ts`:
      - Scrape HTML → extract French narrative → translate & store in `text_sources`.
    - File: `lib/ingestWeather.ts`:
      - Call chosen weather source → shape data → store into `weather_snapshots`.

### 5.5. API Routes (Route Handlers)

13. **Create `/app/api/update/meteo-france-bra/route.ts`**  
    - HTTP method: `POST` or `GET` (for dev convenience)
    - Calls `ingestMeteoFranceBra()`
    - Returns JSON with summary of what was updated.

14. **Create `/app/api/update/chamonix-meteo/route.ts`**  
    - Calls `ingestChamonixMeteo()`
    - Returns JSON with summary.

15. **Create `/app/api/update/weather/route.ts`**  
    - Calls `ingestWeather()`
    - Returns JSON with summary.

16. **Create `/app/api/dashboard/route.ts`**  
    - On each call:
      - Query Supabase for the **most recent** entries from each table (for today / last 24 hours).
      - Optionally, if there is no data for today, call the update endpoints internally.
      - Assemble `DashboardResponse` object.
      - Return as JSON.

### 5.6. Frontend Dashboard Page

17. **Create page component** at `app/page.tsx` (or `app/dashboard/page.tsx`)  
    - This should be a **server component** that fetches `/api/dashboard` using `fetch` (`cache: 'no-store'` or `revalidate` interval).
    - Pass the resulting props to a child **client component** `<Dashboard />` which focuses on UI rendering.

18. **Implement `<Dashboard />` UI using shadcn**  
    - Use `Card` components for each section.
    - Use `Badge` + `Tooltip` for avalanche level and explanation.
    - Use `Tabs` or `Accordion` for avalanche details sections.
    - Use a simple table or stacked boxes for weather metrics.

19. **Add loading & error states**  
    - Use shadcn `Skeleton` while data is loading.
    - Show a clear error message if `/api/dashboard` fails.

20. **Mobile optimisation**  
    - Ensure layout uses `flex`/`grid` with responsive classes (`md:`, `lg:`).
    - Test on narrow viewport to confirm readability.

### 5.7. Cron / Scheduled Updates (later step)

21. **Create endpoints that are safe for cron**  
    - `/api/update/meteo-france-bra`
    - `/api/update/chamonix-meteo`
    - `/api/update/weather`

22. **Configure cron jobs** (on Vercel or other):
    - Morning runs (e.g. 05:30, 07:00 Europe/Paris) hitting these endpoints.
    - Optional evening job after 16:00 to capture newest BRA.

23. **Add “last updated” display** in the dashboard header:
    - Compute from `issued_at` for BRA and latest `timestamp` from weather / text sources.

### 5.8. Cost Optimisation Details

24. **Minimise OpenAI usage**:
    - Only call translation if French text is new.
    - Avoid translating short labels / headings; only text blocks.
    - Use compact model (e.g. “mini” variant).

25. **Avoid excessive scraping**:
    - Chamonix-Météo: limit to a few times per day.
    - Prefer cron + DB to on-demand scraping per user request.

26. **Caching and revalidation**:
    - Use Next.js `revalidate` and/or manual caching so `/api/dashboard` doesn’t hammer Supabase or external APIs.

---

## 6. Safety & Disclaimers

- The app is **informational only**; users should always consult official bulletins directly for decision-making.
- Highlight that conditions in high mountains change rapidly.
- Consider including links to official BRA PDF/website and Chamonix-Météo.


---

## 7. Nice-to-Have Future Enhancements

- Show **multiple models** for weather and visualise disagreement.
- Add a small **time series chart** of avalanche risk over last days.
- Add simple **route planning notes** per user (requires auth).
- Add toggles for **units** (°C vs °F, m/s vs km/h) if needed.


---

## 8. Summary for Codex

When working with this project in VS Code, use the above steps as your roadmap. Typical instructions to Codex could look like:

- “Create the `avalanche_bulletins` table SQL migration based on the spec in section 2.1.1.”
- “Implement the `translateFrenchToEnglish` helper using OpenAI and Supabase caching as described.”
- “Implement `/app/api/dashboard/route.ts` to return `DashboardResponse` based on the Supabase tables.”
- “Build the main dashboard UI using shadcn `Card`, `Badge`, `Tabs`, and `Accordion` as per section 4.”

This document is the single source of truth for the project’s architecture and implementation flow.
