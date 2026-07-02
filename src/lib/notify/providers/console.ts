import type { SmsProvider } from "../types";

/**
 * The zero-config provider. Nothing is actually sent — messages are logged
 * so the phone-verification and notification flows work end to end with no
 * accounts or API keys. Because `live` is false, the app also surfaces
 * verification codes on-screen in this mode.
 */
export const consoleProvider: SmsProvider = {
  name: "console",
  live: false,
  async send(to: string, body: string): Promise<void> {
    console.log(`\n📲 [sms → ${to}]\n${body}\n`);
  },
};
