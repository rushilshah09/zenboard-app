// Notion → Documents import (§7S: "switching cost is the real competitor").
//
// Phase 4's cancelled-subscription test is "cancel Notion", and nobody cancels a
// tool their five years of notes are still inside. Notion's own export is a
// folder of Markdown, so the body parsing is already solved — `textToBlocks`
// (lib/clipboard.ts) reads headings, lists, to-dos, quotes, code fences and
// dividers. What is NOT solved, and what this file is, is everything Notion
// wraps around that Markdown:
//
//   · a filename carrying a 32-hex page id — "Meeting notes a1b2…f9.md";
//   · a duplicate H1 of the title as the first body line;
//   · a block of `Property: value` lines that database pages carry and plain
//     pages do not.
//
// Pure and tested. The action that writes pages consumes ImportedDoc[].
import { textToBlocks } from '@/lib/clipboard';
import { genId, type Block } from '@/lib/blocks';
import { liftText } from '@/lib/rich';

export type ImportedDoc = {
  title: string;
  blocks: Block[];
  /** Notion's per-page properties, kept as text. Typing them is a later job. */
  properties: { name: string; value: string }[];
};

/** Notion appends a 32-char hex id to every exported filename. */
const NOTION_ID = /[ _-][0-9a-f]{32}$/i;

/**
 * "Meeting notes a1b2…f9.md" → "Meeting notes".
 *
 * The id is stripped only when it is exactly 32 hex characters at the end, so a
 * legitimately-named file like `report-2026.md` or a hex-looking title keeps its
 * name. Getting this wrong renames the user's pages, which is worse than
 * leaving an ugly suffix on a few.
 */
export function notionTitleFromFilename(filename: string): string {
  const base = (filename.split(/[\\/]/).pop() ?? filename).replace(/\.(md|markdown|txt)$/i, '');
  const stripped = base.replace(NOTION_ID, '');
  return (stripped || base).trim() || 'Untitled';
}

/**
 * Notion writes a page's properties as `Name: value` lines directly under the
 * H1, ending at the first blank line. Only read them when the FIRST line after
 * the title matches — otherwise an ordinary document that happens to open with
 * "Note: remember to call Sam" would lose that sentence into a property.
 */
function takeProperties(lines: string[]): { properties: ImportedDoc['properties']; rest: string[] } {
  const properties: ImportedDoc['properties'] = [];
  let i = 0;
  const PROP = /^([A-Za-z][\w \-/]{0,40}):[ \t]*(.*)$/;
  while (i < lines.length && lines[i].trim() !== '') {
    const m = PROP.exec(lines[i]);
    if (!m) break;
    properties.push({ name: m[1].trim(), value: m[2].trim() });
    i++;
  }
  // A single line is far more likely to be prose than a property block.
  if (properties.length < 2) return { properties: [], rest: lines };
  while (i < lines.length && lines[i].trim() === '') i++;   // eat the separator
  return { properties, rest: lines.slice(i) };
}


// ── BODY FIDELITY ───────────────────────────────────────────────────────────
// The body used to go through `textToBlocks` (lib/clipboard.ts), which is the
// generic PASTE parser: headings, flat lists, quotes, code fences, dividers.
// That is right for pasted text and wrong for a Notion export, because it drops
// four things Notion documents are actually made of:
//
//   · NESTING. Notion indents sub-items; a flat parser returns a flat list, so a
//     three-level outline arrives as one column of bullets. This is the damage
//     that matters most — it is not a style loss, it is the loss of the meaning
//     the indentation carried.
//   · TABLES. `| a | b |` became one text block per row: a table turned into
//     rows of pipes. Zenboard has a real `table` block with `rows`.
//   · IMAGES. `![alt](file.png)` became the literal markdown as prose.
//   · CALLOUTS and TOGGLES, which Notion exports as `<aside>` and
//     `<details><summary>` and which have exact counterparts here.
//
// Everything below maps to a block type Zenboard already has — no new block
// types were needed, which is the reason the fidelity is reachable at all.

/** Notion indents one level per tab or per 2–4 spaces. */
function indentOf(line: string): number {
  const m = /^([\t ]*)/.exec(line)![1];
  const tabs = (m.match(/\t/g) ?? []).length;
  const spaces = m.replace(/\t/g, '').length;
  return tabs + Math.floor(spaces / 2);
}

const mk = (type: Block['type'], text: string, extra?: Partial<Block>): Block => {
  const lifted = liftText(text);
  return { id: genId(), type, text: lifted.text, ...(lifted.spans ? { spans: lifted.spans } : {}), ...extra };
};

const TABLE_SEP = /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/;
const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/** A URL alone on its line is a bookmark, which is how Notion exports one. */
const BARE_URL = /^https?:\/\/\S+$/;

/**
 * Notion's Markdown → Zenboard blocks, preserving structure.
 *
 * Deliberately its own function rather than a flag on `textToBlocks`: the two
 * have different jobs, and a parser that tries to be both ends up guessing. A
 * pasted line starting with `|` is prose; in a Notion export it is a table.
 */
export function notionBodyToBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    const indent = indentOf(raw);

    // ── fenced code — verbatim, including its own indentation ──────────────
    const fence = /^```([\w-]+)?\s*$/.exec(line);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push({ id: genId(), type: 'code', text: buf.join('\n'), lang: fence[1] ?? 'text' });
      continue;
    }

    // ── LaTeX block. Zenboard has no equation block, so it lands in code with
    //    its language named — visible and intact, rather than silently prose.
    if (line === '$$') {
      const buf: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { buf.push(lines[i]); i++; }
      i++;
      out.push({ id: genId(), type: 'code', text: buf.join('\n'), lang: 'latex' });
      continue;
    }

    // ── table: a header row, a separator, then body rows ───────────────────
    if (line.startsWith('|') && TABLE_SEP.test(lines[i + 1] ?? '')) {
      const rows: string[][] = [cells(line)];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      out.push({ id: genId(), type: 'table', text: '', rows });
      continue;
    }

    // ── callout: Notion writes `<aside>`, often opening with an emoji ──────
    if (/^<aside>/i.test(line)) {
      const buf: string[] = [];
      let first = line.replace(/^<aside>\s*/i, '');
      if (first) buf.push(first);
      i++;
      while (i < lines.length && !/^<\/aside>/i.test(lines[i].trim())) { buf.push(lines[i].trim()); i++; }
      i++;
      out.push(mk('callout', buf.filter(Boolean).join('\n').trim()));
      continue;
    }

    // ── toggle: `<details><summary>Title</summary>` … `</details>`. The body
    //    becomes indented children, which is exactly how a toggle nests here.
    if (/^<details>/i.test(line)) {
      i++;
      let summary = '';
      if (/^<summary>/i.test(lines[i]?.trim() ?? '')) {
        summary = lines[i].trim().replace(/^<summary>/i, '').replace(/<\/summary>$/i, '').trim();
        i++;
      }
      const buf: string[] = [];
      while (i < lines.length && !/^<\/details>/i.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      out.push(mk('toggle', summary, { indent }));
      for (const child of notionBodyToBlocks(buf.join('\n'))) {
        out.push({ ...child, indent: (child.indent ?? 0) + indent + 1 });
      }
      continue;
    }

    // ── image ──────────────────────────────────────────────────────────────
    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line);
    if (img) {
      out.push({ id: genId(), type: 'image', text: img[1] ?? '', src: decodeURI(img[2]), ...(indent ? { indent } : {}) });
      i++;
      continue;
    }

    // ── bookmark: a bare URL on its own line ───────────────────────────────
    if (BARE_URL.test(line)) {
      out.push({ id: genId(), type: 'bookmark', text: line, src: line, ...(indent ? { indent } : {}) });
      i++;
      continue;
    }

    if (line === '') {
      // Keep interior blank lines as spacing; drop the outer ones.
      if (out.length && i < lines.length - 1) out.push({ id: genId(), type: 'text', text: '' });
      i++;
      continue;
    }

    // ── the line kinds `textToBlocks` already knows, plus indentation ──────
    const extra = indent ? { indent } : undefined;
    if (/^#{1}\s+/.test(line)) out.push(mk('h1', line.replace(/^#\s+/, ''), extra));
    else if (/^#{2}\s+/.test(line)) out.push(mk('h2', line.replace(/^##\s+/, ''), extra));
    else if (/^#{3,}\s+/.test(line)) out.push(mk('h3', line.replace(/^#{3,}\s+/, ''), extra));
    else if (/^[-*]\s+\[[ xX]\]\s+/.test(line))
      out.push(mk('todo', line.replace(/^[-*]\s+\[[ xX]\]\s+/, ''), { checked: /\[[xX]\]/.test(line), ...extra }));
    else if (/^[-*+•]\s+/.test(line)) out.push(mk('bullet', line.replace(/^[-*+•]\s+/, ''), extra));
    else if (/^\d+[.)]\s+/.test(line)) out.push(mk('numbered', line.replace(/^\d+[.)]\s+/, ''), extra));
    else if (/^>\s?/.test(line)) out.push(mk('quote', line.replace(/^>\s?/, ''), extra));
    else if (/^(---+|___+|\*\*\*+)$/.test(line)) out.push({ id: genId(), type: 'divider', text: '' });
    else out.push(mk('text', line, extra));
    i++;
  }
  return out;
}

/**
 * One exported Markdown file → one document.
 *
 * The title comes from the H1 when there is one, because Notion writes the
 * page's real name there and the filename is a sanitised version of it (slashes
 * and colons become spaces). The H1 is then dropped from the body — keeping it
 * would give every imported page a heading identical to its own title.
 */
export function parseNotionMarkdown(filename: string, text: string): ImportedDoc {
  const lines = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const h1 = /^#\s+(.+?)\s*$/.exec(lines[i] ?? '');
  const title = h1 ? h1[1].trim() : notionTitleFromFilename(filename);
  if (h1) i++;
  while (i < lines.length && lines[i].trim() === '') i++;

  const { properties, rest } = takeProperties(lines.slice(i));
  return { title: title || 'Untitled', blocks: notionBodyToBlocks(rest.join('\n')), properties };
}

/** Files an import will accept. Notion exports Markdown; CSV is the task importer's job. */
export const isImportableDoc = (filename: string): boolean =>
  /\.(md|markdown|txt)$/i.test(filename);
