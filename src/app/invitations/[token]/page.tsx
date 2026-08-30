import { redirect } from "next/navigation";

import { Badge, Card } from "@/components/ui";
import { InvitationTokenActions } from "@/components/organization/InvitationTokenActions";
import { getOptionalUser } from "@/lib/auth/session";
import { invitationService } from "@/lib/services/invitation.service";

/**
 * The emailed deep link. Existing account holders normally just log in and
 * see their invitations under /dashboard/organization (section 13) — this
 * page exists for the not-yet-logged-in path: click the email, log in (or
 * register), and land back here to finish accepting.
 */
export default async function InvitationTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await invitationService.resolveByToken(token);

  if (!invitation) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card className="p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Invitation not available</h1>
          <p className="mt-2 text-sm text-slate-600">This invitation link is invalid.</p>
        </Card>
      </div>
    );
  }

  const user = await getOptionalUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  const emailMatches = user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">You&apos;ve been invited to {invitation.organizationName}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Role: <Badge tone="brand">{invitation.role.replace(/_/g, " ")}</Badge>
        </p>

        {!emailMatches ? (
          <p className="mt-4 text-xs text-red-600">
            This invitation was sent to {invitation.email}, but you&apos;re logged in as {user.email}. Log in with
            the invited email address to respond.
          </p>
        ) : invitation.status !== "pending" ? (
          <p className="mt-4 text-xs text-slate-500">
            This invitation is no longer pending (status: {invitation.status}).
          </p>
        ) : (
          <div className="mt-6 flex justify-center">
            <InvitationTokenActions invitationId={invitation.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
