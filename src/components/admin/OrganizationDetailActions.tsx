"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { AssignOwnerModal } from "@/components/admin/AssignOwnerModal";

export function OrganizationDetailActions({
  organizationId,
  isActive,
  hasOwner,
}: {
  organizationId: string;
  isActive: boolean;
  hasOwner: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const handleToggleActive = async () => {
    setTogglingActive(true);
    const result = await apiFetch(`/api/admin/organizations/${organizationId}`, {
      method: "PATCH",
      json: { isActive: !isActive },
    });
    setTogglingActive(false);

    if (result.success) {
      toast.success(isActive ? "Organization suspended." : "Organization activated.");
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={() => setAssigning(true)}>
        {hasOwner ? "Change Owner" : "Assign Owner"}
      </Button>
      <Button variant={isActive ? "secondary" : "primary"} loading={togglingActive} onClick={handleToggleActive}>
        {isActive ? "Suspend Organization" : "Activate Organization"}
      </Button>

      <AssignOwnerModal
        organizationId={organizationId}
        isOpen={assigning}
        onClose={() => setAssigning(false)}
        onAssigned={() => {
          setAssigning(false);
          router.refresh();
        }}
      />
    </div>
  );
}
