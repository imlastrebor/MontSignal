import { getSupabaseServiceRoleClient } from "@/lib/supabaseClient";
import { fetchOpenMeteoSnapshot } from "@/lib/openMeteo";
import type { Json } from "@/lib/database.types";

type IngestResult = {
  inserted: boolean;
  rowId?: string;
  validDate: string;
  timestamp: string;
  source: string;
};

/**
 * Fetches Open-Meteo forecast (Météo-France model) and upserts into weather_snapshots.
 */
export async function ingestOpenMeteoWeather(): Promise<IngestResult> {
  const supabase = getSupabaseServiceRoleClient();
  const snapshot = await fetchOpenMeteoSnapshot();

  const { data: row, error } = await supabase
    .from("weather_snapshots")
    .upsert(
      {
        source: snapshot.source,
        valid_date: snapshot.validDate,
        location: snapshot.location,
        timestamp: snapshot.timestamp,
        data: snapshot.data as unknown as Json,
      },
      { onConflict: "source,valid_date,location" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    inserted: true,
    rowId: row?.id,
    validDate: snapshot.validDate,
    timestamp: snapshot.timestamp,
    source: snapshot.source,
  };
}
