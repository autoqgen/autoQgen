import UserTable from "@/components/admin/UserTable";

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Users & Roles Governance</h1>
        <p className="mt-1 text-xs text-slate-500">
          Manage platform accounts, assign RBAC permissions, and control user access states.
        </p>
      </header>

      <UserTable />
    </div>
  );
}
