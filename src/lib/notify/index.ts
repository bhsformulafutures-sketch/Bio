import type { SmsProvider } from "./types";
import { consoleProvider } from "./providers/console";
import { createTwilioProvider } from "./providers/twilio";

let provider: SmsProvider | null = null;

/**
 * Pick the SMS backend from the environment. Set the three TWILIO_* vars to
 * go live; otherwise everything runs on the console provider so the app
 * works with zero configuration.
 */
export function getSmsProvider(): SmsProvider {
  if (!provider) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    provider = sid && token && from ? createTwilioProvider(sid, token, from) : consoleProvider;
  }
  return provider;
}

/** Whether real SMS is configured (controls whether dev codes are shown). */
export function smsIsLive(): boolean {
  return getSmsProvider().live;
}

export type { SmsProvider } from "./types";
