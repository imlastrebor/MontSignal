import { getSupabaseServiceRoleClient } from "@/lib/supabaseClient";
import {
  MASSIF_ID_MONT_BLANC,
  fetchAndParseMeteoFranceBra,
  type ParsedMeteoFranceBra,
} from "@/lib/meteoFrance";
import { translateFrenchToEnglish } from "@/lib/translate";

const SOURCE = "meteo-france-bra";

function toDateOnly(isoString: string): string {
  const d = new Date(isoString);
  // Fallback: if invalid date, return as-is to avoid silent data loss.
  if (Number.isNaN(d.getTime())) {
    return isoString;
  }
  return d.toISOString().slice(0, 10);
}

type IngestResult = {
  inserted: boolean;
  bulletinId?: string;
  validDate: string;
  issuedAt: string;
  massif: string;
  raw: ParsedMeteoFranceBra;
};

export async function ingestMeteoFranceBra(
  massifId: number = MASSIF_ID_MONT_BLANC,
): Promise<IngestResult> {
  const supabase = getSupabaseServiceRoleClient();
  const parsed = await fetchAndParseMeteoFranceBra(massifId);

  const validDate = toDateOnly(parsed.validUntil ?? parsed.validFrom);
  const issuedAt = parsed.issuedAt;

  const dangerLevelByAltitude = Object.fromEntries(
    parsed.riskBands.map((band) => [band.label, band.level ?? null]),
  );

  const aspectsByAltitude = {
    all: parsed.aspects,
  };

  const frenchText =
    parsed.summary?.combined ??
    `${parsed.summary?.natural ?? ""}\n${parsed.summary?.accidental ?? ""}`.trim();

  const { englishText } = await translateFrenchToEnglish({
    text: frenchText,
    source: SOURCE,
    validDate,
  });

  const bulletinInsert = {
    source: SOURCE,
    massif: parsed.massifName,
    valid_date: validDate,
    issued_at: issuedAt,
    danger_level_min: parsed.riskMin,
    danger_level_max: parsed.riskMax,
    danger_level_by_altitude: dangerLevelByAltitude,
    danger_aspects: aspectsByAltitude,
    french_text: frenchText,
    english_text: englishText,
    raw_json: parsed.raw,
  };

  const { data: bulletinRow, error: upsertErr } = await supabase
    .from("avalanche_bulletins")
    .upsert(bulletinInsert, { onConflict: "source,massif,valid_date" })
    .select()
    .single();

  if (upsertErr) {
    throw upsertErr;
  }

  // Keep text_sources in sync for translation cache / reuse.
  const textInsert = {
    source: SOURCE,
    valid_date: validDate,
    french_text: frenchText,
    english_text: englishText,
    raw_html: parsed.rawXml, // store XML here for debugging.
  };

  const { error: textErr } = await supabase
    .from("text_sources")
    .upsert(textInsert, { onConflict: "source,valid_date" });

  if (textErr) {
    throw textErr;
  }

  return {
    inserted: true,
    bulletinId: bulletinRow?.id,
    validDate,
    issuedAt,
    massif: parsed.massifName,
    raw: parsed,
  };
}
