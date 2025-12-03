import OpenAI from "openai";

import { env } from "@/env";
import { getSupabaseServiceRoleClient } from "@/lib/supabaseClient";

type TranslationResult = {
  englishText: string;
  cached: boolean;
};

/**
 * Translate French → English with caching in Supabase (text_sources) by exact French text match.
 * validDate is required to upsert text_sources for this source/day.
 */
export async function translateFrenchToEnglish(params: {
  text: string;
  source: string;
  validDate: string;
}): Promise<TranslationResult> {
  const { text, source, validDate } = params;

  if (!text?.trim()) {
    return { englishText: "", cached: true };
  }

  const supabase = getSupabaseServiceRoleClient();

  // 1) Cache lookup by French text (any source/day that has same French).
  const { data: cachedRows, error: cacheErr } = await supabase
    .from("text_sources")
    .select("english_text")
    .eq("french_text", text)
    .not("english_text", "is", null)
    .limit(1);

  if (!cacheErr && cachedRows && cachedRows.length > 0) {
    const cached = cachedRows[0]?.english_text ?? text;
    return { englishText: cached, cached: true };
  }

  // 2) Translate with OpenAI.
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Translate the following avalanche/weather bulletin text from French to concise, clear English. Keep numeric values and mountain/aspect terms intact. Do not add commentary.",
      },
      { role: "user", content: text },
    ],
  });

  const englishText = completion.choices[0]?.message?.content?.trim() || text;

  // 3) Upsert into text_sources for this source/date so future calls are cached.
  const { error: upsertErr } = await supabase
    .from("text_sources")
    .upsert(
      {
        source,
        valid_date: validDate,
        french_text: text,
        english_text: englishText,
      },
      { onConflict: "source,valid_date" },
    );

  if (upsertErr) {
    // Log but do not fail the translation if caching write fails.
    console.error("Failed to cache translation", upsertErr.message);
  }

  return { englishText, cached: false };
}
