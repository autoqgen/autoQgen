"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  FolderTree,
  Layers,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";

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
  UnsavedChangesModal,
  useToast,
} from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import type { PaginationMeta } from "@/types/api";

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
  order?: number;
  [key: string]: unknown;
}

interface Props {
  title: string;
  description: string;
  endpoint: string;
  fields: TaxonomyField[];
  canWrite: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSingular(title: string): string {
  if (title.endsWith("ies")) return title.slice(0, -3) + "y";
  if (title.endsWith("s")) return title.slice(0, -1);
  return title;
}

export default function TaxonomyManager({
  title,
  description,
  endpoint,
  fields,
  canWrite,
}: Props) {
  const toast = useToast();
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Form State
  const [form, setForm] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [parentFilters, setParentFilters] = useState<Record<string, string>>({});

  const [parentOptions, setParentOptions] = useState<Record<string, TaxonomyItem[]>>({});
  const [globalParentOptions, setGlobalParentOptions] = useState<Record<string, TaxonomyItem[]>>({});

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load items from API
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const queryParams = new URLSearchParams({
      page: String(page),
      limit: "20",
      includeInactive: "true",
    });

    if (debouncedSearch.trim()) {
      queryParams.set("search", debouncedSearch.trim());
    }

    for (const [key, value] of Object.entries(parentFilters)) {
      if (value) {
        queryParams.set(key, value);
      }
    }

    const result = await apiFetch<TaxonomyItem[]>(`${endpoint}?${queryParams.toString()}`);

    setLoading(false);

    if (!result.success) {
      setLoadError(result.error.message);
      return;
    }

    setItems(result.data);
    setMeta(result.meta ?? null);
  }, [endpoint, page, debouncedSearch, parentFilters]);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setLoadError("");

      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "20",
        includeInactive: "true",
      });

      if (debouncedSearch.trim()) {
        queryParams.set("search", debouncedSearch.trim());
      }

      for (const [key, value] of Object.entries(parentFilters)) {
        if (value) {
          queryParams.set(key, value);
        }
      }

      const result = await apiFetch<TaxonomyItem[]>(`${endpoint}?${queryParams.toString()}`);

      if (ignore) return;
      setLoading(false);

      if (!result.success) {
        setLoadError(result.error.message);
        return;
      }

      setItems(result.data);
      setMeta(result.meta ?? null);
    }

    void fetchData();

    return () => {
      ignore = true;
    };
  }, [endpoint, page, debouncedSearch, parentFilters]);

  // Parent selects for Create Form (respects form dependencies)
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

        const query = new URLSearchParams({ limit: "100", includeInactive: "false" });
        if (field.dependsOn && scope) query.set(field.dependsOn, scope);

        const result = await apiFetch<TaxonomyItem[]>(`${field.source}?${query.toString()}`);
        next[field.key] = result.success ? result.data : [];
      }

      setParentOptions(next);
    }

    void loadParents();
    // `form` is intentionally excluded: dependencyKey tracks form dependency values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, dependencyKey]);

  // Global parent options for filter selects & table row label display
  useEffect(() => {
    async function loadGlobalParents() {
      const next: Record<string, TaxonomyItem[]> = {};

      for (const field of fields) {
        if (field.type !== "parent" || !field.source) continue;
        const query = new URLSearchParams({ limit: "100", includeInactive: "true" });
        const result = await apiFetch<TaxonomyItem[]>(`${field.source}?${query.toString()}`);
        next[field.key] = result.success ? result.data : [];
      }

      setGlobalParentOptions(next);
    }

    void loadGlobalParents();
  }, [fields]);

  function update(key: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !slugTouched && fields.some((f) => f.key === "slug")) {
        next.slug = slugify(value);
      }
      return next;
    });

    if (key === "slug") {
      setSlugTouched(true);
    }

    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  const isDirty = useMemo(() => {
    return Object.values(form).some((val) => Boolean(val && val.trim()));
  }, [form]);

  const isValid = useMemo(() => {
    for (const field of fields) {
      if (field.required && !(form[field.key] ?? "").trim()) return false;
    }
    return true;
  }, [fields, form]);

  const canCreate = isValid && !saving;

  const handleSaveAction = useCallback(async (): Promise<boolean> => {
    if (!isValid) return false;

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
      toast.error(result.error.message);
      return false;
    }

    setForm({});
    setSlugTouched(false);
    setFormMessage("");
    setPage(1);
    toast.success(`${title} entry created successfully!`);
    await load();
    return true;
  }, [endpoint, fields, form, isValid, load, title, toast]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleSaveAction();
  }

  const { showLeaveModal, confirmSaveAndLeave, confirmDiscardAndLeave, cancelLeave } =
    useUnsavedChanges({
      isDirty,
      onSave: handleSaveAction,
      onDiscard: () => {
        setForm({});
        setSlugTouched(false);
      },
    });

  async function handleDeactivate(id: string) {
    const result = await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!result.success) {
      setLoadError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.info("Entry deactivated.");
    await load();
  }

  async function handleActivate(id: string) {
    const result = await apiFetch(`${endpoint}/${id}`, {
      method: "PUT",
      json: { isActive: true },
    });
    if (!result.success) {
      setLoadError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success("Entry activated.");
    await load();
  }

  // Filter items by status on client side
  const filteredItems = useMemo(() => {
    if (statusFilter === "active") return items.filter((item) => item.isActive);
    if (statusFilter === "inactive") return items.filter((item) => !item.isActive);
    return items;
  }, [items, statusFilter]);

  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items]);
  const inactiveCount = useMemo(() => items.filter((item) => !item.isActive).length, [items]);

  const parentFields = useMemo(
    () => fields.filter((field) => field.type === "parent"),
    [fields],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "all" ||
    Object.values(parentFilters).some(Boolean);

  function clearAllFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setParentFilters({});
    setPage(1);
  }

  function getParentName(fieldKey: string, rawVal: unknown): string {
    if (!rawVal) return "";
    const id = typeof rawVal === "object" && rawVal !== null && "_id" in rawVal
      ? (rawVal as { _id: string })._id
      : String(rawVal);
    const nameFromObj = typeof rawVal === "object" && rawVal !== null && "name" in rawVal
      ? (rawVal as { name: string }).name
      : null;
    if (nameFromObj) return nameFromObj;

    const list = globalParentOptions[fieldKey] ?? parentOptions[fieldKey] ?? [];
    const match = list.find((opt) => opt._id === id);
    return match ? match.name : id;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Overview Strip */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-card p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60">
              <FolderTree className="h-3.5 w-3.5 text-brand-600" />
              Taxonomy Management
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">{description}</p>
        </div>

        {canWrite ? (
          <Button
            variant={showCreateForm ? "secondary" : "primary"}
            onClick={() => setShowCreateForm((prev) => !prev)}
            className={`self-start sm:self-center rounded-xl px-4 py-2.5 font-semibold transition-all shadow-xs ${
              showCreateForm
                ? "border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20"
            }`}
          >
            {showCreateForm ? (
              <>
                <X className="h-4 w-4" />
                Close Form
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add New {getSingular(title)}
              </>
            )}
          </Button>
        ) : null}
      </header>

      {/* 2. KPI Summary Boxes Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-card p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Entries
            </span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600 group-hover:bg-slate-200 transition-colors">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {meta ? meta.total : items.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">In this collection</p>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs transition-all hover:shadow-md hover:border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Active Entries
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-950">{activeCount}</p>
          <p className="mt-0.5 text-xs text-emerald-600">Available for selection</p>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-xs transition-all hover:shadow-md hover:border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Inactive Entries
            </span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700 group-hover:bg-amber-200 transition-colors">
              <Power className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-950">{inactiveCount}</p>
          <p className="mt-0.5 text-xs text-amber-600">Deactivated or disabled</p>
        </div>
      </div>

      {/* 3. Search & Filter Control Box */}
      <Card className="border border-slate-200/80 bg-card/80 backdrop-blur-xs p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <SlidersHorizontal className="h-4 w-4 text-brand-600" />
              Filter & Search Controls
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear All Filters
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {/* Search Input Box */}
            <div className="md:col-span-5">
              <label htmlFor="taxonomy-search" className="sr-only">
                Search entries
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="taxonomy-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={`Search ${title.toLowerCase()} by name or slug...`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-brand-500 focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Status Filter Segmented Control */}
            <div className="md:col-span-4 flex items-center">
              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-card text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                    statusFilter === "active"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 hover:text-emerald-700"
                  }`}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("inactive")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                    statusFilter === "inactive"
                      ? "bg-amber-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 hover:text-amber-700"
                  }`}
                >
                  Inactive ({inactiveCount})
                </button>
              </div>
            </div>

            {/* Parent Dropdown Filters */}
            {parentFields.map((field) => (
              <div key={field.key} className="md:col-span-3">
                <label htmlFor={`filter-${field.key}`} className="sr-only">
                  Filter by {field.label}
                </label>
                <Select
                  id={`filter-${field.key}`}
                  value={parentFilters[field.key] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setParentFilters((prev) => ({ ...prev, [field.key]: val }));
                    setPage(1);
                  }}
                  className="rounded-xl border-slate-200 bg-slate-50/50 text-xs py-2"
                >
                  <option value="">All {field.label}s</option>
                  {(globalParentOptions[field.key] ?? []).map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Active filters:</span>
              {searchQuery ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 border border-brand-200">
                  Search: &quot;{searchQuery}&quot;
                  <button type="button" onClick={() => setSearchQuery("")}>
                    <X className="h-3 w-3 hover:text-brand-900" />
                  </button>
                </span>
              ) : null}
              {statusFilter !== "all" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 capitalize">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter("all")}>
                    <X className="h-3 w-3 hover:text-slate-900" />
                  </button>
                </span>
              ) : null}
              {Object.entries(parentFilters).map(([k, v]) => {
                if (!v) return null;
                const fieldConfig = fields.find((f) => f.key === k);
                const parentName = getParentName(k, v);
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 border border-purple-200"
                  >
                    {fieldConfig?.label ?? k}: {parentName}
                    <button
                      type="button"
                      onClick={() =>
                        setParentFilters((prev) => ({ ...prev, [k]: "" }))
                      }
                    >
                      <X className="h-3 w-3 hover:text-purple-900" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </Card>

      {/* 4. Add New Entry Form Box */}
      {canWrite && showCreateForm ? (
        <Card className="border border-brand-200/80 bg-gradient-to-b from-brand-50/40 via-card to-card p-6 shadow-md transition-all">
          <div className="flex items-center justify-between border-b border-brand-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Add New {getSingular(title)}
                </h2>
                <p className="text-xs text-slate-500">
                  Fill in the details below to create a new {getSingular(title).toLowerCase()} entry.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Close form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
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
                      className="rounded-xl border-slate-200 bg-card shadow-2xs"
                    >
                      <option value="">Select {field.label}…</option>
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
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="rounded-xl border-slate-200 bg-card shadow-2xs"
                    />
                  )
                }
              </Field>
            ))}

            <div className="sm:col-span-2 flex flex-col gap-3 pt-3 border-t border-slate-100">
              {formMessage ? <Alert tone="error">{formMessage}</Alert> : null}
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!canCreate}
                  className={`transition-all rounded-xl px-5 py-2.5 ${
                    canCreate
                      ? "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25"
                      : "opacity-50 cursor-not-allowed bg-slate-200 text-slate-500"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Create {getSingular(title)}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setForm({});
                    setSlugTouched(false);
                    setShowCreateForm(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </Button>
                {isDirty ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setForm({});
                      setSlugTouched(false);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 ml-auto"
                  >
                    Reset Form
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </Card>
      ) : !canWrite ? (
        <Alert tone="info">Your role can view this taxonomy but not modify it.</Alert>
      ) : null}

      {/* 5. Data Table Box */}
      <Card className="overflow-hidden border border-slate-200/90 bg-card p-0 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold tracking-tight text-slate-800">{title} Directory</h2>
            <Badge tone="indigo">{filteredItems.length} items</Badge>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loadError ? (
          <div className="p-6">
            <Alert tone="error">{loadError}</Alert>
          </div>
        ) : null}

        {loading ? (
          <div className="flex py-16 justify-center">
            <Spinner />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={hasActiveFilters ? "No matching entries" : "Nothing here yet"}
              body={
                hasActiveFilters
                  ? "No taxonomy items match your active filters or search terms."
                  : canWrite
                  ? "Create the first entry using the form above."
                  : "No entries have been created."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearAllFilters} className="mt-2 text-xs">
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{title} directory listing</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="py-3 px-6">
                    Name & Slug
                  </th>
                  {parentFields.map((pf) => (
                    <th scope="col" key={pf.key} className="py-3 px-4">
                      {pf.label}
                    </th>
                  ))}
                  {fields.some((f) => f.key === "order" || f.key === "chapterNo" || f.key === "group" || f.key === "year") ? (
                    <th scope="col" className="py-3 px-4">
                      Details
                    </th>
                  ) : null}
                  <th scope="col" className="py-3 px-4">
                    Status
                  </th>
                  {canWrite ? (
                    <th scope="col" className="py-3 px-6 text-right">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr
                    key={item._id}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      !item.isActive ? "bg-slate-50/40 opacity-80" : ""
                    }`}
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {item.name}
                        </span>
                        <code className="mt-0.5 text-xs text-slate-400 font-mono">
                          {item.slug}
                        </code>
                      </div>
                    </td>

                    {parentFields.map((pf) => {
                      const parentName = getParentName(pf.key, item[pf.key]);
                      return (
                        <td key={pf.key} className="py-3.5 px-4 text-xs text-slate-600">
                          {parentName ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200">
                              <ChevronRight className="h-3 w-3 text-slate-400" />
                              {parentName}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      );
                    })}

                    {fields.some((f) => f.key === "order" || f.key === "chapterNo" || f.key === "group" || f.key === "year") ? (
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {item.chapterNo !== undefined && item.chapterNo !== null ? (
                          <span className="font-medium text-slate-700">Ch. {String(item.chapterNo)}</span>
                        ) : item.order !== undefined && item.order !== null ? (
                          <span className="font-medium text-slate-700">Order: {String(item.order)}</span>
                        ) : item.group ? (
                          <span className="font-medium text-slate-700">{String(item.group)}</span>
                        ) : item.year ? (
                          <span className="font-medium text-slate-700">{String(item.year)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}

                    <td className="py-3.5 px-4">
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {canWrite ? (
                      <td className="py-3.5 px-6 text-right">
                        {item.isActive ? (
                          <Button
                            variant="ghost"
                            onClick={() => handleDeactivate(item._id)}
                            className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg py-1 px-3"
                          >
                            <Power className="h-3.5 w-3.5" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => handleActivate(item._id)}
                            className="text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg py-1 px-3"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Activate
                          </Button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta ? (
          <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onChange={setPage}
            />
          </div>
        ) : null}
      </Card>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onStay={cancelLeave}
        onDiscard={confirmDiscardAndLeave}
        onSave={() => void confirmSaveAndLeave()}
        canSave={canCreate}
        saving={saving}
        title="Unsaved Entry"
        description="You have entered data in the form above that hasn't been created yet. Would you like to create this entry or discard your changes before leaving?"
      />
    </div>
  );
}
