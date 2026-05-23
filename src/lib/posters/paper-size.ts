import { resolveDetectedAmbassadorRegion } from "@/lib/settings";

export type PaperSize = "letter" | "a4";

// Countries that commonly use US Letter as the standard paper size. Everywhere
// else defaults to A4.
const LETTER_COUNTRY_CODES = new Set(["us", "ca"]);

export function getDefaultPaperSize(
  countryCode: string | null | undefined,
  ambassadorRegion: string | null | undefined,
): PaperSize {
  const code = countryCode?.trim().toLowerCase() ?? "";
  if (code !== "" && LETTER_COUNTRY_CODES.has(code)) {
    return "letter";
  }

  const region = resolveDetectedAmbassadorRegion(ambassadorRegion);
  if (region === "United States" || region === "Canada") {
    return "letter";
  }

  return "a4";
}

export function normalizeRegionCode(
  countryCode: string | null | undefined,
): string | null {
  const code = countryCode?.trim().toLowerCase() ?? "";
  return code === "" ? null : code;
}
