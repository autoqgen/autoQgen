/**
 * Email transport contract.
 *
 * Step 1 issued reset tokens but had no delivery mechanism. Delivery is
 * introduced behind an interface so the SMTP implementation can be swapped for
 * a provider API (SES, Postmark, Resend) without touching any service.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  delivered: boolean;
  /** Provider message id when available. Never contains recipient content. */
  messageId?: string;
  /** Set when the transport intentionally did not send (e.g. console mode). */
  skippedReason?: string;
}

export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
