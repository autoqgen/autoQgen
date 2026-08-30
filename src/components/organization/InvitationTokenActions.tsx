"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

export function InvitationTokenActions({ invitationId }: { invitationId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  const respond = async (action: "accept" | "reject") => {
    setBusy(action);
    const result = await apiFetch(`/api/invitations/${invitationId}/${action}`, { method: "POST" });
    setBusy(null);

    if (result.success) {
      toast.success(action === "accept" ? "Invitation accepted." : "Invitation declined.");
      router.push("/dashboard/organization");
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="secondary" disabled={busy !== null} onClick={() => respond("reject")}>
        Reject
      </Button>
      <Button variant="primary" loading={busy === "accept"} disabled={busy !== null} onClick={() => respond("accept")}>
        Accept
      </Button>
    </div>
  );
}
