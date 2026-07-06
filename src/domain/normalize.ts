const HYPHENS = /[-‐‑‒–—―ー−ｰ－]/g;

export function toAscii(value: string): string {
  return value.normalize("NFKC");
}

export function normalizePostalCode(value: string): string | null {
  const normalized = toAscii(value).replace(HYPHENS, "").replace(/\s/g, "");
  return /^\d{7}$/.test(normalized) ? normalized : null;
}

export function normalizeCorporateNumber(value: string): string | null {
  const normalized = toAscii(value).replace(HYPHENS, "").replace(/\s/g, "");
  return /^\d{13}$/.test(normalized) ? normalized : null;
}

export function normalizeCompanyName(value: string): string {
  return toAscii(value).replace(/\s+/g, " ").trim();
}
