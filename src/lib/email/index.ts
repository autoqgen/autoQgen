import nodemailer, { type Transporter } from "nodemailer";

import { env, isProd } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { BrevoEmailTransport, brevoEmailConfigured } from "@/lib/email/brevo";
import type { EmailMessage, EmailSendResult, EmailTransport } from "@/lib/email/types";

export type { EmailMessage, EmailSendResult, EmailTransport };

/**
 * Email delivery.
 *
 * Three transports, selected by configuration:
 *
 *  - **brevo** — used whenever all Brevo settings are configured.
 *  - **smtp** — used whenever SMTP_HOST is configured and Brevo is not.
 *    created lazily, so a build or a request that never sends mail pays nothing.
 *  - **console** — the development default. Logs subject and recipient only;
 *    the reset URL is emitted separately by the password-reset service and only
 *    when AUTH_DEBUG_RESET_URL is on, which is forced off in production.
 *
 * Production refuses to fall back to the console transport silently: if SMTP is
 * unconfigured, `send` returns `delivered: false` and logs an error, and the
 * calling service still returns its generic response so the failure is not
 * observable to an anonymous caller.
 */

class ConsoleEmailTransport implements EmailTransport {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    // Subject and recipient only. Bodies contain reset links and are never logged.
    logger.info("Email (console transport)", {
      to: message.to,
      subject: message.subject,
      transport: this.name,
    });

    return { delivered: false, skippedReason: "console transport — no mail was sent" };
  }
}

class SmtpEmailTransport implements EmailTransport {
  readonly name = "smtp";
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = await this.getTransporter().sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      logger.info("Email sent", { subject: message.subject, transport: this.name });
      return { delivered: true, messageId: info.messageId };
    } catch (error: unknown) {
      // Never rethrow: delivery failure must not turn into an enumeration
      // oracle or a 500 on the forgot-password endpoint.
      logger.error("Email delivery failed", { subject: message.subject, error });
      return { delivered: false, skippedReason: "transport error" };
    }
  }
}

const globalForEmail = globalThis as unknown as { __autoqgenEmail?: EmailTransport };

function buildTransport(): EmailTransport {
  if (brevoEmailConfigured()) return new BrevoEmailTransport();
  if (env.SMTP_HOST) return new SmtpEmailTransport();

  if (isProd) {
    logger.error(
      "SMTP is not configured. Password reset emails will NOT be delivered in production.",
    );
  }

  return new ConsoleEmailTransport();
}

export function getEmailTransport(): EmailTransport {
  return (globalForEmail.__autoqgenEmail ??= buildTransport());
}

/** Test seam: lets suites inject a recording transport. */
export function setEmailTransport(transport: EmailTransport): void {
  globalForEmail.__autoqgenEmail = transport;
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  return getEmailTransport().send(message);
}

export const emailDeliveryConfigured = (): boolean =>
  brevoEmailConfigured() || Boolean(env.SMTP_HOST);
