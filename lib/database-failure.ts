// What a database says when it cannot be shown, or cannot be made.
//
// Two rules, both learnt from the screen. A server's own words are never the
// message: a database that failed to save printed Postgres's `duplicate key value
// violates unique constraint "collections_pkey"` as the whole block — and the
// document saved it. And the one failure a person can fix themselves, the tables
// not being there yet, says how; every other failure offers to try again, because
// what usually causes one (no connection, a new deployment) passes.
import { FAILURE_COPY } from '@/lib/action-failure';

export type DbFailure = {
  /** One sentence in sentence case, without its period — the line adds it. */
  title: string;
  /** Only ever words written for people; absent when all there is is a server's. */
  detail?: string;
  /** Whether "Try again" can help. */
  retry: boolean;
};

// Supabase words the un-migrated case two ways — "Could not find the table
// 'public.collections' in the schema cache" (REST) and "relation … does not
// exist" (SQL). Both mean 0013 is not applied, and no retry changes that.
const UNMIGRATED = /relation .* does not exist|schema cache|could not find the table/i;

// The action-failure net's lines are the only reasons in hand written for people.
const HUMAN = new Set<string>(Object.values(FAILURE_COPY));

const TITLE = {
  create: 'This database couldn’t be created',
  load: 'This database couldn’t be loaded',
  list: 'Your databases couldn’t be loaded',
} as const;

/** `create` — making one failed · `load` — one exists but would not load · `list` — the linked-view picker. */
export function describeDbFailure(message: string, when: keyof typeof TITLE): DbFailure {
  if (UNMIGRATED.test(message)) {
    return {
      title: 'Databases aren’t set up yet',
      detail: 'Paste migration 0013_databases.sql into the Supabase SQL editor to turn them on.',
      retry: false,
    };
  }
  const title = TITLE[when];
  return HUMAN.has(message) ? { title, detail: message, retry: true } : { title, retry: true };
}
