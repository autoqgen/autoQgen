import type { EmailMessage } from "@/lib/email/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function accountCreatedEmail(input: {
  recipientEmail: string;
  recipientName: string;
  loginUrl: string;
}): EmailMessage {
  const name = input.recipientName.trim() || "there";
  const safeName = escapeHtml(name);
  const safeLoginUrl = escapeHtml(input.loginUrl);

  return {
    to: input.recipientEmail,
    subject: "Your AutoQgen account is ready",
    text: [
      `Hi ${name},`,
      "",
      "Your AutoQgen account has been created successfully.",
      "",
      `Sign in here: ${input.loginUrl}`,
      "",
      "— AutoQgen",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
      <tr><td style="padding:28px;">
        <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#5b21b6;">AutoQgen</p>
        <h1 style="margin:0 0 12px;font-size:20px;">Your account is ready</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">Hi ${safeName}, your AutoQgen account has been created successfully.</p>
        <p style="margin:0;"><a href="${safeLoginUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;">Sign in to AutoQgen</a></p>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}