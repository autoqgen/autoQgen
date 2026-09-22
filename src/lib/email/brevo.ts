import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import type { EmailMessage, EmailSendResult, EmailTransport } from "@/lib/email/types";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface BrevoResponse {
  messageId?: string;
}

export class BrevoEmailTransport implements EmailTransport {
  readonly name = "brevo";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": env.BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender: {
            email: env.BREVO_SENDER_EMAIL!,
            name: env.BREVO_SENDER_NAME!,
          },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
      });

      if (!response.ok) {
        logger.error("Brevo email delivery failed", {
          status: response.status,
          subject: message.subject,
        });
        return { delivered: false, skippedReason: "provider error" };
      }

      const payload = (await response.json().catch(() => null)) as BrevoResponse | null;
      logger.info("Email sent", { subject: message.subject, transport: this.name });
      return { delivered: true, messageId: payload?.messageId };
    } catch (error) {
      logger.error("Brevo email delivery failed", { subject: message.subject, error });
      return { delivered: false, skippedReason: "transport error" };
    }
  }
}

export const brevoEmailConfigured = (): boolean =>
  Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_NAME);
