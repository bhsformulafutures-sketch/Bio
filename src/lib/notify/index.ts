import type { EmailProvider } from "./types";
import { consoleProvider } from "./providers/console";
import { createResendProvider } from "./providers/resend";

let provider: EmailProvider | null = null;

/**
 * Pick the email backend from the environment. Set RESEND_API_KEY and
 * RESEND_FROM_EMAIL to go live; otherwise everything runs on the console
 * provider so the app works with zero configuration.
 */
export function getEmailProvider(): EmailProvider {
  if (!provider) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    provider = apiKey && from ? createResendProvider(apiKey, from) : consoleProvider;
  }
  return provider;
}

/** Whether real email is configured (controls whether dev codes are shown). */
export function emailIsLive(): boolean {
  return getEmailProvider().live;
}

export type { EmailProvider } from "./types";
