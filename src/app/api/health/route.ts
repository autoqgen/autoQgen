import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { connectDB, connectionState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness and readiness.
 *
 * Reports only whether the process is up and whether the database is reachable.
 * It deliberately exposes no version, no configuration and no data — the
 * previous project's `/api/test` confirmed database connectivity to anonymous
 * callers and `/api/questions/test` dumped the entire collection.
 */
export const GET = defineRoute({
  auth: false,
  skipDb: true,
  async handler({ requestId }) {
    let database: "up" | "down" = "down";

    try {
      await connectDB();
      database = connectionState() === 1 ? "up" : "down";
    } catch {
      database = "down";
    }

    return ok(
      { status: database === "up" ? "ok" : "degraded", database },
      { status: database === "up" ? 200 : 503, requestId },
    );
  },
});
