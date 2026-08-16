"use client";

import { Eye } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Card, Pagination, Select, Spinner, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { AUDIT_ACTIONS, type AuditAction } from "@/types/audit";

interface AuditItem {
  id?: string;
  _id?: string;
  action: AuditAction;
  actor?: {
    id?: string;
    _id?: string;
    email?: string;
  };
  resourceType: string;
  resourceId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_TONE: Record<string, string> = {
  "auth.login": "green",
  "auth.logout": "slate",
  "auth.register": "brand",
  "user.update-role": "amber",
  "user.suspend": "red",
  "question.create": "green",
  "question.delete": "red",
  "paper.publish": "brand",
};

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(date.getTime())) return "—";
  if (diffInSeconds < 5) return "Just now";
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

function getResourceLabel(log: AuditItem): string {
  const meta = log.metadata || {};

  if (meta.targetEmail) return String(meta.targetEmail);
  if (meta.targetName) return String(meta.targetName);
  if (meta.email) return String(meta.email);
  if (meta.questionTitle) return String(meta.questionTitle);
  if (meta.paperTitle) return String(meta.paperTitle);
  if (meta.title) return String(meta.title);
  if (meta.name) return String(meta.name);
  if (meta.code) return String(meta.code);

  if (log.resourceId) {
    if (log.resourceId.includes("@")) return log.resourceId;
    if (log.resourceId.length > 16) {
      return `${log.resourceId.substring(0, 8)}…${log.resourceId.substring(log.resourceId.length - 4)}`;
    }
    return log.resourceId;
  }

  return "—";
}

export default function AuditLogTable() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [inspectItem, setInspectItem] = useState<AuditItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(resourceFilter ? { resourceType: resourceFilter } : {}),
    });

    const result = await apiFetch<AuditItem[]>(`/api/audit?${params.toString()}`);
    setLoading(false);

    if (result.success) {
      const normalized = result.data.map((item, index) => ({
        ...item,
        id: item.id || item._id || `log-${index}`,
      }));
      setLogs(normalized);
      if (result.meta) {
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      }
    } else {
      toast.error(result.error.message);
    }
  }, [page, actionFilter, resourceFilter, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchLogs();
    });
  }, [fetchLogs]);

  return (
    <Card className="p-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          <Select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="min-w-[180px]"
          >
            <option value="">All Action Types</option>
            {AUDIT_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </Select>

          <Select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="min-w-[160px]"
          >
            <option value="">All Resources</option>
            <option value="user">User</option>
            <option value="auth">Auth</option>
            <option value="question">Question</option>
            <option value="paper">Paper</option>
            <option value="taxonomy">Taxonomy</option>
            <option value="security">Security</option>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <Spinner label="Loading audit logs" />
      ) : logs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-700">No audit events found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting search filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3 pl-4">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Target Resource</th>
                <th className="p-3">IP Address</th>
                <th className="p-3 text-right pr-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log, index) => (
                <tr key={log.id || log._id || `log-row-${index}`} className="hover:bg-slate-50/60 transition">
                  <td
                    className="p-3 pl-4 text-slate-700 font-semibold text-[11px] whitespace-nowrap cursor-help"
                    title={new Date(log.createdAt).toLocaleString()}
                  >
                    {getRelativeTime(log.createdAt)}
                  </td>

                  <td className="p-3">
                    <Badge tone={ACTION_TONE[log.action] ?? "slate"}>
                      {log.action}
                    </Badge>
                  </td>

                  <td className="p-3 font-medium text-slate-800">
                    {log.actor?.email ?? "System"}
                  </td>

                  <td className="p-3 text-slate-600">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 shrink-0">
                        {log.resourceType}
                      </span>
                      <span className="font-medium text-slate-800 truncate text-xs" title={log.resourceId}>
                        {getResourceLabel(log)}
                      </span>
                    </div>
                  </td>

                  <td className="p-3 font-mono text-[11px] text-slate-500">
                    {log.ip ?? "127.0.0.1"}
                  </td>

                  <td className="p-3 text-right pr-4">
                    <Button
                      variant="ghost"
                      onClick={() => setInspectItem(log)}
                      className="py-1 px-2 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Audit Event Payload</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Event ID: {inspectItem.id}
            </p>

            <div className="mt-4 rounded-xl bg-slate-900 p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-64">
              <pre>{JSON.stringify(inspectItem.metadata ?? {}, null, 2)}</pre>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setInspectItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={(p) => setPage(p)}
        />
      </div>
    </Card>
  );
}
