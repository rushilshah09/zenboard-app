'use client';
// Content — the module PRODUCT_THINKING.md §9 asks for: idea → script → shoot →
// edit → review → scheduled → published, with a calendar that answers "what is
// going out when" and "what am I filming that day".
//
// THE OBJECT IS A PAGE (lib/content.ts explains why). So the SCRIPT here is the
// same block editor Documents uses, with the same autosave — a creator's real
// work happens in prose, and this module would be a spreadsheet without it.
//
// Two views, both named by the user: the BOARD is the pipeline, the CALENDAR is
// the schedule. No list view yet: it would be a third way to read the same rows
// before either of these has earned its keep.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MOTION, motion, useReducedMotion } from '@/components/ds/ui/motion';
import { Plus, Video, Calendar as CalendarIcon, Kanban, ChevronLeft, ChevronRight, MapPin, Clock, Ellipsis, Tray, ArrowRight, Bookmark, Archive, Sparkles, Search, Globe, Trash2, Lightbulb, FileText, Image as ImageIcon, Volume2, type IconType } from '@/components/ds/icons';
import {
  Icon, Button, IconButton, SegmentedControl, PageView, EmptyState, EmptyLine, Alert, Badge, Card, CardGrid, Select, TextInput, Textarea, Checkbox,
  Popover, PopoverTrigger, PopoverContent, MenuItem, LinkCard, LinkMark, ChannelMark, markFor, toast, toastReverted, dismissToast,
  TimePicker, ToggleGroup, ToggleGroupItem, DatePicker,
} from '@/components/ds/ui';
import { CanvasLayout } from '@/components/ui/canvas-layout';
import { ViewContainer } from '@/components/ui/view-container';
import { type BoardColumnData } from '@/components/ds/ui/board';
import { Skeleton, SkeletonText } from '@/components/ds/ui/skeleton';
import { DraggableBoard } from '@/components/content/pipeline-drag';
import dynamic from 'next/dynamic';
import { ConnectedPanel } from '@/components/connected/connected-panel';
import { addPage, updatePage, getPage, archivePage, deletePage } from '@/lib/actions/library';
import { setContentStage, captureToInbox, sortInboxItem, setContentImage, rememberLinkPreview } from '@/lib/actions/content';
import { setStageName } from '@/lib/actions/stage-labels';
import {
  stageName, normalizeStageName, withStageName, STAGE_NAME_MAX, type StageLabels,
} from '@/lib/stage-labels';
import { setPageLinks } from '@/lib/actions/library';
import { requestApproval, cancelApproval } from '@/lib/actions/portal';
import { repurposePiece, makeIdeaFromReference } from '@/lib/actions/content';
import { toBlocks, serialize, genId, type Block } from '@/lib/blocks';
import { safeHref } from '@/lib/safe-url';
import { useServerState } from '@/lib/use-server-state';
import { useModeParam, useRecordParam, writeModes } from '@/lib/hub-url';
import { useLinkMeta, peekLinkMeta } from '@/lib/use-link-meta';
import { uploadAttachment, useAttachmentUrl, openAttachment } from '@/lib/use-attachment';
import { attachmentKind, rejectReason } from '@/lib/attachments';
import { attachmentCover, coverAttachmentId } from '@/lib/covers';
import { platformOf, platformThumbnail, isMissingThumbnail } from '@/lib/platforms';
import { useChanged } from '@/lib/use-changed';
import { hostOf, type LinkMeta } from '@/lib/unfurl';
import { isTempId, tempId } from '@/lib/temp-id';
import { formatDay, formatMonthYear, formatDayWithWeekday, formatDayTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import {
  board, byDay, isLate, readContent, writeContent, needsYou, nextAction, landingIndex, agendaDay, type NeedsYou,
  shotsOf, shootDay, shootLocations, shootSummary, isAwaitingClient, needsChanges,
  STAGES, FORMATS, FORMAT_LABEL, CHANNEL_SUGGESTIONS,
  inbox, onlyPieces, parseCapture, briefOf, seedBrief,
  canRepurpose, repurposeOptions, repurpose, derivativesOf, sourceOf, repurposeSummary,
  stagesFor, isSettled,
  isReference, lineageOf, sparkSummary, ideaFromReference,
  libraryItems, libraryMonths, matchesLibrary, linkedTitle, isAutoTitle, imageCaptureTitle, LIBRARY_KINDS,
  freshPreview, previewFrom, type LinkPreview,
  type Piece, type Stage, type ContentMeta, type Format, type Shot, type Bucket, type LibraryItem,
} from '@/lib/content';

// A ProseMirror editor CANNOT render on the server — it needs a real DOM to
// build its view — so every byte of it in the worker bundle was work thrown
// away on first paint. It also only ever appears inside a panel that opens on
// interaction, never in the initial HTML.
//
// `ssr: false` is therefore the correct shape, not only the smaller one, and
// `database-view.tsx` already loads it this way. Static imports here put the
// whole editor in the Cloudflare worker, which has a 3 MiB gzipped ceiling.
const BlockEditor = dynamic(
  () => import('@/components/documents/block-editor').then((m) => ({ default: m.BlockEditor })),
  { ssr: false },
);

// Inbox first: it is where things LAND, and a triage pile you have to go
// looking for is a triage pile that grows.
// Library last: it is where work ENDS UP, so it reads left-to-right as the
// life of a piece — land it, make it, schedule it, and there it is.
//
// `board` and `calendar` are NOT two places. They are one place — the pipeline
// — drawn two ways: the same pieces, grouped by stage or laid out by date. They
// were two tabs, which asked the user to treat "where am I" and "how is this
// drawn" as the same question, and `page-header.tsx` is explicit that they are
// not: a layout switch is a setting ON the current view, and it belongs in the
// actions lane as bare glyphs (see `task-view-toggle.tsx`, which says the same
// thing for List ⇄ Board on Tasks).
//
// WHY THE LAYOUT STAYS IN THIS ONE PARAM rather than a second `?layout=`:
// `?view=calendar` is already a link that exists — `content-today.tsx` sends
// one for a shoot day — and one param naming exactly what is on screen keeps
// every such link working untouched, with nothing to alias and nothing to
// migrate. The tab's own value is derived from it instead (`PLACE_OF`).
const VIEWS = ['inbox', 'board', 'calendar', 'library'] as const;
type View = typeof VIEWS[number];

/** What the Library can be narrowed to. `all` is the default and never in the URL. */
const LIBRARY_FILTERS = ['all', ...LIBRARY_KINDS] as const;
type LibraryFilter = typeof LIBRARY_FILTERS[number];
const FILTER_LABEL: Record<LibraryFilter, string> = { all: 'All', saved: 'Saved', published: 'Published' };

/** How many Library cards render before "Show more" — a shelf grows for years. */
const LIBRARY_PAGE = 48;

// A published piece with no picture of its own is shown by what KIND of thing it
// is. Not one glyph for everything: a newsletter drawn as a video is a small lie.
const FORMAT_GLYPH: Record<Format, IconType> = {
  video: Video, short: Video, podcast: Volume2,
  post: FileText, article: FileText, newsletter: FileText, carousel: ImageIcon,
};

/** Put a row back where it was — Undo should not reshuffle the list you were in. */
function insertAt(rows: Piece[], row: Piece, index: number): Piece[] {
  const next = [...rows];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, row);
  return next;
}

/** The three places, which is what the tabs name. */
type Place = 'inbox' | 'pipeline' | 'library';
const PLACE_OF: Record<View, Place> = {
  inbox: 'inbox', board: 'pipeline', calendar: 'pipeline', library: 'library',
};

// A column's dot. Not seven different hues — the pipeline is one process, and
// colouring each step would make a board of noise. Only the two states worth
// spotting from across the room get their own: waiting, and out the door.
const STAGE_DOT: Record<Stage, string> = {
  idea: 'bg-ink-300', script: 'bg-ink-300', shoot: 'bg-ink-300', edit: 'bg-ink-300',
  review: 'bg-warning-500', scheduled: 'bg-info-500', published: 'bg-success-500',
};

const day = (iso: string) => formatDay(iso) ?? iso;

export function ContentWorkspace({ initialPieces, projects = [], todayISO, stageLabels = {}, demoScripts, demo = false }: {
  initialPieces: Piece[];
  /**
   * What this person calls their stages. The stage IDS never change — they carry
   * `isSettled`, the format routing and the next action — so this is labels only
   * (lib/stage-labels.ts).
   */
  stageLabels?: StageLabels;
  /** Attachable projects — a piece needs one before a client can sign it off. */
  projects?: { id: string; name: string }[];
  todayISO: string;
  /**
   * Dev-preview only: there is no session, so every write would throw and every
   * optimistic move would snap back. One flag gates ALL of them — a harness that
   * gates the reads and leaves one write live is a harness that lies.
   */
  demo?: boolean;
  /**
   * Dev-preview only: the scripts, already loaded. When present it replaces the
   * fetch AND the save — a demo prop that gates only the read leaves the write
   * pointed at a server the harness does not have.
   */
  demoScripts?: Record<string, Block[]>;
}) {
  const [pieces, setPieces] = useServerState(initialPieces);
  // The server is the source of truth (the page re-renders on revalidate), but a
  // header that waits a round trip to show the word you just typed feels broken.
  const [labels, setLabels] = useServerState(stageLabels);
  // The view is a MODE, so it pushes history (lib/hub-url.ts) — `?view=calendar`
  // is a link you can send, and Back returns to the board you came from.
  const [view, setView] = useModeParam<View>('view', 'board', VIEWS);
  // What the Library is showing is a mode too: "12 more in Library" from the
  // board is a link to the published shelf, not to everything.
  const [kind, setKind] = useModeParam<LibraryFilter>('kind', 'all', LIBRARY_FILTERS);
  // Which piece is open is a RECORD selection, so it replaces rather than pushes.
  const [openId, setOpenId] = useRecordParam('piece');
  // A shoot day is addressable too — `?shoot=2026-09-09` is the call sheet, and
  // it is a DATE, so it needs no record to exist first.
  const [shootISO, setShootISO] = useRecordParam('shoot');

  const open = pieces.find((p) => p.id === openId) ?? null;
  const untriaged = inbox(pieces);
  // ONE reader for the name of a stage. Four surfaces show it — the column head,
  // the card's move menu, the piece's stage select and the repurpose list — and
  // a rename that reached three of them would be worse than none.
  const named = useCallback((s: Stage) => stageName(labels, s), [labels]);

  /** Rename a stage, optimistically. Reverts and says so, like every other write. */
  const renameStage = useCallback(async (stage: Stage, raw: string) => {
    const name = normalizeStageName(raw, stage);
    if ((labels[stage] ?? null) === name) return;   // nothing actually changed
    const before = labels;
    setLabels(withStageName(labels, stage, name));
    if (demo) return;
    const res = await setStageName(stage, raw);
    if ('error' in res) { setLabels(before); toastReverted(res.error); }
  }, [labels, setLabels, demo]);

  /**
   * Send something to Trash, and offer it back.
   *
   * The Inbox is meant to reach empty, and until now the only way to get rid of
   * a capture you did not want was to file it somewhere it did not belong. Trash
   * is reversible, so this acts at once and offers Undo rather than asking — the
   * Documents rule (INTERACTION_STANDARDS §2.2), with the same failure handling:
   * the "moved to Trash" claim is taken down before it is contradicted.
   */
  async function remove(id: string) {
    const index = pieces.findIndex((p) => p.id === id);
    const gone = pieces[index];
    // A capture still waiting for its real id has nothing on the server to trash
    // yet; the row gets its id within a round trip.
    if (!gone || isTempId(id)) return;
    setPieces((ps) => ps.filter((p) => p.id !== id));
    if (openId === id) setOpenId(null);
    const said = toast({
      message: `“${linkedTitle(gone)}” moved to Trash.`,
      action: { label: 'Undo', onAction: () => { void restore(gone, index); } },
    });
    if (demo) return;
    const res = await archivePage(id, true);
    if ('error' in res) {
      setPieces((ps) => (ps.some((p) => p.id === id) ? ps : insertAt(ps, gone, index)));
      dismissToast(said);
      toastReverted(res.error);
    }
  }

  /** Undo a removal: back where it was, in the same place in the list. */
  async function restore(gone: Piece, index: number) {
    setPieces((ps) => (ps.some((p) => p.id === gone.id) ? ps : insertAt(ps, gone, index)));
    if (demo) return;
    const res = await archivePage(gone.id, false);
    if ('error' in res) {
      setPieces((ps) => ps.filter((p) => p.id !== gone.id));
      toastReverted(res.error);
    }
  }

  /**
   * Remember a link's preview on its row. A CACHE write: the card already shows
   * the preview, so a failure changes nothing on screen and the next visit simply
   * asks again — which is why it neither reverts nor toasts.
   */
  const rememberPreview = useCallback((id: string, preview: LinkPreview) => {
    if (isTempId(id)) return;
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, meta: { ...p.meta, preview } } : p)));
    void rememberLinkPreview(id, preview).catch(() => { /* a cache: the next visit asks again */ });
  }, [setPieces]);
  // Memoised: a new object every render would re-render every link on the screen.
  const previewContext = useMemo(() => ({ todayISO, remember: demo ? undefined : rememberPreview }), [todayISO, demo, rememberPreview]);

  /** Capture, optimistically — the box has to feel like a scratchpad. */
  async function capture(raw: string) {
    const { title, sourceUrl } = parseCapture(raw);
    if (!title) return;
    const tmp = tempId();
    const item: Piece = { id: tmp, title, meta: { stage: 'idea', bucket: 'inbox', sourceUrl } };
    setPieces((ps) => [item, ...ps]);
    if (demo) return;
    const res = await captureToInbox({ title, sourceUrl });
    if ('error' in res) {
      setPieces((ps) => ps.filter((p) => p.id !== tmp));
      toast({ message: res.error, variant: 'error' });
      return;
    }
    setPieces((ps) => ps.map((p) => (p.id === tmp ? { ...p, id: res.id } : p)));
  }

  /**
   * Capture pictures — pasted, dropped or picked. One capture per image.
   *
   * Each shows AT ONCE from its own bytes (an object URL) while three things
   * happen behind it: the capture row is made, the file goes straight to storage
   * (lib/use-attachment.ts, never through this server), and the row is pointed at
   * the stored file. The picture IS the capture, so if the upload fails the row
   * goes with it — a titled row with nothing in it is not what was captured.
   * Uploads run one after another: each holds a one-shot ticket.
   */
  async function captureImages(files: File[], typed: string) {
    const images = files.filter((f) => attachmentKind(f.type, f.name) === 'image');
    if (images.length < files.length) {
      toast({ message: images.length ? 'Only the images were captured.' : 'Only images can be captured here.', variant: 'error' });
    }
    for (const [i, file] of images.entries()) {
      const refused = rejectReason(file);
      if (refused) { toast({ message: refused, variant: 'error' }); continue; }
      // What was typed names the FIRST picture; the rest are named by their files.
      const { title, sourceUrl } = imageCaptureTitle(file.name, i === 0 ? typed : '', formatDayTime(new Date()) ?? '');
      const tmp = tempId();
      const localImage = URL.createObjectURL(file);
      setPieces((ps) => [{ id: tmp, title, localImage, meta: { stage: 'idea', bucket: 'inbox', sourceUrl } }, ...ps]);
      if (demo) continue;

      const made = await captureToInbox({ title, sourceUrl });
      if ('error' in made) {
        setPieces((ps) => ps.filter((p) => p.id !== tmp));
        toast({ message: made.error, variant: 'error' });
        continue;
      }
      setPieces((ps) => ps.map((p) => (p.id === tmp ? { ...p, id: made.id } : p)));

      const up = await uploadAttachment({ page_id: made.id }, file);
      const linked = 'error' in up ? up : await setContentImage(made.id, up.attachment.id);
      if ('error' in linked) {
        setPieces((ps) => ps.filter((p) => p.id !== made.id));
        // The capture was the picture. Best effort: if this delete fails too, an
        // empty titled capture is left behind — visible, and removable by hand.
        void deletePage(made.id);
        toast({ message: `Couldn’t save “${file.name}”. ${linked.error}`, variant: 'error' });
        continue;
      }
      if ('attachment' in up) {
        const image = attachmentCover(up.attachment.id);
        setPieces((ps) => ps.map((p) => (p.id === made.id ? { ...p, meta: { ...p.meta, image } } : p)));
      }
    }
  }

  /**
   * Triage one capture onto a shelf. Optimistic and reverting, like `moveTo` —
   * the row leaving the list IS the feedback.
   */
  async function sortTo(id: string, bucket: Bucket, linkTitle?: string) {
    const row = pieces.find((p) => p.id === id);
    const before = row?.meta;
    if (!row || !before || before.bucket === bucket) return;
    // The name the row SHOWED goes with it: sorted from the list without ever
    // being opened, a bare link would otherwise reach the board as
    // "youtube.com/watch". Only over our placeholder — the server re-checks.
    const adopt = linkTitle?.trim() && isAutoTitle(row.title, before.sourceUrl) ? linkTitle.trim() : undefined;
    setPieces((ps) => ps.map((p) => (p.id === id
      ? { ...p, title: adopt ?? p.title, meta: { ...p.meta, bucket, stage: bucket === 'piece' ? 'idea' : before.stage } }
      : p)));
    if (demo) return;
    try {
      const res = await sortInboxItem(id, bucket, adopt);
      if ('error' in res) throw new Error(res.error);
    } catch (e) {
      setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, title: row.title, meta: { ...p.meta, bucket: before.bucket, stage: before.stage } } : p)));
      toast({ message: e instanceof Error ? e.message : 'Could not sort that.', variant: 'error' });
    }
  }

  function patch(id: string, next: Partial<ContentMeta>) {
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, meta: { ...p.meta, ...next } } : p)));
  }

  /**
   * Start a piece from something you saved, and OPEN it.
   *
   * Opening is the point, not a nicety: the new idea is deliberately untitled
   * (naming it after someone else's reel would be wrong), so leaving the user
   * on the inbox would have created an "Untitled" row somewhere they cannot
   * see and given them nothing to do about it.
   */
  async function spark(referenceId: string) {
    const ref = pieces.find((p) => p.id === referenceId);
    if (!ref || !isReference(ref)) return;
    if (demo) {
      const idea = ideaFromReference({ id: ref.id });
      const id = tempId();
      setPieces((ps) => [...ps, { id, title: idea.title, meta: idea.meta }]);
      setOpenId(id);
      return;
    }
    const res = await makeIdeaFromReference(referenceId);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    const idea = ideaFromReference({ id: ref.id });
    setPieces((ps) => [...ps, { id: res.id, title: idea.title, meta: idea.meta }]);
    setOpenId(res.id);
  }

  /**
   * Cut a piece into shorter ones.
   *
   * NOT optimistic, unlike the stage move, and that is deliberate: a stage move
   * changes something already on screen, so the card sliding IS the feedback
   * and a rollback puts it back where it was. This CREATES rows, and a
   * temp-id row that later has to be replaced by a real one is the case
   * `lib/temp-id.ts` exists for — but here the wait is a click on a control
   * that shows `loading`, and the rows appear where you are already looking.
   * Nothing is on screen to feel stuck.
   *
   * The server re-reads the source and refuses a cut that was never offered, so
   * this does not re-check the rules — it would be a second, drifting copy of
   * them (`lib/content.ts` is the one vocabulary).
   */
  async function cut(sourceId: string, presetIds: string[]) {
    if (!presetIds.length) return;
    if (demo) {
      // The harness must not leave the write live — M3's rule. Fabricate the
      // same rows the server would, so the lineage row is verifiable offline.
      const src = pieces.find((p) => p.id === sourceId);
      if (!src) return;
      const made = repurpose({ id: src.id, title: src.title ?? '', meta: src.meta }, presetIds);
      setPieces((ps) => [
        ...ps,
        ...made.map((m) => ({ id: tempId(), title: m.title, meta: m.meta, projectId: src.projectId })),
      ]);
      return;
    }
    const res = await repurposePiece(sourceId, presetIds);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    const src = pieces.find((p) => p.id === sourceId);
    const made = repurpose({ id: sourceId, title: src?.title ?? '', meta: src?.meta ?? { stage: 'idea', bucket: 'piece' } }, presetIds);
    setPieces((ps) => [
      ...ps,
      ...res.ids.map((id, i) => ({ id, title: made[i]?.title ?? 'Untitled', meta: made[i]?.meta ?? { stage: 'idea' as Stage, bucket: 'piece' as Bucket }, projectId: src?.projectId })),
    ]);
    toast({ message: `${res.ids.length} ${res.ids.length === 1 ? 'cut' : 'cuts'} created.` });
  }

  /**
   * Move a piece along the pipeline from the board.
   *
   * Optimistic, and it reverts on failure: the card moving IS the feedback, so
   * waiting for the round trip would make the most frequent action on the most
   * used screen feel broken. `setContentStage` merges server-side — the board
   * has no blocks, and writing `content` without them would delete the script.
   */
  async function moveTo(id: string, stage: Stage) {
    const before = pieces.find((p) => p.id === id)?.meta.stage;
    if (!before || before === stage) return;
    patch(id, { stage });
    if (demo) return;
    try {
      const res = await setContentStage(id, stage);
      if ('error' in res) throw new Error(res.error);
    } catch (e) {
      patch(id, { stage: before });
      toast({ message: e instanceof Error ? e.message : 'Could not move that.', variant: 'error' });
    }
  }

  async function create(stage: Stage, title: string) {
    const tmp = tempId();
    const piece: Piece = { id: tmp, title, meta: { stage, bucket: 'piece' } };
    setPieces((ps) => [piece, ...ps]);
    const res = await addPage({ title, type: 'content' });
    if ('error' in res) {
      setPieces((ps) => ps.filter((p) => p.id !== tmp));
      toast({ message: res.error, variant: 'error' });
      return;
    }
    setPieces((ps) => ps.map((p) => (p.id === tmp ? { ...p, id: res.id } : p)));
    // The stage lives in the page body's JSON, so a brand-new piece needs one
    // write to say where it starts. Without it every card would appear in Idea
    // after a reload no matter which column you added it to.
    await updatePage(res.id, { content: { blocks: [], ...writeContent({ stage, bucket: 'piece' }) } });
  }

  return (
    <PreviewContext.Provider value={previewContext}>
    <CanvasLayout
        // NO TITLE, NO ICON, NO SUBTITLE — and so no left cluster at all
        // (`hasScope` in page-header.tsx goes false and the lane collapses).
        //
        // The app header one row above already says "Content", with this
        // module's own icon, because that is what the nav says you are looking
        // at. Repeating it underneath in bold spent a whole header lane saying
        // a word that was already on screen. Checked against every other
        // module before changing it: Home shows the date, Calendar the month,
        // Projects the project's name, and Documents and Habits both pass
        // `title={undefined}` DELIBERATELY to avoid exactly this. Content was
        // the only module in the app that restated its own nav label.
        //
        // The subtitle went with it. `8 in progress · 1 late · 1 needs changes`
        // was prose you could not act on, and the two numbers that mattered are
        // now the "Needs you" strip, which names the actual pieces.
        //
        // The left lane, WHERE YOU ARE. Three PLACES: what has landed, what is
        // being made, what is finished — different pieces in each, which is the
        // lane's own test. Named rather than glyphed, because unlike the layout
        // switch beside the primary button these change WHAT you are looking at.
        tabs={(
          <SegmentedControl
            aria-label="Inbox, pipeline or library"
            fit="content"
            value={PLACE_OF[view]}
            // Arriving at the pipeline lands on the board, which is the layout
            // that answers "what is in flight" without picking a month.
            onValueChange={(v) => setView(v === 'pipeline' ? 'board' : (v as View))}
            options={[
              {
                value: 'inbox',
                label: (
                  <span className="flex items-center gap-1.5">
                    Inbox
                    {untriaged.length > 0 && (
                      <span className="text-caption tabular-nums text-ink-500">{untriaged.length}</span>
                    )}
                  </span>
                ),
                'aria-label': untriaged.length ? `Inbox, ${untriaged.length} to sort` : 'Inbox',
              },
              { value: 'pipeline', label: 'Pipeline' },
              { value: 'library', label: 'Library' },
            ]}
          />
        )}
        // The right lane, in the order page-header.tsx sets out: what shapes
        // the current view first, then the page's own verb last. The layout
        // switch is bare 16px glyphs and no text — the same control, drawn the
        // same way, as List ⇄ Board on Tasks and on Documents, which is what
        // makes "change how this is drawn" recognisable wherever you meet it.
        // Only rendered in the pipeline: there is nothing to re-draw in an inbox
        // or a library, and a dead toggle is worse than no toggle.
        actions={(
          <>
            {PLACE_OF[view] === 'pipeline' && (
              <SegmentedControl
                aria-label="Pipeline layout"
                value={view}
                onValueChange={(v) => setView(v as View)}
                options={[
                  { value: 'board', 'aria-label': 'Board', label: <Icon icon={Kanban} size={16} /> },
                  { value: 'calendar', 'aria-label': 'Calendar', label: <Icon icon={CalendarIcon} size={16} /> },
                ]}
              />
            )}
            <Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />}
              onClick={() => create('idea', '')}>New idea</Button>
          </>
        )}
      overlays={(
        <>
        {shootISO && (
          <ShootDayView
            key={shootISO}
            iso={shootISO}
            pieces={shootDay(pieces, shootISO)}
            demoScripts={demoScripts}
            onClose={() => setShootISO(null)}
            onOpenPiece={(id) => { setShootISO(null); setOpenId(id); }}
          />
        )}

        {open && !shootISO && (
          <PieceEditor
            key={open.id}
            piece={open}
            stageTitle={named}
            projects={projects}
            demo={demo}
            demoScripts={demoScripts}
            onClose={() => setOpenId(null)}
            onMeta={(next) => patch(open.id, next)}
            onTitle={(title) => setPieces((ps) => ps.map((p) => (p.id === open.id ? { ...p, title } : p)))}
            onPiece={(next) => setPieces((ps) => ps.map((p) => (p.id === open.id ? { ...p, ...next } : p)))}
            siblings={pieces}
            onCut={(ids) => cut(open.id, ids)}
            onOpenPiece={(id) => setOpenId(id)}
            onSpark={() => spark(open.id)}
            onSort={(bucket, linkTitle) => sortTo(open.id, bucket, linkTitle)}
            onRemove={() => remove(open.id)}
            // The crumb that names where a saved thing or a capture lives takes
            // you there, as a document's folder crumb does.
            onPlace={(place) => { setOpenId(null); setView(place); }}
          />
        )}
        </>
      )}
    >

    <div className="scroll-region min-h-0 flex-1">
      {view === 'inbox' ? (
        <InboxView items={untriaged} onCapture={capture} onCaptureImages={captureImages} onSort={sortTo} onOpen={setOpenId} onRemove={remove} />
      ) : view === 'library' ? (
        // BEFORE the pipeline's empty state, not after it: the Library holds what
        // you saved as well as what you made, so "nothing in the pipeline" is no
        // reason to hide a shelf of saved references.
        <LibraryView pieces={pieces} kind={kind} onKind={setKind} onOpen={setOpenId} onSpark={spark} />
      ) : onlyPieces(pieces).length === 0 ? (
        <div className="grid h-full place-items-center">
          <EmptyState
            illustration={<Icon icon={Video} size={20} />}
            title="Nothing in the pipeline"
            description="From the first idea to the day it goes out."
            primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => create('idea', '')}>New idea</Button>}
          />
        </div>
      ) : (
        // One region for the pipeline, owning the gutter its two layouts used to
        // own separately. The strip belongs to the PLACE, not to one drawing of
        // it: the same pieces need you whether you are looking at columns or at
        // a month, and a panel that appeared and vanished with the layout would
        // be the drift CONSISTENCY_PRINCIPLE.md is about.
        <div className="flex h-full min-h-0 flex-col px-4 py-3">
          <NeedsYouStrip items={needsYou(pieces, todayISO)} onOpen={setOpenId} />
          {view === 'calendar' ? (
            <ContentCalendar pieces={pieces} todayISO={todayISO} onOpen={setOpenId} onShoot={setShootISO} />
          ) : (
            <PipelineBoard pieces={pieces} todayISO={todayISO} onOpen={setOpenId} onAdd={create} onMove={moveTo}
              name={named} onRename={renameStage}
              // One step, not two: the published shelf, already filtered.
              onSeeLibrary={() => writeModes({ view: 'library', kind: 'published' })} />
          )}
        </div>
      )}
    </div>

    </CanvasLayout>
    </PreviewContext.Provider>
  );
}

// ── Inbox ────────────────────────────────────────────────────────────────────
//
// "A creator should be able to dump anything into one place... then later
// organize it into Ideas, Inspiration, References, or Content."
//
// TWO DECISIONS CARRY THIS SCREEN.
//
// 1. The box asks for ONE field. Not a format, not a channel, not a date. The
//    moment of capture is between two other things — mid-scroll, mid-meeting —
//    and a form is what makes a creator keep using their Notes app instead.
//    Everything else is decided at triage, when there is time to decide.
//
// 2. Each thing is decided ONCE, into one of three places: the pipeline (I will
//    make this), the Library (someone else made this and I want to keep it), or
//    Trash. Readwise Reader's inbox works the same way. "Reference" and
//    "Inspiration" are one shelf under two names, so there is one.
//
// THE INBOX IS ONLY THE PILE (2026-09-14). Saved references used to be listed
// here too, under the pile, so an inbox you are meant to empty could never look
// empty once you had kept anything, and the swipe file lived somewhere nobody
// would look for it. Kept things are in the Library now.
function InboxView({ items, onCapture, onCaptureImages, onSort, onOpen, onRemove }: {
  items: Piece[];
  onCapture: (text: string) => void;
  /** Pictures pasted, dropped or picked, with whatever was typed as the first one's name. */
  onCaptureImages: (files: File[], typed: string) => void;
  onSort: (id: string, bucket: Bucket, linkTitle?: string) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [dropping, setDropping] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const submit = () => { const v = text; setText(''); onCapture(v); };
  // Whatever is in the box names the picture, and the box clears — the same
  // "one run of captures" rhythm as pressing Enter.
  const takeFiles = (files: File[]) => {
    if (!files.length) return;
    const typed = text;
    setText('');
    onCaptureImages(files, typed);
  };
  const carriesFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    // THE WHOLE PLACE takes a drop, not a small target: the inbox is where things
    // land, and a screenshot dragged from the desktop should not have to find a box.
    <div
      className="mx-auto flex h-full w-full max-w-[720px] flex-col gap-4 px-6 py-6"
      onDragOver={(e) => { if (!carriesFiles(e)) return; e.preventDefault(); if (!dropping) setDropping(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        takeFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {/* Enter saves and clears, so a run of thoughts goes in as a run. A pasted
          image is captured as it lands — a screenshot on the clipboard is the
          fastest capture there is. */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-paper px-3 py-2 transition-colors duration-fast',
          // The same "drop here" language as the DS dropzone: the edge firms to the
          // control tier and the box takes the wash over its own fill.
          dropping ? 'border-line-control wash-over' : 'border-line',
        )}
      >
        <Icon icon={dropping ? ImageIcon : Plus} size={16} className="shrink-0 text-ink-500" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (!files.length) return;
            e.preventDefault();
            takeFiles(files);
          }}
          placeholder={dropping ? 'Drop to capture' : 'Paste a link, an image, or write the thought'}
          aria-label="Capture to inbox"
          className="min-w-0 flex-1 bg-transparent text-ui text-ink-900 outline-none placeholder:text-ink-500"
        />
        <input ref={picker} type="file" accept="image/*" multiple hidden aria-hidden tabIndex={-1}
          onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; takeFiles(files); }} />
        <IconButton size="sm" variant="ghost" label="Add an image"
          icon={<Icon icon={ImageIcon} size={16} />} onClick={() => picker.current?.click()} />
        <Button size="sm" type="submit" disabled={!text.trim()}>Save</Button>
      </form>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <EmptyState
            illustration={<Icon icon={Tray} size={20} />}
            title="Nothing to sort"
            description="Paste a link, an image or a thought to sort later."
          />
        </div>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {items.map((item) => (
            <InboxRow key={item.id} item={item} onSort={onSort} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One capture. A link introduces itself the way its page does — favicon, the
 * page's own title, the site — rather than as `youtube.com/watch`, which is what
 * the capture box can name it before anything is known about the page.
 */
function InboxRow({ item, onSort, onOpen, onRemove }: {
  item: Piece;
  onSort: (id: string, bucket: Bucket, linkTitle?: string) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const href = safeHref(item.meta.sourceUrl) ?? undefined;
  const { link } = useLinkPreview(item, href);
  const captured = useContentImage(item);
  // A link shows its video or page image too, so the pile is recognisable at a glance.
  const picture = usePicture([captured, platformThumbnail(href), link?.image]);
  const title = linkedTitle(item, link?.title);
  const who = item.meta.sourceAuthor || link?.author?.trim();
  const detail = href ? [who, link?.siteName?.trim() || hostOf(href)].filter(Boolean).join(' · ') : item.meta.note;

  return (
    <li className="group touch-row flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-surface-hover">
      {/* A link shows where it lives — the platform's own mark (YouTube, X,
          Instagram…), else the site's favicon; a picture or a thought shows that it
          is one. */}
      <span aria-hidden className="grid size-4 shrink-0 place-items-center text-ink-500">
        {href ? (
          <LinkMark url={href} favicon={link?.favicon} size={16} />
        ) : (
          <Icon icon={captured || item.meta.image ? ImageIcon : Lightbulb} size={16} />
        )}
      </span>
      <button type="button" onClick={() => onOpen(item.id)} className="focus-ring min-w-0 flex-1 rounded-sm text-left">
        <span className="block truncate text-ui text-ink-900">{title}</span>
        {detail && <span className="mt-0.5 block truncate text-caption text-ink-500">{detail}</span>}
      </button>
      {/* `reveal-on-hover`, not a hand-rolled opacity pair: the house utility
          also turns these on for a COARSE POINTER, and a phone has no hover. */}
      <span className="reveal-on-hover flex shrink-0 items-center gap-1">
        <IconButton size="sm" variant="ghost" label="Add to pipeline"
          icon={<Icon icon={ArrowRight} size={16} />} onClick={() => onSort(item.id, 'piece', link?.title)} />
        <IconButton size="sm" variant="ghost" label="Save to library"
          icon={<Icon icon={Bookmark} size={16} />} onClick={() => onSort(item.id, 'reference', link?.title)} />
        <IconButton size="sm" variant="ghost" label="Move to Trash" disabled={isTempId(item.id)}
          icon={<Icon icon={Trash2} size={16} />} onClick={() => onRemove(item.id)} />
      </span>
      {/* A picture is recognised by eye, so it shows — at the END, after the
          actions: every title still starts on the same line, and the thumbnail
          stays on the row's edge instead of floating in front of controls that
          are invisible until you hover. */}
      {picture.src && (
        /* eslint-disable-next-line @next/next/no-img-element -- a signed, local or third-party URL; next/image cannot optimise any of them */
        <img src={picture.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={picture.onError} onLoad={picture.onLoad}
          className="h-8 w-12 shrink-0 rounded-sm border border-line-soft object-cover" />
      )}
    </li>
  );
}

/**
 * WHAT NEEDS YOU — the strip above the board.
 *
 * The section used to answer "what needs me" in the subtitle, as prose:
 * `10 in progress · 1 late · 1 needs changes`. Three true numbers you cannot
 * act on, describing pieces that were — measured on 2026-09-12 — scrolled off
 * the right-hand edge of the board, because lateness and rejected work live in
 * `edit` and `review` and the board is ordered by stage. The one thing you
 * opened the page to find was the one thing the page made you hunt for.
 *
 * Two decisions worth keeping:
 *
 * **It renders nothing when empty** — not an empty state, nothing at all. It is
 * the mirror of the waiting-on panel and follows the same rule: a heading over
 * a blank space is a permanent reminder of an absence, and "nothing is
 * slipping" is not news that needs a billboard. The board below is then the
 * whole page, exactly as it was before.
 *
 * **The count is on the heading, and the list is capped.** Four cards is a
 * glance; nine is a second board. The heading always states the true total, so
 * a capped item is never hidden silently — and it is still on the board with
 * its own badge, which is where it was always going to be worked on.
 */
const NEEDS_YOU_SHOWN = 4;

function NeedsYouStrip({ items, onOpen }: { items: NeedsYou[]; onOpen: (id: string) => void }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, NEEDS_YOU_SHOWN);
  return (
    <section aria-label="Needs you" className="mb-3">
      <h2 className="mb-1.5 flex items-center gap-1.5 text-overline text-ink-500">
        Needs you
        <span className="tabular-nums">{items.length}</span>
      </h2>
      {/* 300px and gap-3 are the BOARD's column width and gutter, not a taste:
          each card then sits exactly over the column it belongs to, so the strip
          reads as the top of the board rather than a banner floating above it. */}
      <div className="flex flex-wrap gap-3">
        {shown.map((n) => (
          <Card
            key={n.piece.id}
            on="paper"
            interactive
            className="w-[300px] gap-1.5 p-3"
            onClick={() => onOpen(n.piece.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(n.piece.id); }}
          >
            <p className="truncate text-body font-medium text-ink-900">{n.piece.title?.trim() || 'Untitled'}</p>
            {/* `items-start`, because the line beside the badge is allowed TWO
                lines. When the reason is "changes" that line is the client's
                own note — the actual work — and one truncated line of it read
                "Love it — can we cut the intro to 1…", which is a notification
                rather than an instruction. */}
            <div className="flex min-w-0 items-start gap-2 text-meta text-ink-500">
              {n.reason === 'changes'
                ? <Badge status="danger">Changes</Badge>
                : <Badge status="danger">Late</Badge>}
              {/* The next move, which until now existed only as a grey caption
                  inside the detail panel — you had to open a piece to be told
                  what to do with it. `nextAction`, not `STAGE_ACTION`: the raw
                  map answers "Waiting on a look" for a piece whose client has
                  already looked and said no. */}
              <span className="line-clamp-2 leading-normal">
                {n.reason === 'late' && n.daysLate > 0 && (
                  <span className="tabular-nums">{n.daysLate === 1 ? '1 day over' : `${n.daysLate} days over`} · </span>
                )}
                {nextAction(n.piece)}
              </span>
            </div>
          </Card>
        ))}
      </div>
      {items.length > shown.length && (
        <p className="mt-1.5 mb-0 text-caption text-ink-500">
          {items.length - shown.length} more on the board.
        </p>
      )}
    </section>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

function PipelineBoard({ pieces, todayISO, onOpen, onAdd, onMove, name, onRename, onSeeLibrary }: {
  pieces: Piece[]; todayISO: string;
  onOpen: (id: string) => void;
  onAdd: (stage: Stage, title: string) => void;
  onMove: (id: string, stage: Stage) => void;
  name: (s: Stage) => string;
  onRename: (stage: Stage, name: string) => void;
  onSeeLibrary: () => void;
}) {
  const columns: BoardColumnData[] = board(pieces).map((col) => ({
    id: col.stage,
    // `name(col.stage)`, not `col.label`: `board()` returns the DEFAULT label,
    // and the header must show what this person calls the stage.
    name: name(col.stage),
    // …and `col.label` IS the default, which the rename field shows as its
    // placeholder: clear the field and you can see what it goes back to.
    defaultName: col.label,
    dotClass: STAGE_DOT[col.stage],
    // A piece is CREATED as an idea and then moved. Offering "+ New idea" in
    // Published — or in Shoot — names the wrong thing for the column and adds a
    // control for an act nobody performs. The header's own "New idea" is always
    // there for the case where you are backfilling.
    canAdd: col.stage === 'idea',
    // `published` is the one column nothing leaves, so it is the only one that
    // would grow forever. It shows the recent tail and says what it is not
    // showing — a hidden card is work you have lost track of.
    footer: col.hidden > 0 ? (
      <button type="button" onClick={onSeeLibrary}
        className="focus-ring w-full rounded-sm px-2 py-1.5 text-left text-caption text-ink-500 hover:bg-surface-hover hover:text-ink-800">
        {col.hidden} more in Library
      </button>
    ) : undefined,
    cards: col.pieces.map((p) => ({
      id: p.id,
      title: p.title?.trim() || 'Untitled',
      action: <StageMenu stage={p.meta.stage} format={p.meta.format} name={name} onMove={(s) => onMove(p.id, s)} />,
      // The card says WHERE it goes and WHEN — the two things you scan a
      // pipeline for. Late is the only thing that gets a colour.
      meta: (
        <span className="flex items-center gap-1.5">
          {p.meta.channel && (
            <span className="flex items-center gap-1 text-caption text-ink-500">
              <ChannelMark channel={p.meta.channel} />{p.meta.channel}
            </span>
          )}
          {/* The client's answer outranks the date: "they want changes" is the
              only thing on this card that tells you to do something today. */}
          {needsChanges(p) ? <Badge status="danger">Changes</Badge>
            : isAwaitingClient(p) ? <Badge status="warning">With client</Badge>
            : p.meta.publishAt && (
              isLate(p.meta, todayISO)
                ? <Badge status="danger">Late</Badge>
                : <span className="text-caption tabular-nums text-ink-500">{day(p.meta.publishAt)}</span>
            )}
        </span>
      ),
    })),
  }));

  return (
    // `flex-1 min-h-0`, not `h-full`: the strip above it is a sibling now, and
    // `h-full` would be the full height of both of them together.
    <div className="min-h-0 flex-1">
      {/* `emptyLabel` rather than the DS default ("Drop tasks here"): a content
          board holds ideas, not tasks, and the column is still a real drop
          target — the placeholder is what advertises that, only while you are
          actually holding something. */}
      {/* `DraggableBoard`, not `Board`: dnd-kit stays out of the DS barrel
          (`property-block.test.ts` — "the DS draws shapes; features bring the
          drag"), so the feature wraps the DS kanban in the behaviour. */}
      <DraggableBoard columns={columns} onOpen={onOpen} addLabel="New idea" emptyLabel="Nothing here yet"
        // Bleed the scroller to the page edge and pad INSIDE it. It sat inside the
        // region's 16px padding, so a board scrolled sideways cut its columns off
        // at a line 16px in from the edge, with blank page beside the cut —
        // measured, and visible in a user's recording. Now columns slide under
        // the edge instead, while the first column still starts on the same
        // line as everything above it.
        className="-mx-4 px-4"
        onAdd={(stage, title) => onAdd(stage as Stage, title)}
        onMoveCard={(id, stage) => onMove(id, stage as Stage)}
        onRenameColumn={(stage, next) => onRename(stage as Stage, next)}
        renameMaxLength={STAGE_NAME_MAX}
        // The column is a date-ordered queue, so the drop position is not the
        // answer — `landingIndex` asks the board itself where the card ends up.
        landingIndex={(id, stage) => landingIndex(pieces, id, stage as Stage)}
        renderDragged={(id) => {
          const card = columns.flatMap((c) => c.cards).find((c) => c.id === id);
          return card ? (
            <Card on="paper-2" className="gap-2 p-3">
              <p className="text-body text-ink-800">{card.title}</p>
              {card.meta && <div className="flex items-center gap-2 text-meta text-ink-500">{card.meta}</div>}
            </Card>
          ) : null;
        }}
      />
    </div>
  );
}

/**
 * Moving a card, from the card.
 *
 * A MENU, not a drag. Every pointer gesture in this app ships a menu twin
 * anyway — the twin is what works on a phone, with a keyboard, and with a
 * screen reader — so the twin is what gets built first. Dragging can land on
 * top of it later without changing anything here.
 */
/**
 * Where this piece can go next.
 *
 * Offers only the stages its FORMAT passes through — a LinkedIn post has no
 * shoot day, and a menu that offers one is a menu that can strand a card in a
 * column its format cannot explain. The piece's CURRENT stage is always
 * included even when the format skips it, so a piece whose format changed can
 * always be moved back out; hiding the way out is worse than an odd entry.
 */
function StageMenu({ stage, format, name, onMove }: { stage: Stage; format?: Format; name: (s: Stage) => string; onMove: (s: Stage) => void }) {
  const [open, setOpen] = useState(false);
  const offered = stagesFor(format).includes(stage)
    ? stagesFor(format)
    : STAGES.filter((s) => s === stage || stagesFor(format).includes(s));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton size="xs" variant="ghost" label="Move to stage" selected={open}
          icon={<Icon icon={Ellipsis} size={14} />} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[168px] p-1">
        {offered.map((s) => (
          <MenuItem key={s} active={s === stage}
            onClick={() => { setOpen(false); onMove(s); }}>
            {name(s)}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function monthGrid(anchor: Date): string[] {
  // Six weeks from the Monday on or before the 1st — a fixed grid, so the page
  // does not change height as you walk months.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const shift = (first.getDay() + 6) % 7;      // Monday-first
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - shift);
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

// ── The library ──────────────────────────────────────────────────────────────
//
// Everything you KEEP, in one place you can search: what you saved from other
// people and what you put out yourself (lib/content.ts explains why they share a
// shelf). Eden's library is the reference for the SHAPE — a search box first,
// then a narrowing filter, then a grid of things that look like what they are —
// and the difference is what it holds: no AI, no chats, no tables, only the two
// kinds of thing a creator actually keeps.
//
// Grouped by month, because "what did I put out in August" and "that reel I
// saved in June" are both asked by date. A card, not a row, because a swipe
// file is recognised by eye.
function LibraryView({ pieces, kind, onKind, onOpen, onSpark }: {
  pieces: Piece[];
  kind: LibraryFilter;
  onKind: (kind: LibraryFilter) => void;
  onOpen: (id: string) => void;
  /** Start a piece from something saved. The saved thing stays where it is. */
  onSpark: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(LIBRARY_PAGE);
  // A new search or filter starts from the top of the results, not from wherever
  // "Show more" had got to in the last one.
  if (useChanged(`${kind}|${query}`) && limit !== LIBRARY_PAGE) setLimit(LIBRARY_PAGE);

  const all = libraryItems(pieces);
  if (!all.length) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          illustration={<Icon icon={Archive} size={20} />}
          title="Nothing kept yet"
          description="Saved links and published work land here."
        />
      </div>
    );
  }

  const count: Record<LibraryFilter, number> = {
    all: all.length,
    saved: all.filter((i) => i.kind === 'saved').length,
    published: all.filter((i) => i.kind === 'published').length,
  };
  const inKind = kind === 'all' ? all : all.filter((i) => i.kind === kind);
  // Search reaches what only the PAGE knows as well — the fetched title of a link
  // saved as a bare address — for any card whose link has already been read.
  const found = query.trim()
    ? inKind.filter((i) => {
        const url = safeHref(i.kind === 'saved' ? i.piece.meta.sourceUrl : i.piece.meta.liveUrl);
        const link = url ? peekLinkMeta(url) : null;
        return matchesLibrary(i, query, [link?.title, link?.author, link?.siteName]);
      })
    : inKind;
  const shown = found.slice(0, limit);

  return (
    // `page-rhythm`: the app's own top and bottom gutter for a page. Without it
    // the search box sat on the header's rule with no space at all.
    <ViewContainer width="wide" className="page-rhythm">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <TextInput size="sm" icon={<Icon icon={Search} />} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the library" aria-label="Search the library"
            autoComplete="off" data-1p-ignore data-lpignore="true" />
        </div>
        <SegmentedControl
          aria-label="Show"
          fit="content"
          value={kind}
          onValueChange={(v) => onKind(v as LibraryFilter)}
          options={LIBRARY_FILTERS.map((k) => ({
            value: k,
            label: (
              <span className="flex items-center gap-1.5">
                {FILTER_LABEL[k]}
                <span className="text-caption tabular-nums text-ink-500">{count[k]}</span>
              </span>
            ),
            'aria-label': `${FILTER_LABEL[k]}, ${count[k]}`,
          }))}
        />
        {query.trim() && (
          <p role="status" className="sr-only">{found.length === 1 ? '1 result' : `${found.length} results`}</p>
        )}
      </div>

      {found.length === 0 ? (
        query.trim() ? (
          <EmptyLine>Nothing in the library matches “{query.trim()}”.</EmptyLine>
        ) : kind === 'saved' ? (
          <EmptyState illustration={<Icon icon={Bookmark} size={20} />} title="Nothing saved yet"
            description="Save something from the inbox to keep it here." />
        ) : (
          <EmptyState illustration={<Icon icon={Archive} size={20} />} title="Nothing published yet"
            description="Everything you release lands here." />
        )
      ) : (
        <>
          {libraryMonths(shown).map((m) => (
            <section key={m.key || 'undated'} className="mb-8 last:mb-0">
              <h2 className="mb-3 text-overline">
                {/* Something you cannot date is still something you kept — it
                    gets a group rather than being dropped or given a guessed month. */}
                {m.key ? formatMonthYear(`${m.key}-01`) : 'No date'}
              </h2>
              {/* The MEDIUM track: at the small one a thumbnail was 118px tall and
                  the site name truncated to "instagram.…". */}
              <CardGrid min="md">
                {m.items.map((item) => (
                  <LibraryCard key={item.piece.id} item={item} all={pieces} onOpen={onOpen} onSpark={onSpark} />
                ))}
              </CardGrid>
            </section>
          ))}
          {found.length > shown.length && (
            <div className="mt-8 flex justify-center">
              <Button size="sm" variant="secondary" onClick={() => setLimit((n) => n + LIBRARY_PAGE)}>
                Show {Math.min(LIBRARY_PAGE, found.length - shown.length)} more
              </Button>
            </div>
          )}
        </>
      )}
    </ViewContainer>
  );
}

/**
 * One thing you kept, drawn the way it looks where it lives.
 *
 * A saved link shows its page's image, title and site; your own published piece
 * shows its live post when you gave it a link, and what kind of thing it is when
 * you did not. The picture area is always the same shape, so a row of cards
 * stays a row whether or not a site sent an image.
 */
function LibraryCard({ item, all, onOpen, onSpark }: {
  item: LibraryItem;
  /** Every piece — what a saved thing sparked, or what a piece was cut into, are relationships. */
  all: Piece[];
  onOpen: (id: string) => void;
  onSpark: (id: string) => void;
}) {
  const { piece, kind } = item;
  const saved = kind === 'saved';
  const href = safeHref(saved ? piece.meta.sourceUrl : piece.meta.liveUrl) ?? undefined;
  const { link, rememberedImage, stale } = useLinkPreview(piece, href);
  const captured = useContentImage(piece);
  // Best first: a picture you captured (it IS the thing you kept); the platform's
  // own thumbnail, known without asking; then the page's og:image.
  const picture = usePicture([captured, platformThumbnail(href), link?.image]);
  const image = picture.src;
  // A REMEMBERED picture that no longer loads has expired: ask the page again.
  const onImageError = () => { if (image && image === rememberedImage) stale(); picture.onError(); };
  const title = linkedTitle(piece, link?.title);
  // With no picture, the card says what kind of thing it is. A link on a platform
  // is its platform — Instagram's login wall gives us no image, but the camera
  // mark is still the fastest way to know what you saved.
  const platformMark = saved ? markFor(platformOf(href)) : undefined;
  const glyph: IconType = platformMark ?? (saved ? (href ? Globe : Lightbulb) : piece.meta.format ? FORMAT_GLYPH[piece.meta.format] : Video);
  // Only once it has produced something — a "0 ideas" badge on a shelf of saved
  // links is a reproach for having saved them.
  const went = saved ? sparkSummary(piece.id, all) : repurposeSummary(piece.id, all);
  const detail = saved
    ? [piece.meta.sourceAuthor || link?.author?.trim(), href && (link?.siteName?.trim() || hostOf(href))].filter(Boolean).join(' · ')
    : [piece.meta.format && FORMAT_LABEL[piece.meta.format], piece.meta.channel, piece.meta.publishAt && day(piece.meta.publishAt)].filter(Boolean).join(' · ');

  return (
    <div className="group relative min-w-0">
      <Card
        on="paper"
        interactive
        aria-label={title}
        className="h-full gap-0 overflow-hidden p-0"
        onClick={() => onOpen(piece.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(piece.id); }}
      >
        <div className="aspect-video w-full overflow-hidden border-b border-line-soft bg-surface-sunken">
          {image ? (
            /* eslint-disable-next-line @next/next/no-img-element -- any site's og:image; next/image needs a known host */
            <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
              onError={onImageError} onLoad={picture.onLoad} className="size-full object-cover" />
          ) : saved && !href && piece.meta.note ? (
            // A thought kept without a link has no picture, but it has WORDS —
            // and they are what you would recognise it by. A lightbulb on a grey
            // slab said only that there was nothing to show.
            <p className="m-0 line-clamp-4 p-4 text-body leading-relaxed text-ink-800">{piece.meta.note}</p>
          ) : (
            <span className={cn('grid size-full place-items-center', platformMark ? 'text-ink-700' : 'text-ink-500')}>
              <Icon icon={glyph} size={20} weight={platformMark ? 'fill' : undefined} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-ui font-medium text-ink-900">{title}</p>
          <p className="flex min-w-0 items-center gap-1.5 text-caption text-ink-500">
            {/* Where it is from: the platform's mark for a saved link, the channel's
                for your own published piece (link-mark.tsx has the one rule). */}
            {saved
              ? (href ? <LinkMark url={href} favicon={link?.favicon} size={14} /> : <Icon icon={Bookmark} size={12} className="shrink-0" />)
              : <ChannelMark channel={piece.meta.channel} size={14} />}
            <span className="truncate">{detail || (saved ? 'Saved' : 'Published')}</span>
            {went && <span className="shrink-0">· {went}</span>}
          </p>
        </div>
      </Card>
      {/* OUTSIDE the card: the card is a button, and a button inside a button is
          one control that swallows the other. Laid over the picture on a raised
          chip, so it reads on any image in either theme. */}
      {saved && (
        <span className="reveal-on-hover absolute end-2 top-2 flex rounded-md border border-line-soft bg-surface-raised p-0.5 shadow-lift-1">
          <IconButton size="sm" variant="ghost" label="Make something from this"
            icon={<Icon icon={Sparkles} size={16} />} onClick={() => onSpark(piece.id)} />
        </span>
      )}
    </div>
  );
}

/**
 * WHERE THE MONTH GRID STOPS BEING READABLE, measured rather than guessed.
 *
 * A chip gives its title the cell less 32px (the cell's `p-1`, the chip's
 * `px-1`, a 12px glyph and its gap). At `text-caption` a title needs about 65px
 * to show ten characters — enough to tell "August recap" from "Autumn launch"
 * — so a cell narrower than ~97px cannot, and seven of them is ~680px. Below
 * that the grid shows dots and the day's entries are listed underneath, which is
 * what Apple and Google Calendar do on a phone. Before this, at 375px, all nine
 * titles in the fixture were cut to 15px of text: "A…", "Fi…", "T…".
 *
 * A container query rather than a viewport one: the calendar sits beside the
 * sidebar on a laptop and full width on a phone, and it is the calendar's own
 * width that decides whether a title fits.
 *
 * Written out as two WHOLE class strings, not a `${breakpoint}:hidden` template:
 * Tailwind finds classes by scanning source text literally, so a variant built
 * at runtime is never generated — the narrow layout would stay hidden forever
 * and nothing would say why. The first draft of this did exactly that.
 */
const WIDE_CALENDAR = 'flex min-h-0 flex-1 flex-col @max-[42.5rem]:hidden';
const NARROW_CALENDAR = 'hidden flex-col @max-[42.5rem]:flex';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function Weekdays({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('grid grid-cols-7 border-b border-line-soft pb-1.5', className)}>
      {WEEKDAYS.map((d) => (
        <div key={d} className="text-caption font-medium text-ink-500">{d}</div>
      ))}
    </div>
  );
}

type CalendarEntry = { kind: 'shoot' | 'publish'; piece: Piece };

/** A publish date that has passed on unfinished work — the same rule as the board's `Late` badge. */
const entryLate = (e: CalendarEntry, todayISO: string) => e.kind === 'publish' && isLate(e.piece.meta, todayISO);
const entryTitle = (e: CalendarEntry) => e.piece.title?.trim() || 'Untitled';

/** "2 to publish, 1 shoot" — what a day button says to a screen reader. */
function daySummary(entries: CalendarEntry[]): string {
  if (entries.length === 0) return 'nothing scheduled';
  const publish = entries.filter((e) => e.kind === 'publish').length;
  const shoot = entries.length - publish;
  return [
    publish ? `${publish} to publish` : '',
    shoot ? `${shoot} ${shoot === 1 ? 'shoot' : 'shoots'}` : '',
  ].filter(Boolean).join(', ');
}

function ContentCalendar({ pieces, todayISO, onOpen, onShoot }: {
  pieces: Piece[]; todayISO: string; onOpen: (id: string) => void; onShoot: (iso: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date(`${todayISO}T00:00:00`));
  // WHICH WAY you moved is information the grid otherwise throws away: a month
  // that is simply replaced leaves you checking the heading to find out whether
  // you went forward or back. The grid enters from the side you came from.
  // `dir` is state rather than a diff of dates because "Today" can jump either
  // way, and the jump should still say which way it went.
  const [dir, setDir] = useState(0);
  const still = useReducedMotion();
  const days = byDay(pieces);
  const grid = monthGrid(anchor);
  const month = anchor.getMonth();
  const inMonthDays = grid.filter((iso) => new Date(`${iso}T00:00:00`).getMonth() === month);
  // The wide grid keeps all six weeks so the page does not change height as you
  // walk months — it is laid out absolutely inside a fixed region. The narrow one
  // flows and scrolls, so a last week made entirely of next month's days is just
  // 44px of numbers you cannot select. It can never be the FIRST week: the grid
  // starts on the Monday on or before the 1st.
  const narrowGrid = grid.slice(35).some((iso) => inMonthDays.includes(iso)) ? grid : grid.slice(0, 35);

  // The narrow layout's chosen day. `null` means "this month's default", so
  // walking to another month re-derives it instead of carrying a day over from a
  // month that is no longer on screen.
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && inMonthDays.includes(picked)
    ? picked
    : agendaDay(inMonthDays, (iso) => (days.get(iso)?.length ?? 0) > 0, todayISO);
  const dayGrid = useRef<HTMLDivElement>(null);

  const step = (n: number) => {
    setDir(n);
    setPicked(null);
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  };
  const goToday = () => {
    const t = new Date(`${todayISO}T00:00:00`);
    setDir(t < anchor ? -1 : t > anchor ? 1 : 0);
    setPicked(null);
    setAnchor(t);
  };
  const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;

  // One tab stop for the whole narrow grid, arrows to move — a date picker's
  // grammar, because forty-two tab stops is not a keyboard path. Clamped to the
  // month on screen: the leading and trailing days belong to other months.
  const onDayKey = (e: React.KeyboardEvent) => {
    if (!selected) return;
    const i = inMonthDays.indexOf(selected);
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: number;
    if (e.key in moves) next = i + moves[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = inMonthDays.length - 1;
    else return;
    e.preventDefault();
    const iso = inMonthDays[Math.max(0, Math.min(inMonthDays.length - 1, next))];
    setPicked(iso);
    requestAnimationFrame(() => dayGrid.current?.querySelector<HTMLButtonElement>(`[data-day="${iso}"]`)?.focus());
  };

  const selectedEntries: CalendarEntry[] = selected ? days.get(selected) ?? [] : [];
  const open = (e: CalendarEntry, iso: string) => (e.kind === 'shoot' ? onShoot(iso) : onOpen(e.piece.id));

  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-h4 text-ink-900">{formatMonthYear(anchor)}</span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" aria-label="Previous month" icon={<Icon icon={ChevronLeft} size={16} />} onClick={() => step(-1)} />
        <Button size="sm" variant="secondary" onClick={goToday}>Today</Button>
        <Button size="sm" variant="ghost" aria-label="Next month" icon={<Icon icon={ChevronRight} size={16} />} onClick={() => step(1)} />
      </div>

      {/* ── WIDE: the month, with the titles on it ─────────────────────────── */}
      <div className={WIDE_CALENDAR}>
        <Weekdays />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout" custom={dir}>
            <motion.div
              key={monthKey}
              custom={dir}
              initial={still ? false : { transform: `translateX(${dir * 28}px)`, opacity: 0 }}
              animate={{ transform: 'translateX(0px)', opacity: 1 }}
              exit={still ? { opacity: 0 } : { transform: `translateX(${dir * -28}px)`, opacity: 0 }}
              // Short and exponential-out: the grid should have arrived by the time
              // your eye gets there. Anything springy turns a date picker into a toy.
              transition={{ duration: MOTION.slow, ease: MOTION.ease }}
              className="absolute inset-0 grid grid-cols-7 grid-rows-6"
            >
              {grid.map((iso) => {
                const entries = days.get(iso) ?? [];
                const inMonth = new Date(`${iso}T00:00:00`).getMonth() === month;
                return (
                  <div key={iso} className={cn(
                    'min-w-0 overflow-hidden border-b border-r border-line-soft p-1',
                    !inMonth && 'bg-surface-sunken',
                  )}>
                    <div className={cn(
                      'mb-0.5 text-caption tabular-nums',
                      iso === todayISO ? 'font-semibold text-accent' : inMonth ? 'text-ink-600' : 'text-ink-500',
                    )}>{Number(iso.slice(8))}</div>
                    {/* A shoot chip opens the DAY, not the piece: on a shoot day the
                        thing you need is the call sheet — everything being filmed and
                        every shot — not one script. A publish chip opens the piece,
                        because that is the only thing publishing that day. */}
                    {entries.slice(0, 3).map((e) => {
                      const late = entryLate(e, todayISO);
                      return (
                        <button key={`${e.piece.id}:${e.kind}`}
                          onClick={() => open(e, iso)}
                          title={`${e.kind === 'shoot' ? 'Shoot day' : late ? 'Late' : 'Publish'}: ${entryTitle(e)}`}
                          className="focus-ring mb-0.5 flex w-full items-center gap-1 rounded-xs px-1 py-0.5 text-left transition-colors duration-fast hover:bg-surface-hover">
                          {/* A shoot and a publish are the SAME piece on two days, so the
                              glyph has to say which appointment this is — otherwise the
                              calendar reads as two copies of one thing. */}
                          <Icon icon={e.kind === 'shoot' ? Video : CalendarIcon} size={12}
                            className={cn('shrink-0', e.kind === 'shoot' ? 'text-ink-500' : late ? 'text-danger' : 'text-info-600')} />
                          {/* `text-caption`, 12px — it was `text-micro`, 10px, a size below
                              the type scale's own 11px floor, used for the ONE thing on
                              this surface a person actually reads. */}
                          <span className={cn('min-w-0 flex-1 truncate text-caption leading-tight', late ? 'text-danger' : 'text-ink-800')}>
                            {entryTitle(e)}
                          </span>
                        </button>
                      );
                    })}
                    {entries.length > 3 && (
                      <span className="px-1 text-caption text-ink-500">+{entries.length - 3} more</span>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── NARROW: dots on the month, the day's entries underneath ───────── */}
      <div className={NARROW_CALENDAR}>
        <Weekdays />
        <div ref={dayGrid} role="group" aria-label={`Days in ${formatMonthYear(anchor)}`} onKeyDown={onDayKey}
          className="grid grid-cols-7">
          {narrowGrid.map((iso) => {
            const entries = days.get(iso) ?? [];
            const inMonth = new Date(`${iso}T00:00:00`).getMonth() === month;
            const isToday = iso === todayISO;
            const number = (
              <span className={cn(
                'text-ui tabular-nums',
                isToday ? 'font-semibold text-accent' : inMonth ? 'text-ink-800' : 'text-ink-500',
              )}>{Number(iso.slice(8))}</span>
            );
            if (!inMonth) {
              return <div key={iso} aria-hidden className="grid h-11 place-items-center border-b border-line-soft">{number}</div>;
            }
            const isSelected = iso === selected;
            return (
              <button key={iso} type="button" data-day={iso}
                aria-pressed={isSelected}
                aria-label={`${formatDayWithWeekday(iso)}, ${daySummary(entries)}`}
                // Roving: only the chosen day is a tab stop.
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setPicked(iso)}
                className={cn(
                  'focus-ring flex h-11 flex-col items-center justify-center gap-1 border-b border-line-soft transition-colors duration-fast',
                  isSelected ? 'rounded-md bg-surface-active' : 'hover:bg-surface-hover',
                )}>
                {number}
                {/* Dots, not titles — a title cannot fit in a 48px cell. Colour
                    is not the only carrier: the label above says what they are,
                    and the list below spells them out. */}
                <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                  {entries.slice(0, 3).map((e) => (
                    <span key={`${e.piece.id}:${e.kind}`} className={cn(
                      'size-1.5 rounded-full',
                      entryLate(e, todayISO) ? 'bg-danger-600' : e.kind === 'shoot' ? 'bg-ink-500' : 'bg-info-500',
                    )} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <section aria-label={formatDayWithWeekday(selected)} className="mt-4">
            <h3 className="mb-1.5 text-overline text-ink-500">{formatDayWithWeekday(selected)}</h3>
            {selectedEntries.length === 0 ? (
              <p className="m-0 py-2 text-ui text-ink-500">Nothing scheduled.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {selectedEntries.map((e) => {
                  const late = entryLate(e, todayISO);
                  return (
                    <li key={`${e.piece.id}:${e.kind}`}>
                      <button type="button" onClick={() => open(e, selected)}
                        className="focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-fast hover:bg-surface-hover">
                        <Icon icon={e.kind === 'shoot' ? Video : CalendarIcon} size={16}
                          className={cn('shrink-0', e.kind === 'shoot' ? 'text-ink-500' : late ? 'text-danger' : 'text-info-600')} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ui text-ink-900">{entryTitle(e)}</span>
                          <span className="block truncate text-caption text-ink-500">
                            {e.kind === 'shoot' ? 'Shoot' : 'Publish'}
                            {e.piece.meta.channel && ` · ${e.piece.meta.channel}`}
                          </span>
                        </span>
                        {late && <Badge status="danger">Late</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ── The shoot day ────────────────────────────────────────────────────────────
//
// The call sheet. On a shoot morning the question is not "what is this piece
// about" — it is "where am I, what am I filming, and what do I still need". So
// this assembles the DAY: every piece carrying that shoot date, its call time
// and location, and every shot in its script, tickable here.
//
// The shots are the script's own to-do blocks, so nothing was entered twice —
// you wrote "cutaway of the swatches" once, while writing, and this is the same
// line. Ticking it here writes back into the script.

type Loaded = { blocks: Block[]; meta: ContentMeta };

function ShootDayView({ iso, pieces, onClose, onOpenPiece, demoScripts }: {
  iso: string;
  pieces: Piece[];
  onClose: () => void;
  onOpenPiece: (id: string) => void;
  demoScripts?: Record<string, Block[]>;
}) {
  const [loaded, setLoaded] = useState<Record<string, Loaded>>(() => (
    demoScripts
      ? Object.fromEntries(pieces.map((p) => [p.id, { blocks: demoScripts[p.id] ?? [], meta: p.meta }]))
      : {}
  ));
  const [busy, setBusy] = useState(!demoScripts);

  useEffect(() => {
    if (demoScripts) return;
    let alive = true;
    const ids = pieces.map((p) => p.id);
    Promise.all(ids.map((id) => getPage(id).then((r) => ('error' in r ? null : r)).catch(() => null)))
      .then((rows) => {
        if (!alive) return;
        const next: Record<string, Loaded> = {};
        rows.forEach((r, i) => {
          if (r) next[ids[i]] = { blocks: toBlocks(r.content), meta: readContent(r.content) };
        });
        setLoaded(next);
        setBusy(false);
      });
    return () => { alive = false; };
    // The day's membership is what this depends on, not the array identity.
  }, [iso, pieces.map((p) => p.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const allShots: Shot[] = pieces.flatMap((p) => shotsOf(loaded[p.id]?.blocks));
  const summary = shootSummary(pieces, allShots);
  const locations = shootLocations(pieces);

  async function tick(pieceId: string, blockId: string, done: boolean) {
    const cur = loaded[pieceId];
    if (!cur) return;
    const blocks = cur.blocks.map((b) => (b.id === blockId ? { ...b, checked: done } : b));
    setLoaded((m) => ({ ...m, [pieceId]: { ...cur, blocks } }));
    if (demoScripts) return;   // the same prop gates the write, not just the read
    // The pipeline is merged back in: `serialize` owns `blocks` and knows
    // nothing about the shoot date, so saving without it would strip the piece
    // out of the very day you are standing in.
    const r = await updatePage(pieceId, { content: { ...serialize(blocks), ...writeContent(cur.meta) } });
    if ('error' in r) {
      setLoaded((m) => ({ ...m, [pieceId]: cur }));
      toast({ message: r.error, variant: 'error' });
    }
  }

  return (
    <PageView
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      contentType="document"
      title={formatDayWithWeekday(iso, { long: true }) ?? iso}
      breadcrumbs={[
        { label: 'Content', onNavigate: onClose },
        { label: formatDayWithWeekday(iso) ?? iso, icon: <Icon icon={Video} size={14} /> },
      ]}
    >
      <div className={MEASURE}>
        <h1 className="text-title-2 text-ink-900">{formatDayWithWeekday(iso, { long: true }) ?? iso}</h1>
        {summary && <p className="mt-1 text-body text-ink-600">{summary}</p>}

        {locations.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {locations.map((loc) => (
              <span key={loc} className="flex items-center gap-1.5 text-ui text-ink-700">
                <Icon icon={MapPin} size={14} className="text-ink-500" />{loc}
              </span>
            ))}
          </div>
        )}

        {pieces.length === 0 ? (
          <p className="mt-6 text-body text-ink-500">Nothing is being filmed on this day.</p>
        ) : pieces.map((p) => {
          const shots = shotsOf(loaded[p.id]?.blocks);
          return (
            <section key={p.id} className="mt-7">
              <div className="mb-2 flex items-baseline gap-2.5">
                {p.meta.callTime && (
                  <span className="flex shrink-0 items-center gap-1 text-ui tabular-nums text-ink-600">
                    <Icon icon={Clock} size={12} className="text-ink-500" />{p.meta.callTime}
                  </span>
                )}
                <button onClick={() => onOpenPiece(p.id)}
                  className="focus-ring min-w-0 rounded-xs text-left text-h4 text-ink-900 transition-colors duration-fast hover:underline">
                  {p.title?.trim() || 'Untitled'}
                </button>
                {p.meta.location && locations.length > 1 && (
                  <span className="shrink-0 text-caption text-ink-500">{p.meta.location}</span>
                )}
              </div>

              {busy ? (
                <span role="status" aria-label="Loading shots" className="block">
                  <Skeleton shape="line" className="w-2/3" />
                </span>
              ) : shots.length === 0 ? (
                // No shot list is a real answer, not an error: plenty of pieces
                // are filmed straight off the script. Say what would change it.
                <p className="text-ui text-ink-500">
                  No shots yet — a to-do line in the script is a shot.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {shots.map((shot) => (
                    <li key={shot.blockId} className="flex items-start gap-2.5 border-b border-line-soft py-2 last:border-0">
                      <span className="pt-0.5">
                        <Checkbox checked={shot.done} onCheckedChange={(v) => tick(p.id, shot.blockId, v === true)}
                          aria-label={shot.text} />
                      </span>
                      <span className={cn('min-w-0 flex-1 text-ui', shot.done ? 'text-ink-500 line-through' : 'text-ink-800')}>
                        {shot.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </PageView>
  );
}

// ── The piece ────────────────────────────────────────────────────────────────

const MEASURE = 'mx-auto w-full max-w-[720px] px-6 pb-16 pt-6';

function PieceEditor({ piece, projects, siblings, demo, stageTitle, onClose, onMeta, onTitle, onPiece, onCut, onOpenPiece, onSpark, onSort, onRemove, onPlace, demoScripts }: {
  piece: Piece;
  /** What this person calls a stage — the same reader the board header uses. */
  stageTitle: (s: Stage) => string;
  projects: { id: string; name: string }[];
  /** Every piece in the module — lineage is a relationship, so it needs the set. */
  siblings: Piece[];
  demo: boolean;
  onClose: () => void;
  onMeta: (next: Partial<ContentMeta>) => void;
  onTitle: (title: string) => void;
  onPiece: (next: Partial<Piece>) => void;
  /** Create the chosen cuts; the workspace owns the optimistic insert. */
  onCut: (presetIds: string[]) => Promise<void>;
  onOpenPiece: (id: string) => void;
  /** A saved thing: start a new piece from it. The saved thing stays saved. */
  onSpark: () => void;
  /** A capture: decide it, from inside it, exactly as from the inbox list. */
  onSort: (bucket: Bucket, linkTitle?: string) => void;
  /** Send it to Trash, with Undo. */
  onRemove: () => void;
  /** The crumb naming where a saved thing or a capture lives takes you there. */
  onPlace: (place: 'inbox' | 'library') => void;
  /**
   * Dev-preview only: the scripts, already loaded. `ShootDayView` has taken
   * this since M2 and the editor never did — so in the harness the editor
   * called `getPage`, got an auth error, and CLOSED ITSELF on open. The whole
   * detail surface has been unverifiable in the browser since it shipped.
   * One prop gates the read AND the save, for the reason M3 wrote down: a
   * harness that leaves one side live is a harness that lies.
   */
  demoScripts?: Record<string, Block[]>;
}) {
  const [title, setTitle] = useState(piece.title ?? '');
  // The harness's blocks are known at first render, so they are the INITIAL
  // state — not something an effect assigns afterwards. Setting them in an
  // effect renders once with an empty script and once more with the real one,
  // which is both a flash and a `set-state-in-effect` lint error.
  const [blocks, setBlocks] = useState<Block[]>(() => (demoScripts ? demoScripts[piece.id] ?? [] : []));
  const [meta, setMeta] = useState<ContentMeta>(piece.meta);
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved'>(demoScripts ? 'idle' : 'loading');
  const skip = useRef(true);
  /** The save waiting out the debounce, if any — run at once if the page closes first. */
  const pending = useRef<(() => Promise<void>) | null>(null);

  // ── Repurposing ──
  // Nothing is pre-selected, the same rule the project close-out settles: a
  // pipeline that fills with work nobody chose is worse than an empty one.
  const [cuts, setCuts] = useState<string[]>([]);
  const [cutting, setCutting] = useState(false);
  const cutOptions = repurposeOptions(meta);
  const madeCuts = derivativesOf(piece.id, siblings);
  const cutFrom = sourceOf(piece, siblings);

  useEffect(() => {
    let alive = true;
    if (demoScripts) return;
    getPage(piece.id).then((r) => {
      if (!alive) return;
      if ('error' in r) { toast({ message: r.error, variant: 'error' }); onClose(); return; }
      setTitle(r.title ?? '');
      setBlocks(toBlocks(r.content));
      setMeta(readContent(r.content));
      skip.current = true;
      setState('idle');
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, onClose]);

  useEffect(() => {
    if (state === 'loading' || isTempId(piece.id) || demoScripts) return;
    if (skip.current) { skip.current = false; return; }
    setState('saving');
    const save = async () => {
      pending.current = null;
      const next = title.trim();
      // The pipeline is MERGED into the body's JSON, never written over it —
      // `serialize` owns `blocks`, this owns `pipeline`, and a save that
      // replaced the whole object would drop whichever half it did not know.
      const r = await updatePage(piece.id, { title: next, content: { ...serialize(blocks), ...writeContent(meta) } });
      if ('error' in r) { toast({ message: r.error, variant: 'error' }); setState('idle'); return; }
      onTitle(next);
      setState('saved');
    };
    pending.current = save;
    const t = setTimeout(save, 600);
    return () => clearTimeout(t);
  }, [title, blocks, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  // FLUSH ON THE WAY OUT. The save above waits 600ms for typing to settle, and
  // closing the page unmounts this component — whose cleanup cancelled the
  // timer. Type a title, press Esc inside that window, and the edit was simply
  // gone. The last pending save now runs as the page closes instead.
  useEffect(() => () => { void pending.current?.(); }, []);

  // The board hears about it NOW, not after the debounce and the round trip.
  // Changing a stage is the one edit whose whole point is somewhere else on
  // screen — waiting 600ms to see the card move makes the control feel broken.
  const [asking, setAsking] = useState(false);

  /** Attach the piece to a project. `setPageLinks` already existed for docs. */
  async function setProject(projectId: string | null) {
    onPiece({ projectId });
    if (demo) return;
    const r = await setPageLinks(piece.id, { projectId });
    if ('error' in r) { onPiece({ projectId: piece.projectId }); toast({ message: r.error, variant: 'error' }); }
  }

  /**
   * Ask the client to sign off. EXPLICIT, never a side effect of reaching the
   * review stage — this makes the piece visible in their portal, and something
   * that shows a client something is not a thing to do by inference. (The same
   * reason client updates ship two buttons rather than a remembered mode.)
   */
  async function ask() {
    if (!piece.projectId) return;
    setAsking(true);
    try {
      if (!demo) {
        const r = await requestApproval(piece.id);
        if ('error' in r) throw new Error(r.error);
      }
      onPiece({ approval: { id: 'pending', status: 'awaiting', createdAt: new Date().toISOString() } });
      set({ stage: 'review' });
      toast({ message: 'Sent to the client', variant: 'success' });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Could not send that.', variant: 'error' });
    } finally {
      setAsking(false);
    }
  }

  async function withdraw() {
    const id = piece.approval?.id;
    if (!id) return;
    const before = piece.approval;
    onPiece({ approval: undefined });
    if (demo) return;
    const r = await cancelApproval(id);
    if ('error' in r) { onPiece({ approval: before }); toast({ message: r.error, variant: 'error' }); }
  }

  const set = (next: Partial<ContentMeta>) => {
    setMeta((m) => ({ ...m, ...next }));
    onMeta(next);
  };

  const brief = briefOf(blocks);
  /**
   * Seed the missing sections. `seedBrief` is idempotent, so this is safe to
   * press twice — and it will be, because the control stays visible while the
   * brief is incomplete. Blocks go through the SAME `setBlocks` the editor
   * uses, so the existing debounced save carries them; there is no second
   * write path to keep in step.
   */
  const addBrief = () => setBlocks((bs) => seedBrief(bs, (type, text) => ({ id: genId(), type, text })));
  const heading = title.trim() || 'Untitled';
  const bucket = meta.bucket;
  // A capture or a saved thing points OUT at someone's page; a piece in the
  // pipeline is yours, named by you, and asks the web for nothing.
  const sourceHref = bucket === 'piece' ? undefined : safeHref(meta.sourceUrl) ?? undefined;
  const { link } = useLinkPreview({ id: piece.id, meta }, sourceHref);
  // …and your own piece, once it is OUT, points at where it went.
  const liveHref = bucket === 'piece' && isSettled(meta.stage) ? safeHref(meta.liveUrl) ?? undefined : undefined;
  const { link: live } = useLinkPreview({ id: piece.id, meta }, liveHref);
  // THE PAGE'S OWN TITLE REPLACES OUR PLACEHOLDER — once the row has loaded, and
  // only while the title is still the address the capture box derived from the
  // link. Derived state, so it is set during render rather than in an effect, and
  // it stops itself: the new title is no longer a placeholder. The ordinary save
  // then stores it, so search and Home stop saying "youtube.com/watch" too.
  const fetchedTitle = link?.title?.trim();
  if (state !== 'loading' && fetchedTitle && title !== fetchedTitle && isAutoTitle(title, meta.sourceUrl)) {
    setTitle(fetchedTitle);
  }
  // A PICTURE THAT LANDS WHILE THE PAGE IS OPEN. The upload finishes after the
  // capture row exists, so this page may have loaded its content before the
  // image was attached — and every save writes the whole pipeline back. Adopt
  // the stored reference the moment the workspace has it, or the next save
  // would quietly erase the picture it was opened to look at.
  if (piece.meta.image && meta.image !== piece.meta.image) {
    setMeta((m) => ({ ...m, image: piece.meta.image }));
  }
  // …and the same for a preview remembered while the page is open, or the next
  // save would forget it and the Library would ask for it all over again.
  if (piece.meta.preview && meta.preview !== piece.meta.preview) {
    setMeta((m) => ({ ...m, preview: piece.meta.preview }));
  }
  const figure = { localImage: piece.localImage, meta };
  const sparked = bucket === 'reference' ? derivativesOf(piece.id, siblings) : [];
  /**
   * Decide a capture from inside it. The workspace writes it NOW — a pending
   * debounced save is not somewhere to keep a decision — and the local copy moves
   * with it, so this page becomes the view that fits what it now is.
   */
  const triage = (next: Bucket) => {
    setMeta((m) => ({ ...m, bucket: next, stage: next === 'piece' ? 'idea' : m.stage }));
    onSort(next, link?.title);
  };
  // The stages this piece can be in: its format's own path, plus wherever it
  // already is if that is off the path (an imported or re-formatted piece), so
  // neither the select nor the breadcrumb ever shows a blank current stage.
  const offeredStages = stagesFor(meta.format).includes(meta.stage)
    ? stagesFor(meta.format)
    : STAGES.filter((s) => s === meta.stage || stagesFor(meta.format).includes(s));

  return (
    <PageView
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      contentType="document"
      title={heading}
      // Where the piece LIVES, the way a Docs page shows its folder path: the
      // module, the stage it is in, then the piece. The stage crumb opens its
      // siblings (the app's interactive-breadcrumb rule) — here, the other
      // stages — so moving a piece is available from the place that names where
      // it is.
      // …and a saved thing or a capture lives in a PLACE, not a stage. The stage
      // crumb on a saved reel used to read "Idea" and offer to move it along a
      // pipeline it can never enter (`onlyPieces` keeps it off the board), so
      // choosing a stage did nothing you could see.
      breadcrumbs={[
        { label: 'Content', onNavigate: onClose },
        bucket === 'piece' ? {
          label: stageTitle(meta.stage),
          // A picker, not a place: its menu MOVES the piece, so it wears a caret.
          caret: true,
          menuLabel: `${stageTitle(meta.stage)} — move to another stage`,
          menu: () => [{
            items: offeredStages.map((s) => ({
              id: s,
              label: stageTitle(s),
              current: s === meta.stage,
              onSelect: () => set({ stage: s }),
            })),
          }],
        } : bucket === 'reference'
          ? { label: 'Library', onNavigate: () => onPlace('library') }
          : { label: 'Inbox', onNavigate: () => onPlace('inbox') },
        { label: heading, icon: <Icon icon={bucket === 'piece' ? Video : bucket === 'reference' ? Bookmark : Tray} size={14} /> },
      ]}
      href={isTempId(piece.id) ? undefined : `/documents?page=${piece.id}`}
      actions={state === 'saving' || state === 'saved'
        ? <span role="status" className="px-1 text-meta text-ink-500">{state === 'saving' ? 'Saving…' : 'Saved'}</span>
        : undefined}
    >
      <div className={MEASURE}>
        <input data-chromeless value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled" aria-label="Content title" autoComplete="off" data-1p-ignore data-lpignore="true"
          className="mb-1 w-full border-0 bg-transparent text-title-2 text-ink-900 outline-none placeholder:text-ink-500" />

        {/* ── A SAVED THING ──────────────────────────────────────────────
            Someone else's work, kept to learn from. It has no stage, format,
            dates or sign-off — until 2026-09-14 it opened in the production
            editor anyway, and the one thing it had no way to do was take you to
            the page it came from. */}
        {bucket === 'reference' && (
          <div className="mb-6 flex flex-col gap-4">
            <ContentFigure piece={figure} />
            {sourceHref && <LinkCard url={sourceHref} meta={link} />}
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-y border-line-soft py-3">
              {/* Full width: a URL is the one value here that is always long, and
                  a field sized like Channel cut it off at "…/watc". */}
              <Field label="Link">
                <div className="w-full">
                  <TextInput type="url" value={meta.sourceUrl ?? ''} onChange={(e) => set({ sourceUrl: e.target.value.trim() || undefined })}
                    placeholder="https://" aria-label="Link" autoComplete="off" data-1p-ignore data-lpignore="true" />
                </div>
              </Field>
              <Field label="Made by">
                <div className="w-full">
                  <TextInput value={meta.sourceAuthor ?? ''} onChange={(e) => set({ sourceAuthor: e.target.value || undefined })}
                    placeholder={link?.author?.trim() || 'A name, a handle or a channel'} aria-label="Made by"
                    autoComplete="off" data-1p-ignore data-lpignore="true" />
                </div>
              </Field>
              {/* The one field that makes a bookmark worth having later. */}
              <span className="self-start pt-2 text-caption text-ink-500">Why you kept it</span>
              <Textarea value={meta.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })}
                placeholder="What works here: the hook, the cut, the pacing" aria-label="Why you kept it" />
            </div>
            {/* What it has become. A saved thing is never used up — one reel can
                start three ideas over a year. */}
            {sparked.length > 0 && (
              <RelatedList pieces={sparked} glyph={Sparkles} stageTitle={stageTitle} onOpen={onOpenPiece} />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Icon icon={Sparkles} size={16} />} onClick={onSpark}>
                Make something from this
              </Button>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" icon={<Icon icon={Trash2} size={16} />} onClick={onRemove}>Move to Trash</Button>
            </div>
          </div>
        )}

        {/* ── A CAPTURE ─────────────────────────────────────────────────
            Not a commitment yet. It shows what it is and asks the one question
            the inbox exists to ask, with the same three answers as the list. */}
        {bucket === 'inbox' && (
          <div className="mb-6 flex flex-col gap-4">
            <ContentFigure piece={figure} />
            {sourceHref && <LinkCard url={sourceHref} meta={link} />}
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-y border-line-soft py-3">
              <span className="self-start pt-2 text-caption text-ink-500">Note</span>
              <Textarea value={meta.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })}
                placeholder="Anything worth remembering about it" aria-label="Note" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Icon icon={ArrowRight} size={16} />} onClick={() => triage('piece')}>
                Add to pipeline
              </Button>
              <Button size="sm" variant="secondary" icon={<Icon icon={Bookmark} size={16} />} onClick={() => triage('reference')}>
                Save to library
              </Button>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" icon={<Icon icon={Trash2} size={16} />} onClick={onRemove}>Move to Trash</Button>
            </div>
          </div>
        )}

        {bucket === 'piece' && (<>
        {/* The hook sits directly under the title because it is the title's
            real job — "what makes this worth watching" is the first thing you
            lose and the last thing you can reconstruct. */}
        <input data-chromeless value={meta.hook ?? ''} onChange={(e) => set({ hook: e.target.value })}
          placeholder="The hook — why anyone would stop scrolling" aria-label="Hook"
          autoComplete="off" data-1p-ignore data-lpignore="true"
          className="mb-4 w-full border-0 bg-transparent text-body text-ink-600 outline-none placeholder:text-ink-500" />

        <div className="mb-5 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-y border-line-soft py-3">
          <Field label="Stage">
            {/* Only the stages this FORMAT passes through — a post has no
                shoot day. The current value is always among them even if the
                format skips it (a format changed after the fact), because a
                Select whose value is not in its own options renders blank and
                the piece looks broken. */}
            <Select aria-label="Stage" size="sm" value={meta.stage} onValueChange={(v) => set({ stage: v as Stage })}
              groups={[{ options: offeredStages.map((s) => ({ value: s, label: stageTitle(s) })) }]} />
          </Field>
          {/* The stage's verb, spelled out. A pipeline that only names states
              makes you translate every time you look at it.
              Not while a sign-off is out: the approval block below already says
              whose move it is, and for changes requested `nextAction` IS the
              client's note — the same sentence printed twice, eight lines apart. */}
          {!needsChanges(piece) && !isAwaitingClient(piece) && (
            <span className="col-span-2 -mt-1 text-caption text-ink-500">{nextAction(piece)}</span>
          )}

          <Field label="Format">
            <Select aria-label="Format" size="sm" placeholder="Not set" value={meta.format ?? undefined} onValueChange={(v) => set({ format: (v || undefined) as Format | undefined })}
              groups={[{ options: FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] })) }]} />
          </Field>

          <Field label="Channel">
            <TextInput value={meta.channel ?? ''} onChange={(e) => set({ channel: e.target.value || undefined })}
              placeholder="YouTube, Instagram…" list="zb-channels" aria-label="Channel"
              autoComplete="off" data-1p-ignore data-lpignore="true" />
            <datalist id="zb-channels">{CHANNEL_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>

          {/* A project is what makes a client sign-off possible at all —
              `approvals.project_id` is NOT NULL — so it sits with the other
              facts, not hidden behind the button that needs it. */}
          <Field label="Project">
            <Select aria-label="Project" size="sm" placeholder="None"
              value={piece.projectId ?? undefined}
              onValueChange={(v) => setProject(v || null)}
              groups={[{ options: projects.map((pr) => ({ value: pr.id, label: pr.name })) }]} />
          </Field>

          <Field label="Shoot">
            <span className="flex items-center gap-2">
              <DatePicker aria-label="Shoot date" className="w-[168px]"
                value={meta.shootAt ?? null} onValueChange={(iso) => set({ shootAt: iso || undefined })} />
              {/* Call time only once there is a day to be called to. A time on
                  its own is not a fact about anything. */}
              {meta.shootAt && (
                <TimePicker aria-label="Call time" className="w-[104px]"
                  value={meta.callTime ?? null} onValueChange={(v) => set({ callTime: v || undefined })} />
              )}
            </span>
          </Field>

          {meta.shootAt && (
            <Field label="Location">
              <TextInput value={meta.location ?? ''} onChange={(e) => set({ location: e.target.value || undefined })}
                placeholder="Studio, rooftop, client's office…" aria-label="Location"
                autoComplete="off" data-1p-ignore data-lpignore="true" />
            </Field>
          )}

          <Field label="Publish">
            <DatePicker aria-label="Publish date" className="w-[168px]"
              value={meta.publishAt ?? null} onValueChange={(iso) => set({ publishAt: iso || undefined })} />
          </Field>

          {/* Where it WENT OUT — only once there is somewhere it could have gone.
              The Library shows the live post from this, and opens it. */}
          {isSettled(meta.stage) && (
            <Field label="Live link">
              <div className="w-full">
                <TextInput type="url" value={meta.liveUrl ?? ''} onChange={(e) => set({ liveUrl: e.target.value.trim() || undefined })}
                  placeholder="The post or video, once it is out" aria-label="Live link"
                  autoComplete="off" data-1p-ignore data-lpignore="true" />
              </div>
            </Field>
          )}
        </div>

        {/* The live post, the way it looks where it went — and a click away. A
            text field holding a URL is not a way to get to anything. */}
        {liveHref && <LinkCard url={liveHref} meta={live} className="mb-5 -mt-2" />}

        {/* A piece that started as a picture keeps it — it is the reference the
            idea came from, and "what did that screenshot show" is asked mid-script. */}
        <ContentFigure piece={figure} className="mb-5 -mt-2" />

        {/* ── THE CLIENT'S SIGN-OFF ──────────────────────────────────────
            Only where it can mean something. With no project there is nobody to
            ask, so the row says that rather than offering a button that would
            fail — `approvals.project_id` is NOT NULL and the portal is per
            project. Everything below runs on `approvals` (0019) and the
            existing `requestApproval`, so it reaches the client's portal and
            Home's "waiting on others" without a line of new plumbing. */}
        <div className="mb-5 -mt-2">
          {piece.approval?.status === 'changes_requested' ? (
            // The DS in-flow message, not a hand-drawn box: that box asked for
            // `danger-200` / `danger-50`, steps the ramp does not have, so it
            // rendered with no fill and the app's default grey edge. The body is
            // `nextAction` — the client's note, or what to do when they left none.
            <Alert variant="danger" title="Changes requested"
              actions={<Button size="sm" variant="secondary" loading={asking} onClick={ask}>Send again</Button>}>
              {nextAction(piece)}
            </Alert>
          ) : piece.approval?.status === 'awaiting' ? (
            <div className="flex items-center gap-2">
              <Badge status="warning">With the client</Badge>
              <span className="text-caption text-ink-500">
                Sent {piece.approval.createdAt ? day(piece.approval.createdAt.slice(0, 10)) : 'recently'}
              </span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={withdraw}>Withdraw</Button>
            </div>
          ) : piece.approval?.status === 'approved' ? (
            <Badge status="success">Approved by the client</Badge>
          ) : piece.projectId ? (
            <Button size="sm" variant="secondary" loading={asking} onClick={ask}>Send to the client</Button>
          ) : (
            <p className="text-caption text-ink-500">Attach a project to send this for client sign-off.</p>
          )}
        </div>

        {/* ── WHAT THIS BECOMES, AND WHAT IT CAME FROM ─────────────────
            One recording becomes five things, and that is where most of the
            leverage in the job is — but only if the material stays attached to
            the cuts. What this removes is the bookkeeping (format, project,
            client, the link back, the fact the cut exists), never the writing:
            a button that spawns five blank rows has moved the typing, and one
            that invents a hook for a video it has not watched is what makes a
            product feel generated.

            It appears only on the four long forms, because a short IS the atom
            — "repurpose this short into a video" is a different, larger thing
            made from scratch, and offering it would put a control on every
            card that mostly means nothing. */}
        {/* SAME EDGE, TWO READINGS. A cut is a shorter version of your own
            piece; a spark is a new thing someone else's work made you think
            of. Calling a spark a "cut" would claim your idea is a derivative
            of a competitor's reel, which is both wrong and the kind of wrong
            nobody notices until it is on screen. */}
        {cutFrom && (
          <div className="mb-4 flex items-center gap-1.5 text-caption text-ink-500">
            <Icon icon={lineageOf(cutFrom) === 'spark' ? Sparkles : Bookmark} size={14} />
            <span>{lineageOf(cutFrom) === 'spark' ? 'Sparked by' : 'Cut from'}</span>
            <button type="button" onClick={() => onOpenPiece(cutFrom.id)}
              className="focus-ring truncate rounded-xs text-ink-800 underline decoration-line-strong underline-offset-2 hover:text-ink-900 [@media(pointer:coarse)]:min-h-6">
              {cutFrom.title || 'Untitled'}
            </button>
          </div>
        )}

        {canRepurpose(meta) && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-caption text-ink-500">
                {/* Says nothing until there is something to say — a "0 cuts"
                    badge is a reproach, not information. */}
                {repurposeSummary(piece.id, siblings) ?? 'Cut this into shorter pieces'}
              </span>
            </div>

            {madeCuts.length > 0 && (
              <RelatedList pieces={madeCuts} stageTitle={stageTitle} onOpen={onOpenPiece} className="mb-2" />
            )}

            <ToggleGroup type="multiple" variant="outline" size="sm" spacing={1}
              value={cuts} onValueChange={setCuts} aria-label="What to cut this into">
              {cutOptions.map((o) => (
                <ToggleGroupItem key={o.id} value={o.id} aria-label={o.label}>{o.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>

            {cuts.length > 0 && (
              <Button size="sm" variant="secondary" className="mt-2" loading={cutting}
                onClick={async () => {
                  setCutting(true);
                  try { await onCut(cuts); setCuts([]); } finally { setCutting(false); }
                }}>
                Create {cuts.length} {cuts.length === 1 ? 'cut' : 'cuts'}
              </Button>
            )}
          </div>
        )}

        {/* ── The brief ──
            One quiet row between the facts and the script, because that is
            where it belongs in the work: the brief is what you decide BEFORE
            you write, and the script is what you write afterwards.

            It is not a form. Ten labelled inputs is what makes a creator open
            a doc instead, and the brief's value is the thinking, not the
            filing — so the sections are real headings in the document, with
            comments and @-mentions on them, and this row only says whether the
            thinking has happened. */}
        {state !== 'loading' && (
          <div className="mb-4 flex items-center gap-3">
            {brief.present ? (
              <>
                <span className="text-caption text-ink-500">
                  Brief · {brief.answered.length} of {brief.total} answered
                </span>
                {/* Offered ONLY when a section is genuinely absent. A blank
                    section already has a heading to type under; a button that
                    "adds" it again would do nothing visible and read as broken. */}
                {brief.answered.length + brief.blank.length < brief.total && (
                  <Button size="sm" variant="ghost" onClick={addBrief}>Add missing sections</Button>
                )}
              </>
            ) : (
              <Button size="sm" icon={<Icon icon={Plus} size={16} />} onClick={addBrief}>Add brief</Button>
            )}
          </div>
        )}

        </>)}

        {state === 'loading' ? (
          <div className="flex flex-col gap-3" aria-label="Loading script" aria-busy="true">
            <SkeletonText lines={3} />
          </div>
        ) : (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}

        {/* The rest of the ecosystem, from the one projection. A piece is a page,
            so `docEdges` already knows its project and its client — which is the
            answer to "what else is this attached to" without a second query or a
            second idea of what connected means. Absent in the harness, which has
            no database to ask. */}
        {!demo && !isTempId(piece.id) && (
          <ConnectedPanel self={{ type: 'content', id: piece.id }} className="mt-10" />
        )}
      </div>
    </PageView>
  );
}

/**
 * What every link on a Content screen needs to know to use a REMEMBERED preview:
 * today (to judge freshness) and how to remember a new one. Provided once by the
 * workspace; `remember` is absent in a harness, which has no session to write with.
 */
const PreviewContext = createContext<{ todayISO: string; remember?: (pieceId: string, preview: LinkPreview) => void }>({ todayISO: '' });

// Per session, so a card that re-mounts (a filter switch, a search) does not
// write the same preview twice.
const REMEMBERED = new Set<string>();

/**
 * A link's preview, for a row that owns it.
 *
 * REMEMBERED when the row holds a fresh one for this very link — no request at
 * all. Otherwise fetched (`/api/unfurl`) and then remembered on the row, once, so
 * the next visit needs no request either. `stale()` sets the remembered one
 * aside and asks again: a picture that no longer loads is the signal, because a
 * platform's signed image address expires in days.
 */
function useLinkPreview(piece: Pick<Piece, 'id' | 'meta'>, url: string | undefined) {
  const { todayISO, remember } = useContext(PreviewContext);
  const [stale, setStale] = useState(false);
  const known = stale ? undefined : freshPreview(piece.meta, url, todayISO);
  const fetched = useLinkMeta(known ? undefined : url);
  const offered = url && fetched ? previewFrom(fetched, url, todayISO) : undefined;
  const key = offered ? `${piece.id}|${offered.url}|${offered.title ?? ''}|${offered.image ?? ''}` : '';
  useEffect(() => {
    if (!offered || !remember || REMEMBERED.has(key)) return;
    REMEMBERED.add(key);
    remember(piece.id, offered);
    // `key` is the preview's identity; `offered` is rebuilt every render.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const link: LinkMeta | null | undefined = known
    ? { url: known.url, title: known.title, image: known.image, siteName: known.siteName, author: known.author, favicon: known.favicon }
    : fetched;
  return { link, rememberedImage: known?.image, stale: () => setStale(true) };
}

/**
 * The first of several possible pictures that actually works.
 *
 * A saved link can be pictured three ways, best first: a picture you captured
 * yourself; the platform's own thumbnail, known without asking (a YouTube video's
 * address is enough); the page's og:image, once fetched. Any of them can fail —
 * a dead link, a hotlink refusal, YouTube's grey 120×90 "no thumbnail" image,
 * which LOADS rather than erroring — and a failure must fall to the next, not to
 * nothing. Failures are remembered by URL, so a new candidate is tried fresh.
 */
function usePicture(candidates: readonly (string | null | undefined)[]) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const src = candidates.find((c): c is string => !!c && !failed.has(c)) ?? null;
  const fail = (url: string) => setFailed((f) => new Set(f).add(url));
  return {
    src,
    onError: () => { if (src) fail(src); },
    onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => { if (src && isMissingThumbnail(e.currentTarget)) fail(src); },
  };
}

/**
 * A capture's picture: its own bytes while it is still uploading, then the
 * stored file (a short-lived signed URL, asked for in a batch with every other
 * picture on screen — lib/use-attachment.ts).
 */
function useContentImage(piece: Pick<Piece, 'localImage' | 'meta'>): string | null {
  const stored = coverAttachmentId(piece.meta.image);
  const { url } = useAttachmentUrl(piece.localImage ? null : stored);
  return piece.localImage ?? url;
}

/**
 * The picture a capture is, at a size you can read, opening full size on click.
 * A signed URL is minted at the moment of the click — never one sitting in the
 * DOM going stale (`openAttachment`).
 */
function ContentFigure({ piece, className }: { piece: Pick<Piece, 'localImage' | 'meta'>; className?: string }) {
  const url = useContentImage(piece);
  const stored = coverAttachmentId(piece.meta.image);
  if (!url) return null;
  const open = async () => {
    if (!stored) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    const res = await openAttachment(stored);
    if ('error' in res) toast({ message: res.error, variant: 'error' });
  };
  return (
    <button type="button" onClick={() => { void open(); }} aria-label="Open the image at full size"
      className={cn('focus-ring block w-full overflow-hidden rounded-md border border-line bg-surface-sunken', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed or local URL; next/image cannot optimise either */}
      <img src={url} alt="" className="mx-auto block max-h-[420px] w-auto max-w-full object-contain" />
    </button>
  );
}

/**
 * The pieces something led to — the cuts of a video, the ideas a saved reel
 * sparked — each with the stage it is in. One list for both relationships, so a
 * cut and a spark cannot drift into two looks for the same kind of line.
 */
function RelatedList({ pieces, glyph, stageTitle, onOpen, className }: {
  pieces: Piece[];
  glyph?: IconType;
  stageTitle: (s: Stage) => string;
  onOpen: (id: string) => void;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-0.5', className)}>
      {pieces.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => onOpen(c.id)}
            className="focus-ring flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-ui text-ink-800 hover:bg-surface-hover">
            {glyph && <Icon icon={glyph} size={14} className="shrink-0 text-ink-500" />}
            <span className="truncate">{c.title || 'Untitled'}</span>
            <span className="ms-auto shrink-0 text-caption text-ink-500">{stageTitle(c.meta.stage)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-caption text-ink-500">{label}</span>
      <span className="flex min-w-0 items-center">{children}</span>
    </>
  );
}
