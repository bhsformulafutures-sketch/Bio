import type { EmailProvider } from "../types";

/**
 * Resend-backed email. Activated only when RESEND_API_KEY and
 * RESEND_FROM_EMAIL are both set. Uses the REST API over fetch so there's
 * no SDK dependency to carry.
 */
export function createResendProvider(apiKey: string, fromEmail: string): EmailProvider {
  const endpoint = "https://api.resend.com/emails";

  return {
    name: "resend",
    live: true,
    async send(to: string, subject: string, body: string): Promise<void> {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          text: body,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Resend send failed (${response.status}): ${detail}`);
      }
    },
  };
}
