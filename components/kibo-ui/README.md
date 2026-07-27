# Kibo UI — vendored, not yet adopted

Advanced composite components pulled from the [Kibo UI](https://www.kibo-ui.com)
shadcn registry (configured in `components.json` as the `@kibo-ui` namespace).
These are the "document and other components" set: the rich-text **editor** plus
the data components **kanban / gantt / tree / table / list**.

```bash
# add more later — registry is wired, so:
npx shadcn@latest add @kibo-ui/<name>       # e.g. @kibo-ui/calendar
```

## Status: installed, parked

The six components live here as third-party source. They are **excluded from
`tsc`** (`tsconfig.json` → `exclude`) because they are **not imported anywhere
yet** and they expect *vanilla* shadcn primitive APIs, which differ from our
curated **B&G** primitives in `components/ds/ui`. Nothing here is wired into the
app; adopting a component means writing the small adapter below, then removing it
from the tsconfig exclude so it typechecks for real.

**The curated DS was preserved** — during install every existing file
(`button`, `dropdown-menu`, `popover`, `tooltip`, `table`, `card`, `scroll-area`)
was **skipped, not overwritten**. Only genuinely new primitives were added to
`components/ds/ui`: `command.tsx`, `separator.tsx`, `dialog.tsx` (vanilla shadcn,
**not yet B&G-themed** — restyle or leave as-is until used).

## Adoption gaps per component (what `tsc` surfaced)

| Component | Expects (vanilla shadcn) | We have (B&G) | Adapter |
|---|---|---|---|
| `editor` | `Tooltip` + `TooltipTrigger` + `TooltipContent` compound | `Tooltip` with a `content` prop | Add compound Radix exports to `ds/ui/tooltip.tsx`, **or** rewrite the editor's tooltip usage to the `content` prop |
| `editor` | `<Button size="icon">` | sizes `xs–xl` + `iconOnly` modifier | Map `size="icon"` → `iconOnly size="md"` (or use `IconButton`) |
| `editor` | tiptap suggestion `command({ signal })` | tiptap v3.28 requires `signal` | Patch the editor's suggestion `command` to accept/pass `signal` (Kibo-vs-tiptap version drift) |
| `kanban` | `ScrollBar` from `scroll-area` | `ScrollArea` only | Add a `ScrollBar` export (Radix `ScrollAreaScrollbar`) to `ds/ui/scroll-area.tsx` |
| `table` | `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` | different table abstraction | Export the raw table primitives from `ds/ui/table.tsx`, or point Kibo's table at a vanilla `table` |
| `gantt`, `tree`, `list` | dnd-kit + their own primitives | — | Compile clean on their own; just theme to B&G tokens on adoption |

## Recommended long-term shape

Keep Kibo **isolated from the curated DS**: when adopting one, give it a thin
local adapter (e.g. `components/kibo-ui/ui/*`) that re-exports the vanilla
primitives it needs, so a Kibo upgrade can never pull our B&G primitives toward
shadcn defaults. Then theme the Kibo component with our tokens (it already uses
CSS-variable classes, so most of it inherits B&G for free).
