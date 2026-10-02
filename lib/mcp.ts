// ── MCP — Zenboard as a tool your AI can reach ──────────────────────────────
//
// User: *"add MCP in this, full access to my ai tools — i just have to say my
// raw thought and it holds all things."*
//
// So: from Claude (or any MCP client) you say "I need to film the studio tour
// Tuesday and the Northwind invoice is overdue", and it lands in Zenboard
// correctly, without you opening Zenboard.
//
// ── WHY THE PROTOCOL IS HAND-WRITTEN AND NOT `@modelcontextprotocol/sdk` ────
// The worker has a 3 MiB gzipped ceiling that already forced every dev-preview
// harness out of the build ([[zenboard-cloudflare-deploy]]). A tools-only MCP
// server over HTTP is four JSON-RPC methods — `initialize`, `tools/list`,
// `tools/call`, and an `initialized` notification to acknowledge. That is this
// file. Adding a transport library to buy four method names would spend the
// budget that keeps the app deployable.
//
// ── WHAT THE TOKEN IS, AND WHY IT IS NOT LAZY ──────────────────────────────
// The calendar feed mints its token on first use, because a read-only view of
// your own schedule behind an unguessable URL is close to harmless. **This one
// is not that.** It reads and WRITES a whole workspace, so it is minted only
// when a person asks for it, shown once, and revocable — and it travels in an
// `Authorization` header rather than a URL, because URLs end up in shell
// history, proxy logs and screenshots in a way headers do not.
//
// The `zb_` prefix is deliberate: a credential that announces what it is can be
// found and revoked when it leaks into a repo or a log, which is the whole
// reason every provider prefixes theirs.

import { randomBytes } from 'crypto';
import { INTAKE_TITLE_MAX } from '@/lib/task-intake';

/** Where the token lives in `profiles.preferences` — no migration, same as the feed. */
export const MCP_TOKEN_KEY = 'mcpToken';

/** 32 bytes: this one writes, so it gets more entropy than the read-only feed's 24. */
export const newMcpToken = (): string => `zb_${randomBytes(32).toString('base64url')}`;

/** Cheap rejection before any query touches the database. */
export const looksLikeMcpToken = (t: string | null | undefined): boolean =>
  !!t && /^zb_[A-Za-z0-9_-]{32,128}$/.test(t);

/** Pull the token out of an Authorization header. Bearer, or bare. */
export function bearerFrom(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  const raw = (m ? m[1] : header).trim();
  return looksLikeMcpToken(raw) ? raw : null;
}

// ── The protocol ────────────────────────────────────────────────────────────

/** The versions we can speak. First is preferred. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

export const SERVER_INFO = { name: 'zenboard', version: '1.0.0' } as const;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

/** JSON-RPC 2.0's reserved codes, the four we can actually produce. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
};

/**
 * The tools.
 *
 * ── WHY `capture` TAKES A `kind` RATHER THAN GUESSING ──────────────────────
 * "Film the studio tour Tuesday" is a task. "That Nike edit was incredible" is
 * an idea. Telling those apart needs the CONVERSATION, and the conversation is
 * on the client — the model that read it is right there. A parser on this side
 * would be a second, worse guess made with less information, and the governing
 * rule for the content inbox already says a capture must not silently become a
 * commitment ([[zenboard-content-module]]).
 *
 * So the client decides, and the default is `task`: an unactioned task is
 * visible and nags, while a stray idea sits quietly. When unsure, fail toward
 * the thing you will see again.
 *
 * ── AND WHY THE DESCRIPTIONS ARE WRITTEN FOR A MODEL ───────────────────────
 * These strings are the only instructions the calling model gets. They say when
 * to use the tool and what the argument means, not what the function does.
 */
export const TOOLS: ToolDef[] = [
  {
    name: 'capture',
    description:
      'Save a raw thought to Zenboard. Use this whenever the user says something ' +
      'they want kept: a task, an idea for content, a reminder, something a ' +
      'client said. It lands in an inbox to be sorted later, so it is safe to ' +
      'use freely; nothing is filed or scheduled by capturing it. Call it once ' +
      'per separate thing, so each can be sorted on its own.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            'The thought, in the user\'s own words. The first line becomes its title; ' +
            'anything longer is kept in full, so do not shorten it.',
        },
        kind: {
          type: 'string',
          enum: ['task', 'idea'],
          description:
            '"task" = something to do (default). "idea" = something to make or ' +
            'a reference worth keeping: a video idea, a post, an inspiring link.',
        },
        url: { type: 'string', description: 'A link the thought is about, if there is one.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'today',
    description:
      "What is on the user's plate today, in their own timezone: the tasks " +
      'planned for today and how much time they add up to, meetings, what is ' +
      'being filmed or published, anything overdue or blocked, and new client ' +
      'requests. Use it to answer "what am I doing today" or before suggesting ' +
      'they take on something new.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search',
    description:
      'Find things in Zenboard by title: tasks, projects, clients, documents and ' +
      'content pieces. Use it to check whether something already exists before ' +
      'capturing a duplicate, or to answer a question about the user\'s work.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for.' },
        limit: { type: 'number', description: 'Maximum results (default 20, max 50).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_projects',
    description:
      'The user\'s projects, with status and client. Use it when they mention a ' +
      'project by name and you need its real name or id, or to answer what they ' +
      'are working on.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export const TOOL_NAMES: ReadonlySet<string> = new Set(TOOLS.map((t) => t.name));

/** Pick a protocol version to answer with. */
export function negotiateVersion(requested: unknown): string {
  return typeof requested === 'string' && (PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : PROTOCOL_VERSIONS[0];
}

/** MCP wraps every tool result in content parts; text is the only one we return. */
export function toolText(text: string, isError = false): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] };
}

export const ok = (id: string | number | null, result: unknown): JsonRpcResponse =>
  ({ jsonrpc: '2.0', id, result });

export const fail = (id: string | number | null, code: number, message: string): JsonRpcResponse =>
  ({ jsonrpc: '2.0', id, error: { code, message } });

/**
 * Is this a well-formed JSON-RPC request we could act on?
 *
 * A NOTIFICATION has no `id` and expects no response — `notifications/
 * initialized` is one, and answering it with a result is a protocol error that
 * some clients treat as fatal. So the id's ABSENCE is meaningful and cannot be
 * defaulted away.
 */
export function parseRequest(body: unknown): { error: string } | { req: JsonRpcRequest; isNotification: boolean } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected a JSON-RPC object.' };
  const b = body as Record<string, unknown>;
  if (b.jsonrpc !== '2.0') return { error: 'Expected jsonrpc "2.0".' };
  if (typeof b.method !== 'string' || !b.method) return { error: 'Missing method.' };
  const hasId = 'id' in b && b.id !== null && b.id !== undefined;
  return {
    req: {
      jsonrpc: '2.0',
      id: hasId ? (b.id as string | number) : null,
      method: b.method,
      params: (b.params && typeof b.params === 'object' && !Array.isArray(b.params))
        ? (b.params as Record<string, unknown>)
        : undefined,
    },
    isNotification: !hasId,
  };
}

/** The arguments of a `tools/call`, validated against the tool's own schema. */
export function readToolCall(
  params: Record<string, unknown> | undefined,
): { error: string } | { name: string; args: Record<string, unknown> } {
  const name = params?.name;
  if (typeof name !== 'string' || !TOOL_NAMES.has(name)) {
    return { error: `Unknown tool: ${typeof name === 'string' ? name : 'none given'}` };
  }
  const raw = params?.arguments;
  const args = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : {};
  const def = TOOLS.find((t) => t.name === name)!;
  for (const required of def.inputSchema.required ?? []) {
    const v = args[required];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
      return { error: `${name} needs "${required}".` };
    }
  }
  return { name, args };
}

/** A capture's kind, normalised. Anything unrecognised is a task — see TOOLS. */
export function captureKind(v: unknown): 'task' | 'idea' {
  return v === 'idea' ? 'idea' : 'task';
}

/**
 * A raw thought, split into the line that names it and the words that are kept.
 *
 * "I just have to say my raw thought" — so it arrives however it was said: one
 * line, or a paragraph dictated into a chat. A title is one line in a list,
 * though, and the first version of this tool cut the text at 200 characters
 * and threw the rest away. So the first line becomes the title, clipped at a
 * word boundary if it will not fit, and if anything at all was left out of the
 * title the WHOLE thought is kept as the body. Nothing said is ever dropped.
 */
export function splitThought(text: string, max = INTAKE_TITLE_MAX): { title: string; body: string | null } {
  const whole = text.trim();
  const first = (whole.split('\n').map((l) => l.trim()).find(Boolean) ?? '').replace(/\s+/g, ' ');
  let title = first;
  if (title.length > max) {
    const cut = title.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    // Break on a word when there is one reasonably near the limit; a single
    // enormous word (a URL) is cut where it stands rather than emptied.
    title = `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
  }
  return { title, body: title === whole ? null : whole };
}

/** How many results a search may return, whatever was asked for. */
export function searchLimit(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 20;
  return Math.min(50, Math.max(1, n));
}
