import { XMLParser } from "fast-xml-parser";

import { env } from "@/env";

const DEFAULT_BRA_ENDPOINT =
  "https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?format=xml&id-massif={id}";

export const MASSIF_ID_MONT_BLANC = 3;

type BraRiskBand = {
  label: string;
  level: number | null;
  evolution?: string | null;
};

export type ParsedMeteoFranceBra = {
  massifId: number;
  massifName: string;
  issuedAt: string;
  validFrom: string;
  validUntil: string;
  amended: boolean;
  riskMin: number | null;
  riskMax: number | null;
  riskBands: BraRiskBand[];
  riskComment: string | null;
  aspects: string[];
  summary: {
    natural?: string | null;
    accidental?: string | null;
    combined?: string | null;
    j2?: string | null;
    j2Comment?: string | null;
  };
  stabilityText?: string | null;
  snowQualityText?: string | null;
  raw: unknown;
  rawXml: string;
};

function boolFromUnknown(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "number") return value === 1;
  return false;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveBraUrl(massifId: number): string {
  const base = process.env.METEO_FRANCE_BRA_URL ?? DEFAULT_BRA_ENDPOINT;
  if (base.includes("{id}")) {
    return base.replace("{id}", String(massifId));
  }
  const url = new URL(base);
  if (!url.searchParams.has("id-massif") && !url.searchParams.has("idMassif")) {
    url.searchParams.set("id-massif", String(massifId));
  }
  if (!url.searchParams.has("format")) {
    url.searchParams.set("format", "xml");
  }
  return url.toString();
}

export async function fetchMeteoFranceBraXml(
  massifId: number = MASSIF_ID_MONT_BLANC,
): Promise<{ xml: string; url: string }> {
  if (!env.METEO_FRANCE_API_KEY) {
    throw new Error("METEO_FRANCE_API_KEY is required to fetch BRA.");
  }

  const url = resolveBraUrl(massifId);
  const res = await fetch(url, {
    headers: {
      Accept: "application/xml",
      apikey: env.METEO_FRANCE_API_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch BRA (${res.status}): ${text}`);
  }

  const xml = await res.text();
  return { xml, url };
}

export function parseMeteoFranceBraXml(xml: string): ParsedMeteoFranceBra {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const root = parsed?.BULLETINS_NEIGE_AVALANCHE;

  if (!root) {
    throw new Error("Unexpected BRA XML format: missing BULLETINS_NEIGE_AVALANCHE root.");
  }

  const risqueNode = root.CARTOUCHERISQUE?.RISQUE ?? {};
  const penteNode = root.CARTOUCHERISQUE?.PENTE ?? {};
  const stabilityText = root.STABILITE?.TEXTE ?? null;
  const snowQualityText =
    root.QUALITE?.TEXTE ??
    root.QUALITE_NEIGE?.TEXTE ??
    root.QUALITENEIGE?.TEXTE ??
    root.QUALITE_NEIGE?.Texte ??
    root.QUALITE_NEIGE ??
    null;

  const riskBands: BraRiskBand[] = [];
  const risk1 = numberOrNull(risqueNode.RISQUE1);
  const risk2 = numberOrNull(risqueNode.RISQUE2);
  const altitude = risqueNode.ALTITUDE;

  if (risk1 !== null) {
    const label = risqueNode.LOC1 ?? (altitude ? `<${altitude}` : "all");
    riskBands.push({
      label,
      level: risk1,
      evolution: risqueNode.EVOLURISQUE1 ?? null,
    });
  }

  if (risk2 !== null) {
    const label = risqueNode.LOC2 ?? (altitude ? `>${altitude}` : "all");
    riskBands.push({
      label,
      level: risk2,
      evolution: risqueNode.EVOLURISQUE2 ?? null,
    });
  }

  const levels = riskBands.map((r) => r.level).filter((v): v is number => v !== null);
  const riskMin = levels.length ? Math.min(...levels) : null;
  const riskMax = numberOrNull(risqueNode.RISQUEMAXI) ?? (levels.length ? Math.max(...levels) : null);

  const aspects = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].filter((aspect) =>
    boolFromUnknown(penteNode[aspect]),
  );

  return {
    massifId: numberOrNull(root.ID) ?? MASSIF_ID_MONT_BLANC,
    massifName: root.MASSIF ?? "Mont-Blanc",
    issuedAt: root.DATEBULLETIN,
    validFrom: root.DATEECHEANCE ?? root.DATEVALIDITE,
    validUntil: root.DATEVALIDITE ?? root.DATEECHEANCE,
    amended: root.AMENDEMENT === "true" || root.AMENDEMENT === true,
    riskMin,
    riskMax,
    riskBands,
    riskComment: risqueNode.COMMENTAIRE ?? null,
    aspects,
    summary: {
      natural: root.CARTOUCHERISQUE?.NATUREL ?? null,
      accidental: root.CARTOUCHERISQUE?.ACCIDENTEL ?? null,
      combined: root.CARTOUCHERISQUE?.RESUME ?? null,
      j2: root.CARTOUCHERISQUE?.RisqueJ2 ?? null,
      j2Comment: root.CARTOUCHERISQUE?.CommentaireRisqueJ2 ?? null,
    },
    stabilityText,
    snowQualityText,
    raw: root,
    rawXml: xml,
  };
}

export async function fetchAndParseMeteoFranceBra(
  massifId: number = MASSIF_ID_MONT_BLANC,
): Promise<ParsedMeteoFranceBra> {
  const { xml } = await fetchMeteoFranceBraXml(massifId);
  return parseMeteoFranceBraXml(xml);
}
