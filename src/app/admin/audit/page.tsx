import AuditLogTable from "@/components/admin/AuditLogTable";

export default function AdminAuditPage() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Security Audit Trail</h1>
        <p className="mt-1 text-xs text-slate-500">
          Immutable system log tracking authentication attempts, role updates, and resource changes.
        </p>
      </header>

      <AuditLogTable />
    </div>
  );
}
