# Button — component specification (B&G v2)

The foundation control for every interactive action in Zenboard. One family, one
interaction model, one motion band, applied across eleven variants and three
composite controls (Icon Button, Double Action Button, Button Group).

Everything here is **token-driven** — the implementations under
`components/ds/ui/` (`button.tsx`, `icon-button.tsx`, `button-group.tsx`) contain
**no hard-coded colors, sizes, radii, or durations**; every value resolves through
the token layer (`app/tokens.generated.css` → `app/tokens.css` → `app/ds-theme.css`
/ `app/globals.css`).

Base system: the **shadcn/ui pattern** — Radix `Slot` for composition + `cva`
variants + Tailwind utilities bound to CSS variables. Live reference:
**/design → Primitives → Button / IconButton / Double Action** (renders these exact
variants with real usage counts).

---

## 0 · Industry audit — what we take, what we reject

Reviewed against Apple HIG, Linear, Notion, Claude, shadcn/ui, and Kibo UI. The
family is deliberately the **intersection of Linear's restraint and Apple's
touch/a11y rigor**, expressed in Zenboard's monochrome (B&G) language.

| Source | Adopted | Rejected / adapted |
|---|---|---|
| **Apple HIG** | 44×44 min touch target; roles map to intent; never rely on color alone | Fully-rounded "capsule" fills — we use the 4–8px radius grid |
| **Linear** | One primary per view; background-only hover; fast, flat, no lift; keyboard-first | — |
| **Notion** | Split ("Double Action") button; quiet/ghost inline actions; sentence case | Colored solid buttons — we stay monochrome |
| **Claude** | Calm, low-chroma surfaces; generous focus affordance | — |
| **shadcn/ui** | cva + Slot + `asChild`; `variant`/`size` API; destructive variant | Their `outline`/`secondary` default hues — remapped to our tokens |
| **Kibo UI** | Reserved for composite data controls (kanban/gantt/tree); not a button source | — |

**Monochrome rule (non-negotiable):** buttons are grayscale. The **only** chromatic
variant is `danger` (semantic red). Berry/accent never appears on a button.

---

## 1 · Design tokens consumed

| Role | Token (utility) | Resolves to |
|---|---|---|
| Primary fill | `bg-ink-900` | `--color-ink-900` `#F2F1EB` |
| Primary label | `text-onsolid` | `--color-text-onsolid` `#121212` |
| Primary hover | `bg-ink-700` | `--color-ink-700` |
| Secondary fill / hover | `bg-surface-fill` / `-hover` | white 12% / 16% |
| Outline border | `border-line-strong` | `--color-border-strong` (ink 12%) |
| Ghost / quiet hover | `bg-surface-hover` / `-active` | white 6% / 9% |
| Tinted / selected wash | `bg-surface-selected` | white 8% |
| Split seam (on ink fill) | `border-line-onsolid` | `--color-border-onsolid` (onsolid 16%) |
| Danger fill | `bg-danger-500` (+600 / +700) | semantic red — the only color |
| Danger wash | `bg-danger-100` | dark red wash |
| Disabled | `bg-surface-disabled` + `text-ink-300` | white 6% + `#5C5C5C` |
| Focus ring | `.focus-ring` utility | `--color-border-focus` (ink 40%) — grayscale |
| Radius | `rounded-xs / sm / md` | 4 / 6 / 8px (`--radius-*`) |
| Motion | `duration-fast ease-standard` | 100ms, colors only (`--duration-fast`) |
| Type | `text-meta / text-ui / text-body-lg` | 12 / 14 / 15px scale |

No raw hex, `rgb()`, px, or ms appears in any button component — if a value is
needed that isn't a token, the token is added first (that is how
`--color-border-onsolid` was introduced for the Double Action seam).

---

## 2 · Variant catalog

Eleven variants, one shared interaction model (§4). `default` / `hover` /
`active` columns are the **background** (and, for outline/link, the border/label);
every variant additionally inherits the shared focus / disabled / loading / touch
behavior from §4 — those are **not** re-specified per row.

| Variant | Default | Hover | Active | Label | Use · per view |
|---|---|---|---|---|---|
| `primary` | `ink-900` fill | `ink-700` | `ink-900` | `onsolid` | THE one main action · **max 1** |
| `secondary` *(default)* | `surface-fill` (12%) | `surface-fill-hover` (16%) | `surface-fill` | `ink-800→900` | Standard actions · any |
| `outline` | transparent + `line-strong` border | `surface-hover` wash | `surface-active` | `ink-800→900` | Actions on an already-filled surface · any |
| `ghost` | transparent | `surface-hover` | `surface-active` | `ink-600→900` | Toolbar / inline actions · any |
| `quiet` | transparent | `surface-hover` | `surface-active` | `ink-500` | Tertiary / meta ("Details") · any |
| `tinted` | `surface-selected` (8%) | `surface-fill` | `surface-fill` | `ink-900` | Pressed / selected-looking · sparing |
| `link` | none (inline text) | `ink-900` | `ink-900` | `ink-800` underline | Actions inside a sentence · any |
| `danger` | `danger-500` | `danger-600` | `danger-700` | `onsolid` | Confirm-dialog destructive CTA · **max 1** |
| `dangerGhost` | transparent | `danger-100` wash | `danger-100` | `danger-600` | Default destructive (menus, rows) · any |
| `neutral` | ≡ `primary` | ≡ `primary` | ≡ `primary` | — | **Legacy alias — do not use in new code** |

`iconOnly`, `fullWidth`, `toggle` are **modifiers**, not variants (§7).

### Variant notes

- **Outline** is the *one* documented exception to "buttons carry no borders." Use
  it only where a fill would read as a nested tile (e.g. a button sitting on an
  already-filled card). Otherwise prefer `secondary`.
- **Destructive** is expressed by two variants: solid `danger` (confirm dialogs
  only, max one) and `dangerGhost` (the default for destructive rows/menu items).
  Never put solid `danger` in a list.
- **Link** is the only variant that is inline text: no box, no height/padding, no
  hit-area pseudo-element (§4.7). Use inside running copy only.

---

## 3 · Size scale — the 24/28/32/36/40 control grid

Anchored to the app's control grid (`--ctl-sm/md/lg` = 28/32/36). `md` aligns
exactly with input height. Off-grid heights (30, 34…) are forbidden.

| Size | Height | Radius | Pad-x | Type | Icon | Icon gap | Use |
|---|---|---|---|---|---|---|---|
| `xs` | 24 | 4 (`xs`) | 8 | 12px (`meta`) | 14 | 4 | Dense inline / editor toolbars (below grid) |
| `sm` | 28 | 6 (`sm`) | 10 | 14px (`ui`) | 16 | 4 | Card CTAs — the Figma home buttons |
| `md` *(default)* | 32 | 8 (`md`) | 12 | 14px (`ui`) | 16 | 6 | Standard — aligns with inputs |
| `lg` | 36 | 8 (`md`) | 16 | 14px (`ui`) | 16 | 8 | Prominent / page-level |
| `xl` | 40 | 8 (`md`) | 20 | 15px (`body-lg`) | 16 | 8 | Hero / auth CTAs only |

- **Minimum touch target (WCAG 2.5.5 / Apple HIG):** every non-`link` button
  guarantees **≥44px** on coarse pointers via a zero-ink `::after` (§4.7) — the
  *visual* height stays on the 24–40 grid, so the grid is never broken to satisfy
  touch. `IconButton` extends this to a full 44×44.
- **Icon size** is 16px everywhere except `xs` (14px). Glyphs come from the icon
  seam (`components/ds/icons`), strokeWidth 1.75.
- **Cursor:** `pointer` when enabled; `progress` while loading; `not-allowed` is
  **not** used (disabled is `pointer-events-none`).
- **Elevation:** none, at any size. Buttons never lift or cast a shadow — fills and
  borders carry hierarchy (§4.2). "Elevation if applicable" → **not applicable, by
  design.**

---

## 4 · The shared interaction model (all variants)

Eight states, defined **once** so the whole family behaves identically. Per-variant
fills for 1–3 live in §2; everything below is universal.

1. **Default** — the variant's resting fill/label (§2).
2. **Hover** — background shifts exactly **one step**; `transition-colors`
   `duration-fast` (100ms) `ease-standard`. Never scale, lift, or shadow.
3. **Active / pressed** — the variant's `active:` fill. No transforms.
4. **Focus-visible / keyboard focus** — `.focus-ring`: a 2px **grayscale** ring
   (`--color-border-focus`, ink 40%) offset from the surface. Keyboard-only
   (`:focus-visible`); **never** stripped. Mouse press does not show it.
5. **Disabled** — `disabled` attr → `surface-disabled` (6%) fill + `ink-300` label,
   **transparent border** (so it can't be mistaken for a broken enabled control),
   `pointer-events-none`. Not announced as loading.
6. **Loading** — `loading` prop → a centered spinner overlays the label; the label
   **stays in the DOM** at `opacity-0` so **width never shifts** and the accessible
   name survives; `aria-busy` + `data-loading`; pointer + `onClick` suppressed
   (double-submit guard). The button is *not* `disabled`, so fill/name persist for
   assistive tech.
7. **Touch (hit target)** — on `@media(pointer:coarse)`, a `::after` extends the
   clickable area to **≥44px tall** at the drawn width — **vertical only**, so
   horizontally adjacent members (Button Group / Double Action) never overlap.
   `link` opts out; `IconButton` recenters it to 44×44.
8. **Selected / toggled** *(where applicable)* — opt-in via the `toggle` modifier
   (`aria-[pressed=true]`) on Button, or the `selected` prop on IconButton →
   `surface-selected` wash + full ink. Never auto-baked into a variant (a toggled
   primary must never flip to unreadable contrast).

WCAG AA is met at every state: monochrome fills clear 4.5:1 for labels / 3:1 for
the outline border and focus ring; state is **never** signaled by color alone
(fill *and* label shift together); focus is always visible.

---

## 5 · Icon Button (`IconButton`)

An icon-only Button with three enforced laws (`icon-button.tsx`):

- **Always an `aria-label`** — passed as `label`, doubles as the tooltip text so
  the two can never drift.
- **Always a tooltip** — identical to `label` (or a richer string that still leads
  with it, e.g. `"Close · Esc"`).
- **Hit-area ≥ visual** — 44×44 on coarse pointers via the recentered `::after`.

Defaults to `variant="ghost"`, `size="md"`. `selected` gives the monochrome toggled
wash + `aria-pressed`. Prefer `IconButton` over `<Button iconOnly>` — the latter
does not enforce the label/tooltip and only gets the vertical touch reach.

```tsx
<IconButton label="Add task" icon={<Icon icon={Plus} size={16} />} />
<IconButton label="Filter" icon={<Icon icon={Filter} size={16} />} selected />
```

---

## 6 · Double Action Button (`SplitButton` / `DoubleActionButton`)

An existing product pattern, now first-class: **one primary action + a disclosure
half** that opens related options, sharing a single fill. (Notion "New ▾", Attio
"Create ▾".)

### 6.1 Anatomy
```
┌───────────────────────┬─────┐
│  [icon] Primary label │  ▾  │   two real <button>s, one shared fill
└───────────────────────┴─────┘
   action half              menu half (disclosure)
                     ^ seam = border-line-* per variant (§1)
```
Three parts: **action half** (the main button — icon + label), the **seam**
(a 1px divider, tokenized per variant), and the **menu half** (icon-only chevron).

### 6.2 Layout & spacing
- Both halves share `variant` + `size`; heights come straight from the §3 grid.
- Outer corners keep the size's radius; the **inner corners are squared**
  (`rounded-e-none` / `rounded-s-none`) so the seam reads as one control.
- Menu half is `w-7` (28px) — wide enough to tap, tight enough to read as a
  disclosure, not a second primary action.
- Seam is `border-s` colored by `SPLIT_DIVIDER[variant]`: `line-onsolid` on the ink
  primary fill, `line-strong`/`line-soft` on fills/ghosts, `danger-700` on danger.

### 6.3 Actions
- **Action half** = the single most likely action (verb-first label).
- **Menu half** = *alternatives to that action*, never unrelated commands. If the
  options aren't variations on the primary, use a plain Button + Dropdown instead.

### 6.4 Icon placement
- Leading `icon` on the action half only. The menu half is always a trailing
  `ChevronDown` (16/14px) — no other glyph, no label.

### 6.5 States
Each half is an independent Button, so all of §4 applies per half: separate hover,
active, focus ring, and touch target. Disabling the control disables **both**
halves. The menu half carries `aria-haspopup="menu"` and `aria-expanded`
(driven by `menuExpanded`).

### 6.6 Accessibility
- Wrapper is `role="group"`; each half is a labeled `<button>` with its own focus
  ring, tabbable in order (action → menu).
- Menu half: `aria-haspopup="menu"` + `aria-expanded={menuExpanded}` +
  `aria-label={menuLabel}` (e.g. "More new-task options").
- Keyboard: `Tab` reaches both halves; `Enter`/`Space` fire each; the disclosed
  menu follows standard menu semantics.

### 6.7 Responsive behavior
- Desktop: full split control.
- Narrow / touch-primary: prefer collapsing to a single Button whose tap opens the
  full menu (the 28px menu half is a desktop affordance). The vertical touch reach
  keeps both halves tappable when the split is retained.

### 6.8 API
```tsx
interface SplitButtonProps extends Omit<ButtonProps, "iconOnly"> {
  menuLabel: string;        // required — accessible name for the chevron half
  onMenuOpen?: () => void;  // chevron click
  menuExpanded?: boolean;   // drives aria-expanded
  menuProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}
// exports: SplitButton · DoubleActionButton (alias) · SplitButtonProps
```
```tsx
<DoubleActionButton variant="primary" icon={<Icon icon={Plus} size={16} />}
  menuLabel="More new-item options" menuExpanded={open} onMenuOpen={() => setOpen(true)}>
  New task
</DoubleActionButton>
```

### 6.9 Usage
Use for a dominant action with close variants (New task ▾ Note/Doc; Save ▾ Save &
close). One Double Action per view at most, and never as the destructive control.

---

## 7 · Component API (Button)

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof button> {          // variant · size · fullWidth · iconOnly · toggle
  asChild?: boolean;    // render into child (e.g. <Link>) via Radix Slot
  loading?: boolean;    // spinner overlay, inert, width-stable
  icon?: React.ReactNode;      // leading 16px glyph
  iconRight?: React.ReactNode; // trailing 16px glyph
}
// exports: Button (component) · button (cva, for style reuse) · ButtonProps
```

- `variant` default `secondary`, `size` default `md`.
- `asChild` renders into the child (e.g. `<Link>`) — the child must be focusable.
- `toggle` opts into pressed styling; pair with `aria-pressed`.
- `iconOnly` requires an `aria-label` (or use `IconButton`).

---

## 8 · Styling rules

- **Never restyle per call site** — extend the cva variants here instead of passing
  `style=` or ad-hoc classes.
- **One `primary` per view**, no exceptions (self-check before shipping a screen).
- Hover / press change **background only**; motion stays at 100ms `ease-standard`.
- **Borders:** buttons carry no borders **except `outline`** (§2). Fills and the
  single outline hairline define hierarchy — never a shadow.
- **Sentence case**, verb-first labels ("Start focus", not "Start Focus").
- Every value is a token; add a token before you reach for a literal.

---

## 9 · Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Default to `secondary` | Invent a new fill inline with `style=` |
| Use `outline` only on filled surfaces | Sprinkle `outline` everywhere as a "nicer" secondary |
| Use `dangerGhost` for destructive rows | Use solid `danger` outside confirm dialogs |
| Use `loading` for async submits | Swap the label for a spinner (width jump) |
| Use `asChild` for navigations | Nest a `<button>` inside a `<Link>` |
| Use `IconButton` (label + tooltip) | Ship an unlabeled `<Button iconOnly>` |
| Use `DoubleActionButton` for a primary + its variants | Put unrelated commands in the menu half |
| Pick sizes from the grid | Add off-grid heights (30, 34…) |
| Keep chrome monochrome | Put berry (or any hue) on a button |
| Let touch reach 44px via the `::after` | Bump visual height to 44 and break the grid |

## 10 · Self-check before shipping any screen with buttons
- [ ] ≤1 filled `primary` (and ≤1 solid `danger`) visible
- [ ] All buttons monochrome except semantic `danger`
- [ ] Every icon-only control is an `IconButton` (label + tooltip) or has `aria-label`
- [ ] Focus ring present and grayscale on every button; never stripped
- [ ] Sizes on the 24/28/32/36/40 grid; touch ≥44px via `::after`, not off-grid height
- [ ] No `style=`/inline color; every value a token
- [ ] `neutral` not used in new code
