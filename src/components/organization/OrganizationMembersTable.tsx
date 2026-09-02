"use client";

import { Search, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Card, Pagination, Select, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { ORG_ASSIGNABLE_BY_OWNER, type OrgMemberStatus, type OrgRole } from "@/types/organization";

interface MemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  status: OrgMemberStatus;
  teamId: string | null;
  teamName: string | null;
  joinedAt: string | null;
}

const ROLE_BADGE_TONE: Record<string, string> = {
  organization_owner: "brand",
  team_admin: "brand",
  moderator: "green",
  reviewer: "green",
  teacher: "slate",
  content_writer: "slate",
  student: "slate",
};

interface OrganizationMembersTableProps {
  /** Where to GET the member list from. */
  fetchUrl: string;
  /**
   * Base path for PATCH/DELETE (e.g. "/api/organization/members"). Omit for
   * a read-only view (used by the Admin Center's cross-org member view).
   */
  mutateBaseUrl?: string;
}

export function OrganizationMembersTable({ fetchUrl, mutateBaseUrl }: OrganizationMembersTableProps) {
  const toast = useToast();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15", ...(search ? { search } : {}) });
    const result = await apiFetch<MemberItem[]>(`${fetchUrl}?${params.toString()}`);
    setLoading(false);

    if (result.success) {
      setMembers(result.data);
      if (result.meta) {
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      }
    } else {
      toast.error(result.error.message);
    }
  }, [fetchUrl, page, search, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMembers();
    });
  }, [fetchMembers]);

  const handleRoleChange = async (memberId: string, role: OrgRole) => {
    if (!mutateBaseUrl) return;
    setUpdatingId(memberId);
    const result = await apiFetch<MemberItem>(`${mutateBaseUrl}/${memberId}`, { method: "PATCH", json: { role } });
    setUpdatingId(null);

    if (result.success) {
      toast.success(`Role updated to ${role.replace(/_/g, " ")}`);
      void fetchMembers();
    } else {
      toast.error(result.error.message);
    }
  };

  const handleStatusToggle = async (memberId: string, currentStatus: OrgMemberStatus) => {
    if (!mutateBaseUrl) return;
    const newStatus: OrgMemberStatus = currentStatus === "active" ? "suspended" : "active";
    setUpdatingId(memberId);
    const result = await apiFetch<MemberItem>(`${mutateBaseUrl}/${memberId}`, {
      method: "PATCH",
      json: { status: newStatus },
    });
    setUpdatingId(null);

    if (result.success) {
      toast.success(`Membership status changed to ${newStatus}`);
      void fetchMembers();
    } else {
      toast.error(result.error.message);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!mutateBaseUrl) return;
    setUpdatingId(memberId);
    const result = await apiFetch<{ removed: boolean }>(`${mutateBaseUrl}/${memberId}`, { method: "DELETE" });
    setUpdatingId(null);

    if (result.success) {
      toast.success("Member removed from the organization.");
      void fetchMembers();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <Card className="p-6">
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
      </div>

      {loading ? (
        <Spinner label="Loading members" />
      ) : members.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-700">No members found</p>
          <p className="text-xs text-slate-500 mt-1">Invite someone to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3 pl-4">Member</th>
                <th className="p-3">Role</th>
                <th className="p-3">Team</th>
                <th className="p-3">Status</th>
                {mutateBaseUrl ? <th className="p-3 text-right pr-4">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const isUpdating = updatingId === member.id;
                const isOwner = member.role === "organization_owner";
                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-brand-600">
                          {member.name.substring(0, 2).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-[11px] text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <Badge tone={ROLE_BADGE_TONE[member.role] ?? "slate"}>{member.role.replace(/_/g, " ")}</Badge>
                    </td>

                    <td className="p-3 text-slate-500">{member.teamName ?? "—"}</td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {member.status === "active" ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                        <span className="capitalize">{member.status}</span>
                      </span>
                    </td>

                    {mutateBaseUrl ? (
                      <td className="p-3 text-right pr-4">
                        {isOwner ? (
                          <span className="text-[11px] text-slate-400">Reassign from Admin Center</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              disabled={isUpdating}
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                              className="py-1 px-2 text-xs w-36"
                            >
                              {ORG_ASSIGNABLE_BY_OWNER.map((role) => (
                                <option key={role} value={role}>
                                  {role.replace(/_/g, " ")}
                                </option>
                              ))}
                            </Select>

                            <Button
                              variant={member.status === "active" ? "ghost" : "primary"}
                              disabled={isUpdating}
                              onClick={() => handleStatusToggle(member.id, member.status)}
                              className="py-1 px-2.5 text-xs"
                            >
                              {member.status === "active" ? "Suspend" : "Activate"}
                            </Button>

                            <Button
                              variant="danger"
                              disabled={isUpdating}
                              onClick={() => handleRemove(member.id)}
                              className="py-1 px-2.5 text-xs"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 border-t border-slate-100 pt-4">
        <Pagination page={page} totalPages={totalPages} total={total} onChange={(p) => setPage(p)} />
      </div>
    </Card>
  );
}
