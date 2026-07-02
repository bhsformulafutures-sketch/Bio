/**
 * SMS delivery is behind a small provider interface so the notification
 * backend can be swapped (Twilio today, something else tomorrow) without
 * touching any calling code.
 */
export interface SmsProvider {
  /** Human-readable id, handy in logs. */
  readonly name: string;
  /** Whether messages actually leave the building. When false (dev), the
   *  app is free to surface verification codes on-screen instead. */
  readonly live: boolean;
  send(to: string, body: string): Promise<void>;
}
