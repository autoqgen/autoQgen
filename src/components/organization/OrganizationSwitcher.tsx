"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Select, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

interface MembershipOption {
  organizationId: string;
  organizationName: string;
  role: string;
}

export function OrganizationSwitcher({
  memberships,
  currentOrganizationId,
}: {
  memberships: MembershipOption[];
  currentOrganizationId: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const { update } = useSession();
  const [switching, setSwitching] = useState(false);

  if (memberships.length <= 1) return null;

  const handleChange = async (organizationId: string) => {
    if (organizationId === currentOrganizationId) return;
    setSwitching(true);
    const result = await apiFetch("/api/organization/switch", { method: "POST", json: { organizationId } });
    setSwitching(false);

    if (result.success) {
      await update();
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <Select
      value={currentOrganizationId ?? ""}
      disabled={switching}
      onChange={(e) => void handleChange(e.target.value)}
      className="max-w-xs"
    >
      {memberships.map((membership) => (
        <option key={membership.organizationId} value={membership.organizationId}>
          {membership.organizationName}
        </option>
      ))}
    </Select>
  );
}
