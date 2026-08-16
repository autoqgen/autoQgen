import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { connectDB } from "@/lib/db";
import { AuditLog, Question, QuestionPaper, User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  permission: "user:read:any",
  async handler({ requestId }) {
    await connectDB();

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalQuestions,
      approvedQuestions,
      pendingQuestions,
      totalPapers,
      publishedPapers,
      totalAuditLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ status: "suspended" }),
      Question.countDocuments(),
      Question.countDocuments({ status: "APPROVED" }),
      Question.countDocuments({ status: "PENDING" }),
      QuestionPaper.countDocuments(),
      QuestionPaper.countDocuments({ status: "PUBLISHED" }),
      AuditLog.countDocuments(),
    ]);

    // Role breakdown
    const roleCountsRaw = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const usersByRole: Record<string, number> = {};
    for (const item of roleCountsRaw) {
      if (item._id) usersByRole[item._id] = item.count;
    }

    return ok(
      {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          byRole: usersByRole,
        },
        questions: {
          total: totalQuestions,
          approved: approvedQuestions,
          pending: pendingQuestions,
        },
        papers: {
          total: totalPapers,
          published: publishedPapers,
        },
        auditLogs: {
          total: totalAuditLogs,
        },
      },
      { requestId }
    );
  },
});
