import fs from "node:fs";
import path from "node:path";

import { logger } from "@/lib/logger";

/**
 * Optional Unicode font loading for PDF export.
 *
 * pdf-lib's built-in fonts are WinAnsi-encoded and cannot render Bangla. To
 * export Bangla papers, drop a TrueType font at:
 *
 *   public/fonts/NotoSansBengali-Regular.ttf
 *
 * When present it is embedded with fontkit and used for everything. When absent
 * the exporter falls back to Helvetica and transliterates unsupported
 * characters, and the caller is told so in the response headers rather than
 * silently producing a page of question marks.
 *
 * This is read once per process and cached.
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

const CANDIDATES = [
  "NotoSansBengali-Regular.ttf",
  "NotoSans-Regular.ttf",
  "SolaimanLipi.ttf",
];

interface FontCache {
  loaded: boolean;
  bytes: Uint8Array | null;
  name: string | null;
}

let cache: FontCache | null = null;

export function loadUnicodeFont(): FontCache {
  if (cache) return cache;

  for (const candidate of CANDIDATES) {
    const fullPath = path.join(FONT_DIR, candidate);
    try {
      if (fs.existsSync(fullPath)) {
        cache = { loaded: true, bytes: new Uint8Array(fs.readFileSync(fullPath)), name: candidate };
        logger.info("Embedded Unicode font for PDF export", { font: candidate });
        return cache;
      }
    } catch (error: unknown) {
      logger.warn("Could not read candidate PDF font", { font: candidate, error });
    }
  }

  cache = { loaded: false, bytes: null, name: null };
  return cache;
}

/** True when the text contains characters the WinAnsi fallback cannot encode. */
export function needsUnicodeFont(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\u0000-\u00FF]/.test(text);
}

/** Replaces characters the standard fonts cannot encode. */
export function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0000-\u00FF]/g, "?");
}
