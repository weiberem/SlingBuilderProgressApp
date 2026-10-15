import nodemailer from "nodemailer";
import { env } from "./env";
import { logger } from "./logger";

export type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * System-Mails (Verifizierung, Passwort-Reset). Ohne SMTP-Konfiguration werden Mails nur geloggt.
 * Ticket-Mails an Sling laufen NICHT hier, sondern über den MailProvider des Nutzers (M2).
 */
export async function sendSystemMail(mail: Mail): Promise<void> {
  const e = env();
  if (!e.SMTP_HOST) {
    logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, "System-Mail (nicht gesendet, SMTP fehlt)");
    return;
  }
  const transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: e.SMTP_FROM, ...mail });
}
