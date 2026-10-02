// ── PIECES WAITING TO BE TRANSCRIBED ────────────────────────────────────────
//
// Every piece of a recording is written here BEFORE it is sent, and removed only once its words are
// in the transcript. So a piece survives the things that happen during real meetings: the tab is
// closed, the laptop sleeps, the Wi-Fi drops, the day's allowance runs out. The next time Zenboard
// opens, the recorder host (components/meetings/recorder-host.tsx) finds what is left and finishes.
//
// This is the only place audio is kept, and only until it is transcribed: IndexedDB on the person's
// own device, never a server. Where IndexedDB is not available (some private windows), pieces are
// kept in memory for the life of the page instead — the recording still works; it just cannot
// outlive a reload, and the host warns before one.

export type QueuedChunk = {
  id: string;
  meetingId: string;
  /** The page load that recorded it. A piece whose page is gone is picked up by the next one. */
  owner: string;
  /** When it was recorded (epoch ms), so the oldest meeting finishes first. */
  created: number;
  /** Tries that ended in a transcriber error; a piece is given up on after a few. */
  attempts: number;
  blob: Blob;
  mime: string;
  start: number;
  end: number;
  me: number[];
  them: number[] | null;
  levels: { me: number; them: number };
};

const DB_NAME = 'zb-meetings';
const STORE = 'chunks';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, QueuedChunk>();

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve) => {
    if (!db) return resolve(undefined);
    try {
      const req = work(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  }));
}

/** Whether pieces survive a reload here. */
export async function persistent(): Promise<boolean> {
  return (await open()) !== null;
}

export async function enqueue(chunk: QueuedChunk): Promise<void> {
  memory.set(chunk.id, chunk);
  await run('readwrite', (s) => s.put(chunk));
}

/** Everything waiting, oldest recording first and in order within a meeting. */
export async function waiting(): Promise<QueuedChunk[]> {
  const stored = (await run<QueuedChunk[]>('readonly', (s) => s.getAll())) ?? [];
  const byId = new Map<string, QueuedChunk>(stored.map((c) => [c.id, c]));
  for (const c of memory.values()) if (!byId.has(c.id)) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => a.created - b.created || a.start - b.start);
}

export async function dequeue(id: string): Promise<void> {
  memory.delete(id);
  await run('readwrite', (s) => s.delete(id));
}

export async function markAttempt(chunk: QueuedChunk): Promise<QueuedChunk> {
  const next = { ...chunk, attempts: chunk.attempts + 1 };
  await enqueue(next);
  return next;
}
