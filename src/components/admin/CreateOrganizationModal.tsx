"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button, Field, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateOrganizationModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    const result = await apiFetch("/api/admin/organizations", { method: "POST", json: { name, slug } });
    setSubmitting(false);

    if (result.success) {
      toast.success(`Organization "${name}" created.`);
      setName("");
      setSlug("");
      setSlugTouched(false);
      onCreated();
    } else {
      setErrors(fieldErrors(result));
      toast.error(result.error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-2xl bg-card p-6 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Create Organization</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Organization name" error={errors.name} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                required
                invalid={invalid}
                aria-describedby={describedBy}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="ABC School"
              />
            )}
          </Field>

          <Field label="Slug" error={errors.slug} hint="Lowercase letters, digits and hyphens only." required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                required
                invalid={invalid}
                aria-describedby={describedBy}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="abc-school"
              />
            )}
          </Field>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!name || !slug}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
