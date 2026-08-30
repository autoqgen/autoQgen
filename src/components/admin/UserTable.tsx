"use client";

import {
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EditUserModal } from "@/components/admin/EditUserModal";
import { Badge, Button, Card, Pagination, Select, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import type { OrgRole } from "@/types/organization";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@/types/roles";

interface AdminUserItem {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organizationId: string | null;
  organizationName: string | null;
  organizationRole: OrgRole | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminOrganizationOption {
  id: string;
  name: string;
}

const ROLE_BADGE_TONE: Record<string, string> = {
  super_admin: "brand",
  organization_owner: "brand",
  team_admin: "brand",
  moderator: "green",
  reviewer: "green",
  teacher: "slate",
  content_writer: "slate",
  student: "slate",
  member: "slate",
};

export default function UserTable() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<AdminOrganizationOption[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(search ? { search } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });

    const result = await apiFetch<AdminUserItem[]>(`/api/admin/users?${params.toString()}`);
    setLoading(false);

    if (result.success) {
      const normalized = result.data.map((u, index) => ({
        ...u,
        id: u.id || u._id || `user-${index}`,
      }));
      setUsers(normalized);
      if (result.meta) {
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      }
    } else {
      toast.error(result.error.message);
    }
  }, [page, search, roleFilter, statusFilter, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchUsers();
    });
  }, [fetchUsers]);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await apiFetch<AdminOrganizationOption[]>("/api/admin/organizations?limit=100");
      if (result.success) setOrganizations(result.data);
    });
  }, []);

  const handleStatusToggle = async (userId: string, currentStatus: UserStatus) => {
    const newStatus: UserStatus = currentStatus === "active" ? "suspended" : "active";
    setUpdatingId(userId);
    const result = await apiFetch<AdminUserItem>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      json: { status: newStatus },
    });
    setUpdatingId(null);

    if (result.success) {
      toast.success(`Account status changed to ${newStatus}`);
      void fetchUsers();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <Card className="p-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <TextInput
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 min-w-[150px]">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <Spinner label="Loading users" />
      ) : users.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-700">No users found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting search parameters or filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3 pl-4">User</th>
                <th className="p-3">Organization</th>
                <th className="p-3">Current Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Joined</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, index) => {
                const userId = u.id || u._id || `user-id-${index}`;
                const isUpdating = updatingId === userId;
                return (
                  <tr key={userId} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-slate-600">
                      {u.organizationName ?? <span className="text-slate-400">—</span>}
                    </td>

                    <td className="p-3">
                      {u.organizationRole ? (
                        <Badge tone={ROLE_BADGE_TONE[u.organizationRole] ?? "slate"}>
                          {u.organizationRole.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">
                        global: {u.role.replace(/_/g, " ")}
                      </p>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          u.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {u.status === "active" ? (
                          <UserCheck className="h-3 w-3" />
                        ) : (
                          <UserX className="h-3 w-3" />
                        )}
                        <span className="capitalize">{u.status}</span>
                      </span>
                    </td>

                    <td className="p-3 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          disabled={isUpdating}
                          onClick={() => setEditingUser(u)}
                          className="py-1 px-2.5 text-xs"
                        >
                          Edit
                        </Button>

                        {/* Status Toggle */}
                        <Button
                          variant={u.status === "active" ? "ghost" : "primary"}
                          disabled={isUpdating}
                          onClick={() => handleStatusToggle(userId, u.status)}
                          className="py-1 px-2.5 text-xs"
                        >
                          {u.status === "active" ? "Suspend" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {editingUser ? (
        <EditUserModal
          key={editingUser.id || editingUser._id}
          user={{
            id: editingUser.id || editingUser._id || "",
            name: editingUser.name,
            email: editingUser.email,
            role: editingUser.role,
            status: editingUser.status,
            organizationId: editingUser.organizationId,
            organizationRole: editingUser.organizationRole,
          }}
          organizations={organizations}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            void fetchUsers();
          }}
        />
      ) : null}
    </Card>
  );
}
