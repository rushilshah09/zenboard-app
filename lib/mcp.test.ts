import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  looksLikeMcpToken, newMcpToken, bearerFrom, negotiateVersion, parseRequest,
  readToolCall, captureKind, searchLimit, toolText, TOOLS, PROTOCOL_VERSIONS,
} from './mcp';

// ── WHY THESE ARE THE TESTS ────────────────────────────────────────────────
// The MCP wire protocol is hand-written here rather than pulled from the SDK,
// because the worker has a 3 MiB ceiling. That trade is only safe if the four
// method shapes are actually held to — a protocol bug does not fail loudly, it
// makes a client silently refuse to connect, and the failure is on someone
// else's machine.

describe('the token', () => {
  it('announces what it is, so a leak can be found and revoked', () => {
    const t = newMcpToken();
    expect(t.startsWith('zb_'), 'every provider prefixes theirs for exactly this reason').toBe(true);
    expect(looksLikeMcpToken(t)).toBe(true);
  });

  it('is long enough that guessing is hopeless, and unique', () => {
    const a = newMcpToken(), b = newMcpToken();
    expect(a).not.toBe(b);
    // 32 bytes base64url ≈ 43 chars, plus the prefix.
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it('rejects anything that is not ours before a query is made', () => {
    for (const bad of [null, undefined, '', 'zb_', 'zb_short', 'not-a-token',
                       'Bearer zb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                       'zb_' + 'a'.repeat(200), 'zb_has spaces in it aaaaaaaaaaaaaaaaaaaaaaaaa']) {
      expect(looksLikeMcpToken(bad as string), `${String(bad).slice(0, 24)} should not pass`).toBe(false);
    }
  });
});

describe('reading the Authorization header', () => {
  const t = newMcpToken();
  it('takes Bearer, bare, and odd spacing', () => {
    expect(bearerFrom(`Bearer ${t}`)).toBe(t);
    expect(bearerFrom(`bearer ${t}`), 'the scheme is case-insensitive per RFC 7235').toBe(t);
    expect(bearerFrom(`  Bearer   ${t}  `)).toBe(t);
    expect(bearerFrom(t), 'a bare token is a common misconfiguration worth accepting').toBe(t);
  });
  it('returns null rather than a malformed token', () => {
    for (const bad of [null, '', 'Bearer', 'Basic abc123', 'Bearer not-a-token']) {
      expect(bearerFrom(bad)).toBeNull();
    }
  });
});

describe('the JSON-RPC envelope', () => {
  it('treats a MISSING id as a notification, which gets no response', () => {
    // This is the one that breaks a connection at the handshake rather than at
    // the first tool: `notifications/initialized` arrives immediately after
    // `initialize`, and answering it with a result is a protocol error some
    // clients treat as fatal. So the id's ABSENCE has to survive parsing.
    const n = parseRequest({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect('req' in n && n.isNotification).toBe(true);
    const explicitNull = parseRequest({ jsonrpc: '2.0', id: null, method: 'ping' });
    expect('req' in explicitNull && explicitNull.isNotification, 'a null id is not an id').toBe(true);
    const call = parseRequest({ jsonrpc: '2.0', id: 1, method: 'ping' });
    expect('req' in call && call.isNotification).toBe(false);
    // id 0 is a legal JSON-RPC id and must not be swallowed by a falsy check.
    const zero = parseRequest({ jsonrpc: '2.0', id: 0, method: 'ping' });
    expect('req' in zero && zero.isNotification, 'id 0 is an id').toBe(false);
  });

  it('refuses anything that is not JSON-RPC 2.0', () => {
    for (const bad of [null, 'a string', [], {}, { jsonrpc: '1.0', method: 'ping' },
                       { jsonrpc: '2.0' }, { jsonrpc: '2.0', method: '' }, { jsonrpc: '2.0', method: 7 }]) {
      expect('error' in parseRequest(bad), `${JSON.stringify(bad)} should be refused`).toBe(true);
    }
  });

  it('ignores params that are not an object', () => {
    const r = parseRequest({ jsonrpc: '2.0', id: 1, method: 'x', params: 'nope' });
    expect('req' in r && r.req.params).toBeUndefined();
  });
});

describe('version negotiation', () => {
  it('answers in the version the client asked for, when we speak it', () => {
    for (const v of PROTOCOL_VERSIONS) expect(negotiateVersion(v)).toBe(v);
  });
  it('falls back to our newest rather than echoing something we cannot speak', () => {
    // Echoing an unknown version claims support we do not have, and the client
    // then sends a shape we will not understand.
    for (const bad of ['1999-01-01', '', null, undefined, 42]) {
      expect(negotiateVersion(bad)).toBe(PROTOCOL_VERSIONS[0]);
    }
  });
});

describe('the tools', () => {
  it('every tool has a schema a model can act on', () => {
    expect(TOOLS.length).toBeGreaterThan(0);
    for (const t of TOOLS) {
      expect(t.name, 'a tool name must be a safe identifier').toMatch(/^[a-z][a-z0-9_]*$/);
      expect(t.inputSchema.type).toBe('object');
      // The description is the ONLY instruction the calling model gets. A short
      // one is a tool that gets used wrongly or not at all.
      expect(t.description.length, `${t.name} needs a description that says WHEN to use it`).toBeGreaterThan(60);
      for (const r of t.inputSchema.required ?? []) {
        expect(Object.keys(t.inputSchema.properties), `${t.name} requires "${r}" but does not define it`).toContain(r);
      }
    }
  });

  it('refuses a call to a tool that does not exist', () => {
    expect('error' in readToolCall({ name: 'drop_everything' })).toBe(true);
    expect('error' in readToolCall({ name: 42 })).toBe(true);
    expect('error' in readToolCall(undefined)).toBe(true);
  });

  it('refuses a call missing a required argument, including blank text', () => {
    expect('error' in readToolCall({ name: 'capture', arguments: {} })).toBe(true);
    expect('error' in readToolCall({ name: 'capture', arguments: { text: '   ' } }),
      'whitespace is not a thought').toBe(true);
    expect('error' in readToolCall({ name: 'capture', arguments: { text: 'film the tour' } })).toBe(false);
  });

  it('allows a tool that takes nothing to be called with nothing', () => {
    const r = readToolCall({ name: 'today' });
    expect('name' in r && r.args).toEqual({});
  });
});

describe('argument normalising', () => {
  it('defaults an unknown kind to a task, because a task is the one you see again', () => {
    expect(captureKind('idea')).toBe('idea');
    expect(captureKind('task')).toBe('task');
    for (const v of [undefined, null, '', 'note', 'TASK', 7, {}]) expect(captureKind(v)).toBe('task');
  });

  it('bounds a search however the caller asks', () => {
    expect(searchLimit(undefined)).toBe(20);
    expect(searchLimit(5)).toBe(5);
    expect(searchLimit(1000), 'a model asking for everything must not get it').toBe(50);
    expect(searchLimit(0)).toBe(1);
    expect(searchLimit(-4)).toBe(1);
    expect(searchLimit(3.7)).toBe(3);
    expect(searchLimit('lots')).toBe(20);
    expect(searchLimit(NaN)).toBe(20);
    expect(searchLimit(Infinity)).toBe(20);
  });
});

describe('tool results', () => {
  it('wraps text in the content shape MCP expects', () => {
    expect(toolText('done')).toEqual({ content: [{ type: 'text', text: 'done' }] });
  });
  it('marks an error without breaking the envelope', () => {
    // A tool error is data the model can read and retry from; a JSON-RPC error
    // usually surfaces to the user as a broken connection.
    const e = toolText('no such project', true);
    expect(e.isError).toBe(true);
    expect(e.content[0].text).toBe('no such project');
  });
});

// ── The route's dispatch table ──────────────────────────────────────────────
//
// A protocol bug here does not fail loudly. The client refuses to connect, on
// someone else's machine, with no message either of us sees — so the handshake
// sequence is asserted against the ROUTE rather than trusted.
describe('the route answers every method a real handshake sends', () => {
  const route = readFileSync('app/api/mcp/route.ts', 'utf8');

  it('handles initialize, tools/list, tools/call and ping', () => {
    for (const m of ['initialize', 'ping', 'tools/list', 'tools/call']) {
      expect(route, `no case for ${m}`).toContain(`case '${m}'`);
    }
  });

  it('answers a notification with no body at all', () => {
    // `notifications/initialized` arrives immediately after initialize. A
    // result in reply is a protocol error, and some clients treat it as fatal —
    // so this breaks the connection at step two, before any tool is ever tried.
    expect(route).toMatch(/isNotification\)\s*return new Response\(null,\s*\{\s*status:\s*202/);
  });

  it('makes exactly one query itself — the token lookup — and hands every tool to lib/mcp-tools', () => {
    // The route is the transport and the gate. A query written here would sit
    // outside the tools' behavioural test (lib/mcp-tools.test.ts), which runs
    // every tool against a recording fake and checks every query it makes.
    const code = route.replace(/\/\/.*$/gm, '');
    expect([...code.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1])).toEqual(['profiles']);
    expect(code).toMatch(/runTool\(\{[\s\S]*userId: owner\.id/);
  });

  it('scopes EVERY query the tools make to the token owner, because the service role has no RLS', () => {
    // The static half of the rule, over the files the queries now live in; the
    // behavioural half is in lib/mcp-tools.test.ts. Both, because each sees
    // what the other cannot: this one reads paths no test happens to run, and
    // that one sees a query assembled in a way no regex would.
    //
    // Each query is cut at the NEXT `.from(` — the first version of this scan
    // ran on a 400-character window, so one query's text could carry the
    // owner filter of the query after it, and a query past the window was not
    // counted at all.
    const EXEMPT: Record<string, RegExp> = {
      // Owned through its project: the owner is the embed's `projects.user_id`.
      client_requests: /\.eq\('projects\.user_id', userId\)/,
      // No owner column; reached only through the user's own task ids.
      task_links: /\.in\('task_id', todays\.map/,
    };
    let seen = 0;
    for (const file of ['lib/mcp-tools.ts', 'lib/digest-data.ts']) {
      const code = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');
      const starts = [...code.matchAll(/\.from\('(\w+)'\)/g)];
      starts.forEach((m, i) => {
        seen += 1;
        const tail = code.slice(m.index, starts[i + 1]?.index ?? code.length);
        const scoped = EXEMPT[m[1]]?.test(tail)
          ?? (/\.eq\('user_id', (?:ctx\.)?userId\)/.test(tail) || /user_id: (?:ctx\.)?userId/.test(tail)
            || /inboxCapture\(\{ userId: ctx\.userId/.test(tail) || /intakeTask\(\{ userId: ctx\.userId/.test(tail));
        expect(scoped, `${file}: .from('${m[1]}') has no owner`).toBe(true);
      });
    }
    expect(seen, 'no queries found — the scan is broken, not the code').toBeGreaterThan(10);
  });

  it('never returns a tool failure as a JSON-RPC error', () => {
    // A JSON-RPC error usually surfaces as a broken connection; a tool error is
    // text the model can read and retry from. Bad arguments are the model's
    // mistake, not the transport's.
    expect(route).toMatch(/if \('error' in call\) return json\(ok\(rpc\.id!, toolText\(call\.error, true\)\)\)/);
  });
});
