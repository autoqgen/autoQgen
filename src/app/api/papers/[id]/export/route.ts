import { NextResponse } from "next/server";

import { defineRoute } from "@/lib/api/handler";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperExportQuerySchema, type PaperExportQuery } from "@/lib/validation/paper.schema";
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
 * `variant=teacher` requires `paper:export-answers`; the service refuses rather
 * than silently downgrading to the student copy.
 */
export const GET = defineRoute<undefined, RouteIdParams, PaperExportQuery>({
  auth: true,
  permission: "paper:export",
  rateLimit: "paperExport",
  paramsSchema: routeIdParamsSchema,
  querySchema: paperExportQuerySchema,
  async handler({ params, query, user, audit }) {
    const result = await paperExportService.export(
      params.id,
      user,
      { format: query.format, variant: query.variant },
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
  },
});
