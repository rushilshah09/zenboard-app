import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readContent, writeContent, board, byDay, isLate, isAwaitingClient, needsChanges, isSettled,
  contentSummary, shotsOf, shootDay, shootLocations, shootSummary,
  contentToday, contentTodaySummary, contentFromProject, PROJECT_CONTENT_PRESETS, CASE_STUDY_SECTIONS,
  STAGES, onlyPieces, inbox, references, parseCapture, briefOf, seedBrief, BRIEF_SECTIONS,
  canRepurpose, repurposeOptions, repurpose, derivativesOf, sourceOf, repurposeSummary,
  libraryItems, libraryMonths, matchesLibrary, isAutoTitle, linkedTitle, imageCaptureTitle,
  readPreview, previewFrom, freshPreview, PREVIEW_FRESH_DAYS,
  librarySummary, PUBLISHED_ON_BOARD, needsYou, nextAction, landingIndex, agendaDay,
  isReference, lineageOf, ideaFromReference, sparkSummary,
  stagesFor, stageApplies, boardStages, STAGE_LABEL, FORMATS,
  REPURPOSE_PRESETS, WRITEUP_SECTIONS, inboxCapture, type Piece, type ContentMeta,
} from './content';

const TODAY = '2026-09-05';
const piece = (id: string, meta: Partial<ContentMeta> = {}, title = id): Piece =>
  ({ id, title, meta: { stage: 'idea', bucket: 'piece', ...meta } });

describe('reading a stored pipeline', () => {
  it('reads every field back', () => {
    const stored = { blocks: [], pipeline: { stage: 'shoot', bucket: 'piece', format: 'short', channel: 'TikTok', publishAt: '2026-09-10', shootAt: '2026-09-08', hook: 'The one nobody tells you' } };
    expect(readContent(stored)).toEqual({
      stage: 'shoot', bucket: 'piece', format: 'short', channel: 'TikTok',
      publishAt: '2026-09-10', shootAt: '2026-09-08', hook: 'The one nobody tells you',
    });
  });

  // A JSON-persisted enum has no database to reject a bad value, so the READER
  // is the only guard. A card in a column that does not exist is a card you
  // cannot see and cannot drag back.
  it('lands an unknown stage on idea, which claims nothing', () => {
    for (const bad of ['filming', 'DONE', '', null, 7, {}]) {
      expect(readContent({ pipeline: { stage: bad } }).stage).toBe('idea');
    }
  });

  it('keeps where a piece went out, and drops a blank one', () => {
    const meta: ContentMeta = { stage: 'published', bucket: 'piece', liveUrl: 'https://youtu.be/abc' };
    expect(readContent(writeContent(meta)).liveUrl).toBe('https://youtu.be/abc');
    expect(readContent({ pipeline: { stage: 'published', liveUrl: '   ' } }).liveUrl).toBeUndefined();
  });

  it('keeps a picture only as an attachment reference', () => {
    // A data-URL in the content JSON would be re-read on every open and
    // snapshotted into every version — the reason covers moved off them.
    expect(readContent({ pipeline: { stage: 'idea', bucket: 'inbox', image: 'attachment:abc' } }).image).toBe('attachment:abc');
    expect(readContent({ pipeline: { stage: 'idea', image: 'data:image/png;base64,AAAA' } }).image).toBeUndefined();
    expect(readContent({ pipeline: { stage: 'idea', image: 'https://example.com/a.png' } }).image).toBeUndefined();
    expect(readContent(writeContent({ stage: 'idea', bucket: 'inbox', image: 'attachment:xyz' })).image).toBe('attachment:xyz');
  });

  it('drops an unknown format rather than inventing one', () => {
    expect(readContent({ pipeline: { stage: 'idea', bucket: 'piece', format: 'tweet' } }).format).toBeUndefined();
  });

  // A half-typed date must never reach the calendar as a day key.
  it('refuses a date that is not a calendar day', () => {
    for (const bad of ['2026-9-5', '2026-09-05T10:00:00Z', 'tomorrow', '']) {
      expect(readContent({ pipeline: { stage: 'idea', bucket: 'piece', publishAt: bad } }).publishAt).toBeUndefined();
    }
  });

  it('survives a page that has no pipeline at all', () => {
    expect(readContent({ blocks: [] }).stage).toBe('idea');
    expect(readContent(null).stage).toBe('idea');
    expect(readContent('nope').stage).toBe('idea');
  });

  it('round-trips through write and omits what is empty', () => {
    const meta: ContentMeta = { stage: 'edit', bucket: 'piece', channel: 'YouTube' };
    expect(writeContent(meta)).toEqual({ pipeline: { stage: 'edit', bucket: 'piece', channel: 'YouTube' } });
    expect(readContent(writeContent(meta))).toEqual({ stage: 'edit', bucket: 'piece', channel: 'YouTube' });
  });
});

describe('what a stage means', () => {
  it('scheduled and published are the settled ones', () => {
    expect(STAGES.filter(isSettled)).toEqual(['scheduled', 'published']);
  });
});

describe('whose move it is', () => {
  const inReview = (approval?: Piece['approval']): Piece =>
    ({ id: 'p', title: 'p', meta: { stage: 'review', bucket: 'piece' }, approval });

  // THE MISTAKE THIS GUARDS. `review` says a piece is being looked at, not by
  // whom — and most reviews are your own. A stage-only rule would fill "waiting
  // on others" with your own homework, which is what lib/waiting.ts refuses to
  // do with a `pending` client request.
  it('being in review is NOT waiting on anyone', () => {
    expect(isAwaitingClient(inReview())).toBe(false);
  });

  it('an unanswered client ask IS', () => {
    expect(isAwaitingClient(inReview({ id: 'a', status: 'awaiting' }))).toBe(true);
  });

  it('an answered one is not — the move came back to you', () => {
    expect(isAwaitingClient(inReview({ id: 'a', status: 'approved' }))).toBe(false);
    expect(isAwaitingClient(inReview({ id: 'a', status: 'changes_requested' }))).toBe(false);
  });

  it('changes requested is its own state: they answered, and the answer was no', () => {
    expect(needsChanges(inReview({ id: 'a', status: 'changes_requested' }))).toBe(true);
    expect(needsChanges(inReview({ id: 'a', status: 'awaiting' }))).toBe(false);
    expect(needsChanges(inReview())).toBe(false);
  });
});

describe('late', () => {
  it('a passed publish date on unfinished work is late', () => {
    expect(isLate({ stage: 'edit', bucket: 'piece', publishAt: '2026-09-01' }, TODAY)).toBe(true);
  });
  it('today is not late', () => {
    expect(isLate({ stage: 'edit', bucket: 'piece', publishAt: TODAY }, TODAY)).toBe(false);
  });
  // It went out. Whenever that was, it is not late now.
  it('published is never late', () => {
    expect(isLate({ stage: 'published', bucket: 'piece', publishAt: '2026-01-01' }, TODAY)).toBe(false);
  });
  // The date is the plan, and the plan has not failed yet.
  it('scheduled is not late', () => {
    expect(isLate({ stage: 'scheduled', bucket: 'piece', publishAt: '2026-01-01' }, TODAY)).toBe(false);
  });
  it('no date is never late', () => {
    expect(isLate({ stage: 'edit', bucket: 'piece' }, TODAY)).toBe(false);
  });
});

describe('the board', () => {
  it('has one column per stage, in pipeline order', () => {
    expect(board([]).map((c) => c.stage)).toEqual([...STAGES]);
  });

  // A column is a queue: what is dated and soonest comes first.
  it('sorts dated work first and soonest first', () => {
    const cols = board([
      piece('undated', { stage: 'script', bucket: 'piece' }),
      piece('later', { stage: 'script', bucket: 'piece', publishAt: '2026-10-01' }),
      piece('sooner', { stage: 'script', bucket: 'piece', publishAt: '2026-09-09' }),
    ]);
    const script = cols.find((c) => c.stage === 'script')!;
    expect(script.pieces.map((p) => p.id)).toEqual(['sooner', 'later', 'undated']);
  });
});

describe('where a dragged card lands', () => {
  // The placeholder must agree with the sort, because a marker that disagrees
  // with where the card actually goes is worse than no marker.
  it('puts a sooner date above one already there', () => {
    const rows = [
      piece('moving', { stage: 'idea', publishAt: '2026-09-02' }),
      piece('sitting', { stage: 'edit', publishAt: '2026-09-20' }),
    ];
    expect(landingIndex(rows, 'moving', 'edit')).toBe(0);
  });

  it('puts a later date below it', () => {
    const rows = [
      piece('moving', { stage: 'idea', publishAt: '2026-12-01' }),
      piece('sitting', { stage: 'edit', publishAt: '2026-09-20' }),
    ];
    expect(landingIndex(rows, 'moving', 'edit')).toBe(1);
  });

  // Dated work is the queue; undated pieces sit after it.
  it('puts an undated piece after every dated one', () => {
    const rows = [
      piece('moving', { stage: 'idea' }),
      piece('a', { stage: 'edit', publishAt: '2026-09-20' }),
      piece('b', { stage: 'edit', publishAt: '2026-09-21' }),
    ];
    expect(landingIndex(rows, 'moving', 'edit')).toBe(2);
  });

  it('lands at the top of an empty column', () => {
    expect(landingIndex([piece('moving', { stage: 'idea' })], 'moving', 'review')).toBe(0);
  });

  // `published` is an archive, newest first — the opposite order.
  it('follows the published column back to front', () => {
    const rows = [
      piece('moving', { stage: 'idea', publishAt: '2026-09-30' }),
      piece('older', { stage: 'published', publishAt: '2026-09-01' }),
    ];
    expect(landingIndex(rows, 'moving', 'published')).toBe(0);
  });

  // The cap is inherited from `board()`, not re-implemented: a piece that sorts
  // past the visible tail gets no slot rather than a wrong one.
  it('gives no slot when the published cap would hide it', () => {
    const rows = [
      piece('moving', { stage: 'idea', publishAt: '2020-01-01' }),
      ...Array.from({ length: PUBLISHED_ON_BOARD }, (_, i) =>
        piece(`p${i}`, { stage: 'published', publishAt: `2026-0${i + 1}-01` })),
    ];
    expect(landingIndex(rows, 'moving', 'published')).toBeNull();
  });

  it('answers null for a piece that is not there', () => {
    expect(landingIndex([], 'ghost', 'edit')).toBeNull();
  });
});

describe('which day the phone agenda opens on', () => {
  const sept = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
  const has = (...isos: string[]) => (iso: string) => isos.includes(iso);

  it('opens on today when today is in the month', () => {
    expect(agendaDay(sept, has('2026-09-20'), '2026-09-05')).toBe('2026-09-05');
  });

  // Today may be empty — it is still the day you opened the calendar to see.
  it('prefers today even when today is empty', () => {
    expect(agendaDay(sept, has('2026-09-02'), '2026-09-14')).toBe('2026-09-14');
  });

  it('in another month, opens on the first day with something on it', () => {
    expect(agendaDay(sept, has('2026-09-17', '2026-09-08'), '2026-10-03')).toBe('2026-09-08');
  });

  it('a month with nothing in it still opens on a real day', () => {
    expect(agendaDay(sept, has(), '2026-10-03')).toBe('2026-09-01');
  });

  it('answers nothing for no days at all', () => {
    expect(agendaDay([], has(), '2026-09-05')).toBeNull();
  });
});

describe('the calendar', () => {
  // The mistake the spreadsheet makes: one object, two appointments.
  it('puts a piece on its shoot day AND its publish day', () => {
    const days = byDay([piece('a', { shootAt: '2026-09-08', publishAt: '2026-09-12' })]);
    expect([...days.keys()].sort()).toEqual(['2026-09-08', '2026-09-12']);
    expect(days.get('2026-09-08')![0].kind).toBe('shoot');
    expect(days.get('2026-09-12')![0].kind).toBe('publish');
  });

  it('shoot reads before publish on a day holding both', () => {
    const days = byDay([
      piece('out', { publishAt: '2026-09-08' }),
      piece('film', { shootAt: '2026-09-08' }),
    ]);
    expect(days.get('2026-09-08')!.map((e) => e.kind)).toEqual(['shoot', 'publish']);
  });

  it('a piece with no dates is on no day', () => {
    expect(byDay([piece('a')]).size).toBe(0);
  });
});

describe('the next move on a piece', () => {
  const inReview = (approval?: Piece['approval']): Piece =>
    ({ id: 'p', title: 'p', meta: { stage: 'review', bucket: 'piece' }, approval });

  it('is the stage\'s own verb when nobody has been asked', () => {
    expect(nextAction(piece('a', { stage: 'edit' }))).toBe('Cut it together');
  });

  // THE CONTRADICTION THIS FIXES: a `Changes` badge beside "Waiting on a look".
  it('is never "waiting" once the client has answered no', () => {
    const p = inReview({ id: 'a', status: 'changes_requested' });
    expect(nextAction(p)).not.toMatch(/waiting/i);
    expect(nextAction(p)).toBe('Make the changes they asked for');
  });

  it('prefers the client\'s own words when they wrote any', () => {
    const p = inReview({ id: 'a', status: 'changes_requested', note: '  Cut the intro to 10s  ' });
    expect(nextAction(p)).toBe('Cut the intro to 10s');
  });

  it('says whose move it is while a real ask is outstanding', () => {
    expect(nextAction(inReview({ id: 'a', status: 'awaiting' }))).toBe('Waiting on your client');
  });

  // A review with no ask is your own homework — the stage-only line is right here.
  it('falls back to the stage when a review is your own', () => {
    expect(nextAction(inReview())).toBe('Waiting on a look');
  });
});

describe('what needs you', () => {
  type ApprovalStatus = 'awaiting' | 'approved' | 'changes_requested';
  const withApproval = (id: string, status: ApprovalStatus, meta: Partial<ContentMeta> = {}): Piece =>
    ({ id, title: id, meta: { stage: 'review', bucket: 'piece', ...meta }, approval: { id: `a-${id}`, status } });

  it('is empty when nothing is slipping — and that is real information', () => {
    const rows = [piece('a', { stage: 'edit' }), piece('b', { stage: 'scheduled', publishAt: '2026-12-01' })];
    expect(needsYou(rows, TODAY)).toEqual([]);
  });

  it('lists an overdue piece, with how late it is', () => {
    const got = needsYou([piece('a', { stage: 'edit', publishAt: '2026-09-01' })], TODAY);
    expect(got.map((n) => [n.piece.id, n.reason, n.daysLate])).toEqual([['a', 'late', 4]]);
  });

  // THE RULE THIS EXISTS TO KEEP, inherited from lib/waiting.ts: whose move is
  // it? An overdue piece sitting with a client is still not yours to move, and
  // listing it would tell you to go and do something you cannot do.
  it('excludes work sitting with the client, even when it is overdue', () => {
    const rows = [withApproval('a', 'awaiting', { publishAt: '2026-08-01' })];
    expect(needsYou(rows, TODAY)).toEqual([]);
  });

  it('includes it the moment the client asks for changes — the move came back', () => {
    const got = needsYou([withApproval('a', 'changes_requested')], TODAY);
    expect(got.map((n) => [n.piece.id, n.reason])).toEqual([['a', 'changes']]);
  });

  it('puts changes before lateness, then the most overdue first', () => {
    const rows = [
      piece('late-a-bit', { stage: 'edit', publishAt: '2026-09-04' }),
      piece('late-a-lot', { stage: 'edit', publishAt: '2026-08-20' }),
      withApproval('answered', 'changes_requested'),
    ];
    expect(needsYou(rows, TODAY).map((n) => n.piece.id)).toEqual(['answered', 'late-a-lot', 'late-a-bit']);
  });

  it('ignores the inbox and the reference shelf — neither is a piece in flight', () => {
    const rows = [
      piece('captured', { bucket: 'inbox', stage: 'idea', publishAt: '2026-08-01' }),
      piece('kept', { bucket: 'reference', stage: 'idea', publishAt: '2026-08-01' }),
    ];
    expect(needsYou(rows, TODAY)).toEqual([]);
  });

  // A day-id is calendar arithmetic, never a local Date (zenboard-day-ids).
  it('counts whole days across a month boundary', () => {
    const got = needsYou([piece('a', { stage: 'edit', publishAt: '2026-08-31' })], '2026-09-02');
    expect(got[0].daysLate).toBe(2);
  });
});

describe('the summary', () => {
  it('is null when there is nothing, so the line can be absent', () => {
    expect(contentSummary([], TODAY)).toBeNull();
  });
  it('counts what is still being made, and says late only when some is', () => {
    expect(contentSummary([piece('a', { stage: 'script', bucket: 'piece' }), piece('b', { stage: 'published', bucket: 'piece' })], TODAY))
      .toBe('1 in progress');
    expect(contentSummary([piece('a', { stage: 'script', bucket: 'piece', publishAt: '2026-09-01' })], TODAY))
      .toBe('1 in progress · 1 late');
  });

  it('surfaces changes requested — the client answered, and the answer was no', () => {
    const rejected: Piece = { id: 'r', title: 'r', meta: { stage: 'review', bucket: 'piece' }, approval: { id: 'a', status: 'changes_requested' } };
    expect(contentSummary([rejected], TODAY)).toBe('1 in progress · 1 needs changes');
  });
});

describe('the shoot day', () => {
  const at = (id: string, over: Partial<ContentMeta>, title = id): Piece =>
    ({ id, title, meta: { stage: 'shoot', bucket: 'piece', ...over } });

  it('is just a date — every piece carrying it is on it', () => {
    const pieces = [
      at('a', { shootAt: '2026-09-09' }),
      at('b', { shootAt: '2026-09-10' }),
      at('c', { shootAt: '2026-09-09' }),
    ];
    expect(shootDay(pieces, '2026-09-09').map((p) => p.id)).toEqual(['a', 'c']);
  });

  // The call time is the reason to be somewhere at an hour; burying it makes a
  // list you re-sort by hand every morning.
  it('leads with the timed pieces, earliest first', () => {
    const pieces = [
      at('late', { shootAt: '2026-09-09', callTime: '14:00' }),
      at('untimed', { shootAt: '2026-09-09' }),
      at('early', { shootAt: '2026-09-09', callTime: '08:30' }),
    ];
    expect(shootDay(pieces, '2026-09-09').map((p) => p.id)).toEqual(['early', 'late', 'untimed']);
  });

  it('refuses a call time that is not a clock time', () => {
    for (const bad of ['9:00', '24:00', '08:60', 'morning', '']) {
      expect(readContent({ pipeline: { stage: 'shoot', bucket: 'piece', callTime: bad } }).callTime).toBeUndefined();
    }
    expect(readContent({ pipeline: { stage: 'shoot', bucket: 'piece', callTime: '08:30' } }).callTime).toBe('08:30');
  });

  // Two places on one day is a real Tuesday, not a conflict.
  it('lists every distinct location, in running order, once each', () => {
    const day = [
      at('a', { location: 'Studio' }),
      at('b', { location: 'Rooftop' }),
      at('c', { location: 'Studio' }),
      at('d', {}),
    ];
    expect(shootLocations(day)).toEqual(['Studio', 'Rooftop']);
  });
});

describe('shots', () => {
  // The same `[ ]` contract the rest of the app uses — nobody learns a second
  // way to write a checklist, and the shot is written once, in the script.
  it('is every to-do line in the script, and nothing else', () => {
    const blocks = [
      { id: 'h', type: 'h2', text: 'Opening' },
      { id: 's1', type: 'todo', text: 'Wide of the desk', checked: false },
      { id: 'p', type: 'text', text: 'Talk about the brief here.' },
      { id: 's2', type: 'todo', text: 'Cutaway to the swatches', checked: true },
      { id: 'b', type: 'bullet', text: 'Not a shot' },
    ];
    expect(shotsOf(blocks)).toEqual([
      { blockId: 's1', text: 'Wide of the desk', done: false },
      { blockId: 's2', text: 'Cutaway to the swatches', done: true },
    ]);
  });

  it('ignores an empty checkbox and an absent script', () => {
    expect(shotsOf([{ id: 'x', type: 'todo', text: '   ' }])).toEqual([]);
    expect(shotsOf([])).toEqual([]);
    expect(shotsOf(null)).toEqual([]);
  });
});

describe('the shoot summary', () => {
  const p = (id: string): Piece => ({ id, title: id, meta: { stage: 'shoot', bucket: 'piece' } });
  it('is null on an empty day, so the line can be absent', () => {
    expect(shootSummary([], [])).toBeNull();
  });
  it('counts pieces, then shots, and says done only when some are', () => {
    expect(shootSummary([p('a')], [])).toBe('1 piece');
    expect(shootSummary([p('a'), p('b')], [
      { blockId: '1', text: 'x', done: false },
      { blockId: '2', text: 'y', done: true },
    ])).toBe('2 pieces · 2 shots · 1 done');
  });
});

describe('content on Home', () => {
  const p = (id: string, over: Partial<ContentMeta>): Piece => ({ id, title: id, meta: { stage: 'shoot', bucket: 'piece', ...over } });

  // Home and the calendar must never disagree about what is on a date, which is
  // why this reuses byDay instead of re-deriving it.
  it('is exactly what the calendar puts on that day, shoots first', () => {
    const pieces = [
      p('out', { publishAt: TODAY }),
      p('film', { shootAt: TODAY }),
      p('other', { publishAt: '2026-09-30' }),
    ];
    expect(contentToday(pieces, TODAY).map((e) => [e.piece.id, e.kind]))
      .toEqual([['film', 'shoot'], ['out', 'publish']]);
  });

  it('is empty when nothing is happening, so the section can be absent', () => {
    expect(contentToday([p('a', {})], TODAY)).toEqual([]);
    expect(contentTodaySummary([])).toBeNull();
  });

  it('leads with the earliest call time — being there is what changes first', () => {
    const entries = contentToday([
      p('late', { shootAt: TODAY, callTime: '14:00' }),
      p('early', { shootAt: TODAY, callTime: '08:30' }),
      p('out', { publishAt: TODAY }),
    ], TODAY);
    expect(contentTodaySummary(entries)).toBe('Filming at 08:30 · 1 going out');
  });

  it('says how many when a shoot has no call time', () => {
    expect(contentTodaySummary(contentToday([p('a', { shootAt: TODAY })], TODAY))).toBe('Filming 1 piece');
  });

  it('says only what is true', () => {
    expect(contentTodaySummary(contentToday([p('a', { publishAt: TODAY })], TODAY))).toBe('1 going out');
  });
});

describe('a finished project becoming content', () => {
  it('carries the project into every piece, so nothing is retyped', () => {
    const out = contentFromProject('Northwind rebrand', ['case-study', 'reel']);
    expect(out.map((p) => p.title)).toEqual([
      'Northwind rebrand · case study',
      'Northwind rebrand · reel',
    ]);
    expect(out.map((p) => [p.meta.format, p.meta.channel])).toEqual([
      ['article', 'Blog'],
      ['short', 'Instagram'],
    ]);
  });

  // The project is done; the content is not. A pipeline that starts things
  // half-written lies about where the work actually is.
  it('starts everything at idea', () => {
    for (const p of contentFromProject('X', PROJECT_CONTENT_PRESETS.map((x) => x.id))) {
      expect(p.meta.stage).toBe('idea');
    }
  });

  // Structure, not claims. Nothing writes a hook or a description on the user's
  // behalf — an invented line about work it has never seen is what makes a
  // product feel generated.
  it('scaffolds only the long piece, and only with headings', () => {
    const out = contentFromProject('X', PROJECT_CONTENT_PRESETS.map((p) => p.id));
    expect(out[0].sections).toEqual(CASE_STUDY_SECTIONS);
    expect(out.slice(1).every((p) => p.sections.length === 0)).toBe(true);
    expect(out.every((p) => p.meta.hook === undefined)).toBe(true);
  });

  it('keeps the preset order, not the order they were picked', () => {
    expect(contentFromProject('X', ['x', 'case-study']).map((p) => p.meta.channel)).toEqual(['Blog', 'X']);
  });

  it('makes nothing from nothing, and survives an unnamed project', () => {
    expect(contentFromProject('X', [])).toEqual([]);
    expect(contentFromProject('   ', ['reel'])[0].title).toBe('Untitled project · reel');
  });
});

// ── THE INBOX, AND THE ONE RULE THAT MAKES IT SAFE ─────────────────────────
// The user's ask was to "dump anything into one place... then later organize it
// into Ideas, Inspiration, References, or Content." The obvious shortcut is to
// file every capture at `stage: 'idea'` and be done. That is wrong, and these
// tests are why: `idea` means "I intend to make this", so a competitor's reel
// saved to study would become a card in the Idea column and — if it ever picked
// up a date — a commitment on the calendar. A capture is not a commitment.
describe('buckets', () => {
  const capture = (id: string, extra: Partial<ContentMeta> = {}) =>
    piece(id, { bucket: 'inbox', ...extra });

  it('defaults to `piece`, so rows written before the inbox existed are untouched', () => {
    expect(readContent({ pipeline: { stage: 'edit' } }).bucket).toBe('piece');
    expect(readContent({}).bucket).toBe('piece');
  });

  it('refuses a bucket it does not know', () => {
    // Same reasoning as the stage enum: a JSON-persisted value has no DB to
    // reject it, and a row on a shelf that does not exist cannot be seen.
    expect(readContent({ pipeline: { stage: 'idea', bucket: 'nonsense' } }).bucket).toBe('piece');
  });

  it('round-trips through write', () => {
    const meta: ContentMeta = {
      stage: 'idea', bucket: 'reference',
      sourceUrl: 'https://example.com/reel', sourceAuthor: '@someone',
      note: 'The cut on the second beat is the whole trick',
    };
    expect(readContent(writeContent(meta))).toMatchObject(meta);
  });

  it('sorts captures onto the right shelf', () => {
    const rows = [piece('mine'), capture('dumped'), piece('saved', { bucket: 'reference' })];
    expect(onlyPieces(rows).map((p) => p.id)).toEqual(['mine']);
    expect(inbox(rows).map((p) => p.id)).toEqual(['dumped']);
    expect(references(rows).map((p) => p.id)).toEqual(['saved']);
  });

  // The leak these buckets exist to prevent, asserted at every door out.
  it('keeps an untriaged capture off the board', () => {
    const rows = [piece('mine'), capture('dumped')];
    const idea = board(rows).find((c) => c.stage === 'idea')!;
    expect(idea.pieces.map((p) => p.id)).toEqual(['mine']);
    expect(board(rows).flatMap((c) => c.pieces)).toHaveLength(1);
  });

  it('keeps an untriaged capture off the calendar even when it carries dates', () => {
    // A capture CAN hold a date — you might dump "post this Friday" — and that
    // still must not put it on Friday until someone has said it is a piece.
    const dated = capture('dumped', { publishAt: '2026-09-10', shootAt: '2026-09-08' });
    const rows = [piece('mine', { publishAt: '2026-09-10' }), dated];
    const days = byDay(rows);
    expect(days.get('2026-09-10')!.map((e) => e.piece.id)).toEqual(['mine']);
    expect(days.get('2026-09-08')).toBeUndefined();
    expect(contentToday(rows, '2026-09-10').map((e) => e.piece.id)).toEqual(['mine']);
  });

  it('keeps captures out of the header count and the shoot day', () => {
    const rows = [
      piece('mine', { stage: 'edit' }),
      capture('dumped', { stage: 'edit', shootAt: '2026-09-08' }),
    ];
    expect(contentSummary(rows, TODAY)).toBe('1 in progress');
    expect(shootDay(rows, '2026-09-08')).toEqual([]);
  });

  it('reports nothing at all when every row is a capture', () => {
    // Not "0 in progress" — the section should be ABSENT, same rule as Waiting.
    expect(contentSummary([capture('a'), capture('b')], TODAY)).toBeNull();
  });
  it('a capture is born untriaged, from either door', () => {
    // `inboxCapture` is the row both the app's capture and the MCP tool
    // write, so this is the one place its meaning is pinned: an inbox item
    // with no stage claim, and nothing it was not given.
    const row = inboxCapture({ userId: 'u', spaceId: 's', title: 'That match cut', sourceUrl: ' https://x.com/v ', note: '  ' });
    expect(row).toMatchObject({ user_id: 'u', space_id: 's', type: 'content', title: 'That match cut' });
    const meta = readContent(row.content);
    expect(meta).toMatchObject({ bucket: 'inbox', stage: 'idea', sourceUrl: 'https://x.com/v' });
    expect(row.content.pipeline).not.toHaveProperty('note');   // blank is not a note — not even stored
    expect(row.content.blocks).toEqual([]);
    // And it stays off every shelf a piece lives on until someone sorts it.
    expect(onlyPieces([{ id: 'x', title: row.title, meta }])).toEqual([]);
  });
});

describe('parsing one line of capture', () => {
  it('keeps plain text as the title', () => {
    expect(parseCapture('Make a post about AI agents')).toEqual({ title: 'Make a post about AI agents' });
  });

  it('names a bare link after where it points', () => {
    // Not `https://www.youtube.com/watch?v=dQw4w9WgXcQ` — an inbox of raw URLs
    // is unreadable exactly when it fills up.
    expect(parseCapture('https://www.youtube.com/watch/dQw4w9WgXcQ'))
      .toEqual({ title: 'youtube.com/dQw4w9WgXcQ', sourceUrl: 'https://www.youtube.com/watch/dQw4w9WgXcQ' });
    expect(parseCapture('https://example.com')).toEqual({ title: 'example.com', sourceUrl: 'https://example.com' });
  });

  it('lets the words win when there are words', () => {
    expect(parseCapture('cool branding example https://example.com/a'))
      .toEqual({ title: 'cool branding example', sourceUrl: 'https://example.com/a' });
    expect(parseCapture('https://example.com/a is a great hook'))
      .toEqual({ title: 'is a great hook', sourceUrl: 'https://example.com/a' });
  });

  it('does not dignify a non-http scheme with a pretty title', () => {
    expect(parseCapture('javascript:alert(1)')).toEqual({ title: 'javascript:alert(1)' });
  });

  it('returns an empty title for whitespace, so the caller can refuse it', () => {
    expect(parseCapture('   ').title).toBe('');
  });
});

// ── The brief ────────────────────────────────────────────────────────────────
// A brief is PROSE, so it lives in the page's blocks rather than in ten more
// JSON fields — the house pattern (a proposal is a doc with special blocks) and
// it buys comments and @-mentions on the brief for free.
describe('the brief', () => {
  const h2 = (text: string) => ({ id: text, type: 'h2', text });
  const p = (text: string) => ({ id: 'p' + text, type: 'text', text });
  const make = (type: 'h2' | 'text', text: string) => ({ id: `${type}:${text}`, type, text });

  it('reports nothing for a page that has no brief', () => {
    expect(briefOf([p('just a script')])).toMatchObject({ present: false, answered: [], blank: [] });
    expect(briefOf(null).present).toBe(false);
  });

  it('counts a section as answered only when something is written under it', () => {
    // A seeded template is all headings and no answers. Reporting that as done
    // would make the indicator a decoration.
    const blocks = [h2('Objective'), p('Get 50 demo bookings'), h2('Audience'), p('')];
    const state = briefOf(blocks);
    expect(state.answered).toEqual(['Objective']);
    expect(state.blank).toEqual(['Audience']);
    expect(state.total).toBe(5);
  });

  it('stops a section at the next heading', () => {
    // Text under `Audience` must not count toward `Objective`.
    const blocks = [h2('Objective'), h2('Audience'), p('Founders who already tried it')];
    expect(briefOf(blocks).answered).toEqual(['Audience']);
    expect(briefOf(blocks).blank).toEqual(['Objective']);
  });

  it('matches a heading regardless of case or stray spacing', () => {
    expect(briefOf([{ id: 'a', type: 'h2', text: '  key MESSAGE ' }, p('x')]).answered).toEqual(['Key message']);
  });

  it('ignores headings that are not brief sections', () => {
    expect(briefOf([h2('Scene 1'), p('wide shot')]).present).toBe(false);
  });

  it('seeds every section, above the script', () => {
    const script = [p('opening line')];
    const seeded = seedBrief(script, make);
    expect(seeded).toHaveLength(BRIEF_SECTIONS.length * 2 + 1);
    expect(seeded[0]).toMatchObject({ type: 'h2', text: 'Objective' });
    // The script is still there, and still last — you read the brief first.
    expect(seeded[seeded.length - 1]).toMatchObject({ text: 'opening line' });
    // Each heading gets a line to type on.
    expect(seeded[1]).toMatchObject({ type: 'text', text: '' });
  });

  it('is idempotent — the button is visible whenever the brief is incomplete', () => {
    const once = seedBrief([], make);
    const twice = seedBrief(once, make);
    expect(twice).toEqual(once);
    expect(twice.filter((b) => b.text === 'Objective')).toHaveLength(1);
  });

  it('tops up a half-finished brief instead of duplicating it', () => {
    const partial = [h2('Objective'), p('Get 50 demo bookings')];
    const topped = seedBrief(partial, make);
    expect(topped.filter((b) => b.text === 'Objective')).toHaveLength(1);
    // The answer survives, and the four missing sections arrive.
    expect(topped.some((b) => b.text === 'Get 50 demo bookings')).toBe(true);
    expect(briefOf(topped).answered).toEqual(['Objective']);
    expect(briefOf(topped).blank).toHaveLength(4);
  });

  it('does not restate a fact the piece already holds', () => {
    // Topic is the title; hook, format and platform are meta. A fact copied
    // into prose is a fact with two homes, and two homes is how the board ends
    // up saying "carousel" while the brief says "reel".
    const headings = BRIEF_SECTIONS.map((s) => s.heading.toLowerCase());
    for (const banned of ['topic', 'hook', 'format', 'platform', 'channel']) {
      expect(headings).not.toContain(banned);
    }
  });
});

// ── Repurposing ──────────────────────────────────────────────────────────────
describe('repurposing', () => {
  const src = (format: ContentMeta['format'], over: Partial<ContentMeta> = {}) =>
    ({ id: 's1', title: 'The studio tour', meta: { stage: 'published' as const, bucket: 'piece' as const, format, ...over } });

  it('offers cuts only from forms that carry more material than they spend', () => {
    // A short IS the atom. "Repurpose this short into a video" is a different,
    // larger thing made from scratch — offering it would put a control on every
    // card that mostly means nothing.
    for (const f of ['video', 'podcast', 'article', 'newsletter'] as const) {
      expect(canRepurpose(src(f).meta), `${f} should be a source`).toBe(true);
    }
    for (const f of ['short', 'post', 'carousel'] as const) {
      expect(canRepurpose(src(f).meta), `${f} is an atom`).toBe(false);
    }
    expect(canRepurpose({ bucket: 'piece' }), 'no format ⇒ nothing to cut').toBe(false);
  });

  it("won't cut up someone else's work, or something not yet decided on", () => {
    // A reference is a competitor's reel saved to study; a capture has not been
    // committed to. Neither is your pipeline. Both carry a format, so the
    // format check alone would have let them through.
    expect(canRepurpose({ format: 'video', bucket: 'reference' })).toBe(false);
    expect(canRepurpose({ format: 'video', bucket: 'inbox' })).toBe(false);
  });

  it('never offers a cut that is the format it came from', () => {
    const ids = (f: ContentMeta['format']) => repurposeOptions(src(f).meta).map((p) => p.format);
    expect(ids('article')).not.toContain('article');
    expect(ids('newsletter')).not.toContain('newsletter');
    // ...nor one that only makes sense from a RECORDING: writing up something
    // already written is not a cut, it is an edit.
    expect(ids('article')).not.toContain('article');
    expect(repurposeOptions(src('article').meta).map((p) => p.id)).not.toContain('writeup');
    expect(repurposeOptions(src('video').meta).map((p) => p.id)).toContain('writeup');
  });

  it('seeds STRUCTURE, never claims', () => {
    const [writeup] = repurpose(src('video'), ['writeup']);
    expect(writeup.sections).toEqual(WRITEUP_SECTIONS);
    expect(writeup.meta.hook, 'an invented hook is what makes a product feel generated').toBeUndefined();
    const [clip] = repurpose(src('video'), ['clip']);
    expect(clip.sections, 'a short is a hook and a clip; headings would be noise').toEqual([]);
  });

  it('starts every cut at idea, as a decided piece', () => {
    const made = repurpose(src('video'), REPURPOSE_PRESETS.map((p) => p.id));
    expect(made.length).toBeGreaterThan(0);
    for (const m of made) {
      expect(m.meta.stage, 'the source is finished; the cut is not').toBe('idea');
      expect(m.meta.bucket, 'the user picked it, so it is a commitment').toBe('piece');
      expect(m.meta.derivedFrom).toBe('s1');
      expect(m.meta.channel, 'a format is a fact; a channel is the creator’s choice').toBeUndefined();
    }
  });

  it('cannot create a cut that was never offered', () => {
    // The ids come from the UI, so this is the boundary: asking for `writeup`
    // from an article must produce nothing rather than a piece the rules refuse.
    expect(repurpose(src('article'), ['writeup'])).toEqual([]);
    expect(repurpose(src('short'), ['clip', 'post']), 'an atom offers nothing').toEqual([]);
    expect(repurpose(src('video'), ['not-a-preset'])).toEqual([]);
  });

  it('links a cut to its source, both ways', () => {
    const rows: Piece[] = [
      { id: 's1', title: 'The studio tour', meta: { stage: 'published', bucket: 'piece', format: 'video' } },
      { id: 'c1', title: 'cut one', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 's1' } },
      { id: 'c2', title: 'cut two', meta: { stage: 'published', bucket: 'piece', derivedFrom: 's1' } },
      { id: 'x', title: 'unrelated', meta: { stage: 'idea', bucket: 'piece' } },
    ];
    expect(derivativesOf('s1', rows).map((r) => r.id)).toEqual(['c1', 'c2']);
    expect(sourceOf(rows[1], rows)?.id).toBe('s1');
    expect(sourceOf(rows[3], rows), 'no source is not an error').toBeNull();
    // A source that has been deleted must not throw — the child is still a piece.
    expect(sourceOf(rows[1], [rows[1]])).toBeNull();
  });

  it('says nothing until there is something to say', () => {
    const rows: Piece[] = [
      { id: 's1', title: 's', meta: { stage: 'published', bucket: 'piece', format: 'video' } },
      { id: 'c1', title: 'a', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 's1' } },
      { id: 'c2', title: 'b', meta: { stage: 'published', bucket: 'piece', derivedFrom: 's1' } },
    ];
    expect(repurposeSummary('s1', rows)).toBe('2 cuts · 1 published');
    expect(repurposeSummary('s1', rows.slice(0, 2))).toBe('1 cut');
    expect(repurposeSummary('nope', rows), 'a "0 cuts" badge is a reproach, not information').toBeNull();
  });

  it('survives a round trip through the stored JSON', () => {
    // derivedFrom is a JSON-persisted id like every other field here, so it has
    // to come back out — and a non-string must not become one.
    const meta = readContent({ pipeline: { stage: 'idea', bucket: 'piece', derivedFrom: 's1' } });
    expect(meta.derivedFrom).toBe('s1');
    expect(writeContent(meta).pipeline.derivedFrom).toBe('s1');
    expect(readContent({ pipeline: { derivedFrom: 42 } }).derivedFrom).toBeUndefined();
    expect(readContent({ pipeline: { derivedFrom: '  ' } }).derivedFrom).toBeUndefined();
    expect(writeContent({ stage: 'idea', bucket: 'piece' }).pipeline).not.toHaveProperty('derivedFrom');
  });

  it('a cut is an ordinary piece — it appears on the board and the calendar', () => {
    // The point of `derivedFrom` being a FACT and not a separate object: nothing
    // downstream has to know about repurposing for a cut to behave like work.
    const rows: Piece[] = [
      { id: 'c1', title: 'cut', meta: { stage: 'script', bucket: 'piece', derivedFrom: 's1', publishAt: TODAY } },
    ];
    expect(onlyPieces(rows)).toHaveLength(1);
    expect(board(rows).find((c) => c.stage === 'script')!.pieces).toHaveLength(1);
    expect(byDay(rows).get(TODAY)).toHaveLength(1);
  });
});

// ── The library ──────────────────────────────────────────────────────────────
describe('the library', () => {
  const out = (id: string, publishAt?: string, over: Partial<ContentMeta> = {}): Piece =>
    ({ id, title: id, meta: { stage: 'published', bucket: 'piece', publishAt, ...over } });
  const kept = (id: string, createdOn?: string, over: Partial<ContentMeta> = {}, title = id): Piece =>
    ({ id, title, createdOn, meta: { stage: 'idea', bucket: 'reference', ...over } });
  const ids = (rows: Piece[]) => libraryMonths(libraryItems(rows)).map((m) => [m.key, m.items.map((i) => i.piece.id)]);

  it('is newest first, grouped by the month it went out', () => {
    const rows = [out('a', '2026-07-04'), out('b', '2026-09-01'), out('c', '2026-07-28'), out('d', '2026-08-15')];
    expect(ids(rows)).toEqual([['2026-09', ['b']], ['2026-08', ['d']], ['2026-07', ['c', 'a']]]);
  });

  it('keeps undated work, at the end', () => {
    // An import, or something released before anyone tracked dates. A piece you
    // cannot date is still a piece you made — dropping it silently loses work.
    expect(ids([out('undated'), out('dated', '2026-09-01')])).toEqual([['2026-09', ['dated']], ['', ['undated']]]);
  });

  it('holds what you KEEP: saved references and published pieces — not the pipeline, not the inbox', () => {
    const rows: Piece[] = [
      out('done', '2026-09-01'),
      kept('ref', '2026-09-03'),
      { id: 'wip', title: 'wip', meta: { stage: 'edit', bucket: 'piece', publishAt: '2026-09-02' } },
      { id: 'cap', title: 'cap', createdOn: '2026-09-04', meta: { stage: 'published', bucket: 'inbox', publishAt: '2026-09-04' } },
    ];
    expect(libraryItems(rows).map((i) => [i.piece.id, i.kind])).toEqual([['ref', 'saved'], ['done', 'published']]);
  });

  it('files a saved thing under the day it was kept, and your own work under the day it went out', () => {
    // A reference has no publish date of its own worth trusting — `publishAt` on
    // one is a leftover from triage — so the day you KEPT it is the only honest one.
    const rows = [kept('ref', '2026-08-20', { publishAt: '2026-01-01' }), out('mine', '2026-09-02')];
    expect(libraryItems(rows).map((i) => [i.piece.id, i.day])).toEqual([['mine', '2026-09-02'], ['ref', '2026-08-20']]);
  });

  describe('finding something in it', () => {
    const item = (p: Piece) => libraryItems([p])[0];
    const reel = item(kept('r', '2026-08-01', {
      sourceUrl: 'https://www.instagram.com/reel/xyz', sourceAuthor: 'Nike', note: 'The hook lands in two seconds',
    }, 'How Nike cuts a 15-second spot'));

    it('needs every word, found anywhere the item is recognised by', () => {
      expect(matchesLibrary(reel, 'nike hook'), 'title + note').toBe(true);
      expect(matchesLibrary(reel, 'instagram'), 'the site it lives on').toBe(true);
      expect(matchesLibrary(reel, 'nike tiktok'), 'one word missing is no match').toBe(false);
      expect(matchesLibrary(reel, '   '), 'an empty query hides nothing').toBe(true);
    });

    it('matches your own work by its format and channel', () => {
      const film = item(out('f', '2026-09-01', { format: 'video', channel: 'YouTube' }));
      expect(matchesLibrary(film, 'video youtube')).toBe(true);
    });

    it('folds case and accents', () => {
      expect(matchesLibrary(item(kept('c', undefined, {}, 'Café du Monde')), 'CAFE')).toBe(true);
    });

    it('also searches what only the page knows — the fetched title of a bare link', () => {
      const bare = item(kept('b', undefined, { sourceUrl: 'https://youtube.com/watch?v=abc' }, 'youtube.com/watch'));
      expect(matchesLibrary(bare, 'attention span')).toBe(false);
      expect(matchesLibrary(bare, 'attention span', ['How I got my attention span back'])).toBe(true);
    });
  });

  describe("a link's name", () => {
    const url = 'https://www.youtube.com/watch?v=abc123';

    it('knows its own placeholder from a name someone typed', () => {
      expect(isAutoTitle('youtube.com/watch', url), 'what parseCapture named it').toBe(true);
      expect(isAutoTitle(url, url), 'the raw address').toBe(true);
      expect(isAutoTitle('', url), 'nothing at all').toBe(true);
      expect(isAutoTitle('Thread on hooks', url), 'a real name').toBe(false);
      expect(isAutoTitle('youtube.com/watch', undefined), 'no link, no placeholder').toBe(false);
    });

    it("shows the page's own title over the placeholder, and never over the person's", () => {
      const bare: Piece = { id: 'b', title: 'youtube.com/watch', meta: { stage: 'idea', bucket: 'inbox', sourceUrl: url } };
      const named: Piece = { ...bare, title: 'Watch before Friday' };
      expect(linkedTitle(bare, 'How I got my attention span back')).toBe('How I got my attention span back');
      expect(linkedTitle(bare), 'until it arrives, the placeholder').toBe('youtube.com/watch');
      expect(linkedTitle(named, 'How I got my attention span back')).toBe('Watch before Friday');
    });

    it("a piece in the pipeline is named by you, whatever it links to", () => {
      const mine: Piece = { id: 'm', title: '', meta: { stage: 'published', bucket: 'piece', liveUrl: url } };
      expect(linkedTitle(mine, 'Some video title')).toBe('Untitled');
    });
  });

  it('counts what the archive PRODUCED, not how many cuts exist', () => {
    // "4 of these went further" is a fact about the archive; a raw cut count is
    // a fact about the pipeline, and the board already shows that.
    const rows: Piece[] = [
      out('s1', '2026-09-01'), out('s2', '2026-08-01'), out('s3', '2026-07-01'),
      { id: 'c1', title: 'c1', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 's1' } },
      { id: 'c2', title: 'c2', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 's1' } },
      { id: 'c3', title: 'c3', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 's2' } },
    ];
    expect(librarySummary(rows), 'three cuts, but only TWO sources').toBe('3 published · 2 cut from');
    expect(librarySummary([out('only', '2026-09-01')])).toBe('3 published'.replace('3', '1'));
    expect(librarySummary([]), 'an empty archive says nothing').toBeNull();
  });

  it('an archive is newest first; a queue is soonest first', () => {
    // The one column where the sort has to invert — published sorted like a
    // queue put the OLDEST thing you ever released at the top and buried this
    // week's at the bottom.
    const rows = [out('old', '2026-01-01'), out('new', '2026-09-01')];
    const cols = board(rows);
    expect(cols.find((c) => c.stage === 'published')!.pieces.map((p) => p.id)).toEqual(['new', 'old']);
    const queue: Piece[] = [
      { id: 'later', title: 'l', meta: { stage: 'edit', bucket: 'piece', publishAt: '2026-09-30' } },
      { id: 'sooner', title: 's', meta: { stage: 'edit', bucket: 'piece', publishAt: '2026-09-02' } },
    ];
    expect(board(queue).find((c) => c.stage === 'edit')!.pieces.map((p) => p.id)).toEqual(['sooner', 'later']);
  });

  it('the board shows a recent tail of published, and says how many it is not showing', () => {
    const many = Array.from({ length: PUBLISHED_ON_BOARD + 3 }, (_, i) =>
      out(`p${i}`, `2026-0${(i % 9) + 1}-01`));
    const col = board(many).find((c) => c.stage === 'published')!;
    expect(col.pieces).toHaveLength(PUBLISHED_ON_BOARD);
    expect(col.hidden).toBe(3);
    // ...and every one of them is still in the library.
    expect(libraryItems(many)).toHaveLength(PUBLISHED_ON_BOARD + 3);
    // No other column is ever capped — they are queues, and a hidden queue item
    // is work you have lost track of.
    for (const c of board(many)) if (c.stage !== 'published') expect(c.hidden).toBe(0);
  });
});

// ── Inspiration ──────────────────────────────────────────────────────────────
describe('inspiration sparks work', () => {
  const ref = (id: string, title = id): Piece =>
    ({ id, title, meta: { stage: 'idea', bucket: 'reference', sourceUrl: `https://x.test/${id}` } });

  it('tells a saved reel apart from your own work', () => {
    expect(isReference(ref('r1'))).toBe(true);
    expect(isReference({ meta: { stage: 'idea', bucket: 'piece' } })).toBe(false);
    expect(isReference({ meta: { stage: 'idea', bucket: 'inbox' } }), 'untriaged is not saved').toBe(false);
  });

  it('reads the SAME edge as a spark or a cut, depending on the source', () => {
    // "A shorter version of my video" and "this exists because of someone
    // else's reel" are not remotely the same claim, and they are one field.
    expect(lineageOf(ref('r1'))).toBe('spark');
    expect(lineageOf({ meta: { stage: 'published', bucket: 'piece', format: 'video' } })).toBe('cut');
  });

  it('never names your idea after somebody else’s video', () => {
    // A reference's title is usually the source's own — "youtube.com/dQw4w9",
    // "How Nike edits". Inheriting it is wrong in a way you would not notice
    // until it was sitting on the board.
    const idea = ideaFromReference(ref('r1', 'How Nike edits their ads'));
    expect(idea.title).toBe('');
    expect(idea.meta.derivedFrom).toBe('r1');
    expect(idea.meta.stage).toBe('idea');
    expect(idea.meta.bucket, 'pressing the button IS the commitment').toBe('piece');
    expect(ideaFromReference(ref('r1'), '  My own angle  ').title).toBe('My own angle');
  });

  it('leaves the reference on the shelf', () => {
    // One reel can spark three ideas over a year. Consuming it would delete the
    // thing that makes the shelf worth keeping.
    const rows: Piece[] = [
      ref('r1'),
      { id: 'a', title: 'a', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 'r1' } },
      { id: 'b', title: 'b', meta: { stage: 'script', bucket: 'piece', derivedFrom: 'r1' } },
    ];
    expect(references(rows).map((r) => r.id), 'still saved').toEqual(['r1']);
    expect(sparkSummary('r1', rows)).toBe('2 ideas from this');
    expect(sparkSummary('r1', [ref('r1'), rows[1]])).toBe('1 idea from this');
    expect(sparkSummary('r1', [ref('r1')]), 'a "0 ideas" badge is a reproach').toBeNull();
  });

  it('a reference never reaches the board, the calendar or a count — only the Library, as saved', () => {
    // The gate that makes the shelf safe. A saved reel carrying dates — some do,
    // from an unfurl — must not become an appointment, nor pass for your own
    // published work on the shelf where both now live.
    const rows: Piece[] = [{
      id: 'r1', title: 'someone else’s reel',
      meta: { stage: 'published', bucket: 'reference', publishAt: TODAY, shootAt: TODAY },
    }];
    expect(onlyPieces(rows)).toEqual([]);
    expect(board(rows).every((c) => c.pieces.length === 0)).toBe(true);
    expect(byDay(rows).size).toBe(0);
    expect(libraryItems(rows).map((i) => i.kind)).toEqual(['saved']);
    expect(contentSummary(rows, TODAY)).toBeNull();
  });

  it('an idea sparked from a reference IS ordinary work', () => {
    const rows: Piece[] = [
      ref('r1'),
      { id: 'i1', title: 'my angle', meta: { stage: 'idea', bucket: 'piece', derivedFrom: 'r1', publishAt: TODAY } },
    ];
    expect(onlyPieces(rows).map((p) => p.id)).toEqual(['i1']);
    expect(board(rows).find((c) => c.stage === 'idea')!.pieces).toHaveLength(1);
    expect(byDay(rows).get(TODAY)).toHaveLength(1);
    // ...and it can find its way back to what sparked it.
    expect(sourceOf(rows[1], rows)?.id).toBe('r1');
    expect(lineageOf(sourceOf(rows[1], rows)!)).toBe('spark');
  });
});

// ── The pipeline was written for video ───────────────────────────────────────
describe('a format only walks the stages it has', () => {
  it('a text post has no shoot and no edit', () => {
    // Measured before this existed: a board of posts and carousels showed three
    // consecutive dead columns — Draft, Shoot, Edit — each with "Nothing here
    // yet" AND a "+ New idea" button, pushing the real work off screen.
    expect(stagesFor('post')).toEqual(['idea', 'script', 'review', 'scheduled', 'published']);
    expect(stageApplies('post', 'shoot')).toBe(false);
    expect(stageApplies('post', 'edit')).toBe(false);
  });

  it('a carousel is designed, so it keeps edit but never films', () => {
    expect(stagesFor('carousel')).toEqual(['idea', 'script', 'edit', 'review', 'scheduled', 'published']);
  });

  it('written formats skip only the shoot', () => {
    for (const f of ['article', 'newsletter'] as const) {
      expect(stageApplies(f, 'shoot'), `${f} is not filmed`).toBe(false);
      expect(stageApplies(f, 'edit'), `${f} is edited`).toBe(true);
    }
  });

  it('anything filmed or recorded walks the whole path', () => {
    for (const f of ['video', 'short', 'podcast'] as const) {
      expect(stagesFor(f)).toEqual([...STAGES]);
    }
  });

  it('a piece with NO format walks the whole path', () => {
    // Not knowing is not the same as knowing it skips something, and hiding a
    // stage from a piece that might need it is the worse mistake.
    expect(stagesFor(undefined)).toEqual([...STAGES]);
    expect(stagesFor(null)).toEqual([...STAGES]);
  });

  it('every path keeps the spine every format shares', () => {
    for (const f of FORMATS) {
      const path = stagesFor(f);
      for (const must of ['idea', 'review', 'scheduled', 'published'] as const) {
        expect(path, `${f} must be able to reach ${must}`).toContain(must);
      }
      // ...and never reorders the pipeline.
      expect(path).toEqual(STAGES.filter((s) => path.includes(s)));
    }
  });
});

describe('the board shows the columns the work needs', () => {
  const at = (id: string, format: ContentMeta['format'], stage: ContentMeta['stage'] = 'idea'): Piece =>
    ({ id, title: id, meta: { stage, bucket: 'piece', format } });

  it('a board of posts has no shoot column', () => {
    const cols = boardStages([at('a', 'post'), at('b', 'post', 'review')]);
    expect(cols).toEqual(['idea', 'script', 'review', 'scheduled', 'published']);
  });

  it('one video brings the whole path back', () => {
    // The set changes when you take on a new KIND of work — rare, and it means
    // something — not every time a card moves.
    const cols = boardStages([at('a', 'post'), at('v', 'video')]);
    expect(cols).toEqual([...STAGES]);
  });

  it('NEVER hides a column that holds a piece, whatever its format', () => {
    // The safety net. Without it, changing a video's format to `post` while it
    // sat in Shoot would take the card off the board with no way back — a
    // column may be irrelevant, but a hidden card is lost work.
    const stranded = at('x', 'post', 'shoot');
    const cols = boardStages([stranded]);
    expect(cols).toContain('shoot');
    expect(board([stranded]).find((c) => c.stage === 'shoot')!.pieces).toHaveLength(1);
    // Every piece on the board lands in exactly one column, always.
    const rows = [at('a', 'post', 'shoot'), at('b', 'carousel', 'edit'), at('c', 'video', 'idea'), at('d', undefined, 'review')];
    const placed = board(rows).flatMap((c) => c.pieces).map((p) => p.id).sort();
    expect(placed).toEqual(['a', 'b', 'c', 'd']);
  });

  it('an empty board still has columns', () => {
    expect(boardStages([])).toEqual([...STAGES]);
    // ...and captures and references do not conjure columns of their own.
    expect(boardStages([{ id: 'r', title: 'r', meta: { stage: 'shoot', bucket: 'reference', format: 'video' } }]))
      .toEqual([...STAGES]);
  });

  it('calls the writing stage Draft, because the same column holds a post', () => {
    // "Script" is video vocabulary. The KEY stays `script` — it is a persisted
    // JSON enum, and renaming a stored value to fix a label loses in-flight work.
    expect(STAGE_LABEL.script).toBe('Draft');
    expect(STAGES).toContain('script');
  });
});

describe('a piece is created as an idea, then moved', () => {
  it('the board offers an add only at the front of the pipeline', () => {
    // Every column offered "+ New idea", including `published`, where creating
    // "an idea" that is already out is a sentence that does not parse. Six of
    // seven were mislabelled clutter for an act nobody performs; the header's
    // own "New idea" covers the rare backfill.
    const rows: Piece[] = STAGES.map((s, i) => ({
      id: `p${i}`, title: `p${i}`, meta: { stage: s, bucket: 'piece', format: 'video' },
    }));
    const src = readFileSync('components/content/content-workspace.tsx', 'utf8');
    expect(src, 'the content board must gate its add control').toMatch(/canAdd:\s*col\.stage === 'idea'/);
    // ...and the DS default must stay TRUE, or the task board — where adding to
    // "In progress" is an everyday act — loses every one of its composers.
    const board = readFileSync('components/ds/ui/board.tsx', 'utf8');
    expect(board).toMatch(/col\.canAdd !== false/);
    expect(rows).toHaveLength(STAGES.length);
  });
});

describe('naming an image capture', () => {
  const WHEN = '14 Sep, 6:20 PM';

  it('uses what you typed, and a link in it becomes the source', () => {
    expect(imageCaptureTitle('image.png', 'Hero idea for the launch', WHEN)).toEqual({ title: 'Hero idea for the launch' });
    expect(imageCaptureTitle('image.png', 'This layout https://example.studio/work', WHEN))
      .toEqual({ title: 'This layout', sourceUrl: 'https://example.studio/work' });
  });

  it("keeps a name someone chose, readable", () => {
    expect(imageCaptureTitle('nike_ad-frame_03.png', '', WHEN).title).toBe('nike ad frame 03');
    expect(imageCaptureTitle('Studio homepage.webp', '', WHEN).title).toBe('Studio homepage');
  });

  it('calls a screenshot a screenshot, with when it was taken', () => {
    expect(imageCaptureTitle('Screenshot 2026-09-14 at 18.20.11.png', '', WHEN).title).toBe(`Screenshot from ${WHEN}`);
    expect(imageCaptureTitle('Screen Shot 2021-01-02 at 9.00.00 AM.png', '', WHEN).title).toBe(`Screenshot from ${WHEN}`);
  });

  it('replaces a name that says nothing with the moment it was captured', () => {
    for (const name of ['image.png', 'IMG_1234.JPG', '20260914_182011.jpg', 'photo.heic', 'untitled.png', '.png']) {
      expect(imageCaptureTitle(name, '', WHEN).title, name).toBe(`Image from ${WHEN}`);
    }
  });

  it('never mistakes a real name that merely starts like a generic one', () => {
    expect(imageCaptureTitle('images of the rooftop shoot.jpg', '', WHEN).title).toBe('images of the rooftop shoot');
    expect(imageCaptureTitle('photographer moodboard.png', '', WHEN).title).toBe('photographer moodboard');
  });
});

describe('a remembered link preview', () => {
  const URL_ = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const TODAY_ = '2026-09-14';

  it('is stored small, dated, and only with something to show', () => {
    const p = previewFrom({ title: '  Me at   the zoo ', image: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg', siteName: 'YouTube', author: 'jawed' }, URL_, TODAY_);
    expect(p).toEqual({ url: URL_, at: TODAY_, title: 'Me at the zoo', image: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg', siteName: 'YouTube', author: 'jawed' });
    expect(previewFrom({ siteName: 'YouTube' }, URL_, TODAY_), 'a site name alone is not a preview').toBeUndefined();
    expect(previewFrom(null, URL_, TODAY_)).toBeUndefined();
  });

  it('refuses what it cannot trust — it is written from the browser, so the reader guards it', () => {
    expect(readPreview({ url: URL_, at: TODAY_, title: 'T', image: 'http://insecure.example/a.jpg' })?.image, 'http image').toBeUndefined();
    expect(readPreview({ url: URL_, at: TODAY_, image: 'javascript:alert(1)' }), 'script and nothing else').toBeUndefined();
    expect(readPreview({ url: URL_, at: 'yesterday', title: 'T' }), 'not a day').toBeUndefined();
    expect(readPreview({ at: TODAY_, title: 'T' }), 'no url').toBeUndefined();
    expect(readPreview([]), 'not an object').toBeUndefined();
    expect(readPreview({ url: URL_, at: TODAY_, title: 'x'.repeat(5000) })!.title!.length, 'capped').toBe(300);
    expect(readPreview({ url: URL_, at: TODAY_, title: 'T', favicon: 'https://example.studio/favicon.ico' })?.favicon).toBe('https://example.studio/favicon.ico');
    expect(readPreview({ url: URL_, at: TODAY_, title: 'T', favicon: 'data:image/png;base64,AAAA' })?.favicon, 'favicons are https too').toBeUndefined();
  });

  it('survives the round trip through the content JSON', () => {
    const preview = previewFrom({ title: 'Me at the zoo', image: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' }, URL_, TODAY_)!;
    expect(readContent(writeContent({ stage: 'idea', bucket: 'reference', sourceUrl: URL_, preview })).preview).toEqual(preview);
  });

  it('applies only to the link it describes, and only while fresh', () => {
    const preview = previewFrom({ title: 'Me at the zoo' }, URL_, '2026-09-01')!;
    expect(freshPreview({ preview }, URL_, TODAY_), '13 days old').toEqual(preview);
    expect(freshPreview({ preview }, 'https://youtu.be/other', TODAY_), 'the link was edited').toBeUndefined();
    const old = previewFrom({ title: 'Me at the zoo' }, URL_, '2026-07-01')!;
    expect(freshPreview({ preview: old }, URL_, TODAY_), `older than ${PREVIEW_FRESH_DAYS} days`).toBeUndefined();
    expect(freshPreview({}, URL_, TODAY_)).toBeUndefined();
  });
});
