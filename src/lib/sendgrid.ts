import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

export async function sendResetEmail(to: string, resetUrl: string) {
  if (!apiKey) throw new Error("SENDGRID_API_KEY is not configured");
  const from = process.env.PASSWORD_RESET_FROM || "no-reply@autoqgen.local";
  const msg = {
    to,
    from,
    subject: "Reset your AutoQgen password",
    text: `You requested a password reset. Use the link to reset your password: ${resetUrl}`,
    html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
  };

  await sgMail.send(msg);
}
