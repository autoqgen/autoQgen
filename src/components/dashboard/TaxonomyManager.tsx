"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Pagination,
  Select,
  Spinner,
  TextInput,
} from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import type { PaginationMeta } from "@/types/api";

/**
 * One component drives all six taxonomy screens, matching the single generic
 * service behind the API. Adding a resource is a configuration change, not a
 * new page.
 */

export interface TaxonomyField {
  key: string;
  label: string;
  type: "text" | "number" | "parent";
  required?: boolean;
  /** For `parent` fields: the collection endpoint to populate the select from. */
  source?: string;
  /** Restricts the parent list to children of another selected field. */
  dependsOn?: string;
  hint?: string;
}

interface TaxonomyItem {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  [key: string]: unknown;
}

interface Props {
  title: string;
  description: string;
  endpoint: string;
  fields: TaxonomyField[];
  canWrite: boolean;
}

export default function TaxonomyManager({
  title,
  description,
  endpoint,
  fields,
  canWrite,
}: Props) {
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [parentOptions, setParentOptions] = useState<Record<string, TaxonomyItem[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const result = await apiFetch<TaxonomyItem[]>(`${endpoint}?page=${page}&limit=20`);

    setLoading(false);

    if (!result.success) {
      setLoadError(result.error.message);
      return;
    }

    setItems(result.data);
    setMeta(result.meta ?? null);
  }, [endpoint, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Parent selects reload only when a field they depend on changes — keyed on
   * the dependency values rather than the whole form, so typing a name does not
   * re-fetch every parent list on each keystroke.
   */
  const dependencyKey = fields
    .filter((field) => field.type === "parent")
    .map((field) => `${field.key}:${field.dependsOn ? (form[field.dependsOn] ?? "") : ""}`)
    .join("|");

  useEffect(() => {
    async function loadParents() {
      const next: Record<string, TaxonomyItem[]> = {};

      for (const field of fields) {
        if (field.type !== "parent" || !field.source) continue;

        const scope = field.dependsOn ? form[field.dependsOn] : undefined;
        if (field.dependsOn && !scope) {
          next[field.key] = [];
          continue;
        }

        const query = new URLSearchParams({ limit: "100" });
        if (field.dependsOn && scope) query.set(field.dependsOn, scope);

        const result = await apiFetch<TaxonomyItem[]>(`${field.source}?${query.toString()}`);
        next[field.key] = result.success ? result.data : [];
      }

      setParentOptions(next);
    }

    void loadParents();
    // `form` is intentionally excluded: only dependencyKey should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, dependencyKey]);

  function update(key: string, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormMessage("");
    setSaving(true);

    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = form[field.key];
      if (value === undefined || value === "") continue;
      payload[field.key] = field.type === "number" ? Number(value) : value;
    }

    const result = await apiFetch<TaxonomyItem>(endpoint, { method: "POST", json: payload });

    setSaving(false);

    if (!result.success) {
      setErrors(fieldErrors(result));
      setFormMessage(result.error.message);
      return;
    }

    setForm({});
    setFormMessage("");
    setPage(1);
    await load();
  }

  async function handleDeactivate(id: string) {
    const result = await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!result.success) {
      setLoadError(result.error.message);
      return;
    }
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </header>

      {canWrite ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Add new</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
            {fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                error={errors[field.key]}
                hint={field.hint}
                required={field.required}
              >
                {({ id, describedBy, invalid }) =>
                  field.type === "parent" ? (
                    <Select
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={form[field.key] ?? ""}
                      onChange={(event) => update(field.key, event.target.value)}
                      required={field.required}
                    >
                      <option value="">Select…</option>
                      {(parentOptions[field.key] ?? []).map((option) => (
                        <option key={option._id} value={option._id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type={field.type === "number" ? "number" : "text"}
                      value={form[field.key] ?? ""}
                      onChange={(event) => update(field.key, event.target.value)}
                      required={field.required}
                    />
                  )
                }
              </Field>
            ))}

            <div className="sm:col-span-2 flex flex-col gap-3">
              {formMessage ? <Alert tone="error">{formMessage}</Alert> : null}
              <div>
                <Button type="submit" loading={saving}>
                  Create
                </Button>
              </div>
            </div>
          </form>
        </Card>
      ) : (
        <Alert tone="info">
          Your role can view this taxonomy but not modify it.
        </Alert>
      )}

      <Card>
        {loadError ? <Alert tone="error">{loadError}</Alert> : null}

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body={canWrite ? "Create the first entry using the form above." : "No entries have been created."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-4">
                    Name
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Slug
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Status
                  </th>
                  {canWrite ? (
                    <th scope="col" className="py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{item.name}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{item.slug}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={item.isActive ? "green" : "slate"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canWrite ? (
                      <td className="py-2.5 text-right">
                        {item.isActive ? (
                          <Button variant="ghost" onClick={() => handleDeactivate(item._id)}>
                            Deactivate
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta ? (
          <div className="mt-4">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onChange={setPage}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
