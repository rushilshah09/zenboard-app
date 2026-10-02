'use client';
// Dev-only harness for the Content module (PRODUCT_THINKING §9). Staged so every
// state is on screen at once: a late piece, one waiting on a reply, a piece whose
// shoot and publish are DIFFERENT DAYS (the whole reason the calendar carries
// both), and one stored with a stage the vocabulary does not know. 404s in prod.
import { notFound, useSearchParams } from 'next/navigation';
import { ContentWorkspace } from '@/components/content/content-workspace';
import { AppShell } from '@/components/shell/app-shell';
import { readContent, type Piece, type PieceApproval } from '@/lib/content';
import type { Block } from '@/lib/blocks';
import { primeLinkMeta } from '@/lib/use-link-meta';
import { primeAttachmentUrl } from '@/lib/use-attachment';
import { Toaster } from '@/components/ds/ui';

const TODAY = '2026-09-05';

// MODULE SCOPE, and it matters. `useServerState` snaps local state back whenever
// its prop is a new REFERENCE — that is how it follows the server. An inline
// `stageLabels={{ edit: 'The cut' }}` is a new object on every render, so every
// optimistic rename was reverted before it could paint. A real Server
// Component's serialized props change identity only when the data does, so the
// harness has to behave the same way or it tests something the app never does.
const STAGE_LABELS = { edit: 'The cut' } as const;
const at = (n: number) => {
  const d = new Date(`${TODAY}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Built through `readContent` on purpose: the harness stores what the DATABASE
// would store, so the normalisers are exercised rather than bypassed.
const piece = (
  id: string, title: string, pipeline: Record<string, unknown>,
  extra: { projectId?: string; approval?: PieceApproval; createdOn?: string } = {},
): Piece => ({ id, title, meta: readContent({ blocks: [], pipeline }), ...extra });

const PROJECTS = [
  { id: 'pr1', name: 'Northwind rebrand' },
  { id: 'pr2', name: 'Studio marketing' },
];

const PIECES: Piece[] = [
  piece('c1', 'Why most studio websites fail', { stage: 'idea', format: 'video', channel: 'YouTube' }),
  // c2 and c3 share a shoot day on purpose: a shoot day is a DATE, so two
  // pieces filmed the same morning need nothing created to be on it together —
  // and they are in two places, which is a real Tuesday, not a conflict.
  piece('c2', 'The 3-question client brief', { stage: 'script', format: 'short', channel: 'Instagram', publishAt: at(9), shootAt: at(2), callTime: '11:00', location: 'Rooftop' }),
  // Shoot and publish on DIFFERENT days — one object, two appointments.
  piece('c3', 'Studio tour, part one', { stage: 'shoot', format: 'video', channel: 'YouTube', shootAt: at(2), publishAt: at(16), callTime: '09:00', location: 'Studio' }),
  piece('c4', 'How we price a rebrand', { stage: 'edit', format: 'video', channel: 'YouTube', publishAt: at(6) }),
  // LATE: publish date has passed and it is still being made.
  piece('c5', 'August recap', { stage: 'edit', format: 'short', channel: 'TikTok', publishAt: at(-3) }),
  // WITH THE CLIENT: a real `approvals` row, which is what actually makes the
  // next move someone else's — the review stage alone never did.
  piece('c6', 'Client spotlight — Northwind', { stage: 'review', format: 'post', channel: 'LinkedIn', publishAt: at(3) },
    { projectId: 'pr1', approval: { id: 'ap1', status: 'awaiting', createdAt: at(-2) } }),
  // They answered, and the answer was no. This outranks every date on the board.
  piece('c10', 'Northwind case study film', { stage: 'review', format: 'video', channel: 'YouTube', publishAt: at(12) },
    { projectId: 'pr1', approval: { id: 'ap2', status: 'changes_requested', note: 'Love it — can we cut the intro to 10s and swap the logo shot for the new mark?', createdAt: at(-1) } }),
  // In review with NOBODY asked: your own homework, and it must NOT read as
  // waiting on anyone.
  piece('c11', 'Behind the scenes — week one', { stage: 'review', format: 'short', channel: 'Instagram' }),
  piece('c7', 'Five fonts we keep coming back to', { stage: 'scheduled', format: 'carousel', channel: 'Instagram', publishAt: at(1) }),
  // Settled: a past date on a published piece is history, never "late".
  piece('c8', 'The rebrand nobody asked for', { stage: 'published', format: 'video', channel: 'YouTube', publishAt: at(-11), liveUrl: 'https://youtu.be/rebrand' }),
  // Published with no live link: the Library shows what KIND of thing it is.
  piece('c13', 'What a brand audit actually covers', { stage: 'published', format: 'article', channel: 'Blog', publishAt: at(-38) }),
  // Stored with a stage the vocabulary does not know — it must land in Idea
  // rather than vanish into a column that does not exist.
  piece('c9', 'Imported from the old spreadsheet', { stage: 'filming', channel: 'YouTube' }),

  // ── The inbox: only the pile still to sort ──────────────────────────────
  piece('n1', 'Thread on hooks that actually work', { bucket: 'inbox', sourceUrl: 'https://x.com/someone/status/1' }),
  piece('n2', 'Idea: the pricing video nobody makes', { bucket: 'inbox' }),
  // A BARE link, titled the way the capture box titles one before anything is
  // known about the page. Its preview carries the page's real title, which must
  // replace this placeholder everywhere it shows.
  piece('n3', 'youtube.com/watch', { bucket: 'inbox', sourceUrl: 'https://www.youtube.com/watch?v=attn' }),
  // A SCREENSHOT, pasted: the picture is the capture. Its bytes are an attachment
  // (primed below — a harness has no session to sign a URL with).
  piece('n4', 'Screenshot from 13 Sep, 16:12', { bucket: 'inbox', image: 'attachment:demo-shot-inbox' }),

  // ── The Library's saved shelf ───────────────────────────────────────────
  // Spread over three months, so the grouping is visible. These `reference`
  // rows had NOWHERE to render until 2026-09-09 — the fixture had none either,
  // which is part of why the hole went unnoticed.
  // A picture kept in the library, with the reason it was kept.
  piece('r5', 'Ad frame: the one-line offer', {
    bucket: 'reference', image: 'attachment:demo-shot-library', note: 'Nothing on it but the product and one line.',
  }, { createdOn: at(-1) }),
  piece('r1', 'How Nike cuts a 15-second spot', {
    bucket: 'reference', sourceUrl: 'https://youtube.com/watch?v=abc123',
    sourceAuthor: 'Nike', note: 'The cut on the beat at 0:04.',
  }, { createdOn: at(-2) }),
  // A thought kept for later has no link at all.
  piece('r4', 'Open on the result, then show the work', {
    bucket: 'reference', note: 'Heard on a podcast. Use it for case-study intros.',
  }, { createdOn: at(-5) }),
  // The first video ever uploaded — a real link, with a real thumbnail.
  piece('r6', 'Me at the zoo', {
    bucket: 'reference', sourceUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', sourceAuthor: 'jawed',
    note: 'Nineteen seconds, one idea, no intro. Proof the idea carries it.',
  }, { createdOn: at(-9) }),
  // ── REMEMBERED PREVIEWS ────────────────────────────────────────────────
  // Saved under their PLACEHOLDER names, so a card that reads its real title can
  // only have got it from the preview stored on the row.
  // 1. Fresh, stored, and deliberately NOT primed: drawn with no request at all.
  piece('r7', 'behance.net/Coffee-Roaster', {
    bucket: 'reference', sourceUrl: 'https://www.behance.net/gallery/1234567/Coffee-Roaster',
    preview: { url: 'https://www.behance.net/gallery/1234567/Coffee-Roaster', at: at(-3), title: 'Brand identity for a coffee roaster', siteName: 'Behance', author: 'North Studio' },
  }, { createdOn: at(-45) }),
  // 2. Stored, but its picture's address has EXPIRED — the card must ask again,
  //    and this link's fresh answer is primed below.
  piece('r8', 'vimeo.com/76979871', {
    bucket: 'reference', sourceUrl: 'https://vimeo.com/76979871',
    preview: { url: 'https://vimeo.com/76979871', at: at(-2), title: 'The new Vimeo player', image: 'https://127.0.0.1:9/expired-thumbnail.jpg' },
  }, { createdOn: at(-50) }),
  // 3. The control: nothing stored, nothing primed — the one link that must ask.
  piece('r9', 'dribbble.com/shots', {
    bucket: 'reference', sourceUrl: 'https://dribbble.com/shots/20000001-Onboarding',
  }, { createdOn: at(-55) }),
  piece('r2', 'Studio site with a brilliant case-study layout', {
    bucket: 'reference', sourceUrl: 'https://example.studio/work',
  }, { createdOn: at(-20) }),
  // One reference that has already sparked something, so the shelf shows its
  // count and the piece shows "Sparked by" rather than "Cut from". Its page
  // gives us NOTHING (Instagram's login wall) — the honest fallback.
  piece('r3', 'That reel about client onboarding', {
    bucket: 'reference', sourceUrl: 'https://instagram.com/reel/xyz',
  }, { createdOn: at(-40) }),
  piece('c12', 'Our onboarding, in 40 seconds', { stage: 'idea', format: 'short', derivedFrom: 'r3' }),
];

// ── Link previews, without a network ────────────────────────────────────────
// A harness has no session, so `/api/unfurl` refuses it and every card would be
// the hostname fallback. Primed at MODULE scope of this CLIENT module — the
// browser's cache, not the server's — with what those pages say, and pictures
// drawn inline so nothing is fetched from anywhere.
const art = (from: string, to: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/></svg>`,
)}`;
// An unknown site keeps its own favicon, so the one off-platform fixture needs a
// believable one: a monogram, the way most studio sites draw theirs. Platform
// links carry NO favicon here on purpose — they are drawn with their own mark.
const monogram = (letter: string, bg: string, ink: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="${bg}"/><text x="16" y="22" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle" fill="${ink}">${letter}</text></svg>`,
)}`;
const LINKS = [
  { url: 'https://youtube.com/watch?v=abc123', title: 'How Nike cuts a 15-second spot', siteName: 'YouTube', author: 'Nike', image: art('#111827', '#b91c1c') },
  { url: 'https://example.studio/work', title: 'Selected work — Example Studio', siteName: 'Example Studio', description: 'Brand identity and websites for independent companies.', image: art('#e7e5e4', '#78716c'), favicon: monogram('E', '#1c1917', '#fafaf9') },
  { url: 'https://x.com/someone/status/1', title: 'Hooks that actually work: a thread', siteName: 'X', author: '@someone' },
  { url: 'https://www.youtube.com/watch?v=attn', title: 'How I got my attention span back', siteName: 'YouTube', author: 'Lilla Björn Stationery', image: art('#fde68a', '#0f766e') },
  { url: 'https://youtu.be/rebrand', title: 'The rebrand nobody asked for', siteName: 'YouTube', image: art('#1e3a8a', '#9333ea') },
  // A REAL video, answered exactly as YouTube's oEmbed answered it on 2026-09-14.
  // Its picture is YouTube's own thumbnail address — with a network, the harness
  // shows the real frame, as the app does.
  { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', title: 'Me at the zoo', siteName: 'YouTube', author: 'jawed', image: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' },
  // The FRESH answer for r8 above, once its remembered picture is found dead.
  { url: 'https://vimeo.com/76979871', title: 'The new Vimeo player', siteName: 'Vimeo', image: art('#1ab7ea', '#0b3d53') },
];
for (const link of LINKS) primeLinkMeta(link.url, link);

// Two "screenshots", drawn inline: a page with a header, a hero and three cards,
// and an ad frame — enough shape that a thumbnail reads as a picture of something.
const shotOf = (bg: string, ink: string, accent: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><rect width="1280" height="800" fill="${bg}"/><rect x="0" y="0" width="1280" height="64" fill="${ink}" opacity="0.08"/><rect x="80" y="140" width="620" height="56" rx="8" fill="${ink}"/><rect x="80" y="220" width="460" height="24" rx="6" fill="${ink}" opacity="0.45"/><rect x="80" y="280" width="180" height="48" rx="24" fill="${accent}"/><rect x="760" y="120" width="440" height="320" rx="16" fill="${accent}" opacity="0.85"/><rect x="80" y="500" width="340" height="220" rx="14" fill="${ink}" opacity="0.1"/><rect x="470" y="500" width="340" height="220" rx="14" fill="${ink}" opacity="0.1"/><rect x="860" y="500" width="340" height="220" rx="14" fill="${ink}" opacity="0.1"/></svg>`,
)}`;
primeAttachmentUrl('demo-shot-inbox', shotOf('#fafaf9', '#1c1917', '#2563eb'));
primeAttachmentUrl('demo-shot-library', shotOf('#0c0a09', '#fafaf9', '#f97316'));
primeLinkMeta('https://instagram.com/reel/xyz', null);

// The scripts, as `getPage` would return them. A shot is a to-do BLOCK, so the
// shot list is not a second list to keep — it is the script's own checkboxes.
const shot = (id: string, text: string, checked = false): Block => ({ id, type: 'todo', text, checked });
const SCRIPTS: Record<string, Block[]> = {
  c3: [
    { id: 'h1', type: 'h2', text: 'Opening' },
    shot('s1', 'Wide of the studio from the door', true),
    shot('s2', 'Slow push in on the desk'),
    { id: 'p1', type: 'text', text: 'Talk through how the week is planned.' },
    shot('s3', 'Cutaway: swatch book, shallow depth'),
  ],
  c2: [
    { id: 'p2', type: 'text', text: 'Three questions, straight to camera.' },
    shot('s4', 'Talking head, rooftop, golden hour'),
    shot('s5', 'B-roll: notebook and the three questions written out'),
  ],
};

const SHELL_SPACES = [{ id: 's1', name: "Rushil shah's workspace", emoji: '✦', color: '#9A1B6F', tag: 'WORK' as const }];

export default function ContentPreviewPage() {
  // `?shell=1` renders the module inside the REAL AppShell. Without it the page
  // has no content pane, so a record opened full page falls back to taking the
  // whole window — and the in-pane behaviour, which is how it opens in the app,
  // could not be seen at all.
  const inShell = useSearchParams()?.get('shell') === '1';
  if (process.env.NODE_ENV === 'production') notFound();
  // One stage starts renamed, so the harness shows the case that matters: a
  // custom name has to reach the column head, the card's move menu, the piece's
  // stage select AND the repurpose list, not three of the four.
  const workspace = (
    <ContentWorkspace initialPieces={PIECES} projects={PROJECTS} todayISO={TODAY}
      stageLabels={STAGE_LABELS} demoScripts={SCRIPTS} demo />
  );
  if (inShell) {
    return <AppShell name="Rushil shah" email="designdotrushil@gmail.com" spaces={SHELL_SPACES} pins={[]} activeSpaceId="s1">{workspace}</AppShell>;
  }
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)', overflow: 'hidden' }}>
      {workspace}
      {/* Its own <Toaster/>: outside AppShell there is none, and "moved to Trash"
          with its Undo is the only way back from a removal — a harness that
          cannot show it cannot verify it. (`?shell=1` uses the shell's.) */}
      <Toaster />
    </div>
  );
}
