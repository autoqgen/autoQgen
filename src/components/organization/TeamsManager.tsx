"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Card, EmptyState, Field, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

interface TeamItem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

/** `canCreate` is true only for the Organization Owner (teams:create). Team Admins can still rename their own team via the row-level Save button — the API enforces the actual scoping. */
export function TeamsManager({ canCreate }: { canCreate: boolean }) {
  const toast = useToast();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Record<string, { name: string; description: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<TeamItem[]>("/api/organization/teams");
    setLoading(false);
    if (result.success) {
      setTeams(result.data);
      setEditing(Object.fromEntries(result.data.map((t) => [t.id, { name: t.name, description: t.description }])));
    } else {
      toast.error(result.error.message);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchTeams();
    });
  }, [fetchTeams]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    const result = await apiFetch("/api/organization/teams", {
      method: "POST",
      json: { name: newName, description: newDescription },
    });
    setCreating(false);

    if (result.success) {
      toast.success("Team created.");
      setNewName("");
      setNewDescription("");
      void fetchTeams();
    } else {
      toast.error(result.error.message);
    }
  };

  const handleSave = async (teamId: string) => {
    const draft = editing[teamId];
    if (!draft) return;
    setSavingId(teamId);
    const result = await apiFetch(`/api/organization/teams/${teamId}`, {
      method: "PATCH",
      json: { name: draft.name, description: draft.description },
    });
    setSavingId(null);

    if (result.success) {
      toast.success("Team updated.");
      void fetchTeams();
    } else {
      toast.error(result.error.message);
    }
  };

  const handleDelete = async (teamId: string) => {
    setSavingId(teamId);
    const result = await apiFetch(`/api/organization/teams/${teamId}`, { method: "DELETE" });
    setSavingId(null);

    if (result.success) {
      toast.success("Team removed.");
      void fetchTeams();
    } else {
      toast.error(result.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {canCreate ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Create a team</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3">
            <Field label="Team name" required>
              {({ id }) => (
                <TextInput id={id} required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Class 9 Mathematics" />
              )}
            </Field>
            <Field label="Description">
              {({ id }) => (
                <TextInput id={id} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              )}
            </Field>
            <div className="flex items-end">
              <Button type="submit" loading={creating} disabled={!newName}>
                Create team
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Teams</h2>
        {loading ? (
          <Spinner label="Loading teams" />
        ) : teams.length === 0 ? (
          <EmptyState title="No teams yet" body="Create a team to start grouping members." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {teams.map((team) => {
              const draft = editing[team.id] ?? { name: team.name, description: team.description };
              const busy = savingId === team.id;
              return (
                <li key={team.id} className="flex flex-wrap items-center gap-3 py-3">
                  <TextInput
                    value={draft.name}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [team.id]: { ...draft, name: e.target.value } }))}
                    className="max-w-[220px]"
                  />
                  <TextInput
                    value={draft.description}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [team.id]: { ...draft, description: e.target.value } }))
                    }
                    placeholder="Description"
                    className="flex-1 min-w-[160px]"
                  />
                  <Button variant="secondary" disabled={busy} onClick={() => handleSave(team.id)}>
                    Save
                  </Button>
                  {canCreate ? (
                    <Button variant="danger" disabled={busy} onClick={() => handleDelete(team.id)}>
                      Delete
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
