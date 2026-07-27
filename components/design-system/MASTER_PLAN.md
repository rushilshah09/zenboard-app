# Zenboard Design System — Master Plan

*The governance document for evolving Zenboard's Black & White design system. It sits above individual specs (`button-spec.md`, `usage.generated.ts`) and under the `DESIGN_CONSTITUTION.md`. Read this before building or auditing any surface.*

Target bar: **Linear** (precision, density, speed) · **Notion** (flexible structure) · **Claude** (calm, readable). Zenboard is none of them — it is a calm, monochrome operating system for work.

---

## 0. Status snapshot (2026‑07‑18)

Migration is page‑by‑page. A surface is "done" when it renders entirely from DS components + tokens, with the only remaining inline `style={}` being one of the **two sanctioned cases**: (a) **user/label/project/event colour**, or (b) **computed layout geometry** (position/size from runtime math — e.g. a calendar event's `top`/`height`, a grid's `gridTemplateColumns`). Everything else — every colour, type, radius, border, elevation, and motion value — is a token.

| Surface | `style={` | legacy `var(--…)` | status |
|---|---:|---:|---|
| today (Home) | 4 | 4 | ✅ done (user colours only) |
| **tasks** | **5** | **0** | ✅ done |
| **calendar** | **25** | **0** | ✅ done (geometry + event colour only) |
| **projects** | **8** | **0** | ✅ **done — this pass (3 user-colour + 4 computed-geometry + 1 comment mention)** |
| settings | 3 | 0 | ✅ effectively done |
| habits | 2 | 0 | ✅ effectively done |
| auth | 0 | 0 | ✅ done |
| documents | 650 | 932 | ⬜ heaviest |
| shell (cross‑cutting) | 183 | 281 | ⬜ |
| money | 126 | 169 | ⬜ |
| clients | 103 | 181 | ⬜ |
| focus | 58 | 85 | ⬜ |
| inbox | 58 | 89 | ⬜ |
| rituals | 49 | 97 | ⬜ |
| horizon (Goals) | 46 | 74 | ⬜ |
| portal | 44 | 73 | ⬜ (keep intended brand colour only) |
| onboarding | 28 | 49 | ⬜ |

Regenerate this table any time:

```bash
for d in components/*/; do n=$(basename $d); \
 s=$(grep -rohE "style=\{" $d*.tsx 2>/dev/null | wc -l); \
 l=$(grep -rohE "var\(--(paper|ink|line|red|amber|blue|accent|text-[a-z]|r-[a-z]|dur-|hover|nav-|shadow|ease)" $d*.tsx 2>/dev/null | wc -l); \
 printf "%-14s %5s %6s\n" "$n" "$s" "$l"; done | sort -k2 -rn
```

---

## 1. Mission & the Black & White thesis

The interface is **monochrome by default**. Hierarchy is built from **type, space, contrast, opacity, borders, elevation, and layered neutral surfaces** — never from decorative hue. A screen that needs colour to be legible has failed its layout.

Colour is a **semantic signal**, spent sparingly and only where it *means* something:

- **status / state** — success, warning, danger, info
- **priority** — the one product concept allowed a hue (see §5)
- **user content** — project dots, label colours, avatars, cover images

Everything else — chrome, nav, cards, menus, inputs, buttons — is ink on neutral. "Sophisticated, not plain": depth comes from a **calibrated grayscale ladder**, not from adding colours.

The four adjectives to test every screen against: **calm, minimal, premium, timeless.**

---

## 2. Operating model — the DS‑first loop

Every component, on every surface, passes through this loop. **Never build UI on a page that isn't first a DS decision.**

```
AUDIT → CONSOLIDATE → RESKIN → EXTEND → TOKENIZE → VERIFY
```

1. **Audit** — inspect the existing implementation for: consistency, usability, accessibility, spacing rhythm, hierarchy, and interaction quality. Note every hard‑coded value and every hand‑rolled control.
2. **Consolidate** — if two implementations overlap (e.g. two task rows, three "menu" popovers), collapse them to **one** reusable component. Duplication is a defect.
3. **Reskin** — express it in the B&W language, preserving behaviour exactly. No functional regressions.
4. **Extend** — add the missing variant / size / state the real usage needs, *in the DS*, before the feature consumes it.
5. **Tokenize** — every spacing, size, radius, elevation, opacity, motion, and colour value resolves to a token. Zero literals.
6. **Verify** — `tsc` clean, browser‑verified (console + a11y tree + screenshot), state matrix exercised.

Golden rule (from the Constitution): **extend the system, don't fork a one‑off.** If a needed component doesn't exist, create it in `components/ds/ui/`, export it from `index.ts`, showcase it in the DS portal (`/design`), *then* use it.

---

## 3. Token architecture

Four layers. Each owns exactly one job; never reach past a layer.

| Layer | File | Owns | Rule |
|---|---|---|---|
| 1 · Primitive + semantic colour | `app/tokens.generated.css` | raw hex + semantic colour vars (`--color-ink-*`, `--color-surface-*`, `--color-danger-*`) | **generated** — never hand‑edit colours here except through the tokens pipeline |
| 2 · App aliases | `app/tokens.css`, `app/globals.css` | legacy Paper‑OS aliases mapped onto layer 1 (`--paper-2 → surface`, `--berry-500 → ink-900`), view rhythm | compatibility only; do not add new work here |
| 3 · Utility registration | `app/ds-theme.css` | `@theme inline` → Tailwind utilities (`bg-surface-fill`, `text-ink-800`, `rounded-tag`), the DS type scale, motion, `@utility` helpers (`focus-ring`, `row-hover`, `surface-panel`) | register, don't redeclare colours |
| 4 · Components | `components/ds/ui/*` | consume **utilities only** | no raw hex / rgb / Tailwind palette / inline colour |

**The legacy→B&G map** (what you replace during a reskin):

| Legacy (Paper‑OS) | B&G utility |
|---|---|
| `var(--paper)` / `--paper-2` / `--paper-3` | `bg-background` · `bg-surface-raised` · `bg-surface-fill` / `-sunken` |
| `var(--ink)` / `--text-primary` | `text-ink-900` |
| `var(--ink-2)` / `--text-secondary` / `--text-muted` | `text-ink-800` / `text-ink-600` / `text-ink-500` |
| `var(--line)` / `--line-2` | `border-line-strong` / `border-line-soft` |
| `var(--hover)` / `--nav-active-bg` | `bg-surface-hover` / `bg-surface-selected` |
| `var(--accent)` / `--primary` (+ `--on-*`) | `bg-ink-900 text-onsolid` |
| `var(--red|amber|blue)` (chrome) | **remove** — neutral, or a §5 semantic token if it means something |
| `var(--text-*-size)` | the `text-*` type scale (§6) |
| `var(--r-*)` | `rounded-xs/sm/md/lg` · `rounded-tag` (5) · `rounded-panel` (12) |
| `var(--dur-*)` / `--ease` | `duration-fast/base` · `ease-standard/out-quiet` |

---

## 4. The neutral depth system ("sophisticated B&W")

Depth is engineered from three calibrated ladders + elevation. Learn them; they are the whole palette.

**Surface ladder** (back → front, each a distinct step of neutral):
`bg-background` (canvas) → `bg-surface-sunken` / `-well` (insets, wells) → `bg-surface-raised` / `surface-panel` (cards) → `bg-surface-fill` (12% white chips) → `bg-surface-hover` → `bg-surface-active` → `bg-surface-selected` (8% wash) → `bg-surface-disabled`.
*Law:* **one fill level per nesting.** Never stack two fills without a border between them. A card is a raised surface with a hairline — not a darker box on the canvas.

**Ink (text/icon) ladder:** `ink-900` titles · `ink-800` body/primary controls · `ink-600` secondary labels · `ink-500` meta/timestamps · `ink-400` faint/placeholder · `ink-300` disabled · `ink-200` rest strokes. **Never opacity‑faded text** — always a real ink step.

**Line ladder:** `line-soft` (8% — dividers, row separators) · `line-strong` (12% — inputs, chip strokes, popover rings) · `line-ink` (emphasis) · `line-onsolid` (seam on an ink‑solid fill).

**Elevation:** `shadow-lift-1` (raised control / composer) · `shadow-lift-2` (menus, dropdowns) · `shadow-panel` (framed card) · `shadow-popover` (overlays). Elevation is a **shadow + surface step together**, never a lift on its own.

Every state — hover, active, selected, focused, disabled, pressed — moves **one deliberate step** along these ladders. That is what makes B&W feel intentional instead of flat.

---

## 5. Colour as meaning — the only exceptions

Four semantic families, each `-500`/`-600` (foreground) + `-100` (soft wash) + `-300` (border):

- **success** — done, paid, healthy
- **warning** — attention, medium priority
- **danger** — destructive, overdue, blocked, high priority
- **info** — in progress, sent, neutral‑informational

Plus **user content** colour (project/label/avatar) passed as inline `style={{ background }}` — the sanctioned inline‑style escape hatch.

**Priority** is the canonical worked example, now a single DS component — `PriorityBadge` (`components/ds/ui/priority.tsx`):
- glyph = three ascending **signal‑strength bars**; bars fill up to the level.
- `low` → neutral `ink` · `med` → `warning` · `high` → `danger`.
- two variants: `bars` (dense inline rows) and `chip` (roomy rows / composer).
- This replaced three divergent one‑offs (a raw `--red/--amber` bar+label, a `FigmaTag priority` chip, a composer `PrioGlyph`) and **removed the decorative `low = blue`.**

The brand berry (`--color-berry-500`) is **remapped to `ink-900`** app‑wide; it only surfaces true colour in the client **portal**, deliberately.

---

## 6. The typography system

One family (Inter/Geist). A semantic scale — pick by **role**, never by pixel. Registered in `app/ds-theme.css` / `globals.css`.

| Token | px / line‑height | weight · tracking | Use for |
|---|---|---|---|
| `text-display` | 32 / 1.15 | 600 · ‑0.02em | marketing / auth hero only |
| `text-title-1` | 30 / 36 | 600 · ‑0.43px | page hero number |
| `text-title-2` | 24 / 32 | 600 | page/section titles (Home greeting) |
| `text-title-3` | 22 / 28 | 600 · ‑0.40px | card titles |
| `text-title-4` | 18 / 24 | 600 · ‑0.30px | sub‑section headings |
| `text-lead` | 16 / 26 | 400 | composer titles, lead paragraphs |
| `text-editor` | 16 / 24 | 400 · ‑0.23px | document body |
| `text-ui` | **14 / 20** | 400/500 · ‑0.15px | **default UI text**, rows, menu items, buttons |
| `text-body` | 14 / 1.43 | 400 | prose body |
| `text-meta` | 12 / 16 | 500 | chips, tags, dense meta |
| `text-caption` | 11 / 14 | 500 · 0.02em | counts, timestamps, secondary meta |
| `text-overline` | 11 / 14 | 600 · 0.06em, UPPERCASE | section labels only |

**Rhythm laws.** Default UI text is **`text-ui` (14px)**. Numbers in stats/tables/rows use **`tabular-nums`**. Section labels use **`text-overline`** (uppercase, sans) — never monospace, except invoice/ID strings (`INV‑001`). All copy is **sentence case**. Weight carries hierarchy in tandem with ink step: a selected row is `font-medium text-ink-900`, an idle one `font-normal text-ink-600` — the pair, not colour, signals state.

Glossary (one name per concept): **Doc / Documents · Finance · Lists · Shutdown · Keyboard shortcuts.**

---

## 7. The universal interaction‑state model

Every interactive DS component defines **eight** states, each a token move (§4) — no exceptions:

| State | Signal |
|---|---|
| Default | base surface + ink |
| Hover | +1 surface step (`surface-hover`), colours only, 100ms |
| Active / pressed | +1 more (`surface-active`); **no transform / scale / lift** |
| Selected | `surface-selected` wash + `ink-900` + `font-medium` (+ `aria-pressed`/`aria-selected`) |
| Focus‑visible | `focus-ring` utility (2px offset ring in `border-focus`) — never stripped |
| Disabled | `surface-disabled` + `ink-300`, transparent border, `pointer-events-none` |
| Loading | inert via `data-loading`, label held under `opacity-0` so width/name survive |
| Keyboard | identical to hover highlight (one shared highlight, per Radix) |

Motion band: **100–150ms, colours only**, `ease-standard` / `ease-out-quiet`. The one sanctioned flourish is the checkbox tick drawing itself (140ms). Everything else is calm. `motion-reduce` honoured everywhere.

Touch: hit target ≥ 44×44 via a coarse‑pointer `::after`, while the visual grid stays 28/32/36 (`--ctl-*`).

---

## 8. Component inventory & consolidation backlog

The DS (`components/ds/ui`, 60+ components) is grouped A–F: Primitives · Forms · Nav/Overlays · Feedback · Data/Display. It is broad; the work is **consolidation and adoption**, not net‑new.

**Consolidation backlog (duplicates / one‑offs to collapse):**

| # | Duplication | Target | Notes |
|---|---|---|---|
| C1 | Two task rows — shared `TaskRow` (compact) **and** `tasks-view.Row` (roomy) | one `TaskRow` with a `density="compact"|"comfortable"` prop | both now share DS primitives (Checkbox/PriorityBadge/Tag/DropdownMenu); merge spans Today+Projects+Tasks so it is a cross‑page task, not a page task. Projects pass (2026‑07‑18) consumed the compact `TaskRow` as‑is, so the merge is untangled from any page reskin — schedule as its own pass |
| C2 | Hand‑rolled `Menu`/`MenuRow` popovers repeated across pages | DS `DropdownMenu` | done in Tasks + Projects; recurs in money, documents |
| C3 | Legacy `@/components/ui/{primitives,panels,popover,select,zen}` shims (20+ importers) | DS `ds/ui` equivalents | retire the shim layer once all pages migrate (task #18) |
| C4 | Bespoke `Select` with `renderTrigger` chips | DS `Select` / `Combobox` / `DropdownMenu` | legacy `ui/select` is a self‑contained hand‑roll, not DS‑backed |
| C5 | Per‑page nav rows (rail items, sidebar items) restyled inline | a `NavItem` DS primitive | many private copies; extract once |
| C6 | Per‑page "stat tile", "section head", "badge" forks (esp. clients) | DS `Stat`, `text-overline`, `Badge`/`StatusBadge` | clients hand‑rolls all three |

**Rule for new components:** design → `components/ds/ui/x.tsx` → export in `index.ts` → add a `/design` portal entry → write/append the spec → only then consume.

---

## 9. Page‑by‑page audit ledger

**One surface at a time. Do not advance until the current one is fully aligned** (§10 DoD). Order = leverage (shared components first) × weight:

1. ✅ **Home / Today** — done (shared `TaskRow`, schedule, habits; `InlineConfirm` extracted)
2. ✅ **Tasks** — done this pass (`PriorityBadge` added; `TaskRow` + `tasks-view` + toggle fully DS; menus → DropdownMenu; segmented → SegmentedControl)
3. ✅ **Calendar** — done this pass (SegmentedControl views · DS DropdownMenu/Switch/IconButton/ButtonGroup · 6 injected `<style>` blocks removed · week/month grids keep computed geometry + event colour inline)
4. ✅ **Projects** — done this pass (zen `Btn/Badge/StatTile/SectionHead/Tabs/Toast` → DS `Button/Badge/Stat/PanelHeader/Tabs/toast+Toaster` · detail tabs → DS Tabs, layout toggle → SegmentedControl · `SwitchTrack`/hand-rolled panels → DS `Drawer`+`Switch` (share), `Drawer` savedStamp (doc editor), `Modal`+`Field`+`DatePicker` (project modal) · Overview circle-toggles → square DS Checkbox · one filled-primary per view (`New task`) · board/timeline keep computed geometry inline only). C1 deliberately NOT done here — projects consumes the already-DS compact `TaskRow`; the merge is now purely `tasks-view.Row` ⇄ `TaskRow` and stays a cross-page task (see §8 C1)
5. ⬜ **Clients** (103) — hand‑rolled Btn/StatTile/SectionHead/Badge forks → DS (C6)
6. ⬜ **Money** (126) — invoice detail; mono is legit only for `INV‑` IDs
7. ⬜ **Documents** (650) — heaviest; block editor, DB views, covers/icons; stage the reskin
8. ⬜ **Small pages** — Horizon (46), Focus (58), Inbox (58), Rituals (49), Week, Library
9. ⬜ **Settings** (3) — near‑done; finish + verify
10. ⬜ **Login + Onboarding** (28) — hero type is the one `text-display` home
11. ⬜ **Client portal** (44) — keep intended berry where the brand truly shows
12. ⬜ **Cross‑cutting: app shell** (183) + retire legacy `ui/` shim layer (C3)

---

## 10. Definition of Done

**Per component**
- [ ] Built from tokens only — no hex/rgb/palette/inline colour (except §5 user content)
- [ ] All 8 states (§7) present, each a token move
- [ ] `focus-ring` visible; keyboard operable; ARIA correct; `motion-reduce` honoured
- [ ] XS–XL sizes where relevant; 44px touch; responsive
- [ ] Exported from `index.ts`; shown in `/design`; spec updated
- [ ] No duplicate — extends, never forks

**Per page (report each)**
1. **Issues found** — hard‑codes, hand‑rolls, duplicates, hierarchy/spacing/a11y gaps
2. **Fixes applied** — what became DS + tokens
3. **DS updates** — components/variants/tokens added (with why)
- [ ] `style={` reduced to user‑colour **or** computed geometry only; `legacy‑var` = 0; injected `<style>` = 0
- [ ] `tsc` clean; browser‑verified (console clean + a11y tree + screenshot); interaction matrix exercised

---

## 11. Cadence & guardrails

- **DS before features. Components before pages. Consistency before creativity.**
- Prefer **reuse → extend → create**, in that order. A one‑off is a bug.
- When a page needs a pattern the DS lacks, the DS grows *first*.
- Keep the snapshot (§0) and ledger (§9) current — they are the source of truth for "how far are we."
- Every merged change must leave Zenboard **more** cohesive than before. Net‑new inconsistency is never an acceptable cost of shipping.
