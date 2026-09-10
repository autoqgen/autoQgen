import type { ErrorCode } from "@/lib/errors/app-error";

/**
 * Browser-side file download.
 *
 * The paper export route streams a binary body on success but returns the
 * standard `{ success:false, error }` JSON envelope on failure. A plain
 * `<a href>` cannot react to that — a denied or failed export just navigates
 * the tab to raw JSON. This fetches instead, so the caller can show a toast on
 * failure and honour `X-Export-Degraded`.
 *
 * Returns a discriminated result; it never throws.
 */
export interface DownloadResult {
  ok: boolean;
  /** The server substituted glyphs it could not render (e.g. Bangla). */
  degraded: boolean;
  error?: { code: ErrorCode | string; message: string };
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

export async function downloadFile(
  url: string,
  fallbackName = "download",
): Promise<DownloadResult> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin" });
  } catch {
    return {
      ok: false,
      degraded: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to connect. Please check your connection and try again.",
      },
    };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    return {
      ok: false,
      degraded: false,
      error: {
        code: body?.error?.code ?? "INTERNAL_ERROR",
        message:
          body?.error?.message ?? "Could not generate the file. Please try again.",
      },
    };
  }

  const degraded = response.headers.get("X-Export-Degraded") != null;
  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackName,
  );

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { ok: true, degraded };
}
