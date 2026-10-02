// POST /api/mcp — Zenboard as an MCP server.
//
// UNAUTHENTICATED at the framework level by necessity: an MCP client sends no
// cookies, so the bearer token IS the credential. That is the same shape as the
// calendar feed and the client portal, and the same discipline follows from it,
// with one difference that matters: the service role has no RLS to lean on, and
// this endpoint WRITES. So every query the tools make (lib/mcp-tools.ts) is
// scoped to the token's owner EXPLICITLY — `.eq('user_id', userId)` on every
// read and every insert, asserted in lib/mcp-tools.test.ts. That exact
// assumption, left implicit, is what once mis-numbered invoices.
import { createServiceClient } from '@/lib/supabase/server';
import {
  MCP_TOKEN_KEY, bearerFrom, negotiateVersion, parseRequest, readToolCall,
  toolText, ok, fail, RPC, TOOLS, SERVER_INFO,
} from '@/lib/mcp';
import { runTool } from '@/lib/mcp-tools';
import { readTimeZone } from '@/lib/date';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JSON_HEADERS = { 'content-type': 'application/json' } as const;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

/**
 * Who owns this token — and the one other thing the tools need from their
 * profile: the zone their "today" is in. Null for any token we do not know.
 */
async function ownerOf(token: string): Promise<{ id: string; preferences: unknown } | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('id, preferences')
    .contains('preferences', { [MCP_TOKEN_KEY]: token })
    .maybeSingle();
  return (data as { id: string; preferences: unknown } | null) ?? null;
}

// The tools themselves live in lib/mcp-tools.ts, where they take the client as
// an argument and can be tested; this file is the transport and the gate.

// ── Transport ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const token = bearerFrom(req.headers.get('authorization'));
  // 401 with a WWW-Authenticate header, not the feed's 404: an MCP client is a
  // program being configured by its owner, and "your token is wrong" is the
  // message that gets them unstuck. The feed 404s because a stranger poking at
  // a URL should not learn the shape is right; here the caller already holds a
  // token and is trying to use it.
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing or malformed bearer token.' }), {
      status: 401, headers: { ...JSON_HEADERS, 'www-authenticate': 'Bearer realm="zenboard"' },
    });
  }
  const owner = await ownerOf(token);
  if (!owner) {
    return new Response(JSON.stringify({ error: 'Unknown token. Generate a new one in Zenboard → Settings → Connections.' }), {
      status: 401, headers: { ...JSON_HEADERS, 'www-authenticate': 'Bearer realm="zenboard"' },
    });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return json(fail(null, RPC.PARSE_ERROR, 'Invalid JSON.'), 400); }

  const parsed = parseRequest(body);
  if ('error' in parsed) return json(fail(null, RPC.INVALID_REQUEST, parsed.error), 400);
  const { req: rpc, isNotification } = parsed;

  // A notification expects NO response body. Answering one with a result is a
  // protocol error, and some clients treat it as fatal — `notifications/
  // initialized` arrives immediately after the handshake, so getting this wrong
  // breaks the connection at the first step rather than at the first tool.
  if (isNotification) return new Response(null, { status: 202 });

  try {
    switch (rpc.method) {
      case 'initialize':
        return json(ok(rpc.id!, {
          protocolVersion: negotiateVersion(rpc.params?.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        }));

      case 'ping':
        return json(ok(rpc.id!, {}));

      case 'tools/list':
        return json(ok(rpc.id!, { tools: TOOLS }));

      case 'tools/call': {
        const call = readToolCall(rpc.params);
        // A bad tool call is a TOOL error, not a protocol error: the model that
        // made it can read the message and try again, whereas a JSON-RPC error
        // usually surfaces as a broken connection.
        if ('error' in call) return json(ok(rpc.id!, toolText(call.error, true)));
        const text = await runTool({
          db: createServiceClient(),
          userId: owner.id,
          tz: readTimeZone(owner.preferences),
          preferences: owner.preferences,
          // Links point back at whichever host the client reached.
          origin: new URL(req.url).origin,
        }, call.name, call.args);
        return json(ok(rpc.id!, toolText(text)));
      }

      default:
        return json(fail(rpc.id!, RPC.METHOD_NOT_FOUND, `Unsupported method: ${rpc.method}`));
    }
  } catch (e) {
    return json(fail(rpc.id ?? null, RPC.INTERNAL, e instanceof Error ? e.message : 'Something went wrong.'));
  }
}

/** A GET here means someone opened the URL in a browser. Say what it is. */
export function GET() {
  return json({
    name: SERVER_INFO.name,
    description: 'Zenboard MCP server. POST JSON-RPC with an Authorization: Bearer token.',
    tools: TOOLS.map((t) => t.name),
  });
}
