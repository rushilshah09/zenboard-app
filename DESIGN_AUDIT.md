# Zenboard Design Audit

Conducted 2026-07-03. Scope: every top-level screen (Dashboard, Inbox, Tasks, Calendar,
Horizon, Projects, Clients, Money, Documents, Settings, Focus) plus a codebase-wide scan
for design-token violations across all 100 `.tsx`/`.ts` files under `components/`, `app/`,
`lib/`. Findings below are concrete — file:line references and screenshots, not opinion.

## The headline finding

**The design system foundation is good. Adoption of it is the problem.**

`app/globals.css` already has a comprehensive token set: full color ramp (paper/ink/accent
families), a radius scale, a shadow scale, and motion tokens. `components/ui/` already has
well-built primitives: `primitives.tsx` (Button, Card, Field, Input, Textarea, Pill, Kbd),
`zen.tsx` (Btn, Badge, StatTile, SectionHead, Tabs, Toast), and `states.tsx`
(EmptyState, Skeleton, ErrorState — the last explicitly commented "never a centered
spinner," which is exactly what was asked for here).

But adoption is almost nonexistent, out of **70 component files**:

| Shared file | Imported by | Adoption |
|---|---|---|
| `components/ui/primitives.tsx` (Button, Card, Field, Input, Pill) | 3 files | 4% |
| `components/ui/zen.tsx` (Btn, Tabs, Badge, StatTile) | 8 files | 11% |
| `components/ui/states.tsx` (EmptyState, Skeleton, ErrorState) | 0 feature files (only its own internal use) | 0% |

The screens that *do* use `zen.tsx` (Projects, Money) are visibly the most polished,
consistent screens in the app. The screens that hand-roll everything inline (Dashboard,
Horizon, Focus, the sidebar/topbar) are exactly the ones that read as "generic" /
"unrefined." This is a causal, not just correlated, relationship — see screen notes below.

**On top of that, there is one genuine foundational gap**: no typography token system
exists at all (confirmed: zero `--text-*`/`--font-size-*` variables in `globals.css`).
Even the *shared* components (`zen.tsx`'s `Btn`, `StatTile`, `SectionHead`) pick font-sizes
as raw numbers (13, 14, 15, 24...) rather than from a scale. A codebase-wide scan found
**623 `fontSize:` declarations spanning 26 distinct numeric values** (9 through 52,
including half-points like 11.5/12.5/13.5), which is the clearest signal that sizes are
being eyeballed per-component rather than drawn from a system.

There is also a duplicate Button problem specifically: `primitives.tsx` exports `Button`
and `zen.tsx` exports a *differently-shaped* `Btn` (different variant names, different
sizing mechanism) — two non-interoperable canonical buttons, plus a near-exact copy of
`zen.tsx`'s Button logic duplicated inline in `components/clients/clients-view.tsx`, plus
the sidebar/topbar's buttons, which use neither and hand-roll a third pattern.

---

## Concrete bugs found (fix regardless of design-system work)

1. **Settings shows the wrong active nav state.** On `/settings`, both the sidebar and the
   top bar highlight "Dashboard" as active instead of nothing/Settings — the `current`
   page-id resolver in `app-shell.tsx` has no entry for `settings`, so it silently falls
   back to `'today'`. Misleads users about where they are. `components/shell/app-shell.tsx`.
2. **"Templet" typo** on the Documents toolbar button (should be "Template").
   `components/documents/documents-view.tsx`.
3. **Duplicate "Today's highlight — Do this first" card** on the Dashboard — it renders
   once as a dismissible banner with a Shutdown CTA, and again immediately below as a
   separate section with the identical title. Reads as a bug, wastes vertical space.
   `components/today/today-view.tsx` (or equivalent).
4. **`ITEMSSTATUS` column header** on the Money invoice table is missing a space/separation
   between "Items" and "Status". `components/money/money-view.tsx`.
5. **Toggle switch reimplemented independently 4 times** (`view-width.tsx`,
   `app-shell.tsx`, `share-panel.tsx`, `focus-view.tsx`), each with slightly different
   hardcoded shadow opacity (`0.2` vs `0.08`) and radius (`99` vs `999`) — not a visible
   bug today, but a ticking one; the next person to touch one will drift further.

---

## Codebase-wide token-violation scan (grounded, not estimated)

Full methodology and raw grep output in `/private/tmp/.../scratchpad/` from this session;
summary:

- **Colors**: well-adopted (40 raw hex/rgba matches across 14 files, mostly the duplicated
  toggle-switch and a few `COLORS` swatch arrays that have drifted from `lib/theme.ts`'s
  canonical `ACCENTS`).
- **Border-radius**: 449 declarations, 41% hardcoded. Two clean wins: `5`/`6`/`8` collide
  exactly with existing `--r-xs`/`--r-sm`/`--r-md` (mechanical find-replace); `99` vs `999`
  are the same pill shape fought with two magic numbers because no `--r-full` token exists.
- **Spacing**: ~42% of files use off-scale values. Not random — `6`, `10`, `14`, `18`
  recur so consistently (65-69 occurrences each for gap alone) that it looks like an
  unofficial secondary scale running parallel to `--space-*`, worth formalizing rather
  than just "fixing."
- **Typography**: no scale exists (see above) — the single biggest gap.
- **Shadows**: best-adopted category (89% compliance); remaining violations trace to the
  same duplicated toggle-switch.
- **Icons**: 301 `<Icon size={N}>` usages across 12 distinct sizes (10-22); 13 and 14
  dominate. A real scale needs ~4 sizes, not 12.

---

## Screen-by-screen notes

**Dashboard (`/today`)** — duplicate highlight card (bug, above). Two different section-
header treatments on one page (grey-pill-bar header for "Today's highlight"/"Schedule" vs.
plain text for "Today's plan"). Empty states are plain centered text, not using the
existing `EmptyState` component.

**Inbox** — one of the better screens. Clean header, capture input, row actions. Minor:
row action icon-buttons feel slightly disconnected (faint borders, inconsistent gaps).

**Calendar** — solid. Toolbar mixes three different button styles (ghost `Sync`/`Today`,
segmented `Day/Week/Month`, solid `+ New event`) with no shared toolbar-button component
behind them.

**Horizon** — third distinct page-header pattern (bold title + italic serif tagline,
shared with Money/Settings — fine once codified, just needs to be the *only* pattern for
this class of page). Empty state is generic text in a dashed box, not `EmptyState`.

**Projects** — the most polished screen in the app, and it's the one most built on
`zen.tsx` (`StatTile`, `Tabs`, `SectionHead`). This is the reference to build the rest of
the app toward, not a page needing rework. One nit: "Preview as client" renders with a
permanent accent tint alongside plain ghost siblings ("Edit", "Shared"), which reads as if
it's already toggled on.

**Clients** — best empty state in the app (icon in a tinted circle, heading, hint, primary
CTA) — but it's hand-rolled, not the shared `EmptyState` component. Should become the
reference implementation *of* that component everywhere else.

**Money** — second-most polished screen (also built on `zen.tsx`). Real bug: `ITEMSSTATUS`
header spacing (above).

**Documents** — "Templet" typo (bug, above). Toolbar buttons are a fourth distinct
small-button style, different again from Calendar's and Money's.

**Settings** — wrong active-nav bug (above). Otherwise clean; "Save changes" button's
default/idle state renders low-contrast enough to look disabled when it isn't.

**Focus** — correctly minimal chrome for a distraction-free mode, but the empty state
("Your task list is empty.") is barer than Clients' — no icon, no hint copy — so it reads
unfinished rather than intentionally spare.

---

## Recommended sequencing

Doing this all at once across 70 files in one pass would itself violate the "never ship
inconsistent, unreviewed work" spirit of the ask. Proposed order, each step independently
shippable and verifiable:

1. **P0 — fix the 5 concrete bugs above.** ✅ Done 2026-07-03 (all but the toggle
   dedup, folded into step 3). Settings active-nav bug, "Templet" typo, duplicate
   Dashboard highlight title, Money `ITEMSSTATUS` grid gap.
2. **P0 — typography token scale.** ✅ Done 2026-07-03. 11-level scale
   (`display/h1/stat/h2/h3/h4/bodyLg/body/small/caption/label/code`) added to
   `globals.css` (both raw `--text-*` custom properties and Tailwind `@theme inline`
   utilities) plus `lib/typography.ts`'s `TYPE` object for the inline-style majority
   of the codebase. Sizes were verified against live-rendered examples (not guessed)
   before locking: page titles → h1 (28px), StatTile numbers → stat (24px),
   SectionHead → h4 (15px). Applied to `zen.tsx`'s `StatTile`/`SectionHead` and
   verified pixel-identical on Projects/Money afterward.
3. **P0 — Button/Btn reconciliation + Toggle.** ✅ Done 2026-07-03, partially. `Button`
   (`primitives.tsx`) is now a strict superset of `Btn` (`zen.tsx`) — gained the
   `tinted` variant and icon/iconRight props. Added `--r-full` token and a canonical
   `Toggle` component. **Deliberately not done**: `Btn`'s 8 existing call sites were
   *not* repointed to `Button` (would've silently changed rendering in files outside
   this pass's review), and the 4 duplicated inline toggle-switches were *not* swapped
   for the new `Toggle` yet — both are step 4 work now that the canonical
   implementations exist and are ready.
4. **P1 — rollout, in progress.**
   - **Empty states — ✅ Done 2026-07-03.** The shared `EmptyState` (`states.tsx`) was
     first *upgraded* to match the app's best hand-rolled empty state (Clients: 48px
     tinted icon tile, 18px display title, 280px-capped hint, accent CTA) and gained
     `tone` (neutral/accent), `compact`, `secondaryAction`, `ReactNode` title/hint, and
     a proper iconized `ErrorState`. Then rolled out — going from **0% adoption → the
     backbone of every primary empty surface**: Dashboard highlight (`Star`, accent),
     Dashboard plan (`Sun`), Habits (`Fire`), Schedule (`CalendarDots`, compact),
     Horizon (`Target`), Inbox (`Check` + inline `Kbd`), and Clients (`Users`) — the
     former reference now built *on* the component. `SkeletonRows` preset added for
     list loaders. tsc clean; each surface verified live in the browser.
   - **Toggles — ✅ Done 2026-07-03.** Extracted a presentational `SwitchTrack` (single
     source of truth for track/knob geometry) that both the standalone `Toggle` and
     row-embedded switches share — so the drift the audit flagged (34/36px tracks,
     `0.2` vs `0.08` shadow, `99` vs `999` radius) can't recur. Migrated `view-width.tsx`
     and `share-panel.tsx` off their hand-rolled `Switch` spans. The two Focus-mode
     switches (`app-shell.tsx`, `focus-view.tsx`) are *navigation* controls nested
     inside larger labeled buttons — left as-is (dropping a `Toggle` button inside a
     button would be invalid HTML; low payoff, real risk).
   - **Still open (deliberately deferred as lateral/low-payoff churn needing per-site
     visual diffs):** repoint `Btn`→`Button` at its 9 call sites; consolidate the
     Calendar/Documents toolbar buttons + segmented control onto the canonical
     `Button`/`Tabs` (Horizon & Money already use `zen.Tabs`); dedupe the
     `COLORS`/`TAG_COLORS` arrays drifted from `lib/theme.ts`.
5. **P2 — not started.** Formalize or eliminate the "6/10/14/18" secondary spacing
   scale; sweep the mechanical radius collisions (`5→r-xs`, `6→r-sm`, `8→r-md`).

---

## 2026-07-04 — Calendar redesign (shipped)

Full visual redesign of the Calendar tool onto the shared panel language
(interaction engine — drag-create/move/resize, overlap lanes — kept intact):

- **Layout**: one full-height `Panel` instrument (grey chrome) holding the
  toolbar, a mini-month rail (hidden ≤980px), and the white `PanelCard` grid
  canvas. Replaces the letterboxed 62vh grid + floating toolbar. This also
  retires the audit's "Calendar toolbar mixes three button styles" finding.
- **Toolbar**: single 30px control family — grouped `‹ Today ›` nav, the app's
  segmented `Tabs` for Day/Week/Month, accent New event. Heading is always
  "Month Year" + a view-specific `num` caption.
- **Event language** (app-wide semantic, matches dashboard Schedule): plum
  accent = Zenboard, blue = Google; 3px left bar + soft tint over `paper-2` +
  1.5px white keyline; hover lifts with `shadow-md` (130ms). Same treatment in
  week blocks, all-day chips, and month chips. Legend in the rail.
- **Now line**: gutter time chip (dashboard "Now" language) + whisper hairline
  across the week, solid 2px on today. Today/weekend columns get faint washes.
- **Month view**: "+N more" now opens that day in Day view (was a dead label
  that fell through to create-event); cells hover-invite; out-month washed.
- **EventEditor**: rebuilt on system `Button`/`Toggle`/`Input`, labeled fields.
- **Fixed in passing (app-wide bug)**: the unlayered `button{color:inherit;
  font-size:inherit}` reset in `globals.css` beat every Tailwind color/size
  utility on buttons — primary `Button` rendered ink-on-accent (the contrast
  bug the user screenshotted). Now wrapped in `@layer base` so utilities win.
- **Dev harness**: `/dev-preview/calendar` (404s outside development) renders
  `CalendarView` via a new `demoEvents` prop with staged data — overlaps,
  all-day, synced/manual — for visual verification without a session.
- Verified: all three views + editor + create flow, dark mode, 768px tablet,
  `tsc` clean, zero console errors.

## 2026-07-07 — DS v2 reconciliation + Sidebar Control (shipped)

Source of truth: the "Updated DS v2" + "pop up ui" Figma Sites exports (decoded,
served locally, and measured via getComputedStyle — same method as the 2026-07-06
HiFi pass; reference pages were deleted from `public/` after verification).

- **Tokens (`globals.css`)**: ink ramp re-anchored (`#20201F / #2C2C2B / #4F494E /
  #5F5E59 / #878386`); `--paper-2 → #FEFEFB`, `--paper-3 → #F2F2EF`; new
  `--line-3` (24% stroke for radio/checkbox outlines), `--hover`/`--hover-strong`
  (warm `rgba(42,28,0,…)` wash — now also drives `.zb-press` and `.zb-nav-item`),
  `--disabled-bg`/`--disabled-text` (the flattened disabled treatment every
  control collapses to), `--tip-bg`/`--tip-text` (dark tooltip chip). Depth
  system re-measured: sm = shell panels, md = floating pills, lg = popovers
  (`0 16px 32px -12px`), xl = dialogs (adds the warm ring), panel/card = the
  two-layer card frame/sheet. `--accent-soft` 9%→8%, `--on-accent → #FDFEFB`,
  `--sidebar-w-collapsed 56→50`. Body text 14/20 with -0.006em tracking.
  Dark-theme equivalents added for every new token.
- **Button (`primitives.tsx`)**: DS v2 language — 14px/400 at every size, gap 4,
  radius 8, pads 10/10/12 across 28/32/40, icons 16 at every rung (icon-only
  squares pad 6/8/12). New `dark` variant (`#2C2C2B` → hover `#5F5E59`); ghost
  is ink-4 → warm wash; tinted loses its border (8% accent fill); primary loses
  its shadow. All fill variants share the token disabled treatment. New
  `SplitButton` (main action · hairline · chevron segment). `Pill` → 20px chip,
  radius 5, 12/500, warm-wash neutral. New `Tooltip` (dark 10px chip, pure CSS
  reveal) and `RadioIndicator` (16px circle; accent donut when checked).
- **Shell (`app-shell.tsx`)**: borderless floating panels (shadow only), 8px
  panel gap, 48px topbar (breadcrumb 14/400 ink-2, 230px borderless search,
  borderless Focus pill, ghost + New per the mock), sidebar brand row 48 with no
  divider, nav padding 8, items 34/r6 with warm-wash active + 2×25 accent edge
  bar + 400-weight labels (ink-2 active / ink-4 rest), 24px paper-4 workspace
  avatar, menus on the popover language (r12 · shadow-lg · paper-3 header strip).
- **Sidebar Control (new, per the popup design)**: manages two INDEPENDENT
  states. Current active mode — row click, switches immediately, warm selected
  wash, stored per-tab in `sessionStorage` (`zb:sidebar:session`). Default
  startup mode — the right-hand 16px radio indicator; hover = warm halo +
  "Mark as default" tooltip; click persists to `localStorage` (`zb:sidebar`,
  key kept for back-compat) without touching the current mode; restored on
  every launch. Popover: 230px paper-2 sheet, r12, popover shadow, 32px paper-3
  header strip, 28px rows (pad 4×8, r4). Verified live: row switch keeps the
  donut in place, marking default doesn't move the sidebar, fresh session
  restores the default; all popover metrics match the reference exactly.
- Verified: `/dev-preview/ds` button ladder numerically identical to the
  reference matrix; `/dev-preview/shell` light + dark + 375px mobile; `tsc`
  clean. Legacy `Btn` call sites intentionally untouched (per the standing
  "per-site visual review" policy) — they inherit the new tokens automatically.

## 2026-07-07 (later) — Home + Documents redesign (shipped)

Source: "document and home screen redesign .mhtml" (Figma Sites export, decoded →
measured via getComputedStyle → reference deleted from `public/` after).

- **Panel language (app-wide, `panel.tsx`)**: headers go quiet — 16/500 `--ink-5`
  title + muted 16px icon (was 14/500 ink); `PanelAction` is now a plain ghost
  (14/400 ink, 16px icon — was a bordered 12px chip).
- **Home (`today-view.tsx` + `schedule-section.tsx`)**: 32px top padding and 32px
  section rhythm; greeting Mark 24 + gap 6, title ink-2; shutdown banner is a flat
  paper-2 sheet (16×20 pad) with a plain moon glyph, 16/500 ink-2 title, 12/400
  ink-5 sub, bordered white Shutdown chip + ghost X (no accent tile/shadow);
  highlight card: 14/500 ink-2 title, warm-wash tag chips, 20px pad, lead action =
  bordered white chip + ghost siblings (14/400); schedule event titles 14/400.
- **Documents (`documents-view.tsx`)**: rail gets the top icon row (hide-rail ·
  search · new page) with an inline search filter; rows use the warm-wash active
  language (ink-2 active / ink-4 rest, 16px icons). Toolbar is now right-aligned
  [Filter ⌄] (by tag, from live tags) + [⋮ Create] menus on the DS popover
  language. Grid sits on the new recessed `--well` surface (`#E7E7DF`, pad 12,
  new token + dark equivalent) with flat two-tone cards — 271×320 r12, paper-3
  head (16/500 ink-4 title · 12 meta · 24px dot chips on paper-2) over a paper-2
  preview body (12/16 wrapped); dashed New Note tile (1.5px `--line-3`, r12).
  Editor page flattened onto the panel surface (no floating card) with a
  Notion-style ghost "Add icon" row (functional — `updatePage` now accepts
  `icon`; small emoji strip). Responsive: rail auto-hides ≤820px (toolbar button
  restores it), cards go fluid ≤680px.
- **Dev harnesses**: `app/dev-preview/home` and `app/dev-preview/documents`
  (staged data mirroring the reference frames; 404 in prod).
- Verified live on both harnesses (grid + filter + rail collapse + editor +
  mobile 375); only harness error is the expected unauthenticated autosave.
  `tsc` clean.

## 2026-07-08 — Doc editor counter/TOC + app-wide popover unification (shipped)

- **Document live counter** (`DocStats`, documents-view): floating pill at the
  bottom edge of an open document — Characters · words · sentences · paragraphs ·
  Spaces, computed live from title+blocks; `--well` surface, 13px ink-5,
  tabular numerals, pointer-events none.
- **Document progress indicator** (`DocToc`): the collapsed heading-lines rail
  now expands on hover into a labeled sections panel (DS popover surface, 28px
  rows, line glyph + 14px label, active = warm wash + ink line); click scrolls.
- **App-wide popover unification**: normalized 15 legacy menu surfaces across 9
  files (tasks, calendar ×3, week ×2, clients, focus ×2, task-detail,
  block-editor ×3) plus the documents Card/DocAction menus and the shell account
  menu to ONE popover language — paper-2 · r-lg 12 · shadow-lg · no border ·
  8px padding · 28px items (14/400 ink-4, warm-wash hover). Hover states in
  week/horizon/view-width switched from paper-3 to `--hover`. Dialogs/drawers
  intentionally keep `shadow-xl` (that's the dialog tier).
- Verified in the documents harness: counter counts correctly, TOC expands with
  active tracking, menus render on the new surface. `tsc` clean.

## 2026-07-09 — Document covers, icon picker, comments (shipped)

Sources of truth: `Document redesign v1 .mhtml`, `chnage cover .mhtml`,
`emoji upload .mhtml`, `add comment .mhtml` (decoded + measured via
getComputedStyle; ref pages deleted after). Notion is the structural benchmark
for the cover panel; every value maps to existing tokens.

- **New DS components**:
  - `ui/picker-panel.tsx` — PickerPanel (paper-3 · r-xl 16 · `--shadow-panel`
    4-layer ring+drop, new token pair light/dark) + PickerTabs (40px row, pill
    tabs 4px 8px r-md 14/400 — active `--hover`+ink-2, rest ink-4) +
    PickerQuietAction (quiet ink-4 "Remove" — measured, NOT red).
  - `ui/emoji-picker.tsx` — Emoji | Icons | Upload; 28px paper-2 search field
    (hairline ring, disabled-text placeholder) + bordered shuffle + skin-tone
    cycle (Fitzpatrick, persisted `zb:emoji-tone`); recents (`zb:emoji-recent`);
    12-up 32px cells, 24px glyphs, 12/500 ink-5 labels; bottom category rail
    with scroll-sync; curated Phosphor "Icons" tab (stored `ph:Name`); upload →
    180px square data-URL.
  - `ui/page-icon.tsx` — PageIcon resolves emoji / `ph:Name` / image URL at any
    size; used by sheet icon (52), topbar crumb (12), card titles (15).
  - `ui/upload-zone.tsx` — shared dashed drop target (drag highlight, browse).
  - `documents/cover-picker.tsx` — Gallery | Upload | Link + quiet Remove;
    "Color & Gradient" section label (12/500 ink-5); 4-up 2:1 swatches r-sm,
    accent ring + check on current; Link tab (paste URL → cover, `--primary`
    submit); width 560.
  - `lib/covers.ts` — 20 curated Japanese-palette gradient covers (sakura …
    tsuki; content assets, fixed colors by design); `lib/image.ts` — canvas
    downscale to data-URL (cover 1600w webp/jpeg ~0.82, icon 180 square).
- **Document cover band** (`DocCover`): full-bleed, fixed 279px (180 ≤680px,
  measured from the HiFi); gradient or uploaded/link image. Grouped action pill
  top-right 10/10 per the HiFi — paper-2 · 1px `--line` · r8 · pad 2 · gap 4,
  chips 14/400 ink-4 (r6, 4px 6px), 1×13 `--line` dividers: Change | Random
  (gradients) / Change | Reposition (images). Reposition = drag-to-crop
  (objectPosition %, persisted as `coverPos`), Save/Cancel in the same pill.
- **Comments** (`DocComments`, per add-comment HiFi): 24px r6 `--well` avatar
  with 14/400 ink-3 initial (real initial passed from profile; `userInitial`
  prop), quiet 14px composer "Add a comment…", Enter/`--primary` arrow posts,
  Esc closes; rows show text + ago + hover-delete. Stored in content JSON
  `comments` next to blocks/props/resources (no schema change).
- **Ghost trio** now uses the real pickers; "Add comment" stays available even
  when icon+cover are both set. Doc metadata (cover/coverPos/props/resources/
  comments) rides in the page content JSON via the existing autosave.
- Verified in the documents harness: 20-swatch gallery + selection ring, random,
  upload→webp cover, reposition drag (50→21% save), link tab, comment post with
  spec-exact avatar, PageIcon at all call sites. `tsc` clean.

---

# 2026-07-17 — Design-engineering audit & rebuild (master-prompt v4)

New master directive: install/repair the system layers, then rebuild screens.
North star: Things 3 warmth × Linear discipline. This section is the work order;
every row is verified against the current codebase (file:line), not taken from
the prompt on faith. Where the prompt's claim conflicts with what's actually
shipped, the Verdict column says so.

## Audit table

| # | Screen | Element | Problem | Root system missing | Fix | Verdict |
|---|--------|---------|---------|--------------------|-----|---------|
| 1 | Goals vs Home/Tasks | Primary buttons | "New goal" renders NEUTRAL DARK (`primitives.tsx:38` maps `primary→'neutral'`); Tasks/Home render BERRY (`ds/ui/button.tsx:26` `primary: bg-berry-500`). Two Button primitives with opposite primary treatments coexist (10 files import ds/ui, 23 import primitives/zen). | One canonical Button | **Primary = accent, period.** Repoint `primitives.tsx` primary at the accent fill; migrate call sites toward `ds/ui` Button over time. Composer "Add task" (tasks-view) flipped dark→accent too. | CONFIRMED |
| 2 | Calendar | Category checkboxes | Rail checkboxes take each calendar's raw hue (`calendar-sidebar.tsx:23` `background: dot`); `EVENT_COLORS` is a 9-hue palette (`lib/event-color.ts:11`). Rainbow exists nowhere else in the app. | Governed semantic palette | Cut `EVENT_COLORS` to a governed set drawn from the status trios; keep hue as *signal* (per-calendar identity) but cap saturation/count; checkbox chrome stays neutral until checked. | CONFIRMED (partially governed — hues already come from token trios, but count+raw-hue chrome is ungoverned) |
| 3 | Home | Panel-in-panel | `panels.tsx` Panel = paper-2 shell w/ ring-or-border; `PanelBody` = paper-3 card w/ ANOTHER border + shadow inside it (panels.tsx:66-71). Double borders + stacked fills on every Home module. | One elevation step per surface | Flatten: each module = ONE `surface` card (radius-lg, single elevation); internal grouping via spacing + hairline dividers, not a second card. NOTE: the framed-panel look came from the Figma HiFi file — the v4 prompt supersedes it. | CONFIRMED |
| 4 | App-wide | Figure/ground | Canvas #E8E8E3 vs card #FCFCFA is fine, but border+shadow doubling (row 3) and paper-2 shells blur the ramp. | Elevation ramp discipline | flat=canvas · raised=surface + (border XOR soft shadow) · overlay=shadow-lg. Enforce "never both heavy border and shadow". | CONFIRMED |
| 5 | App-wide | Type scale | `--text-*` tokens exist (globals.css) but screens set raw `text-[24px]`/`text-[16px]`/`fontSize` inline everywhere (today-view, tasks-view, calendar). Scale exists; role discipline doesn't. | Named type roles | Map display/title/subtitle/body/label/caption onto the existing `--text-*` ladder; sweep raw sizes to roles per screen during rebuilds. | PARTIAL (tokens exist, usage undisciplined) |
| 6 | IA | "Projects" ×4 | Nav item "Projects" (app-shell), sidebar starred group, tasks rail "List" group (= projects), calendar rail "PROJECTS" category group. | One entity model | Rename tasks rail group "List"→"Projects"; calendar group stays "Projects" only if it filters project calendars (it does); kill the separate starred duplicates or label the group. | CONFIRMED |
| 7 | Sidebar vs Tasks | Project entity token | Main sidebar: folder icon (`Folder=Ph.FolderNotchIcon`); tasks rail: 8×8 colored dots; calendar rail: colored checkbox. Three renderings of one entity. | Entity token | One project token = colored dot + name (dot carries identity color; folder icon dropped except Documents-style contexts). Apply in app-shell, tasks-view, calendar-sidebar. | CONFIRMED |
| 8 | App-wide | Radius | `--r-*` scale exists and is broadly adopted; stragglers: task checkbox r5 vs `--r-xs` 4 / prompt's radius-sm 6, mixed popover radii already normalized earlier. | Radius mapping | Checkbox → 6px (`--r-sm`-adjacent); sweep remaining raw radii to tokens during screen passes. | PARTIAL (mostly done) |
| 9 | Tasks | Casing | Header renders "Filter" (Title) beside "layout" (lower) — tasks-view.tsx:398 vs :424. | Casing rule | Buttons/controls Title Case, descriptions sentence case. "layout"→"Layout". | CONFIRMED |
| 10 | Goals | Duplicate action labels | "New goal" (horizon-view.tsx:185) + "Add goal" (:208) for the same action. | One label per action | Standardize on "New goal" (matches topbar "+ New"). | CONFIRMED |
| 11 | App-wide | Empty states / seed | Canonical EmptyState exists — TWICE (`ui/states.tsx` + `ds/ui/states.tsx`). Real app has no seed data (demo data only in dev-preview). | One EmptyState + first-run seed | Merge to one EmptyState; add first-run seed content (starter tasks/goal/habit) at onboarding. | CONFIRMED (duplicate primitive) |
| 12 | App-wide | Icon voice | `ds/icons.ts` ships a MIX: ~45 Phosphor exports (shell/Home/tasks) + ~170 Tabler exports. Two stroke voices at once. | One icon set | Complete the Phosphor migration through the seam (user directive 2026-07-17: Phosphor). | CONFIRMED |
| 13 | Home | Greeting fallback | `today/page.tsx:20` falls back to raw email prefix → "designdotrushil". | Humane copy | Fallback chain: full_name → "there" (never the email handle). | CONFIRMED |
| 14 | App-wide | Card language | TWO panel systems ship: `ui/panel.tsx` (44px-header Panel/PanelHeader/PanelCard) and `ui/panels.tsx` (framed Figma panel). Same job, different components. | One Card | Fold into one Card primitive during the Home flatten (row 3). | CONFIRMED |

## Execution order (v4 §9)
1. ~~Audit~~ (this table).
2. Token repairs: primary=accent decision (row 1), elevation rule (row 4), governed event palette (row 2).
3. Primitives: one Button, one Card, one EmptyState, entity token, icon seam→Phosphor (rows 1,3,7,11,12,14).
4. IA/copy: rows 6,9,10,13.
5. Screen rebuilds Home→Tasks→Calendar→Goals→rest, each closing its rows above.
6. Acceptance pass per §7 + anti-pattern review per §8.
