import type { EmailMessage } from "@/lib/email/types";

/**
 * Organization invitation email. Same plain-text + HTML approach as
 * password-reset.ts: content generated once, rendered both ways, the secure
 * link is the only place the token appears.
 */

export interface InvitationTemplateInput {
  recipientEmail: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
  supportEmail?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ");
}

export function invitationEmail(input: InvitationTemplateInput): EmailMessage {
  const roleLabel = formatRole(input.role);
  const safeOrg = escapeHtml(input.organizationName);
  const safeRole = escapeHtml(roleLabel);
  const safeUrl = escapeHtml(input.acceptUrl);

  const text = [
    `You've been invited to join ${input.organizationName} on AutoQgen as ${roleLabel}.`,
    "",
    "Open this link to accept or review the invitation:",
    input.acceptUrl,
    "",
    `This invitation expires in ${input.expiresInDays} days.`,
    "",
    "If you weren't expecting this, you can ignore this email.",
    "",
    "— AutoQgen",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#5b21b6;">AutoQgen</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0;">
          <h1 style="margin:0 0 12px;font-size:20px;">You've been invited to ${safeOrg}</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">You've been invited to join <strong>${safeOrg}</strong> on AutoQgen as <strong>${safeRole}</strong>.</p>
          <p style="margin:0 0 24px;">
            <a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;">View invitation</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.6;">
            This invitation expires in <strong>${input.expiresInDays} days</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:#475569;line-height:1.6;">
            If the button does not work, copy this address into your browser:<br />
            <span style="word-break:break-all;color:#7c3aed;">${safeUrl}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.6;">
            If you weren't expecting this, you can safely ignore this email.${
              input.supportEmail
                ? ` Questions? Contact <a href="mailto:${escapeHtml(input.supportEmail)}" style="color:#7c3aed;">${escapeHtml(input.supportEmail)}</a>.`
                : ""
            }
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to: input.recipientEmail,
    subject: `You've been invited to join ${input.organizationName} on AutoQgen`,
    text,
    html,
  };
}
