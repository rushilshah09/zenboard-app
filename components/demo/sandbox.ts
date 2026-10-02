// ── THE DEMO'S SANDBOX ──────────────────────────────────────────────────────
//
// The website's product demo is the REAL app (user, 2026-09-28, with Notion's home page open: "I want
// like Notion, a real dashboard application demo here, not a fake one"). Its views are the product's
// own components, rendered at /demo inside an iframe on the home page, on sample data. Those components
// were written to talk to a server, and a visitor is not signed in to anything — or worse, IS signed in,
// in another tab, on this same origin. So before a single view is imported, this module walls the
// document off from everything outside it:
//
//   · SERVER ACTIONS are answered here and never sent. A view calls `toggleTask(…)` exactly as it does
//     in the app; the POST it makes is caught, and the answer is one that every action in lib/actions
//     treats as success: `{ ok: true }` (79 of them return that) with an `id` (the 19 that create
//     something return that). Nothing is ever let through, so no edit made in the demo can reach a
//     database, the visitor's own account included.
//   · EVERY OTHER REQUEST is refused, except the page's own static files: no Supabase, no prefetch of an
//     app route, no analytics. A request the sandbox does not recognise gets an empty 204, which every
//     caller already treats as "nothing there".
//   · STORAGE IS THE DEMO'S OWN. localStorage and sessionStorage are replaced by memory, seeded with the
//     website's one appearance (lib/theme.ts `SITE_APPEARANCE`), and IndexedDB is hidden. This matters more
//     than it looks: the durable mutation queue (lib/mutation-store.ts) writes intents to localStorage
//     for the app's worker to deliver later, so a demo sharing the real storage would leave edits for
//     a signed-in visitor's real app to replay. BroadcastChannel is silenced for the same reason (it
//     reaches the app's other tabs), and cookie writes go nowhere.
//
// It runs once, when CALLED — never as a bare `import './sandbox'`. package.json declares only CSS as having
// side effects, so a bundler is entitled to drop an import whose bindings go unused, and it did: the
// first version installed itself on import, the import was tree-shaken away, and a ticked task reached
// the server (it was refused there, without a session). So the entry calls `installSandbox()` by name,
// the app calls it again before it renders, and the app renders nothing if `isSandboxed()` is false.

import { ACCENT_KEY, DENSITY_KEY, SITE_APPEARANCE, SKIN_KEY, THEME_KEY } from '@/lib/theme';

type Answer = { ok: true; id: string };

let issued = 0;
/** The answer for any action nothing more specific claims (see above). */
export function answerAction(): Answer {
  issued += 1;
  return { ok: true, id: `demo-${issued}` };
}

/**
 * A view whose actions READ something (a meeting's suggested actions, a channel's messages) needs an
 * answer of that shape, not `{ ok: true }`. It registers an answerer while it is mounted: given the
 * action's arguments, it returns the answer, or `undefined` to leave the call to the next answerer and,
 * finally, to the default. Arguments are only readable when Next sent them as JSON; a call it sent as
 * form data (a file, say) goes straight to the default.
 */
export type Answerer = (args: unknown[]) => unknown;
const answerers = new Set<Answerer>();
export function registerAnswerer(answer: Answerer): () => void {
  answerers.add(answer);
  return () => { answerers.delete(answer); };
}
async function answerFor(body: BodyInit | null | undefined): Promise<unknown> {
  if (typeof body === 'string') {
    let args: unknown = null;
    try { args = JSON.parse(body); } catch { /* not JSON: the default answers */ }
    if (Array.isArray(args)) {
      for (const answer of answerers) {
        const value = await answer(args);
        if (value !== undefined) return value;
      }
    }
  }
  return answerAction();
}

/** A React Flight frame, the wire format Next's action client reads. No flight data (`f`), no
 *  revalidation header and no build id: the client resolves the call with the value and changes
 *  nothing else (next/dist/client/components/router-reducer/reducers/server-action-reducer.js). */
export const actionFrame = (value: unknown) => `0:{"a":"$@1","f":"","q":"","i":false}\n1:${JSON.stringify(value)}\n`;

/** The appearance the demo's storage starts with: the website's one appearance, stored the way the app
 *  stores a choice, so anything in a view that reads the stored choice agrees with what is shown. */
const APPEARANCE: Record<string, string> = {
  [THEME_KEY]: SITE_APPEARANCE.theme,
  [DENSITY_KEY]: SITE_APPEARANCE.density,
  [ACCENT_KEY]: SITE_APPEARANCE.accent,
  [SKIN_KEY]: SITE_APPEARANCE.skin,
};

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
  };
}

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, get: () => value });
}

/** Is this a request for one of the page's own files, which is all the demo may load? */
function isOwnFile(url: URL, method: string) {
  if (url.origin !== window.location.origin || method !== 'GET') return false;
  return url.pathname.startsWith('/_next/static/') || /\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg|mp4)$/.test(url.pathname);
}

/** A socket that never connects, for everything but the dev server's own reload channel. */
class ClosedSocket extends EventTarget {
  readyState = 3;
  send() {}
  close() {}
}

type Sealed = Window & { __zbDemoSandbox?: boolean };

/** Has this document been walled off? The demo refuses to render the product's views until it has. */
export function isSandboxed() {
  return typeof window !== 'undefined' && (window as Sealed).__zbDemoSandbox === true;
}

export function installSandbox() {
  if (typeof window === 'undefined' || isSandboxed()) return;

  // ── Storage ──────────────────────────────────────────────────────────────
  define(window, 'localStorage', memoryStorage(APPEARANCE));
  define(window, 'sessionStorage', memoryStorage());
  define(window, 'indexedDB', undefined);
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookie?.get) {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => cookie.get!.call(document), set: () => {} });
  }
  window.BroadcastChannel = class {
    name: string;
    onmessage: ((this: BroadcastChannel, ev: MessageEvent) => unknown) | null = null;
    onmessageerror: ((this: BroadcastChannel, ev: MessageEvent) => unknown) | null = null;
    constructor(name: string) { this.name = name; }
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return false; }
  } as unknown as typeof BroadcastChannel;

  // ── Network ──────────────────────────────────────────────────────────────
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), window.location.href);
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    if (method === 'POST' && headers.has('next-action')) {
      return new Response(actionFrame(await answerFor(init?.body)), { headers: { 'content-type': 'text/x-component' } });
    }
    if (isOwnFile(url, method)) return realFetch(input, init);
    return new Response(null, { status: 204 });
  };
  const RealSocket = window.WebSocket;
  window.WebSocket = function DemoSocket(url: string | URL, protocols?: string | string[]) {
    const target = new URL(String(url), window.location.href);
    // `next dev` reloads the page over its own socket; nothing else may open one.
    if (target.host === window.location.host && target.pathname.startsWith('/_next/')) return new RealSocket(url, protocols);
    return new ClosedSocket();
  } as unknown as typeof WebSocket;
  window.EventSource = ClosedSocket as unknown as typeof EventSource;
  window.XMLHttpRequest = class {
    readyState = 0;
    status = 0;
    open() {}
    send() {}
    abort() {}
    setRequestHeader() {}
    addEventListener() {}
    removeEventListener() {}
  } as unknown as typeof XMLHttpRequest;
  if (navigator.sendBeacon) navigator.sendBeacon = () => true;

  // Last, so the mark is only ever set on a document that is sealed.
  (window as Sealed).__zbDemoSandbox = true;
}
