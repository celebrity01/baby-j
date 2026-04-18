// Shared API utilities for route handlers

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export function getJulesHeaders(req: Request): HeadersInit {
  const apiKey = req.headers.get("X-Jules-Api-Key") || "";
  const sanitized = sanitizeHeaderValue(apiKey);
  if (sanitized.startsWith("ya29.")) {
    return { Authorization: `Bearer ${sanitized}` };
  }
  return { "X-Goog-Api-Key": sanitized };
}

export const JULES_BASE = "https://jules.googleapis.com/v1alpha";

/** Clamp a numeric query param between min and max, falling back to default */
export function clampParam(raw: string | null, min: number, max: number, fallback: number): number {
  const parsed = parseInt(raw || String(fallback), 10);
  if (isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
