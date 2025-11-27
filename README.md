This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser Supabase client.
- `SUPABASE_SERVICE_ROLE_KEY` for server-only operations.
- `OPENAI_API_KEY` for translations.
- `METEO_FRANCE_API_KEY` if you have official API access.
- `INTERNAL_UPDATE_SECRET` to protect internal update endpoints.

## Supabase client helpers

- Browser/CSR: `getSupabaseBrowserClient()` in `src/lib/supabaseClient.ts`.
- Server (writes): `getSupabaseServiceRoleClient()` throws if `SUPABASE_SERVICE_ROLE_KEY` is missing to avoid accidental use without credentials.

### Typing Supabase

- `src/lib/database.types.ts` mirrors the spec tables for now. Replace with generated types from your Supabase project when the schema is created:
  ```bash
  npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/lib/database.types.ts
  ```

### Database schema

- Apply `supabase/schema.sql` in the Supabase SQL editor or via CLI:
  ```bash
  supabase db push --db-url "$SUPABASE_DB_URL" --file supabase/schema.sql
  ```
- Tables include unique constraints per day/source and RLS allowing public reads; inserts are permitted to `service_role` (used by the server key).

### Regenerate types (project ref: `bwuwzmkndmhslvrlkevi`)

```bash
npm run typegen
# or manually:
npx supabase gen types typescript --project-id bwuwzmkndmhslvrlkevi --schema public > src/lib/database.types.ts
```
Requires a Supabase access token (`SUPABASE_ACCESS_TOKEN`) set in your env or Supabase CLI login.

### Health check

- Endpoint: `GET /api/health`
- Does: runs a lightweight select on `avalanche_bulletins` to confirm Supabase connectivity/env vars. Returns `{ ok: true/false, count, status }`.
