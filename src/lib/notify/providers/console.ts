import type { EmailProvider } from "../types";

/**
 * The zero-config provider. Nothing is actually sent — messages are logged
 * so the email-verification and notification flows work end to end with no
 * accounts or API keys. Because `live` is false, the app also surfaces
 * verification codes on-screen in this mode.
 */
export const consoleProvider: EmailProvider = {
  name: "console",
  live: false,
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`\n📧 [email → ${to}] ${subject}\n${body}\n`);
  },
};
