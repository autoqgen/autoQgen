"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button, Select, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { ORG_ROLES, type OrgRole } from "@/types/organization";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@/types/roles";

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organizationId: string | null;
  organizationRole: OrgRole | null;
}

interface AdminOrganizationOption {
  id: string;
  name: string;
}

const humanize = (value: string) => value.replace(/_/g, " ");

/**
 * Rendered only while a user is being edited, and given `key={user.id}` by the
 * parent so it remounts (fresh state) per user — hence plain `useState`
 * initializers rather than a prop-syncing effect.
 */
export function EditUserModal({
  user,
  organizations,
  onClose,
  onSaved,
}: {
  user: EditableUser;
  organizations: AdminOrganizationOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [organizationId, setOrganizationId] = useState(user.organizationId ?? "");
  const [organizationRole, setOrganizationRole] = useState<OrgRole>(user.organizationRole ?? "member");
  const [globalRole, setGlobalRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const patch: Record<string, unknown> = {};

    if (globalRole !== user.role) patch.role = globalRole;
    if (status !== user.status) patch.status = status;

    const nextOrganizationId = organizationId || null;
    const organizationChanged = nextOrganizationId !== (user.organizationId ?? null);
    if (organizationChanged) patch.organizationId = nextOrganizationId;

    if (nextOrganizationId && (organizationChanged || organizationRole !== user.organizationRole)) {
      // Send the intended org role whenever the organization itself changed, so
      // the server never has to guess a role for the new membership.
      patch.organizationRole = organizationRole;
    }

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    const result = await apiFetch(`/api/admin/users/${user.id}`, { method: "PATCH", json: patch });
    setSaving(false);

    if (result.success) {
      toast.success(`${user.name} updated.`);
      onSaved();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit user</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {user.name} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Organization</span>
            <Select
              value={organizationId}
              disabled={saving}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              <option value="">No organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Organization role</span>
            <Select
              value={organizationRole}
              disabled={saving || !organizationId}
              onChange={(e) => setOrganizationRole(e.target.value as OrgRole)}
            >
              {ORG_ROLES.map((role) => (
                <option key={role} value={role}>
                  {humanize(role)}
                </option>
              ))}
            </Select>
            <span className="text-[11px] text-slate-400">
              {organizationId
                ? "Role inside the selected organization. Owner grants full organization control."
                : "Select an organization to set an organization role."}
            </span>
          </label>

          <div className="border-t border-slate-100" />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Global role</span>
            <Select
              value={globalRole}
              disabled={saving}
              onChange={(e) => setGlobalRole(e.target.value as UserRole)}
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {humanize(role)}
                </option>
              ))}
            </Select>
            <span className="text-[11px] text-slate-400">
              Platform-wide capability rank. Separate from the organization role.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Account status</span>
            <Select
              value={status}
              disabled={saving}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
            >
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" loading={saving} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
