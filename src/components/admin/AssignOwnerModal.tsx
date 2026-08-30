"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function AssignOwnerModal({
  organizationId,
  isOpen,
  onClose,
  onAssigned,
}: {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const term = search.trim();

    const timeout = setTimeout(async () => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      const result = await apiFetch<UserOption[]>(
        `/api/admin/users?limit=8&status=active&search=${encodeURIComponent(term)}`,
      );
      setSearching(false);
      if (result.success) setResults(result.data);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, isOpen]);

  if (!isOpen) return null;

  const handleAssign = async () => {
    if (!selected) return;
    setAssigning(true);
    const result = await apiFetch(`/api/admin/organizations/${organizationId}/owner`, {
      method: "POST",
      json: { userId: selected.id },
    });
    setAssigning(false);

    if (result.success) {
      toast.success(`${selected.name} is now the organization owner.`);
      setSearch("");
      setSelected(null);
      setResults([]);
      onAssigned();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Assign Organization Owner</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <TextInput
          placeholder="Search by name or email…"
          value={selected ? selected.name : search}
          onChange={(e) => {
            setSelected(null);
            setSearch(e.target.value);
          }}
        />

        {!selected && (searching || results.length > 0) ? (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {searching ? (
              <li className="p-3 text-xs text-slate-500">Searching…</li>
            ) : (
              results.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(option)}
                    className="w-full text-left p-3 text-xs hover:bg-slate-50"
                  >
                    <p className="font-semibold text-slate-900">{option.name}</p>
                    <p className="text-slate-500">{option.email}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={assigning} disabled={!selected} onClick={handleAssign}>
            Assign Owner
          </Button>
        </div>
      </div>
    </div>
  );
}
