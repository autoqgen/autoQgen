import type { EmailMessage } from "@/lib/email/types";

/**
 * Password reset email.
 *
 * Plain-text and HTML bodies are generated from the same content so the message
 * reads correctly in every client. The token appears only inside the link, never
 * in the subject or the visible body text.
 */

export interface PasswordResetTemplateInput {
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
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

export function passwordResetEmail(input: PasswordResetTemplateInput): EmailMessage {
  const name = input.recipientName.trim() || "there";
  const safeName = escapeHtml(name);
  // The URL is already percent-encoded by the service; escape it for HTML too.
  const safeUrl = escapeHtml(input.resetUrl);

  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your AutoQgen password.",
    "",
    "Open this link to choose a new one:",
    input.resetUrl,
    "",
    `This link expires in ${input.expiresInMinutes} minutes and can be used once.`,
    "",
    "If you did not request this, you can ignore this email — your password will not change.",
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
          <h1 style="margin:0 0 12px;font-size:20px;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Hi ${safeName}, we received a request to reset your AutoQgen password.</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">Choose a new password using the button below.</p>
          <p style="margin:0 0 24px;">
            <a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;">Choose a new password</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.6;">
            This link expires in <strong>${input.expiresInMinutes} minutes</strong> and can only be used once.
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
            If you did not request this, you can safely ignore this email — your password will not change.${
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
    subject: "Reset your AutoQgen password",
    text,
    html,
  };
}

/** Sent when a reset completes, so an unexpected change is noticed quickly. */
export function passwordChangedEmail(input: {
  recipientEmail: string;
  recipientName: string;
  supportEmail?: string;
}): EmailMessage {
  const name = input.recipientName.trim() || "there";

  const text = [
    `Hi ${name},`,
    "",
    "Your AutoQgen password was just changed, and you have been signed out on all devices.",
    "",
    "If this was not you, reset your password immediately and contact an administrator.",
    "",
    "— AutoQgen",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
      <tr><td style="padding:28px;">
        <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#5b21b6;">AutoQgen</p>
        <h1 style="margin:0 0 12px;font-size:20px;">Your password was changed</h1>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, your AutoQgen password was just changed and you have been signed out on all devices.</p>
        <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">If this was not you, reset your password immediately and contact an administrator.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { to: input.recipientEmail, subject: "Your AutoQgen password was changed", text, html };
}
