import { NextResponse } from "next/server";

import { defineRoute } from "@/lib/api/handler";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import {
  paperExportBodySchema,
  paperExportQuerySchema,
  type PaperExportBody,
  type PaperExportQuery,
} from "@/lib/validation/paper.schema";
import { paperExportService } from "@/lib/services/paper-export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a generated PDF or DOCX.
 *
 * This is the one route that does not return the JSON envelope, because the
 * response body is a binary document. Errors still go through the shared
 * handler and therefore still return the envelope.
 *
 * The service requires organization-scoped access to the paper. Users with
 * that access may request either the student or teacher copy.
 */
async function exportPaper(
  params: RouteIdParams,
  query: PaperExportQuery,
  body: PaperExportBody | undefined,
  user: Parameters<typeof paperExportService.export>[1],
  audit: Parameters<typeof paperExportService.export>[3],
) {
  const result = await paperExportService.export(
    params.id,
    user,
    { format: query.format, variant: query.variant, designConfig: body?.designConfig },
    audit,
  );

  const headers: Record<string, string> = {
    "Content-Type": result.contentType,
    "Content-Disposition": `attachment; filename="${result.filename}"`,
    "Content-Length": String(result.body.byteLength),
    "Cache-Control": "no-store",
  };

  if (result.degraded) {
    // Surfaced so the UI can warn that Bangla glyphs were substituted.
    headers["X-Export-Degraded"] = "unicode-font-missing";
  }

  return new NextResponse(Buffer.from(result.body), { status: 200, headers });
}

export const GET = defineRoute<undefined, RouteIdParams, PaperExportQuery>({
  auth: true,
  rateLimit: "paperExport",
  paramsSchema: routeIdParamsSchema,
  querySchema: paperExportQuerySchema,
  async handler({ params, query, user, audit }) {
    return exportPaper(params, query, undefined, user, audit);
  },
});

export const POST = defineRoute<PaperExportBody, RouteIdParams, PaperExportQuery>({
  auth: true,
  rateLimit: "paperExport",
  paramsSchema: routeIdParamsSchema,
  querySchema: paperExportQuerySchema,
  bodySchema: paperExportBodySchema,
  async handler({ params, query, body, user, audit }) {
    return exportPaper(params, query, body, user, audit);
  },
});
