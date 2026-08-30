"use client";

import { useEffect, useState } from "react";

import { Button, Card, Field, Select, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { ORG_ASSIGNABLE_BY_OWNER } from "@/types/organization";

interface TeamOption {
  id: string;
  name: string;
}

export function InviteMemberForm({ onInvited }: { onInvited?: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ORG_ASSIGNABLE_BY_OWNER[0] ?? "teacher");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await apiFetch<TeamOption[]>("/api/organization/teams");
      if (result.success) setTeams(result.data);
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    const result = await apiFetch("/api/organization/invitations", {
      method: "POST",
      json: { email, role, teamId: teamId || undefined },
    });

    setSubmitting(false);

    if (result.success) {
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setTeamId("");
      onInvited?.();
    } else {
      setErrors(fieldErrors(result));
      toast.error(result.error.message);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-slate-900 mb-4">Invite a member</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Email" error={errors.email} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="email"
              required
              invalid={invalid}
              aria-describedby={describedBy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          )}
        </Field>

        <Field label="Role" error={errors.role} required>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ORG_ASSIGNABLE_BY_OWNER.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Team (optional)">
          {({ id }) => (
            <Select id={id} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="sm:col-span-3">
          <Button type="submit" loading={submitting} disabled={!email}>
            Send invitation
          </Button>
        </div>
      </form>
    </Card>
  );
}
