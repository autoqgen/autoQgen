"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Card, Spinner, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

interface MyInvitation {
  id: string;
  organizationName: string;
  role: string;
  expiresAt: string;
}

/** The logged-in user's own pending invitations, with Accept/Reject actions. */
export function PendingInvitationsList({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast();
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<MyInvitation[]>("/api/invitations");
    setLoading(false);
    if (result.success) {
      setInvitations(result.data);
    } else {
      toast.error(result.error.message);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchInvitations();
    });
  }, [fetchInvitations]);

  const respond = async (id: string, action: "accept" | "reject") => {
    setRespondingId(id);
    const result = await apiFetch(`/api/invitations/${id}/${action}`, { method: "POST" });
    setRespondingId(null);

    if (result.success) {
      toast.success(action === "accept" ? "Invitation accepted." : "Invitation declined.");
      void fetchInvitations();
      onChanged?.();
    } else {
      toast.error(result.error.message);
    }
  };

  if (loading) return <Spinner label="Loading invitations" />;
  if (invitations.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-slate-900 mb-4">Pending invitations</h2>
      <ul className="divide-y divide-slate-100">
        {invitations.map((invitation) => {
          const busy = respondingId === invitation.id;
          return (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{invitation.organizationName}</p>
                <p className="text-xs text-slate-500">
                  Role: <Badge tone="brand">{invitation.role.replace(/_/g, " ")}</Badge>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => respond(invitation.id, "reject")}>
                  Reject
                </Button>
                <Button variant="primary" disabled={busy} loading={busy} onClick={() => respond(invitation.id, "accept")}>
                  Accept
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
