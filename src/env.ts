import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1),
  METEO_FRANCE_API_KEY: z.string().min(1).optional().or(z.literal("").optional()),
  INTERNAL_UPDATE_SECRET: z.string().min(1).optional().or(z.literal("").optional()),
  CRON_SECRET: z.string().min(1).optional().or(z.literal("").optional()),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  METEO_FRANCE_API_KEY: process.env.METEO_FRANCE_API_KEY,
  INTERNAL_UPDATE_SECRET: process.env.INTERNAL_UPDATE_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
});
