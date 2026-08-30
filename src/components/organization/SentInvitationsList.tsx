"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";

import { Badge, Button, Card, Spinner, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

interface SentInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  pending: "brand",
  accepted: "green",
  rejected: "red",
  expired: "slate",
  cancelled: "slate",
};

export interface SentInvitationsListHandle {
  refresh: () => void;
}

export const SentInvitationsList = forwardRef<SentInvitationsListHandle>(function SentInvitationsList(_, ref) {
  const toast = useToast();
  const [invitations, setInvitations] = useState<SentInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<SentInvitation[]>("/api/organization/invitations?limit=50");
    setLoading(false);
    if (result.success) {
      setInvitations(result.data);
    } else {
      toast.error(result.error.message);
    }
  }, [toast]);

  useImperativeHandle(ref, () => ({ refresh: () => void fetchInvitations() }), [fetchInvitations]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchInvitations();
    });
  }, [fetchInvitations]);

  const cancel = async (id: string) => {
    setCancellingId(id);
    const result = await apiFetch(`/api/organization/invitations/${id}`, { method: "DELETE" });
    setCancellingId(null);

    if (result.success) {
      toast.success("Invitation cancelled.");
      void fetchInvitations();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-slate-900 mb-4">Sent invitations</h2>
      {loading ? (
        <Spinner label="Loading invitations" />
      ) : invitations.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-700">No invitations sent yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{invitation.email}</p>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <Badge tone="slate">{invitation.role.replace(/_/g, " ")}</Badge>
                  <Badge tone={STATUS_TONE[invitation.status] ?? "slate"}>{invitation.status}</Badge>
                </p>
              </div>
              {invitation.status === "pending" ? (
                <Button
                  variant="ghost"
                  disabled={cancellingId === invitation.id}
                  onClick={() => cancel(invitation.id)}
                  className="text-xs"
                >
                  Cancel
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
});
