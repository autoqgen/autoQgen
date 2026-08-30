"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge, Card, Pagination, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { CreateOrganizationModal } from "@/components/admin/CreateOrganizationModal";

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  ownerEmail: string | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
}

export function OrganizationsTable() {
  const toast = useToast();
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15", ...(search ? { search } : {}) });
    const result = await apiFetch<OrganizationItem[]>(`/api/admin/organizations?${params.toString()}`);
    setLoading(false);

    if (result.success) {
      setOrganizations(result.data);
      if (result.meta) {
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      }
    } else {
      toast.error(result.error.message);
    }
  }, [page, search, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchOrganizations();
    });
  }, [fetchOrganizations]);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <TextInput
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Create Organization
        </button>
      </div>

      {loading ? (
        <Spinner label="Loading organizations" />
      ) : organizations.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-700">No organizations found</p>
          <p className="text-xs text-slate-500 mt-1">Create one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="p-3 pl-4">Organization</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Members</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3 pl-4">
                    <Link href={`/admin/organizations/${org.id}`} className="font-semibold text-brand-700 hover:underline">
                      {org.name}
                    </Link>
                    <p className="text-[11px] text-slate-500">{org.slug}</p>
                  </td>
                  <td className="p-3 text-slate-600">
                    {org.ownerName ? (
                      <>
                        <p>{org.ownerName}</p>
                        <p className="text-[11px] text-slate-400">{org.ownerEmail}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">No owner assigned</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">{org.memberCount}</td>
                  <td className="p-3">
                    <Badge tone={org.isActive ? "green" : "red"}>{org.isActive ? "active" : "suspended"}</Badge>
                  </td>
                  <td className="p-3 text-slate-500">{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 border-t border-slate-100 pt-4">
        <Pagination page={page} totalPages={totalPages} total={total} onChange={(p) => setPage(p)} />
      </div>

      <CreateOrganizationModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void fetchOrganizations();
        }}
      />
    </Card>
  );
}
