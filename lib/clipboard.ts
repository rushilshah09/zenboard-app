// Notion-style clipboard sanitization (client-only). Pasted HTML is converted
// into native Zenboard blocks: semantic structure survives (headings, lists,
// checklists, quotes, code, tables, images, dividers, links) and inline
// emphasis is kept as the editor's markdown-mark serialization (**bold**,
// *italic*, `code`, [label](url), ~~strike~~) — while ALL presentation is
// dropped: fonts, sizes, colors, margins, classes, ids, spans, divs, layout.
// The result looks like it was written in Zenboard.
import { genId, toBlocks, blocksToMarkdown, type Block, type BlockType } from '@/lib/blocks';
import { liftText } from '@/lib/rich';

const SKIP = new Set(['STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

// ── Inline serialization: keep marks, unwrap everything else ──
function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (SKIP.has(el.tagName)) return '';
  if (el.tagName === 'BR') return '\n';
  const inner = Array.from(el.childNodes).map(inline).join('');
  const body = inner.trim();
  if (!body) return inner; // whitespace-only: keep spacing, no markers
  switch (el.tagName) {
    case 'B': case 'STRONG': return `**${body}**`;
    case 'I': case 'EM': return `*${body}*`;
    case 'CODE': case 'KBD': case 'SAMP': return `\`${body.replace(/`/g, '')}\``;
    case 'S': case 'DEL': case 'STRIKE': return `~~${body}~~`;
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      return /^https?:\/\//i.test(href) && body !== href ? `[${body}](${href})` : body;
    }
    default: return inner; // span/font/u/mark/… → unwrap, style dropped
  }
}

const para = (text: string, extra?: Partial<Block>): Block => ({ id: genId(), type: 'text', text, ...extra });

// Inline-level nodes group into ONE paragraph per run — a pasted sentence
// fragment like `plus <strong>bold</strong> tail` must stay a single block,
// not shred into a block per node.
const INLINE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE', 'KBD', 'SAMP', 'A', 'SPAN', 'FONT', 'MARK', 'SUP', 'SUB', 'SMALL', 'BIG', 'ABBR', 'TIME', 'BR', 'WBR']);
const isInline = (n: Node): boolean =>
  n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has((n as HTMLElement).tagName));

// Walk a container's children: consecutive inline nodes buffer into one
// paragraph (markers preserved for the lift); block elements recurse.
function walkAll(nodes: Iterable<Node>, out: Block[], indent: number) {
  let buf: Node[] = [];
  const flush = () => {
    if (!buf.length) return;
    for (const piece of buf.map(inline).join('').split('\n')) {
      const t = piece.trim();
      if (t) out.push(para(t, indent ? { indent } : undefined));
    }
    buf = [];
  };
  for (const n of nodes) {
    if (isInline(n)) buf.push(n);
    else { flush(); walk(n, out, indent); }
  }
  flush();
}

// ── Structural walk: elements → blocks ──
function walk(node: Node, out: Block[], indent: number) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? '').trim();
    if (t) out.push(para(t.replace(/\s+/g, ' ')));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  if (SKIP.has(el.tagName)) return;

  const pushText = (type: Block['type']) => {
    for (const piece of inline(el).split('\n')) {
      const t = piece.trim();
      if (t) out.push({ id: genId(), type, text: t, ...(indent ? { indent } : {}) });
    }
  };

  switch (el.tagName) {
    case 'H1': return pushText('h1');
    case 'H2': return pushText('h2');
    case 'H3': case 'H4': case 'H5': case 'H6': return pushText('h3');
    case 'P': return pushText('text');
    case 'BLOCKQUOTE': {
      const inner: Block[] = [];
      walkAll(el.childNodes, inner, indent);
      for (const b of inner) out.push(b.type === 'text' ? { ...b, type: 'quote' } : b);
      return;
    }
    case 'PRE': {
      const code = el.textContent ?? '';
      const langM = /language-([\w-]+)/.exec(el.innerHTML);
      if (code.trim()) out.push({ id: genId(), type: 'code', text: code.replace(/\n$/, ''), lang: langM?.[1] ?? 'text' });
      return;
    }
    case 'HR': return void out.push({ id: genId(), type: 'divider', text: '' });
    case 'IMG': {
      const src = el.getAttribute('src') ?? '';
      if (/^(https?:|data:image)/i.test(src)) out.push({ id: genId(), type: 'image', text: el.getAttribute('alt') ?? '', src });
      return;
    }
    case 'TABLE': {
      const rows: string[][] = [];
      el.querySelectorAll('tr').forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll('th, td').forEach((td) => cells.push(inline(td).replace(/\n/g, ' ').trim()));
        if (cells.some((c) => c)) rows.push(cells);
      });
      if (rows.length) {
        const w = Math.max(...rows.map((r) => r.length));
        out.push({ id: genId(), type: 'table', text: '', rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]) });
      }
      return;
    }
    case 'UL': case 'OL': {
      const numbered = el.tagName === 'OL';
      el.querySelectorAll(':scope > li').forEach((li) => {
        // Inline content of the li itself (nested lists handled recursively below)
        const clone = li.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('ul, ol').forEach((n) => n.remove());
        let text = inline(clone).replace(/\n/g, ' ').trim();
        const box = li.querySelector(':scope input[type="checkbox"]');
        let type: Block['type'] = numbered ? 'numbered' : 'bullet';
        let checked: boolean | undefined;
        const todoM = /^\[( |x|X)\]\s*/.exec(text);
        if (box || todoM) { type = 'todo'; checked = box ? (box as HTMLInputElement).checked : todoM![1] !== ' '; text = text.replace(/^\[( |x|X)\]\s*/, ''); }
        if (text) out.push({ id: genId(), type, text, ...(checked !== undefined ? { checked } : {}), ...(indent ? { indent } : {}) });
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => walk(sub, out, indent + 1));
      });
      return;
    }
    default: // div/section/article/main/li fallthrough — recurse, drop the wrapper
      walkAll(el.childNodes, out, indent);
  }
}

// ── plain text → blocks (paste engine, md-ish) ──────────────────────────────
// One typed block per line; ``` fences group into code blocks; inline markers
// lift into rich spans.
function lineToBlock(line: string): Block {
  const mk = (type: BlockType, text: string, extra?: Partial<Block>): Block => {
    const lifted = liftText(text);
    return { id: genId(), type, text: lifted.text, ...(lifted.spans ? { spans: lifted.spans } : {}), ...extra };
  };
  if (/^#{1}\s+/.test(line)) return mk('h1', line.replace(/^#\s+/, ''));
  if (/^#{2}\s+/.test(line)) return mk('h2', line.replace(/^##\s+/, ''));
  if (/^#{3,}\s+/.test(line)) return mk('h3', line.replace(/^#{3,}\s+/, ''));
  if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) return mk('todo', line.replace(/^[-*]\s+\[[ xX]\]\s+/, ''), { checked: /\[[xX]\]/.test(line) });
  if (/^[-*•]\s+/.test(line)) return mk('bullet', line.replace(/^[-*•]\s+/, ''));
  if (/^\d+[.)]\s+/.test(line)) return mk('numbered', line.replace(/^\d+[.)]\s+/, ''));
  if (/^>\s+/.test(line)) return mk('quote', line.replace(/^>\s+/, ''));
  if (/^---+$/.test(line.trim())) return { id: genId(), type: 'divider', text: '' };
  return mk('text', line);
}

export function textToBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const fence = /^```([\w-]+)?\s*$/.exec(lines[i]);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // past the closing fence (or EOF)
      out.push({ id: genId(), type: 'code', text: buf.join('\n'), lang: fence[1] ?? 'text' });
      continue;
    }
    const line = lines[i];
    // Keep interior blank lines as empty paragraphs; trim the outer ones.
    if (line.trim() !== '' || (i > 0 && i < lines.length - 1)) out.push(lineToBlock(line));
    i++;
  }
  return out;
}

// ── block copy/paste fidelity (PRD §7.5) ────────────────────────────────────
// Copy places markdown on text/plain (clean paste into any external app) and
// embeds the true block JSON in text/html, so pasting back into Zenboard
// restores full structure with new ids.
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function copyBlocks(blocks: Block[]): void {
  const md = blocksToMarkdown(blocks);
  const payload = btoa(encodeURIComponent(JSON.stringify(blocks)));
  const html = `<div data-zenboard-blocks="${payload}">${escapeHtml(md).replace(/\n/g, '<br>')}</div>`;
  try {
    void navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob([md], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    })]);
  } catch {
    navigator.clipboard?.writeText(md).catch(() => { /* clipboard unavailable */ });
  }
}

// Extract Zenboard blocks from pasted HTML (our own copy flavor). Returns
// re-normalized blocks with fresh ids, or null when the flavor is absent.
export function blocksFromHtml(html: string): Block[] | null {
  const m = /data-zenboard-blocks="([^"]+)"/.exec(html);
  if (!m) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(m[1]))) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return toBlocks(parsed).map((b) => ({ ...b, id: genId() }));
  } catch { return null; }
}

export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: Block[] = [];
  walkAll(doc.body.childNodes, out, 0);
  return out
    // Merge stray fragments: drop leading/trailing empties the parse produced.
    .filter((b, i) => !(b.type === 'text' && !b.text.trim()) || (i > 0 && i < out.length - 1))
    // The walk serialized inline emphasis as markers; lift them into spans so
    // blocks land in the editor already formatted (code stays literal).
    .map((b) => {
      if (b.type === 'code' || !b.text) return b;
      const lifted = liftText(b.text);
      return lifted.spans ? { ...b, text: lifted.text, spans: lifted.spans } : b;
    });
}
