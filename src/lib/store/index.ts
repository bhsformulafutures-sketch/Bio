import type { Store } from "./types";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";

let store: Store | null = null;

/**
 * Production uses Supabase (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Without them the app falls back to a file-backed store so it runs
 * locally with zero setup.
 */
export function getStore(): Store {
  if (!store) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    store = url && key ? new SupabaseStore(url, key) : new LocalStore();
  }
  return store;
}

export type { Store, ChallengeRecord, ParticipantRecord } from "./types";
