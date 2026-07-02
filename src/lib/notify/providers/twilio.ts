import type { SmsProvider } from "../types";

/**
 * Twilio-backed SMS. Activated only when TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are all set. Uses the REST API
 * over fetch so there's no SDK dependency to carry.
 */
export function createTwilioProvider(
  accountSid: string,
  authToken: string,
  fromNumber: string
): SmsProvider {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  return {
    name: "twilio",
    live: true,
    async send(to: string, body: string): Promise<void> {
      const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio send failed (${response.status}): ${detail}`);
      }
    },
  };
}
