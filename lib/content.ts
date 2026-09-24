// THE vocabulary for a piece of content — PRODUCT_THINKING.md §9, "content is
// first-class: an agency's own content is not a second tool".
//
// THE DECISION: a content piece is a PAGE. `pages.type = 'content'`.
//
// Not a new table, and not because a migration was inconvenient. The thing a
// creator spends their time on is the SCRIPT, and a script is a document — so
// the moment content is a page it inherits the block editor, comments, version
// history, @-mentions, Connected, search, and `client_visible` sharing to the
// portal. A `content` table would have started with a `body text` column and
// spent a year growing back toward what `pages` already is.
//
// What a page does NOT have is a pipeline, and that is what this file adds. The
// fields ride in the page's `content` JSON under one key, exactly the way covers
// and doc properties already do (components/documents/documents-view.tsx) — so
// this needs no migration either. `pages.type` is plain `text` with no CHECK and
// the app already writes note/doc/template/database.
import { hostOf } from './unfurl';
import { coverAttachmentId } from './covers';

/** Where a piece is. The order IS the pipeline — board columns read from it. */
export const STAGES = ['idea', 'script', 'shoot', 'edit', 'review', 'scheduled', 'published'] as const;
export type Stage = typeof STAGES[number];

const STAGE_SET: ReadonlySet<string> = new Set(STAGES);

export const STAGE_LABEL: Record<Stage, string> = {
  idea: 'Idea',
  // "Draft", not "Script": the same column holds a video's script, a
  // newsletter's first pass and the copy for a LinkedIn post. Naming it for the
  // video case made every other format read as though it were in the wrong
  // place. The KEY stays `script` — it is persisted in a JSON enum, and
  // renaming a stored value to fix a label is how in-flight work gets lost.
  script: 'Draft',
  shoot: 'Shoot',
  edit: 'Edit',
  review: 'Review',
  scheduled: 'Scheduled',
  published: 'Published',
};

/**
 * The next thing a human does. A board column that only names a state makes you
 * work out the verb yourself, every time you look at it.
 *
 * `review` is the one that is not a verb for YOU — it is the stage where the
 * next move belongs to someone else, which is the same distinction
 * `lib/waiting.ts` is built on.
 */
export const STAGE_ACTION: Record<Stage, string> = {
  idea: 'Decide if it is worth making',
  script: 'Write it',
  shoot: 'Film or record it',
  edit: 'Cut it together',
  // Deliberately neutral about WHO: a review can be yours. When a client has
  // actually been asked, the piece shows the real line instead.
  review: 'Waiting on a look',
  scheduled: 'Nothing — it is set',
  published: 'Nothing — it is out',
};

/**
 * Is the next move someone else's?
 *
 * THIS IS NOT THE STAGE. `review` says a piece is being looked at; it does not
 * say by whom, and most reviews are your own — you still have to watch it. A
 * stage-only rule would fill "waiting on others" with your own homework, which
 * is exactly the mistake `lib/waiting.ts` refuses to make with a `pending`
 * client request.
 *
 * What makes it someone else's move is a real, outstanding ASK: an `approvals`
 * row that a client has not answered.
 */
export function isAwaitingClient(piece: Piece): boolean {
  return piece.approval?.status === 'awaiting';
}

/** The client answered and wants changes — back to you, and urgently. */
export function needsChanges(piece: Piece): boolean {
  return piece.approval?.status === 'changes_requested';
}

/** Stages where the work itself is finished. */
export function isSettled(stage: Stage): boolean {
  return stage === 'scheduled' || stage === 'published';
}

/** What kind of thing it is. */
export const FORMATS = ['video', 'short', 'post', 'carousel', 'newsletter', 'article', 'podcast'] as const;
export type Format = typeof FORMATS[number];
const FORMAT_SET: ReadonlySet<string> = new Set(FORMATS);

export const FORMAT_LABEL: Record<Format, string> = {
  video: 'Video', short: 'Short', post: 'Post', carousel: 'Carousel',
  newsletter: 'Newsletter', article: 'Article', podcast: 'Podcast',
};

/**
 * Where it goes out. FREE TEXT with suggestions, not an enum — a creator's
 * channels are theirs, and an enum here would be a list we are always one
 * platform behind on.
 */
export const CHANNEL_SUGGESTIONS = ['YouTube', 'Instagram', 'TikTok', 'LinkedIn', 'X', 'Newsletter', 'Blog'];

/**
 * The pipeline fields. Both dates are real and different: `shootAt` is when it
 * gets CAPTURED and `publishAt` is when it goes OUT, and the whole reason a
 * creator keeps a spreadsheet is that those two calendars have to agree.
 */
/**
 * WHICH SHELF a row sits on — and this is a distinction, not a flag.
 *
 * The user's ask: "a creator should be able to dump anything into one place —
 * a screenshot, a YouTube link, a random thought — then later organize it into
 * Ideas, Inspiration, References, or Content."
 *
 * So the inbox is explicitly a STAGING AREA, and that rules out the obvious
 * shortcut of filing every capture at `stage: 'idea'`. `idea` already means
 * something specific: "I intend to make this." A competitor's reel you saved to
 * study is not an idea, and filing it as one fills the pipeline with work
 * nobody chose — the same failure the project close-out avoids by pre-selecting
 * nothing. An unsorted capture has NO stage yet; that is what makes it unsorted.
 *
 *   inbox     — dumped, not yet triaged. No stage claim.
 *   piece     — content I am making. The pipeline. THE DEFAULT, so every row
 *               written before this existed keeps behaving exactly as it did.
 *   reference — someone else's work, kept to learn from. Never gets a stage.
 */
export const BUCKETS = ['inbox', 'piece', 'reference'] as const;
export type Bucket = typeof BUCKETS[number];
const BUCKET_SET: ReadonlySet<string> = new Set(BUCKETS);

export type ContentMeta = {
  stage: Stage;
  /** Which shelf. Absent ⇒ `piece`, so existing rows are untouched. */
  bucket: Bucket;
  format?: Format;
  channel?: string;
  /** ISO date (YYYY-MM-DD). The content calendar reads this. */
  publishAt?: string;
  /** ISO date (YYYY-MM-DD). The shoot plan reads this. */
  shootAt?: string;
  /** The angle, in one line — what makes this worth watching. */
  hook?: string;
  /**
   * Where it gets shot. Lives on the PIECE, not on a shoot day, and that is the
   * correct shape rather than a compromise: two pieces filmed the same day in
   * two places is a real Tuesday, not a conflict to resolve.
   */
  location?: string;
  /** When to be there — "09:30". A shoot day's one time. */
  callTime?: string;
  /**
   * Where a capture came from. Rendered as a link, so it is USER INPUT reaching
   * an href — it must pass `safeHref` at the render site (lib/safe-url.ts).
   * Stored raw; sanitised on the way out, never on the way in, so a rule change
   * applies to everything already saved.
   */
  sourceUrl?: string;
  /** Who made the thing you saved. Free text — a handle, a name, a channel. */
  sourceAuthor?: string;
  /** WHY you kept it. The one field that makes a bookmark worth having later. */
  note?: string;
  /**
   * Where a piece WENT OUT — the video, the post, the issue. The published piece's
   * own address in the world, so the Library can show it the way it looks there
   * and open it. User input reaching an href, exactly like `sourceUrl`: stored
   * raw, `safeHref` at the render site.
   */
  liveUrl?: string;
  /**
   * A PICTURE the capture is — a screenshot pasted or an image dropped into the
   * inbox. Stored as `attachment:<id>`, the reference covers use (lib/covers.ts):
   * the bytes live in the private bucket and every read mints a fresh signed URL.
   * Nothing else is accepted, so a data-URL can never grow the content JSON.
   */
  image?: string;
  /**
   * What a linked page said about itself, REMEMBERED on the row the first time it
   * was fetched — so the Library draws its cards on the next visit without asking
   * `/api/unfurl` once per card, and a platform that refuses a scraper today does
   * not blank a card it described yesterday. Keyed to the URL it describes: edit
   * the link and it no longer applies. See `LinkPreview`.
   */
  preview?: LinkPreview;
  /**
   * The piece this one was cut from — a `pages.id`.
   *
   * A FACT ABOUT THE PIPELINE, so it lives here rather than as a `mentions`
   * edge. A mention is untyped: it can say two pages are related, but not that
   * one is the SOURCE and the other the cut, so "what came out of this video"
   * and "what happens to mention it" become the same query. One home; the
   * Connected projection can read this field the same way it reads any other
   * ([[lib/connected.ts]] is the one projection).
   */
  derivedFrom?: string;
};

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isClock = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Read the pipeline out of a page's stored content.
 *
 * EVERY FIELD IS NORMALISED, because this is a JSON-persisted enum: a stage
 * saved before a rename, or hand-edited, must not put a card in a column that
 * does not exist (lib/properties.ts learned this the hard way). Unknown stage ⇒
 * `idea`, which is the only stage that claims nothing.
 */
export function readContent(content: unknown): ContentMeta {
  const root = (content && typeof content === 'object' && !Array.isArray(content) ? content : {}) as Record<string, unknown>;
  const o = (root.pipeline && typeof root.pipeline === 'object' && !Array.isArray(root.pipeline)
    ? root.pipeline : {}) as Record<string, unknown>;
  const stage = typeof o.stage === 'string' && STAGE_SET.has(o.stage) ? (o.stage as Stage) : 'idea';
  const format = typeof o.format === 'string' && FORMAT_SET.has(o.format) ? (o.format as Format) : undefined;
  // Absent or unrecognised ⇒ `piece`. Every row written before the inbox
  // existed is a piece, and must keep appearing on the board it is already on.
  const bucket = typeof o.bucket === 'string' && BUCKET_SET.has(o.bucket) ? (o.bucket as Bucket) : 'piece';
  return {
    stage,
    bucket,
    format,
    channel: str(o.channel),
    publishAt: isDay(o.publishAt) ? o.publishAt : undefined,
    shootAt: isDay(o.shootAt) ? o.shootAt : undefined,
    hook: str(o.hook),
    location: str(o.location),
    callTime: isClock(o.callTime) ? o.callTime : undefined,
    sourceUrl: str(o.sourceUrl),
    sourceAuthor: str(o.sourceAuthor),
    note: str(o.note),
    liveUrl: str(o.liveUrl),
    image: coverAttachmentId(str(o.image)) ? str(o.image) : undefined,
    preview: readPreview(o.preview),
    derivedFrom: str(o.derivedFrom),
  };
}

/** The half of a page's content JSON this module owns. Merged, never replacing. */
export function writeContent(meta: ContentMeta): { pipeline: ContentMeta } {
  const out: ContentMeta = { stage: meta.stage, bucket: meta.bucket };
  if (meta.format) out.format = meta.format;
  if (meta.channel) out.channel = meta.channel;
  if (meta.publishAt) out.publishAt = meta.publishAt;
  if (meta.shootAt) out.shootAt = meta.shootAt;
  if (meta.hook) out.hook = meta.hook;
  if (meta.location) out.location = meta.location;
  if (meta.callTime) out.callTime = meta.callTime;
  if (meta.sourceUrl) out.sourceUrl = meta.sourceUrl;
  if (meta.sourceAuthor) out.sourceAuthor = meta.sourceAuthor;
  if (meta.note) out.note = meta.note;
  if (meta.liveUrl) out.liveUrl = meta.liveUrl;
  if (meta.image) out.image = meta.image;
  if (meta.preview) out.preview = meta.preview;
  if (meta.derivedFrom) out.derivedFrom = meta.derivedFrom;
  return { pipeline: out };
}

/**
 * The row a capture becomes — THE rule for "a thought caught, not yet a piece".
 *
 * No stage claim (`idea` is the type's floor) and `bucket: 'inbox'`, which is
 * what actually says nobody has triaged it yet. Shared by the app's own
 * capture (`captureToInbox`) and the MCP `capture` tool, which used to copy
 * this shape inline — and a copy is where two entry points quietly start
 * disagreeing about what an untriaged idea is.
 */
export function inboxCapture(input: {
  userId: string;
  spaceId: string;
  title: string;
  sourceUrl?: string;
  note?: string;
}) {
  const meta: ContentMeta = {
    stage: 'idea',
    bucket: 'inbox',
    sourceUrl: input.sourceUrl?.trim() || undefined,
    note: input.note?.trim() || undefined,
  };
  return {
    user_id: input.userId,
    space_id: input.spaceId,
    type: 'content' as const,
    title: input.title,
    content: { blocks: [], ...writeContent(meta) },
  };
}

/** The client's sign-off on a piece — an `approvals` row (0019), unchanged. */
export type PieceApproval = {
  id: string;
  status: 'awaiting' | 'approved' | 'changes_requested';
  /** The client's note when they asked for changes. */
  note?: string;
  createdAt?: string;
};

export type Piece = {
  id: string;
  title: string | null;
  meta: ContentMeta;
  /** `pages.project_id`. A piece needs one before a client can be asked to sign off. */
  projectId?: string | null;
  approval?: PieceApproval;
  /**
   * The day the row was made, in the person's own timezone (`isoDateIn`, never a
   * sliced UTC timestamp). For a saved link, that is when it was kept — the date
   * the Library files it under.
   */
  createdOn?: string;
  /**
   * CLIENT-ONLY: an object URL for a picture still uploading, so a capture shows
   * its image the instant it is dropped. Never persisted and never sent by the
   * server; the stored `meta.image` takes over once the upload lands.
   */
  localImage?: string;
};

/**
 * Is this piece late?
 *
 * Late means a publish date that has PASSED while the piece is still being
 * made. A published piece is never late — it went out, whenever that was. A
 * scheduled one is not late either: the date is the plan, and the plan has not
 * failed until the thing that publishes it does.
 */
export function isLate(meta: ContentMeta, todayISO: string): boolean {
  if (!meta.publishAt || isSettled(meta.stage)) return false;
  return meta.publishAt < todayISO;
}

/**
 * Split one line of capture into a title and a link.
 *
 * The user's examples are deliberately mixed — "make a post about AI agents", a
 * YouTube link, a tweet, a random thought — and a box that produced a row
 * literally titled `https://www.youtube.com/watch?v=...` would make the inbox
 * unreadable at exactly the moment it fills up. So:
 *
 *   a bare URL          → the link, titled by its host and last path segment
 *   text + a URL        → the text is the title, the URL is the source
 *   text only           → the title
 *
 * Only `http(s)` is recognised. This is a TITLE decision, not a security one —
 * the stored URL still passes `safeHref` at render — but there is no reason for
 * a `javascript:` string to earn a prettier title than it deserves.
 */
export function parseCapture(raw: string): { title: string; sourceUrl?: string } {
  const text = raw.trim();
  if (!text) return { title: '' };
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return { title: text };

  const url = match[0];
  const rest = (text.slice(0, match.index) + text.slice(match.index! + url.length)).trim();
  if (rest) return { title: rest, sourceUrl: url };

  // A bare link. Name it after where it points, so the row reads as a place.
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const last = u.pathname.split('/').filter(Boolean).pop();
    return { title: last ? `${host}/${last}` : host, sourceUrl: url };
  } catch {
    return { title: url, sourceUrl: url };
  }
}

/**
 * A remembered link preview. Small by construction — every field is capped — and
 * dated, because a page changes and a platform's image address EXPIRES (TikTok's
 * and Instagram's are signed for days, not months).
 */
export type LinkPreview = {
  /** The link this describes. A preview for any other URL does not apply. */
  url: string;
  title?: string;
  /** https only: a page must not pull an insecure image into itself. */
  image?: string;
  siteName?: string;
  author?: string;
  /** The site's own icon — only ever drawn for a site that is not a known platform. */
  favicon?: string;
  /** The day it was fetched (YYYY-MM-DD). */
  at: string;
};

/** How long a remembered preview is trusted before it is asked for again. */
export const PREVIEW_FRESH_DAYS = 30;

const capped = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? (t.length > max ? t.slice(0, max) : t) : undefined;
};
const httpsUrl = (v: unknown): string | undefined => {
  const t = capped(v, 2048);
  return t && /^https:\/\/[^\s]+$/i.test(t) ? t : undefined;
};

/**
 * A preview as it may be stored — everything capped, the image https-only, and
 * nothing at all unless it names its URL, a real day, and something to show.
 * It is written from the browser, so the READER is the guard (the same rule as
 * every other JSON enum in this file).
 */
export function readPreview(raw: unknown): LinkPreview | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const url = capped(o.url, 2048);
  const at = typeof o.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.at) ? o.at : undefined;
  if (!url || !at) return undefined;
  const preview: LinkPreview = { url, at };
  const title = capped(o.title, 300); if (title) preview.title = title;
  const image = httpsUrl(o.image); if (image) preview.image = image;
  const siteName = capped(o.siteName, 80); if (siteName) preview.siteName = siteName;
  const author = capped(o.author, 120); if (author) preview.author = author;
  const favicon = httpsUrl(o.favicon); if (favicon) preview.favicon = favicon;
  return preview.title || preview.image ? preview : undefined;
}

/** The preview to remember from freshly fetched metadata, or undefined when it says nothing. */
export function previewFrom(meta: { title?: string; image?: string; siteName?: string; author?: string; favicon?: string } | null | undefined, url: string, todayISO: string): LinkPreview | undefined {
  return meta ? readPreview({ url, at: todayISO, title: meta.title, image: meta.image, siteName: meta.siteName, author: meta.author, favicon: meta.favicon }) : undefined;
}

/**
 * The remembered preview for THIS link, if it is still worth trusting — for the
 * same URL, and fetched within `PREVIEW_FRESH_DAYS`. Anything else means ask again.
 */
export function freshPreview(meta: Pick<ContentMeta, 'preview'>, url: string | undefined, todayISO: string): LinkPreview | undefined {
  const p = meta.preview;
  if (!p || !url || p.url !== url) return undefined;
  const age = (Date.parse(`${todayISO}T00:00:00Z`) - Date.parse(`${p.at}T00:00:00Z`)) / 86400000;
  return age >= 0 && age <= PREVIEW_FRESH_DAYS ? p : undefined;
}

/**
 * The name an IMAGE capture gets.
 *
 * What you typed wins, exactly as for a link — a URL in it becomes the source.
 * Otherwise the file's own name, which for a dropped file is usually one someone
 * chose ("nike_ad-frame_03.png" → "nike ad frame 03"). Some names say nothing:
 * the clipboard calls every image "image.png", a phone "IMG_1234", a camera a
 * string of digits. Those, and the OS's own screenshot names, become a label
 * with the moment it was captured, because that is the one fact they carry.
 * `when` is formatted by the caller — dates are lib/date.ts's job.
 */
export function imageCaptureTitle(fileName: string, typed: string, when: string): { title: string; sourceUrl?: string } {
  if (typed.trim()) return parseCapture(typed);
  const stem = fileName.replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(screen ?shot|screen capture|capture)\b/i.test(stem)) return { title: `Screenshot from ${when}` };
  const says_nothing = !stem
    || /^(image|img|photo|picture|pasted|clipboard|untitled|file)(\s*\d*)?$/i.test(stem)
    || /^[\d\s.]+$/.test(stem);
  return { title: says_nothing ? `Image from ${when}` : stem };
}

/**
 * THE GATE. Everything below answers a question about work I am MAKING, so
 * everything below filters through here first.
 *
 * This is deliberately repeated at each selector rather than done once at the
 * loader. The loader is one call site and the selectors are many, and the
 * failure it prevents is silent and expensive: a screenshot someone dumped at
 * 2am showing up as a card in the `Idea` column, or worse, on a calendar day as
 * though it were going out. A capture is not a commitment until someone says so.
 */
export function onlyPieces(rows: Piece[]): Piece[] {
  return rows.filter((p) => p.meta.bucket === 'piece');
}

/** The untriaged pile — newest first is wrong here; keep the given order. */
export function inbox(rows: Piece[]): Piece[] {
  return rows.filter((p) => p.meta.bucket === 'inbox');
}

/** Saved work by other people, kept to learn from. */
export function references(rows: Piece[]): Piece[] {
  return rows.filter((p) => p.meta.bucket === 'reference');
}

// ── WHICH STAGES A FORMAT ACTUALLY PASSES THROUGH ───────────────────────────
//
// The pipeline was written for video, and every format was made to walk it.
// Measured on a board of posts and carousels: **three consecutive dead
// columns** — Draft, Shoot, Edit — each showing "Nothing here yet" AND a
// "+ New idea" button, pushing the six real pieces off screen. A creator who
// writes rather than films spent most of their board looking at work they can
// never do, invited to start more of it.
//
// So a format declares what it SKIPS, rather than each listing a full path:
// adding an eighth stage later then means editing one line, not seven.
//
//   post       a text post is written and posted. No production step at all.
//   carousel   skips the shoot; `edit` is where the slides get designed.
//   article    written and edited, never filmed.
//   newsletter the same.
//   video / short / podcast   the full path — a podcast's "shoot" is its
//              recording session, which is the same day-planning problem
//              (`shootAt`, the call sheet) under a different word.
//
// A piece with NO format walks the full path: not knowing is not the same as
// knowing it skips something, and hiding a stage from a piece that might need
// it is the worse mistake.
const STAGE_SKIPS: Partial<Record<Format, readonly Stage[]>> = {
  post: ['shoot', 'edit'],
  carousel: ['shoot'],
  article: ['shoot'],
  newsletter: ['shoot'],
};

/** The path this format takes, in pipeline order. */
export function stagesFor(format: Format | undefined | null): Stage[] {
  const skip = format ? STAGE_SKIPS[format] : undefined;
  return skip ? STAGES.filter((s) => !skip.includes(s)) : [...STAGES];
}

/** Can a piece of this format be in this stage at all? */
export function stageApplies(format: Format | undefined | null, stage: Stage): boolean {
  return stagesFor(format).includes(stage);
}

/**
 * The columns a board should show, given what is actually on it.
 *
 * Two rules, and the second is the safety net:
 *
 *   1. A stage shows if any format PRESENT can reach it. Make only posts and
 *      the shoot column never appears; add one video and it does. The set
 *      changes when you take on a new KIND of work, which is rare and means
 *      something — not every time a card moves.
 *   2. A stage shows if a piece is IN it, whatever its format. Without this, a
 *      video sitting in Shoot would vanish the moment its format was changed
 *      to `post`, taking the card off the board with no way to get it back. A
 *      column may be irrelevant; a hidden card is lost work.
 *
 * An empty board falls back to the full path, because a board with no columns
 * is not a board.
 */
export function boardStages(rows: Piece[]): Stage[] {
  const only = onlyPieces(rows);
  if (!only.length) return [...STAGES];
  const show = new Set<Stage>();
  for (const p of only) {
    for (const s of stagesFor(p.meta.format)) show.add(s);   // rule 1
    show.add(p.meta.stage);                                  // rule 2
  }
  return STAGES.filter((s) => show.has(s));
}

/**
 * How many published pieces the board shows.
 *
 * `published` is the one TERMINAL column: nothing leaves it, so over a year it
 * is the only one that grows without bound — hundreds of cards in a fixed-width
 * column, crowding the six that are actually in flight. What is useful there is
 * "what just went out"; the rest is archive, and the archive is the Library
 * (`libraryItems`).
 */
export const PUBLISHED_ON_BOARD = 5;

/**
 * Board columns, in pipeline order, each with its pieces in date order.
 *
 * The columns come from `boardStages`, not from `STAGES`: a board of posts and
 * carousels has no shoot to do, and showing the column anyway put three dead
 * placeholders where the work should be.
 */
export function board(rows: Piece[]): { stage: Stage; label: string; pieces: Piece[]; hidden: number }[] {
  const only = onlyPieces(rows);
  return boardStages(rows).map((stage) => {
    // A QUEUE IS ASCENDING; AN ARCHIVE IS DESCENDING, and `published` is an
    // archive. Sorting it soonest-first put the OLDEST thing you ever released
    // at the top of the column and buried this week's at the bottom — the one
    // column where the newest is what you want to see.
    const done = stage === 'published';
    const all = only
      .filter((p) => p.meta.stage === stage)
      .sort((a, b) => {
        const x = a.meta.publishAt, y = b.meta.publishAt;
        // Dated work first, because a column is a queue and undated pieces have
        // no place in it — they keep their given order after it rather than
        // being scattered through it by a date they do not have.
        if (x && y) return (x < y ? -1 : x > y ? 1 : 0) * (done ? -1 : 1);
        return x ? -1 : y ? 1 : 0;
      });
    return {
      stage,
      label: STAGE_LABEL[stage],
      hidden: done ? Math.max(0, all.length - PUBLISHED_ON_BOARD) : 0,
      pieces: done ? all.slice(0, PUBLISHED_ON_BOARD) : all,
    };
  });
}

/**
 * WHERE A DRAGGED CARD WILL LAND — the index it would take in `stage`'s column,
 * or `null` if that column would not show it.
 *
 * A content column is a QUEUE SORTED BY DATE, with no manual order: dropping a
 * card decides its STAGE, and the publish date decides where in the column it
 * sits. That is the whole reason this function exists. Notion's board draws an
 * insertion line under the cursor because in Notion you really are choosing the
 * position; drawing one here would promise a choice the model does not offer —
 * you would aim at the bottom of a column and the card would appear at the top.
 * So the board shows a placeholder at the index the DATE gives it, and this is
 * that index.
 *
 * It asks `board()` with the move already applied rather than re-deriving the
 * order. A second comparator would be a second source of truth, and the one
 * thing a landing marker must never do is disagree with where the card actually
 * lands. It also inherits the `published` cap for free: a piece that sorts past
 * `PUBLISHED_ON_BOARD` is not in the column's `pieces`, so the answer is `null`
 * and the board tints the column without promising a slot.
 */
export function landingIndex(rows: Piece[], pieceId: string, stage: Stage): number | null {
  const moved = rows.map((p) => (p.id === pieceId ? { ...p, meta: { ...p.meta, stage } } : p));
  const column = board(moved).find((c) => c.stage === stage);
  if (!column) return null;
  const at = column.pieces.findIndex((p) => p.id === pieceId);
  return at === -1 ? null : at;
}

/**
 * The day a phone-width calendar opens its agenda on.
 *
 * On a phone the month grid cannot hold a title — measured at 375px, every chip
 * was cut to 15px of text, "A…", "Fi…" — so the grid shows dots and the day's
 * entries are listed below it, the way Apple and Google Calendar do. That list
 * has to start SOMEWHERE, and the choice decides whether it is useful before
 * anyone taps:
 *
 *  1. **Today**, when today is in the month on screen — the question you
 *     opened a calendar to answer.
 *  2. Otherwise **the first day in that month with something on it** — walking
 *     to another month and landing on an empty list would make the month look
 *     empty when it is not.
 *  3. Otherwise **the 1st** — a genuinely empty month still gets a real day.
 *
 * `inMonth` is the month's own days in order; the grid's leading and trailing
 * days from neighbouring months never qualify, since they belong to another
 * month's agenda.
 */
export function agendaDay(inMonth: readonly string[], hasEntries: (iso: string) => boolean, todayISO: string): string | null {
  if (inMonth.length === 0) return null;
  if (inMonth.includes(todayISO)) return todayISO;
  return inMonth.find(hasEntries) ?? inMonth[0];
}

/**
 * The content calendar: pieces by day.
 *
 * A piece appears on its PUBLISH day and, separately, on its SHOOT day — one
 * object, two appointments. Collapsing them to one date is exactly the mistake
 * the spreadsheet makes: you find out you scheduled a shoot for the morning it
 * was supposed to go out.
 */
export type CalendarEntry = { piece: Piece; kind: 'publish' | 'shoot' };

export function byDay(rows: Piece[]): Map<string, CalendarEntry[]> {
  const days = new Map<string, CalendarEntry[]>();
  const add = (day: string, entry: CalendarEntry) => {
    const list = days.get(day) ?? [];
    list.push(entry);
    days.set(day, list);
  };
  for (const piece of onlyPieces(rows)) {
    if (piece.meta.shootAt) add(piece.meta.shootAt, { piece, kind: 'shoot' });
    if (piece.meta.publishAt) add(piece.meta.publishAt, { piece, kind: 'publish' });
  }
  // A shoot comes before a publish on a day that holds both: you cannot post it
  // before you have made it, so that is the order the day actually happens in.
  for (const list of days.values()) {
    list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'shoot' ? -1 : 1));
  }
  return days;
}

/** "8 in progress · 2 late · 1 needs changes" — or null when there is nothing. */
/**
 * NO CURRENT CONSUMER, and that is deliberate rather than rot.
 *
 * This rendered as the Content header's subtitle until 2026-09-12, when the
 * user removed it: `8 in progress · 1 late · 1 needs changes` is prose you
 * cannot act on, and the two numbers that mattered are now the "Needs you"
 * strip, which names the pieces instead of counting them. The rule and its
 * tests are kept because they encode real answers — a capture is not "in
 * progress", a rejected piece is counted once — and because a count may yet
 * earn a home (`PageHeader`'s `count` slot is the obvious one). `librarySummary`
 * below is unsurfaced for the same reason and on the same date.
 */
export function contentSummary(rows: Piece[], todayISO: string): string | null {
  const pieces = onlyPieces(rows);
  if (!pieces.length) return null;
  const parts = [`${pieces.filter((p) => !isSettled(p.meta.stage)).length} in progress`];
  const late = pieces.filter((p) => isLate(p.meta, todayISO)).length;
  if (late) parts.push(`${late} late`);
  // Changes requested outranks everything else that is merely in flight: the
  // client has answered, and the answer was no.
  const changes = pieces.filter(needsChanges).length;
  if (changes) parts.push(`${changes} needs changes`);
  return parts.join(' · ');
}

/**
 * THE NEXT MOVE on one piece, in one line.
 *
 * `STAGE_ACTION` is keyed on the stage alone, and its own note admits the hole
 * that leaves: `review` resolves to "Waiting on a look" whether or not anyone
 * has actually been asked. So a piece whose client has come back asking for
 * changes — the move now firmly yours — was being told to wait for a look it
 * has already had. Seen on screen 2026-09-12 with a `Changes` badge sitting
 * directly beside the words "Waiting on a look", in the same sentence, each
 * contradicting the other.
 *
 * The next move depends on the approval as well as the stage, so the rule has
 * to see both. It lives here, once, because the strip on the board and the
 * detail panel were both reading the raw map and both got it wrong.
 *
 * The client's own words are preferred when there are any: "cut the intro to
 * 10s" is a better instruction than any sentence we could compose, and it is
 * the note they took the trouble to write.
 */
export function nextAction(piece: Piece): string {
  if (needsChanges(piece)) {
    const note = piece.approval?.note?.trim();
    return note || 'Make the changes they asked for';
  }
  if (isAwaitingClient(piece)) return 'Waiting on your client';
  return STAGE_ACTION[piece.meta.stage];
}

/**
 * ── WHAT NEEDS YOU ──────────────────────────────────────────────────────────
 *
 * The pieces whose next move is YOURS and has started to slip.
 *
 * This is the exact mirror of `lib/waiting.ts`, and it keeps that module's one
 * hard rule: **whose move is it?** `waitingOn` lists what you cannot act on, so
 * it must never fill up with your own homework; this lists what you can, so it
 * must never fill up with someone else's. A piece sitting with a client is
 * therefore ABSENT here even though it is unfinished and even though it is
 * late — chasing is a different act from making, and putting it in this list
 * would tell you to go and do a thing you cannot do.
 *
 * Two reasons qualify, in this order:
 *
 *  1. **Changes requested.** The client answered, and the answer was no. That
 *     hands the move back to you no matter what stage the piece is in, which is
 *     why it outranks a date.
 *  2. **Late.** A publish date that has passed while the piece is still being
 *     made — `isLate`'s definition, which already excludes scheduled and
 *     published work.
 *
 * WHY IT IS NOT SIMPLY "everything unfinished": because `contentSummary` says
 * "10 in progress" and ten things is not a list of what to do today. The whole
 * value of this function is that it is usually SHORT and often empty, and an
 * empty one is real information — nothing is slipping. Its surface renders
 * nothing at all in that case, the same way the waiting-on panel does.
 */
export type NeedsYou = {
  piece: Piece;
  /** Why it needs you — the card shows this, so there is no unexplained urgency. */
  reason: 'changes' | 'late';
  /** How many days past its publish date, for ordering and for the label. */
  daysLate: number;
};

export function needsYou(rows: Piece[], todayISO: string): NeedsYou[] {
  const out: NeedsYou[] = [];
  for (const piece of onlyPieces(rows)) {
    // Someone else's move is someone else's move, even when it is overdue.
    if (isAwaitingClient(piece)) continue;
    const late = isLate(piece.meta, todayISO);
    const changes = needsChanges(piece);
    if (!late && !changes) continue;
    out.push({
      piece,
      reason: changes ? 'changes' : 'late',
      daysLate: late ? daysBetweenDays(piece.meta.publishAt!, todayISO) : 0,
    });
  }
  // Changes first (a person is waiting on the answer), then the most overdue.
  return out.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'changes' ? -1 : 1;
    return b.daysLate - a.daysLate;
  });
}

/**
 * Whole days from one day-id to another. Both are `YYYY-MM-DD`, so this is
 * calendar arithmetic and must not go near a local `Date` — parsing a day-id as
 * a date is how a day becomes the day before in a western timezone
 * (see zenboard-day-ids).
 */
function daysBetweenDays(from: string, to: string): number {
  const ms = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
    - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  return Math.round(ms / 86400000);
}

// ── The shoot day ────────────────────────────────────────────────────────────
//
// A SHOOT DAY IS A DATE, not an object. Every piece carrying that `shootAt` is
// on it, and that is the whole grouping — there is nothing to create, nothing to
// keep in sync, and no way to be filming something that is not on the call
// sheet. The question a creator actually asks on Tuesday morning is "what am I
// filming today", and a date answers it without anyone having built a shoot.

/** A SHOT is a to-do line in the script. */
export type Shot = { blockId: string; text: string; done: boolean };

/** What the shot list needs from a block. Structural, so any block type fits. */
type ShotBlock = { id: string; type: string; text?: string; checked?: boolean };

/**
 * The shots in a script.
 *
 * THE SAME `[ ]` CONTRACT the rest of the app already uses: a to-do block is a
 * to-do block whether you typed it in a meeting note or a script, so nobody
 * learns a second way to write a checklist and — the plan's own law — nothing is
 * entered twice. You write "cutaway of the desk" once, in the script, and it is
 * the thing you tick on set.
 */
export function shotsOf(blocks: readonly ShotBlock[] | null | undefined): Shot[] {
  if (!blocks?.length) return [];
  return blocks
    .filter((b) => b.type === 'todo' && (b.text ?? '').trim())
    .map((b) => ({ blockId: b.id, text: (b.text ?? '').trim(), done: !!b.checked }));
}

/** Every piece being shot on one day, in call-time order then title order. */
export function shootDay(rows: Piece[], iso: string): Piece[] {
  return onlyPieces(rows)
    .filter((p) => p.meta.shootAt === iso)
    .sort((a, b) => {
      // A timed piece leads an untimed one: the call time is the reason to be
      // somewhere at an hour, and a list that buries it is a list you re-sort
      // by hand every morning.
      const x = a.meta.callTime, y = b.meta.callTime;
      if (x && y && x !== y) return x < y ? -1 : 1;
      if (x !== y) return x ? -1 : 1;
      return (a.title ?? '').localeCompare(b.title ?? '');
    });
}

/** The distinct places a day sends you, in the order the pieces run. */
export function shootLocations(pieces: Piece[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pieces) {
    const loc = p.meta.location;
    if (!loc || seen.has(loc)) continue;
    seen.add(loc);
    out.push(loc);
  }
  return out;
}

/** "3 pieces · 12 shots · 4 done", or null when the day is empty. */
export function shootSummary(pieces: Piece[], shots: Shot[]): string | null {
  if (!pieces.length) return null;
  const parts = [`${pieces.length} piece${pieces.length === 1 ? '' : 's'}`];
  if (shots.length) {
    parts.push(`${shots.length} shot${shots.length === 1 ? '' : 's'}`);
    const done = shots.filter((s) => s.done).length;
    if (done) parts.push(`${done} done`);
  }
  return parts.join(' · ');
}

// ── Today ────────────────────────────────────────────────────────────────────

/**
 * What content today holds.
 *
 * Reuses `byDay` rather than re-deriving the answer: the calendar and Home must
 * agree about what is happening on a date, and two implementations of "what is
 * on this day" is how they stop agreeing. Shoots lead publishes here for the
 * same reason they do in the grid — you cannot post it before you have made it.
 */
export function contentToday(pieces: Piece[], todayISO: string): CalendarEntry[] {
  return byDay(pieces).get(todayISO) ?? [];
}

/**
 * The one line Home puts above them — "Filming at 09:00 · 2 going out", or null
 * when nothing is happening, so the section can be ABSENT rather than empty.
 */
export function contentTodaySummary(entries: CalendarEntry[]): string | null {
  if (!entries.length) return null;
  const shoots = entries.filter((e) => e.kind === 'shoot');
  const parts: string[] = [];
  if (shoots.length) {
    // The earliest call time is the only number that changes what you do next;
    // the rest of the day follows from being there.
    const call = shoots.map((e) => e.piece.meta.callTime).filter(Boolean).sort()[0];
    parts.push(call ? `Filming at ${call}` : `Filming ${shoots.length} ${shoots.length === 1 ? 'piece' : 'pieces'}`);
  }
  const out = entries.length - shoots.length;
  if (out) parts.push(`${out} going out`);
  return parts.join(' · ');
}

// ── A finished project becomes content ───────────────────────────────────────
//
// PRODUCT_CONTEXT §15: `completed branding project → case study → reel →
// LinkedIn post → X post`. This is the connection that turns client work into
// the studio's own marketing, and it is the one a studio reliably fails to make
// — not because it is hard, but because the moment passes. Three months later
// the project is cold and the blank page wins.
//
// So the offer belongs at the CLOSE-OUT, where the work is freshest, and it has
// to arrive carrying the facts: which project, which client, what it is called.
// Re-typing those is exactly the re-entry §25 calls a defect.
//
// WHAT IS SEEDED IS ONLY WHAT IS TRUE. The title is the project's own name and
// the scaffold is three headings — structure, not claims. Nothing writes a hook
// or a description on the user's behalf: an invented line about work it has
// never seen is the thing that makes a product feel generated.

export type ProjectContentPreset = {
  id: string;
  label: string;
  /** What it becomes in the pipeline. */
  format: Format;
  channel: string;
  /** True only for the long piece the others are cut from. */
  scaffold?: boolean;
};

export const PROJECT_CONTENT_PRESETS: ProjectContentPreset[] = [
  { id: 'case-study', label: 'Case study', format: 'article', channel: 'Blog', scaffold: true },
  { id: 'reel', label: 'Reel', format: 'short', channel: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn post', format: 'post', channel: 'LinkedIn' },
  { id: 'x', label: 'X post', format: 'post', channel: 'X' },
];

/** The case study's skeleton — the three questions every one of them answers. */
export const CASE_STUDY_SECTIONS = ['The brief', 'What we did', 'The result'];

export type NewPiece = {
  title: string;
  meta: ContentMeta;
  /** Heading texts for the body, empty for the short forms. */
  sections: string[];
};

/**
 * What to create from a finished project.
 *
 * Every piece starts at `idea`, never further along: the project is done, the
 * content is not, and a pipeline that starts things half-written lies about
 * where the work is.
 */
export function contentFromProject(projectName: string, presetIds: string[]): NewPiece[] {
  const name = projectName.trim() || 'Untitled project';
  return PROJECT_CONTENT_PRESETS
    .filter((p) => presetIds.includes(p.id))
    .map((p) => ({
      title: `${name} — ${p.label.toLowerCase()}`,
      // A piece born from a finished project is a PIECE, not a capture:
      // the user picked it in the close-out, so it is already a decision.
      meta: { stage: 'idea' as Stage, bucket: 'piece' as Bucket, format: p.format, channel: p.channel },
      sections: p.scaffold ? CASE_STUDY_SECTIONS : [],
    }));
}

// ── The brief ────────────────────────────────────────────────────────────────
//
// A brief is PROSE, so it lives in the page's blocks — not in ten more JSON
// fields. That is the house pattern already (a proposal is a doc with special
// blocks; the project close-out seeds headings, never a record), and here it
// earns its keep twice over: the brief inherits comments and @-mentions for
// free, so a collaborator can argue with the objective in the place the
// objective is written, which is the whole of "approval & collaboration" for
// this surface.
//
// WHAT IS DELIBERATELY NOT A SECTION, and this is the part worth defending:
//
//   Topic     — that is the TITLE.
//   Hook      — already `meta.hook`, and it is shown beside the piece.
//   Format    — already `meta.format`.
//   Platform  — already `meta.channel`.
//
// All four were in the ask, and all four are already FACTS about the piece. A
// fact copied into prose is a fact with two homes, and two homes is how the
// board ends up saying "carousel" while the brief says "reel". References are
// the same argument one step further: a reference is a real row in the inbox's
// `reference` bucket, so the brief LINKS to it rather than restating the URL.
//
// What is left is the five questions that actually change the work.
export const BRIEF_SECTIONS = [
  { heading: 'Objective', prompt: 'What should this piece achieve?' },
  { heading: 'Audience', prompt: 'Who is it for, and what do they already know?' },
  { heading: 'Key message', prompt: 'The one thing they should remember.' },
  { heading: 'Call to action', prompt: 'What do they do next?' },
  { heading: 'Creative direction', prompt: 'Tone, look, pacing, references.' },
] as const;

const BRIEF_HEADINGS: readonly string[] = BRIEF_SECTIONS.map((s) => s.heading);
const isHeading = (b: { type: string }) => b.type === 'h1' || b.type === 'h2' || b.type === 'h3';
const normalise = (s: string) => s.trim().toLowerCase();

export type BriefBlock = { id?: string; type: string; text?: string };

export type BriefState = {
  /** Has the brief been started at all? */
  present: boolean;
  /** Section headings that carry at least one non-empty line under them. */
  answered: string[];
  /** Section headings present but still blank. */
  blank: string[];
  total: number;
};

/**
 * Read the brief out of a page's blocks.
 *
 * A section counts as ANSWERED only when something is written under it. A
 * heading with nothing beneath it is the most common state of a seeded template
 * and reporting it as done would make the indicator a decoration.
 */
export function briefOf(blocks: readonly BriefBlock[] | null | undefined): BriefState {
  const list = blocks ?? [];
  const answered: string[] = [];
  const blank: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (!isHeading(b)) continue;
    const heading = BRIEF_HEADINGS.find((h) => normalise(h) === normalise(b.text ?? ''));
    if (!heading || answered.includes(heading) || blank.includes(heading)) continue;
    // Everything until the next heading of any level belongs to this section.
    let filled = false;
    for (let j = i + 1; j < list.length && !isHeading(list[j]); j++) {
      if ((list[j].text ?? '').trim()) { filled = true; break; }
    }
    (filled ? answered : blank).push(heading);
  }

  return { present: answered.length + blank.length > 0, answered, blank, total: BRIEF_SECTIONS.length };
}

/**
 * The blocks to insert to start a brief — heading + an empty line to type on.
 *
 * IDEMPOTENT, and that is not a nicety: the control that calls this is visible
 * whenever the brief is incomplete, so pressing it twice is the normal case,
 * and a second "Objective" heading is worse than no button at all. Sections
 * already present are skipped, so a half-finished brief is TOPPED UP rather
 * than duplicated.
 *
 * The brief goes at the TOP, above the script. You read it before you write.
 */
export function seedBrief<T extends BriefBlock>(
  blocks: readonly T[] | null | undefined,
  make: (type: 'h2' | 'text', text: string) => T,
): T[] {
  const list = [...(blocks ?? [])];
  const state = briefOf(list);
  const have = new Set([...state.answered, ...state.blank].map(normalise));
  const add: T[] = [];
  for (const section of BRIEF_SECTIONS) {
    if (have.has(normalise(section.heading))) continue;
    add.push(make('h2', section.heading), make('text', ''));
  }
  return add.length ? [...add, ...list] : list;
}

// ── Repurposing ──────────────────────────────────────────────────────────────
//
// One recording becomes five things. That is not a nice-to-have for a creator —
// it is where most of the leverage in the whole job is, and it is the reason a
// content DATABASE beats a content list: the second piece costs a fraction of
// the first, but only if the material is still attached to it.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
// It does not write the derivative. A button that spawns five blank rows has
// moved the typing, not removed it — and one that INVENTS a hook for a video it
// has never watched is the thing that makes a product feel generated (the same
// argument the project close-out settles: seed STRUCTURE, never claims).
//
// What it removes is the bookkeeping: the format, the project, the client, the
// link back to the source, and the fact that this cut exists at all — five
// things a creator otherwise re-types per derivative and then loses track of.
//
// ── WHY ONLY LONG FORMS ARE SOURCES ─────────────────────────────────────────
// A short IS the atom. "Repurpose this short into a video" is not repurposing,
// it is making a different, larger thing from scratch, and offering it would
// put a control on every card that mostly means nothing. So the affordance
// appears on the four forms that actually carry more material than they spend:
// a recording and a long read.

/** The formats with more material in them than any one cut uses. */
export const REPURPOSE_SOURCES: readonly Format[] = ['video', 'podcast', 'article', 'newsletter'];

/** Can this piece be cut into others? */
export function canRepurpose(meta: Pick<ContentMeta, 'format' | 'bucket'>): boolean {
  // A reference is someone else's work — cutting it up is not your pipeline.
  // A capture has not been decided on yet, so it has nothing to cut.
  if (meta.bucket !== 'piece') return false;
  return !!meta.format && REPURPOSE_SOURCES.includes(meta.format);
}

export type RepurposePreset = {
  id: string;
  label: string;
  format: Format;
  /** Long forms get a skeleton; the short ones get none — see SECTIONS below. */
  scaffold?: boolean;
  /** Formats this cut does NOT make sense from. */
  notFrom?: readonly Format[];
};

/**
 * What a long piece can become.
 *
 * NO CHANNEL, unlike `PROJECT_CONTENT_PRESETS`. Those presets are named for
 * their channel ("LinkedIn post") so the channel is the point; these are named
 * for their FORMAT, and a short might go to Reels, Shorts or TikTok — that is
 * the creator's call and their channels are their own (see CHANNEL_SUGGESTIONS).
 * Guessing it here would put a wrong fact on the card that reads like a right one.
 */
export const REPURPOSE_PRESETS: RepurposePreset[] = [
  { id: 'clip', label: 'Short', format: 'short' },
  { id: 'post', label: 'Post', format: 'post' },
  { id: 'carousel', label: 'Carousel', format: 'carousel' },
  // A write-up of something you recorded. Pointless from something already written.
  { id: 'writeup', label: 'Write-up', format: 'article', scaffold: true, notFrom: ['article', 'newsletter'] },
  { id: 'issue', label: 'Newsletter', format: 'newsletter', scaffold: true, notFrom: ['newsletter'] },
];

/** The write-up's skeleton — structure, not claims. */
export const WRITEUP_SECTIONS = ['What it covers', 'The main point', 'Where to watch'];

/** Which cuts are on offer from this source. Empty ⇒ show no control at all. */
export function repurposeOptions(meta: Pick<ContentMeta, 'format' | 'bucket'>): RepurposePreset[] {
  if (!canRepurpose(meta)) return [];
  const from = meta.format!;
  return REPURPOSE_PRESETS.filter((p) => p.format !== from && !p.notFrom?.includes(from));
}

/**
 * The pieces to create from one source.
 *
 * Each starts at `idea` for the same reason everything else does: the source is
 * finished, the cut is not, and a pipeline that starts things half-written lies
 * about where the work is. `bucket: 'piece'` because the user picked it — a
 * capture is not a commitment, but this was.
 */
export function repurpose(
  source: { id: string; title: string; meta: ContentMeta },
  presetIds: string[],
): NewPiece[] {
  const name = source.title.trim() || 'Untitled';
  const offered = repurposeOptions(source.meta);
  return offered
    .filter((p) => presetIds.includes(p.id))
    .map((p) => ({
      title: `${name} — ${p.label.toLowerCase()}`,
      meta: {
        stage: 'idea' as Stage,
        bucket: 'piece' as Bucket,
        format: p.format,
        derivedFrom: source.id,
      },
      sections: p.scaffold ? WRITEUP_SECTIONS : [],
    }));
}

/** What came out of this piece. */
export function derivativesOf(sourceId: string, rows: Piece[]): Piece[] {
  return rows.filter((r) => r.meta.derivedFrom === sourceId);
}

/** What this piece was cut from, if anything. */
export function sourceOf(piece: Piece, rows: Piece[]): Piece | null {
  const id = piece.meta.derivedFrom;
  if (!id) return null;
  return rows.find((r) => r.id === id) ?? null;
}

/**
 * "3 cuts · 1 published" — what a source has produced.
 *
 * Returns null when nothing has been cut yet: a "0 cuts" badge is not
 * information, it is a reproach (same rule as Waiting and the count chip).
 */
export function repurposeSummary(sourceId: string, rows: Piece[]): string | null {
  const kids = derivativesOf(sourceId, rows);
  if (!kids.length) return null;
  const out = kids.filter((k) => k.meta.stage === 'published').length;
  const cuts = `${kids.length} ${kids.length === 1 ? 'cut' : 'cuts'}`;
  return out ? `${cuts} · ${out} published` : cuts;
}

// ── The library: everything you KEEP ────────────────────────────────────────
//
// Content is three places, each with one job, and the Library is the third:
//
//   Inbox     — what LANDED. Emptied by deciding each thing once.
//   Pipeline  — what you are MAKING.
//   Library   — what you KEEP: other people's work you saved to learn from, and
//               your own work once it is out. One searchable place.
//
// ── WHY SAVED WORK MOVED HERE (2026-09-14) ──────────────────────────────────
// Saved references used to be a second list INSIDE the Inbox, under the pile
// still to sort. Two things with opposite lifecycles on one screen: an inbox
// you are meant to empty could never look empty once you had kept anything, and
// "that reel I saved in June" is not something anyone looks for in an inbox.
// Eden's Library ("everything in this workspace, searchable in one place") and
// Readwise Reader's inbox-then-shelf are the references; the difference kept
// here is that your OWN published work sits beside what you saved, because
// "what did I put out in August" and "what inspired it" are asked together.
//
// ── WHY PUBLISHED IS A VIEW AND NOT A COLUMN ────────────────────────────────
// A board column is a QUEUE: fixed width, sorted by what happens next, sized
// for the handful of things in flight. `published` is none of those — nothing
// leaves it, so it is the one column that grows forever, and "what happens
// next" is not a question you ask about work that is already out.

export const LIBRARY_KINDS = ['saved', 'published'] as const;
export type LibraryKind = typeof LIBRARY_KINDS[number];

export type LibraryItem = {
  piece: Piece;
  kind: LibraryKind;
  /**
   * The day it is filed under: when it went OUT for your own work, when you KEPT
   * it for someone else's. Absent when nobody knows.
   */
  day?: string;
};

/**
 * Everything the Library holds, newest first.
 *
 * Saved references and PUBLISHED pieces only — the pipeline is not kept yet, and
 * an inbox capture has not been kept at all. Undated items are real (an import,
 * something released before anyone tracked dates) and go at the END rather than
 * being dropped or given a guessed date.
 */
export function libraryItems(rows: Piece[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const piece of rows) {
    if (piece.meta.bucket === 'reference') items.push({ piece, kind: 'saved', day: piece.createdOn });
    else if (piece.meta.bucket === 'piece' && piece.meta.stage === 'published') {
      items.push({ piece, kind: 'published', day: piece.meta.publishAt });
    }
  }
  // '' sorts lowest, so a newest-first comparison also puts the undated last.
  return items.sort((a, b) => {
    const x = a.day ?? '', y = b.day ?? '';
    return x < y ? 1 : x > y ? -1 : 0;
  });
}

/** A month of the Library. `key` is `YYYY-MM`, or '' for items with no date. */
export type LibraryMonth = { key: string; items: LibraryItem[] };

/**
 * Items grouped by month, newest month first, the undated group last.
 *
 * Returns the month KEY, never a label: formatting a date is `lib/date.ts`'s
 * job, and a second place that renders months is a second place they can
 * disagree (`formatMonthYear`, and the guard test that keeps it that way).
 */
export function libraryMonths(items: LibraryItem[]): LibraryMonth[] {
  const months = new Map<string, LibraryItem[]>();
  for (const item of items) {
    const key = item.day ? item.day.slice(0, 7) : '';
    const group = months.get(key);
    if (group) group.push(item); else months.set(key, [item]);
  }
  // Insertion order is newest-first when the items were; only the undated group
  // can be out of place, and only if it exists.
  const groups = [...months.entries()].map(([key, grouped]) => ({ key, items: grouped }));
  const undated = groups.findIndex((g) => g.key === '');
  if (undated > -1) groups.push(...groups.splice(undated, 1));
  return groups;
}

const fold = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Does a Library item match what was typed?
 *
 * EVERY word has to appear, somewhere a person would recognise the item by: its
 * title, who made it, WHY it was kept, where it went out, its format, the site
 * it lives on — plus `extra`, for what only the page itself knows (the fetched
 * title of a link that was saved as a bare address). So "nike hook" finds the
 * saved spot whose note says "the hook lands in two seconds". Accents fold, so
 * "cafe" finds "Café".
 */
export function matchesLibrary(item: LibraryItem, query: string, extra: readonly (string | null | undefined)[] = []): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const m = item.piece.meta;
  const url = m.sourceUrl ?? m.liveUrl;
  const hay = fold([
    item.piece.title, m.note, m.sourceAuthor, m.channel, m.format && FORMAT_LABEL[m.format],
    url && hostOf(url), ...extra,
  ].filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

/**
 * Is a title only the address we derived from its link?
 *
 * `parseCapture` names a bare link after its host and last path segment
 * ("youtube.com/watch") so the inbox is readable before anything is known about
 * the page. That name is a PLACEHOLDER, and the page's own title should replace
 * it once fetched. A name the person typed never is replaced.
 */
export function isAutoTitle(title: string | null | undefined, url: string | undefined): boolean {
  if (!url?.trim()) return false;
  const t = (title ?? '').trim();
  return !t || t === url.trim() || t === parseCapture(url).title;
}

/**
 * The name to show for a captured or saved link: the page's own title over our
 * placeholder, never over the person's. Anything without a source link is shown
 * by its stored title.
 */
export function linkedTitle(piece: Pick<Piece, 'title' | 'meta'>, fetchedTitle?: string | null): string {
  const url = piece.meta.bucket === 'piece' ? undefined : piece.meta.sourceUrl;
  const fetched = fetchedTitle?.trim();
  if (fetched && isAutoTitle(piece.title, url)) return fetched;
  return piece.title?.trim() || (url ? parseCapture(url).title : '') || 'Untitled';
}

/**
 * "12 published · 4 cut from" — what the archive holds.
 *
 * The second half is the number of pieces that have PRODUCED something, not the
 * number of cuts: "4 of these went further" is a fact about the archive, while
 * a raw cut count is a fact about the pipeline and is already on the board.
 */
export function librarySummary(rows: Piece[]): string | null {
  const out = onlyPieces(rows).filter((p) => p.meta.stage === 'published');
  if (!out.length) return null;
  const all = onlyPieces(rows);
  const sources = out.filter((p) => all.some((r) => r.meta.derivedFrom === p.id)).length;
  const head = `${out.length} published`;
  return sources ? `${head} · ${sources} cut from` : head;
}

// ── Inspiration ──────────────────────────────────────────────────────────────
//
// A creator's day starts as INPUT: reels, videos, articles, a line someone
// said. Some of it sparks work, most of it does not, and the gap between
// saving something and making something from it is usually weeks. That gap is
// the creative process, and until now Zenboard did not model it at all.
//
// ── THE BUG THIS FIXES, AND IT IS A ONE-WAY TRIP ───────────────────────────
// `references()` shipped exported and tested, and **nothing rendered it.** The
// only place the word `reference` appeared in the whole workspace was the
// triage button that files something INTO the bucket. So you could save a
// competitor's reel, press "Keep as reference", and never see it again. An
// inbox with a hole in the floor is worse than no inbox: it teaches you not to
// save things.
//
// ── WHY A SPARK IS THE SAME EDGE AS A CUT ──────────────────────────────────
// `derivedFrom` already says "this piece came out of that one". A reference IS
// a piece (`bucket: 'reference'`), so an idea sparked by a saved reel is the
// same edge, read the other way round — no second relationship, no second
// table, and the reference's "what did this produce" list is the same
// `derivativesOf` the Library already uses.
//
// What CHANGES is the word. A cut is a smaller version of its source; a spark
// is a new thing that source made you think of. `lineageOf` says which.

/** Is this saved input rather than your own work? */
export const isReference = (p: Pick<Piece, 'meta'>): boolean => p.meta.bucket === 'reference';

/**
 * How to describe the link between a piece and its source.
 *
 * Same edge, two readings — and reading it wrong is the difference between
 * "this is a shorter version of my video" and "this exists because of
 * someone else's reel", which are not remotely the same claim.
 */
export function lineageOf(source: Pick<Piece, 'meta'>): 'spark' | 'cut' {
  return isReference(source) ? 'spark' : 'cut';
}

/**
 * Start a piece from something you saved.
 *
 * The reference is NOT consumed — it stays on the shelf. One reel can spark
 * three ideas over a year, and moving it would delete the very thing that
 * makes the shelf worth keeping.
 *
 * The title is left EMPTY on purpose. A reference's title is usually the
 * source's own ("youtube.com/dQw4w9WgXcQ", "How Nike edits"), and inheriting it
 * would name your idea after somebody else's video — which is both wrong and
 * the kind of thing you would never notice until it was on the board. The
 * caller supplies the angle, or it stays untitled until you write one.
 */
export function ideaFromReference(ref: Pick<Piece, 'id'>, title = ''): NewPiece {
  return {
    title: title.trim(),
    meta: {
      stage: 'idea',
      // A commitment, not a capture: pressing "Make something from this" IS the
      // decision the inbox exists to defer.
      bucket: 'piece',
      derivedFrom: ref.id,
    },
    sections: [],
  };
}

/**
 * "2 ideas came from this" — what a saved reference has produced.
 *
 * Null until it has produced something, like every other count here: a "0
 * ideas" badge on a shelf of saved links is a reproach for having saved them.
 */
export function sparkSummary(refId: string, rows: Piece[]): string | null {
  const n = rows.filter((r) => r.meta.derivedFrom === refId).length;
  if (!n) return null;
  return `${n} ${n === 1 ? 'idea' : 'ideas'} from this`;
}
