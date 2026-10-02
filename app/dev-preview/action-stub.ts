// ── ANSWERING SERVER ACTIONS IN A HARNESS ───────────────────────────────────
//
// A harness renders outside the session, so every server action it triggers throws — which is
// right for showing failure paths and useless for showing success ones. This answers the actions a
// harness chooses to, in the wire format Next's action client reads, and lets everything else
// through to fail as before.
//
// How an action looks on the wire: a POST carrying a `next-action` header and the arguments as a
// JSON array. The answer is a React Flight payload; the frame below was captured from a real
// action on /dev-preview/action-failure. Two traps, both from the dev-preview harness memory:
//   · Next runs server actions ONE AT A TIME. A stub that never answers blocks every later action,
//     which looks like the app not sending — so `answer` must always settle.
//   · A harness is dev-only (`page.dev.tsx`); this module is imported only by harnesses, so no
//     production page ever bundles it.

/** Return a value to answer the action, `undefined` to let it through, or throw to fail it. */
export type ActionAnswer = (args: unknown[]) => unknown | Promise<unknown>;

const frame = (value: unknown) =>
  `0:{"a":"$@1","f":"","q":"","i":true,"b":"development"}\n1:${JSON.stringify(value)}\n`;

/** Install the stub; the return value removes it. Call from an effect. */
export function stubServerActions(answer: ActionAnswer): () => void {
  const real = window.fetch;
  window.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (init?.method === 'POST' && headers.has('next-action') && typeof init.body === 'string') {
      let args: unknown;
      try { args = JSON.parse(init.body); } catch { args = null; }
      if (Array.isArray(args)) {
        const value = await answer(args);
        if (value !== undefined) {
          return new Response(frame(value), { headers: { 'content-type': 'text/x-component' } });
        }
      }
    }
    return real(input, init);
  };
  return () => { window.fetch = real; };
}
