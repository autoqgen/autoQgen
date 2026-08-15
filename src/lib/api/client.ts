import type { ApiResult } from "@/types/api";

/**
 * Browser-side API client.
 *
 * Returns the discriminated envelope rather than throwing, so callers handle
 * failure explicitly instead of falling back to `alert()` — which is what the
 * previous project did for every error path.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init ?? {};

  try {
    const response = await fetch(path, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });

    const body = (await response.json().catch(() => null)) as ApiResult<T> | null;

    if (body && typeof body === "object" && "success" in body) {
      return body;
    }

    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected response from the server." },
      requestId: response.headers.get("x-request-id") ?? "unknown",
    };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Network request failed. Check your connection." },
      requestId: "unknown",
    };
  }
}

/** Flattens field-level issues into a `{ field: message }` map for forms. */
export function fieldErrors(result: ApiResult<unknown>): Record<string, string> {
  if (result.success || !result.error.details) return {};

  const map: Record<string, string> = {};
  for (const issue of result.error.details) {
    if (!map[issue.path]) map[issue.path] = issue.message;
  }
  return map;
}
