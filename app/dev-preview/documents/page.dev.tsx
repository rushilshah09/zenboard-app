'use client';
// Dev-only harness for the Documents redesign (rail · filter toolbar · well grid ·
// card language), rendered with staged data so it can be verified without a
// session. 404s in prod, like the other dev-preview routes.
import { notFound } from 'next/navigation';
import { DocumentsView, type Folder, type Page } from '@/components/documents/documents-view';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';

const FOLDERS: Folder[] = [
  { id: 'f1', name: 'Life', parent_folder_id: null, sort_order: 0 },
  { id: 'f2', name: 'Folder name', parent_folder_id: null, sort_order: 1 },
  { id: 'f3', name: 'Folder name 2', parent_folder_id: null, sort_order: 2 },
  // Nested folders + nested pages under them, so the breadcrumb trail has
  // something to be a trail OF (DOCUMENT_NAVIGATION_UX).
  { id: 'fLearn', name: 'Learning sources', parent_folder_id: null, sort_order: 3 },
  { id: 'fMotion', name: 'Motion', parent_folder_id: 'fLearn', sort_order: 4 },
  { id: 'fUx', name: 'UX', parent_folder_id: 'fLearn', sort_order: 5 },
];

/** Two workspaces so the trail's first crumb has something to switch between. */
const SPACES = [
  { id: 's1', name: 'Rushil’s Brain', emoji: '🧠' },
  { id: 's2', name: 'Studio', emoji: '🎛' },
];

const BODY = {
  blocks: [
    { id: 'b1', type: 'h3', text: 'How to use this template' },
    // Empty file + pdf blocks so the 0033 upload affordance is verifiable here:
    // a page with an owner offers "Upload" beside the paste-a-link field.
    { id: 'bFile', type: 'file', text: '' },
    { id: 'bPdf', type: 'pdf', text: '' },
    { id: 'b2', type: 'text', text: 'A freelancer portfolio is a collection of your professional work, abilities, and experiences that you can show to potential clients or employers. This template can help you create a portfolio of your own that showcases your skills and experiences.' },
    { id: 'b3', type: 'text', text: 'Go through the template and add your own information.' },
    { id: 'b4', type: 'h2', text: 'Kickoff agenda' },
    { id: 'b5', type: 'text', text: 'Introductions, project scope, timelines and deliverables.' },
    { id: 'b6', type: 'h2', text: 'Decisions' },
    { id: 'b7', type: 'text', text: 'Weekly sync every Tuesday. Invoices sent at month end.' },
    { id: 'b8', type: 'h3', text: 'Next steps' },
    { id: 'b9', type: 'text', text: 'Send the July invoice to TechSpark and share the portal link.' },
    // DELIBERATELY INVALID. Every paragraph above used to be `type: 'p'` — not a
    // BlockType — and nothing said so: the blocks rendered and edited, they just
    // fell out of the document's 16px typography onto the app's 14px UI text.
    // `asBlockType` lands an unknown type on `text` now, and this row is what
    // keeps that honest in the browser rather than only in a unit test.
    { id: 'bLegacy', type: 'p', text: 'Stored with a type the editor does not know — it must still read as a paragraph.' },
  ],
};

// Fixture times count back from the start of today (UTC), never from the moment this module
// loads. The server keeps one evaluation of the module for as long as nothing changes, while
// every page load evaluates it afresh — so "a minute ago" drifted apart ("2m ago" rendered on
// the server, "1m ago" in the browser) and the documents list failed to hydrate on any load a
// minute after the last rebuild (found verifying COLLECTION_VIEW_PLAN C3). The start of the
// day is the same on both sides, in any time zone, except across midnight UTC.
const TODAY = Math.floor(Date.now() / 86400000) * 86400000;
const monthsAgo = (n: number) => new Date(TODAY - n * 2592000000).toISOString();
/** A calendar day `n` days from today, local — so the timeline fixture is always on screen. */
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const DEMO_DB = {
  collection: {
    id: 'demo-col', page_id: 'pDb', name: 'Projects tracker',
    props: [
      { id: 'title', name: 'Name', type: 'title' as const },
      { id: 'status', name: 'Status', type: 'status' as const, options: [
        { id: 'not_started', name: 'Not started', color: 'gray' as const },
        { id: 'in_progress', name: 'In progress', color: 'blue' as const },
        { id: 'done', name: 'Done', color: 'green' as const },
      ] },
      { id: 'tags', name: 'Tags', type: 'multi_select' as const, options: [
        { id: 'design', name: 'Design', color: 'purple' as const },
        { id: 'dev', name: 'Dev', color: 'orange' as const },
      ] },
      { id: 'start', name: 'Start', type: 'date' as const },
      { id: 'due', name: 'Due', type: 'date' as const },
      { id: 'hours', name: 'Hours', type: 'number' as const },
      // A link and a checkbox, so a cell's action (open) and the DS box are seen.
      { id: 'link', name: 'Link', type: 'url' as const },
      { id: 'paid', name: 'Paid', type: 'checkbox' as const },
    ],
    views: [
      { id: 'v1', name: 'Table', kind: 'table' as const },
      { id: 'v2', name: 'Board', kind: 'board' as const, groupBy: 'status' },
      { id: 'v3', name: 'Gallery', kind: 'gallery' as const },
      // A timeline by Start → Due. Dates sit around the real today, so the bars
      // are on screen when the view opens; two pages have no dates at all.
      { id: 'v4', name: 'Timeline', kind: 'timeline' as const, dateProp: 'start', endDateProp: 'due', zoom: 'month' as const },
    ],
  },
  // Enough pages to see a board as a board: every column holding something, titles
  // that wrap, pages with a body (the card's page glyph) and without, and a card in
  // two Tags columns at once.
  rows: [
    // A row whose page holds a page, which holds a page — pages nest without end.
    { id: 'r1', title: 'Portfolio site', data: { status: 'in_progress', tags: ['design'], start: inDays(-6), due: inDays(10), hours: '12', link: 'zenboard.app', paid: true }, order: 'c', created_at: monthsAgo(1), updated_at: monthsAgo(0),
      content: { blocks: [
        { id: 'rb1', type: 'text', text: 'Case studies first, then the about page.' },
        { id: 'rb2', type: 'page', text: '', pageId: 'pCaseStudies' },
      ] } },
    { id: 'r2', title: 'Client onboarding kit', data: { status: 'not_started', tags: ['design', 'dev'], start: inDays(2), due: inDays(5), hours: '6' }, order: 'e', created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r3', title: 'Invoice automation', data: { status: 'done', tags: ['dev'], start: inDays(-24), due: inDays(-12), hours: '20' }, order: 'g', created_at: monthsAgo(2), updated_at: monthsAgo(1) },
    { id: 'r4', title: 'Framer interactive fonts components', data: { status: 'in_progress', tags: ['design'], start: inDays(7) }, order: 'i', created_at: monthsAgo(1), updated_at: monthsAgo(0),
      content: { blocks: [{ id: 'rb4', type: 'h2', text: 'References' }, { id: 'rb5', type: 'text', text: 'Variable fonts on scroll.' }] } },
    { id: 'r5', title: 'Twitter redesign', data: { status: 'not_started' }, order: 'k', created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r6', title: 'Mastership branding', data: { status: 'not_started', tags: ['design'], start: inDays(9), due: inDays(20) }, order: 'm', created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r7', title: 'Back your own ideas. Move smart. The rest doesn’t matter.', data: { status: 'done' }, order: 'o', created_at: monthsAgo(3), updated_at: monthsAgo(2) },
  ],
};

// COLLECTIONS (COLLECTION_PLAN K6): a Collection is its own kind of page, whose items live in its
// content. One item for each way a picture is found or made — a platform thumbnail (YouTube), an
// address that is an image, platforms with no picture to borrow (Instagram, Pinterest), a website and a
// PDF (tiles naming what they are), and a note. `demoCollection` keeps everything in the browser.
// Its tags (K7): a vocabulary of three, one item with more than a card shows, one item with none. Its sources and
// its collected days vary, so K8's Type · Source · Collected filters each have something to hide.
const collected = (hours: number) => new Date(TODAY - hours * 3600000).toISOString();
const BRAND_INSPIRATION = {
  tags: [
    { id: 'tg-type', name: 'Typography', color: 'purple' },
    { id: 'tg-web', name: 'Web', color: 'blue' },
    { id: 'tg-brand', name: 'Branding', color: 'orange' },
    { id: 'tg-motion', name: 'Motion', color: 'green' },
  ],
  items: [
    { id: 'ci1', kind: 'video', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', title: 'Me at the zoo', author: 'jawed', siteName: 'YouTube', tags: ['tg-motion'], createdAt: collected(1), updatedAt: collected(1) },
    { id: 'ci2', kind: 'image', url: 'https://raw.githubusercontent.com/github/explore/main/topics/react/react.png', title: 'React mark — logo reference', tags: ['tg-brand', 'tg-web', 'tg-type', 'tg-motion'], createdAt: collected(2), updatedAt: collected(2) },
    { id: 'ci3', kind: 'link', url: 'https://www.instagram.com/p/C0typeposter/', title: 'Swiss type on a poster wall', siteName: 'Instagram', tags: ['tg-type'], createdAt: collected(3), updatedAt: collected(3) },
    // Written about (K9): the card shows the notes mark, the item's page opens on the words, and a search finds them.
    { id: 'ci4', kind: 'link', url: 'https://linear.app', title: 'Linear — product design', siteName: 'Linear', description: 'Purpose-built for planning and building products.', tags: ['tg-web'], createdAt: collected(4), updatedAt: collected(4),
      body: [
        { id: 'cb1', type: 'text', text: 'Why I saved this: the sidebar stays quiet while the work is loud.' },
        { id: 'cb2', type: 'text', text: 'Reference for the Studio dashboard.' },
      ] },
    { id: 'ci5', kind: 'pdf', url: 'https://example.com/brand/guidelines.pdf', title: 'Brand guidelines', createdAt: collected(5), updatedAt: collected(5) },
    { id: 'ci6', kind: 'image', url: 'https://www.pinterest.com/pin/123456789/', title: 'Packaging with one colour', siteName: 'Pinterest', createdAt: collected(6), updatedAt: collected(6) },
    { id: 'ci7', kind: 'note', note: 'Idea: a quieter onboarding\nFewer steps, one question at a time.', createdAt: collected(7), updatedAt: collected(7) },
    // Collected six weeks ago, so "Collected · Last 30 days" has something to hide (K8), and the only audio item.
    { id: 'ci8', kind: 'audio', url: 'https://example.com/talks/typography-and-tone.mp3', title: 'Typography and tone — a talk', siteName: 'Example', createdAt: collected(24 * 42), updatedAt: collected(24 * 42) },
  ],
};

// The Index (COLLECTION_PLAN X1): a Collection whose preview is ALL pictures — three picture addresses and a
// platform thumbnail — beside Brand inspiration (pictures, then tiles) and the empty Moodboard, which is shared
// with a client so one card says "Shared". Every address here was checked to answer 200 with an image.
const UI_REFERENCES = {
  items: [
    { id: 'ui1', kind: 'image', url: 'https://raw.githubusercontent.com/github/explore/main/topics/figma/figma.png', title: 'Figma mark', createdAt: collected(20), updatedAt: collected(20) },
    { id: 'ui2', kind: 'image', url: 'https://raw.githubusercontent.com/github/explore/main/topics/tailwind/tailwind.png', title: 'Tailwind mark', createdAt: collected(21), updatedAt: collected(21) },
    { id: 'ui3', kind: 'image', url: 'https://raw.githubusercontent.com/github/explore/main/topics/typescript/typescript.png', title: 'TypeScript mark', createdAt: collected(22), updatedAt: collected(22) },
    { id: 'ui4', kind: 'video', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', title: 'Big Buck Bunny', siteName: 'YouTube', createdAt: collected(23), updatedAt: collected(23) },
  ],
};

const PAGES: Page[] = [
  // A TEMPLATE. Documents has a Templates view (`live.filter(p => p.type ===
  // 'template')`) and until 2026-09-09 no fixture carried one — so that view
  // had never been seen with data in the harness. Added by the guard in
  // `fixture-coverage.test.ts`, which exists because two real bugs shipped
  // hidden behind fixtures that only held the happy type.
  { id: 'pTpl', folder_id: null, title: 'Project brief template', type: 'template', tags: ['brief'],
    updated_at: new Date(TODAY - 200000).toISOString(), icon: '📄',
    content: { blocks: [
      { id: 'tb1', type: 'h2', text: 'The problem' },
      { id: 'tb2', type: 'text', text: '' },
      { id: 'tb3', type: 'h2', text: 'What success looks like' },
    ] } },
  // Demo database — verifies Table / Board / Gallery without a session
  { id: 'pDb', folder_id: null, title: 'Projects tracker', type: 'database', content: { demoDb: DEMO_DB }, tags: [], updated_at: new Date(TODAY - 120000).toISOString(), icon: '🗂' },
  // Collections — their own kind of page (COLLECTION_ITEM_BRIEF): one with an item for each kind, one empty
  { id: 'pCollection', folder_id: null, title: 'Brand inspiration', type: 'collection', content: { blocks: [], demoCollection: true, collection: BRAND_INSPIRATION }, tags: [], updated_at: new Date(TODAY - 110000).toISOString(), icon: '🖼' },
  { id: 'pMoodboard', folder_id: null, title: 'Moodboard', type: 'collection', content: { blocks: [], demoCollection: true, collection: { items: [] } }, tags: [], updated_at: new Date(TODAY - 105000).toISOString(), icon: '🧷', client_visible: true },
  { id: 'pUiRefs', folder_id: null, title: 'UI references', type: 'collection', content: { blocks: [], demoCollection: true, collection: UI_REFERENCES }, tags: [], updated_at: new Date(TODAY - 130000).toISOString(), icon: '🎨' },
  // INLINE databases (database brief §3). A table or board inside a doc runs out
  // to the page's edges while its first column stays on the text; the second
  // block is nested under a list item, so its extra offset shows on the start
  // side only. Both blocks are views of one collection, so an edit in either
  // lands in both.
  { id: 'pInlineDb', folder_id: null, title: 'Launch plan', type: 'note', tags: [],
    updated_at: new Date(TODAY - 100000).toISOString(), icon: '🚀',
    content: { blocks: [
      { id: 'ib1', type: 'text', text: 'Everything that has to ship before the launch, in one place.' },
      { id: 'ibp', type: 'page', text: '', pageId: 'pLaunchChecklist' },
      { id: 'ib2', type: 'collection', text: '', colId: 'demo' },
      { id: 'ib3', type: 'bullet', text: 'Nested under a list item, a database lines up with its parent.' },
      { id: 'ib4', type: 'collection', text: '', colId: 'demo', indent: 1 },
      { id: 'ib5', type: 'text', text: 'Anything after the database carries on in the text column.' },
    ] } },
  // PAGES INSIDE PAGES. The first two live under a database row ("Portfolio site"
  // in the Projects tracker) — so Documents must never list them as loose docs —
  // and the second is inside the first. The third is a page inside a doc.
  { id: 'pCaseStudies', folder_id: null, parent_id: 'r1', title: 'Case studies', type: 'note', tags: [], icon: '📚',
    updated_at: new Date(TODAY - 70000).toISOString(),
    content: { blocks: [
      { id: 'cs-1', type: 'text', text: 'Three projects, each told as problem, process, result.' },
      { id: 'cs-2', type: 'page', text: '', pageId: 'pCaseTechSpark' },
    ] } },
  { id: 'pCaseTechSpark', folder_id: null, parent_id: 'pCaseStudies', title: 'TechSpark rebrand', type: 'note', tags: [],
    updated_at: new Date(TODAY - 65000).toISOString(),
    content: { blocks: [{ id: 'ts-1', type: 'text', text: 'Before and after, with the numbers.' }] } },
  { id: 'pLaunchChecklist', folder_id: null, parent_id: 'pInlineDb', title: 'Launch checklist', type: 'note', tags: [], icon: '✅',
    updated_at: new Date(TODAY - 60000).toISOString(),
    content: { blocks: [{ id: 'lc-1', type: 'todo', text: 'Press kit ready', checked: false }] } },
  // COVER FORMS, on purpose (§7H). An uploaded cover used to be base64'd into
  // pages.content and is now an `attachment:<id>` reference — so both forms
  // exist in real documents and both have to render. The legacy data-URL must
  // still paint; the attachment reference has no session here, so its signature
  // cannot be minted and the band correctly falls back to the well colour
  // instead of a broken-image glyph.
  { id: 'pCoverLegacy', folder_id: null, title: 'Legacy inline cover', type: 'note', tags: [],
    updated_at: new Date(TODAY - 90000).toISOString(),
    content: { blocks: [{ id: 'cl1', type: 'text', text: 'Its cover is a data-URL, written before covers moved to storage.' }],
      cover: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><rect width="8" height="4" fill="#5F87C5"/><circle cx="6" cy="1" r="1.6" fill="#F6E3C0"/></svg>') } },
  { id: 'pCoverStored', folder_id: null, title: 'Stored cover', type: 'note', tags: [],
    updated_at: new Date(TODAY - 80000).toISOString(),
    content: { blocks: [{ id: 'cs1', type: 'text', text: 'Its cover is an attachment reference.' }],
      cover: 'attachment:3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c4d' } },
  // UPLOADS SURVIVE REOPENING (user report 2026-09-21: an image uploaded into a doc was gone when it reopened).
  // `up-img` keeps its stored reference, so it must open as the picture — a reader that dropped `fileId` showed
  // "Add an image" there. `up-lost-*` and `up-pdf` lost theirs to that bug before the fix; they offer the page's
  // uploads that nothing shows. No session here: scripts/verify/verify-doc-uploads.mjs answers the listing and signs.
  { id: 'pUploads', folder_id: null, title: 'Discussion call with client', type: 'note', tags: [],
    updated_at: new Date(TODAY - 20000).toISOString(),
    content: { blocks: [
      { id: 'up-1', type: 'h3', text: 'Besan barfi' },
      { id: 'up-2', type: 'bullet', text: 'Slip missing for besan barfi' },
      { id: 'up-img', type: 'image', text: '', fileId: '3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c01', fileName: 'Besan barfi front.png', fileSize: 1834 },
      { id: 'up-3', type: 'bullet', text: 'Nutritional values and nutritional table' },
      { id: 'up-lost-1', type: 'image', text: '' },
      { id: 'up-lost-2', type: 'image', text: '' },
      { id: 'up-4', type: 'bullet', text: 'Mysore pak spelling is wrong' },
      { id: 'up-pdf', type: 'pdf', text: '' },
    ] } },
  // A SIGNED PROPOSAL holding an uploaded image (2026-09-21). Its signature arrives after the doc does, and the row
  // must repaint when it lands; it was taken before uploads survived a reload, so it matches only the upload-blind
  // reading of the page — which must still read as accepted. verify-doc-uploads.mjs answers the load.
  { id: 'pProposal', folder_id: null, title: 'Packaging proposal', type: 'note', tags: [],
    updated_at: new Date(TODAY - 25000).toISOString(),
    content: { blocks: [
      { id: 'pp-1', type: 'h2', text: 'Packaging for four sweets' },
      { id: 'pp-img', type: 'image', text: 'Direction A', fileId: '3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c02', fileName: 'Direction A.png', fileSize: 2048 },
      { id: 'pp-li', type: 'lineitems', text: '', items: [{ id: 'li1', description: 'Packaging design', quantity: 4, unitAmount: 15000 }] },
      { id: 'pp-acc', type: 'accept', text: '', accept: {} },
    ] } },
  // Empty page (no tags) — verifies "Empty page" body alignment
  { id: 'pEmpty', folder_id: null, title: 'Untitled', type: 'note', content: { blocks: [] }, tags: [], updated_at: new Date(TODAY - 60000).toISOString(), icon: '☀️' },
  // MUST NOT APPEAR. A content piece is a `pages` row with no folder, and
  // Documents' default view is "pages with no folder" — so every video in the
  // pipeline used to show up here as a stray document. `lib/page-kinds.ts` says
  // a page claimed by another module belongs to that module, and this row is
  // what keeps that true in a browser rather than only in a unit test.
  { id: 'pContentLeak', folder_id: null, title: 'Studio tour, part one', type: 'content', content: { blocks: [], pipeline: { stage: 'shoot' } }, tags: [], updated_at: new Date(TODAY - 30000).toISOString() },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: 'p' + i,
    folder_id: i >= 3 ? 'f1' : null,
    title: 'Meeting notes - Client kickoff',
    type: 'note',
    content: i === 0
      ? { ...BODY, cover: 'ruri', props: [
          { id: 'pr1', name: 'Status', value: 'In progress' },
          // LEGACY SHAPES, on purpose. Property types and options are stored as
          // JSON, so the vocabulary merge (lib/properties.ts) has to keep reading
          // what was written before it: options as `{ label }` rather than
          // `{ name }`, and the database's `updated_time` spelling of
          // `last_edited_time`. Both must render correctly here, and editing the
          // page must write the canonical form back.
          { id: 'pr2', name: 'Stage', type: 'status', options: [
            { id: 'o1', label: 'Blocked', color: 'red' },
            { id: 'o2', label: 'Shipped', color: 'green' },
          ], selected: ['o2'] },
          { id: 'pr3', name: 'Edited', type: 'updated_time' },
          // The two types that now render properly, and one WITHHELD type saved
          // before it was withdrawn — a formula used to print the current user's
          // name here, which looked like an answer and was not one.
          { id: 'pr4', name: 'Location', type: 'place', value: '12 Rue de Rivoli, Paris' },
          { id: 'pr5', name: 'Attachments', type: 'files', fileIds: [] },
          // A REAL formula now — the engine has always been able to do this;
          // until today nothing could write one. Reads two properties above it.
          { id: 'pr6', name: 'Budget left', type: 'formula',
            formula: { expr: 'if(prop("Stage") == "Shipped", concat("Billed ", prop("Location")), "Open")' } },
          // A relation holding TWO DIFFERENT record types — the deliberate
          // difference from Notion, where a relation is bound to one database.
          // The second id resolves to nothing, so it renders as a tombstone.
          { id: 'pr7', name: 'Related', type: 'relation', records: [
            { type: 'client', id: '11111111-2222-4333-8444-555555555555' },
            { type: 'project', id: '66666666-7777-4888-8999-aaaaaaaaaaaa' },
          ] },
        ], resources: [{ id: 'r1', url: 'https://linear.app', label: 'linear.app' }] }
      : BODY,
    tags: ['Client Meeting', 'TechSpark'],
    updated_at: monthsAgo(4),
    icon: i === 0 ? '🎯' : undefined,
  })),
  // Motion: a page with a child page (trail depth 5) plus siblings.
  { id: 'pAe', folder_id: 'fMotion', title: 'After Effects', type: 'note', content: BODY, tags: [], updated_at: monthsAgo(1), icon: '🎬' },
  { id: 'pKey', folder_id: 'fMotion', parent_id: 'pAe', title: 'Keyframes', type: 'note', content: BODY, tags: [], updated_at: monthsAgo(1) },
  { id: 'pEase', folder_id: 'fMotion', parent_id: 'pAe', title: 'Easing curves', type: 'note', content: BODY, tags: [], updated_at: monthsAgo(2) },
  { id: 'pPr', folder_id: 'fMotion', title: 'Premiere', type: 'note', content: BODY, tags: [], updated_at: monthsAgo(2) },
  { id: 'pBl', folder_id: 'fMotion', title: 'Blender', type: 'note', content: BODY, tags: [], updated_at: monthsAgo(3), is_favorite: true },
  // UX: nine siblings, which is what trips the menu's filter box (>7 rows).
  ...Array.from({ length: 9 }, (_, i) => ({
    id: 'pUx' + i,
    folder_id: 'fUx',
    title: ['Affinity notes', 'AI research', 'Accessibility', 'Design tokens', 'Heuristics', 'Interviews', 'Motion in UI', 'Personas', 'Usability tests'][i],
    type: 'note',
    content: BODY,
    tags: [],
    updated_at: monthsAgo(i),
  })),
];

export default function DocumentsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--canvas)', padding: 8 }}>
      <div style={{ height: '100%', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <DocumentsView initialFolders={FOLDERS} initialPages={PAGES} userInitial="R" userName="Rushil Shah" spaces={SPACES} activeSpaceId="s1" />
      </div>
      {/* Its own <Toaster/>: dev-preview renders OUTSIDE AppShell, which owns the
          app's single one. Without it every toast this harness raises is
          invisible — including the one that says an optimistic edit was refused
          and put back, which is the ONLY report that failure ever gets. */}
      <Toaster />
      {/* And the shell's net: dev-preview has no session, so EVERY action here
          throws — without this the harness silently keeps edits that failed. */}
      <ActionFailureNet />
    </div>
  );
}
