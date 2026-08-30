"use client";

import { useState } from "react";

import { Button, Card, Field, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";

export function OrganizationSettingsForm({
  organizationName,
  organizationSlug,
  canEdit,
}: {
  organizationName: string;
  organizationSlug: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState(organizationName);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await apiFetch("/api/organization", { method: "PATCH", json: { name } });
    setSaving(false);

    if (result.success) {
      toast.success("Organization name updated.");
    } else {
      setErrors(fieldErrors(result));
      toast.error(result.error.message);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-slate-900 mb-4">Organization settings</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
        <Field label="Organization name" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              value={name}
              disabled={!canEdit}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field label="Slug" hint="Slug changes are made from Admin Center by a Super Admin.">
          {({ id }) => <TextInput id={id} value={organizationSlug} disabled />}
        </Field>

        {canEdit ? (
          <div>
            <Button type="submit" loading={saving} disabled={!name || name === organizationName}>
              Save
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Only the Organization Owner can edit these settings.</p>
        )}
      </form>
    </Card>
  );
}
