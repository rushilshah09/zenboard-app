'use client';
// DS portal — the living design-system reference for Zenboard's B&G language.
// Layout (B&G Figma panel grammar): an inner side rail (component list, grouped)
// beside a preview column. Selecting a component shows its live variants plus a
// "Used in" list sourced from usage.generated.ts (real import scan), so the
// portal always reflects what the app actually ships.
import { useMemo, useState } from 'react';
import {
  Plus, Check, Trash, Search, Settings, ChevronDown, Star, Folder,
} from '@/components/ds/icons';
import {
  Button, IconButton, DoubleActionButton, InlineConfirm, Badge, Tag, PriorityBadge, Tooltip, TooltipProvider, Divider,
  Icon, Mark, Logo, Kbd, Avatar,
  Select, Checkbox, Switch, TextInput, Textarea, Field, Tabs, SegmentedControl,
  Popover, PopoverTrigger, PopoverContent,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Skeleton, Breadcrumbs,
} from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody, FigmaTag } from '@/components/ui/panels';
import { DS_USAGE } from './usage.generated';

/* ── Registry ────────────────────────────────────────────────────────────── */

type Entry = {
  name: string;
  /** usage.generated.ts keys folded into this entry (compound components). */
  keys: string[];
  desc: string;
  render: () => React.ReactNode;
};
type Group = { label: string; items: Entry[] };

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="flex w-[120px] flex-col gap-1.5">
      <div className="h-12 rounded-md border border-line" style={{ background: `var(${token})` }} />
      <div className="text-[12px]" style={{ color: 'var(--color-ink-600)' }}>{label}</div>
      <code className="text-[11px]" style={{ color: 'var(--color-ink-400)' }}>{token}</code>
    </div>
  );
}

function StatefulDemos() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Checkbox label="Checkbox" checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
      <Switch label="Switch" checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function TabsDemo() {
  const [tab, setTab] = useState('one');
  return (
    <Tabs
      items={[{ value: 'one', label: 'Overview' }, { value: 'two', label: 'Activity' }, { value: 'three', label: 'Settings' }]}
      value={tab}
      onValueChange={setTab}
    />
  );
}

function SegmentedDemo() {
  const [v, setV] = useState('list');
  return (
    <SegmentedControl
      aria-label="View"
      options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }, { value: 'calendar', label: 'Calendar' }]}
      value={v}
      onValueChange={setV}
    />
  );
}

function SelectDemo() {
  const [sel, setSel] = useState('med');
  return (
    <div className="w-[200px]">
      <Select
        aria-label="Priority"
        value={sel}
        onValueChange={setSel}
        groups={[{ options: [
          { value: 'low', label: 'Low' },
          { value: 'med', label: 'Medium' },
          { value: 'high', label: 'High' },
        ] }]}
      />
    </div>
  );
}

const GROUPS: Group[] = [
  {
    label: 'Foundations',
    items: [
      {
        name: 'Color tokens', keys: [], desc: 'B&G surfaces and ink — black canvas, #121212 panels, white-alpha fills. Color is reserved for status and priority.',
        render: () => (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-3">
              <Swatch token="--color-canvas" label="Canvas" />
              <Swatch token="--color-paper" label="Panel" />
              <Swatch token="--color-paper-2" label="Sunken" />
              <Swatch token="--color-paper-4" label="Card" />
              <Swatch token="--color-surface-fill" label="Fill 12%" />
              <Swatch token="--color-surface-selected" label="Selected 8%" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Swatch token="--color-ink-900" label="Ink 900" />
              <Swatch token="--color-ink-600" label="Ink 600" />
              <Swatch token="--color-ink-500" label="Ink 500" />
              <Swatch token="--color-ink-300" label="Ink 300" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Swatch token="--color-success-500" label="Success" />
              <Swatch token="--color-warning-500" label="Warning" />
              <Swatch token="--color-danger-500" label="Danger" />
              <Swatch token="--color-info-500" label="Info" />
              <Swatch token="--color-berry-500" label="Berry (brand)" />
            </div>
          </div>
        ),
      },
      {
        name: 'Typography', keys: [], desc: 'One family (Geist). Scale 11–24, 13–14px default UI text, tabular numerals for stats.',
        render: () => (
          <div className="flex flex-col gap-2">
            <span className="text-[24px] font-medium leading-none" style={{ color: 'var(--color-ink-900)' }}>Title 24 · Medium</span>
            <span className="text-[16px] leading-5" style={{ color: 'var(--color-ink-800)' }}>Subheading 16 · Regular</span>
            <span className="text-[14px] leading-5" style={{ color: 'var(--color-ink-800)' }}>Body 14 · the default UI size</span>
            <span className="text-[12px]" style={{ color: 'var(--color-ink-600)' }}>Label 12 · secondary</span>
            <span className="text-[11px] uppercase tracking-[0.04em]" style={{ color: 'var(--color-ink-500)' }}>Section label 11</span>
            <span className="text-[14px] tabular-nums" style={{ color: 'var(--color-ink-800)' }}>0123456789 · tabular-nums</span>
          </div>
        ),
      },
      {
        name: 'Brand', keys: ['Mark', 'Logo'], desc: 'Mark + wordmark render in ink (B&G). Berry survives only as the notification dot.',
        render: () => (
          <div className="flex items-center gap-6">
            <Mark size={24} />
            <Logo height={22} />
            <span className="relative inline-flex">
              <Icon icon={Star} size={18} />
              <span className="absolute -top-1 -right-1 size-2.5 rounded-full border" style={{ background: 'var(--color-berry-500)', borderColor: 'var(--paper)' }} />
            </span>
          </div>
        ),
      },
    ],
  },
  {
    label: 'Primitives',
    items: [
      {
        name: 'Button', keys: ['Button'], desc: 'The foundation control — 11 variants, one interaction model. Primary = ink solid (one per view); secondary = 12% fill (default); outline is the one bordered variant; danger is the only color. Sizes on the 24/28/32/36/40 grid; touch ≥44px. Full spec: components/design-system/button-spec.md.',
        render: () => (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {(['primary', 'secondary', 'outline', 'ghost', 'quiet', 'tinted', 'danger', 'dangerGhost', 'link'] as const).map((v) => (
                <Button key={v} variant={v}>{v}</Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => <Button key={s} size={s} variant="secondary">{s}</Button>)}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" icon={<Plus className="size-4" />}>Leading icon</Button>
              <Button variant="secondary" iconRight={<ChevronDown className="size-4" />}>Trailing icon</Button>
              <Button variant="secondary" iconOnly aria-label="Add"><Plus className="size-4" /></Button>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="secondary" toggle aria-pressed>Toggled</Button>
              <Button variant="secondary" disabled>Disabled</Button>
            </div>
          </div>
        ),
      },
      {
        name: 'IconButton', keys: ['IconButton'], desc: 'Icon-only control — always carries a label (tooltip + aria) and a ≥44×44 touch target. selected = monochrome toggled wash + aria-pressed. Full spec: button-spec.md §5.',
        render: () => (
          <div className="flex items-center gap-3">
            <IconButton label="Search" icon={<Search className="size-4" />} />
            <IconButton label="Add" icon={<Plus className="size-4" />} variant="secondary" />
            <IconButton label="Filter" icon={<Folder className="size-4" />} selected />
            <IconButton label="Delete" icon={<Trash className="size-4" />} variant="dangerGhost" />
            <IconButton label="Add" icon={<Plus className="size-4" />} disabled />
          </div>
        ),
      },
      {
        name: 'Double Action', keys: ['SplitButton', 'DoubleActionButton'], desc: 'One primary action + a disclosure half sharing a fill (Notion "New ▾"). One per view; the menu holds variants of the primary, never unrelated commands. Full spec: button-spec.md §6.',
        render: () => (
          <div className="flex flex-wrap items-center gap-3">
            <DoubleActionButton variant="primary" icon={<Plus className="size-4" />} menuLabel="More new-item options">New task</DoubleActionButton>
            <DoubleActionButton variant="secondary" menuLabel="More save options">Save</DoubleActionButton>
            <DoubleActionButton variant="outline" menuLabel="More export options">Export</DoubleActionButton>
            <DoubleActionButton variant="primary" size="sm" icon={<Plus className="size-4" />} menuLabel="More new-item options">New</DoubleActionButton>
          </div>
        ),
      },
      {
        name: 'Inline confirm', keys: ['InlineConfirm'], desc: 'Row-level destructive confirm — swaps a row’s actions for “Delete? [Delete] [Keep]” in place. Confirm is dangerGhost (solid danger stays in dialogs); both xs so 36px rows never stretch.',
        render: () => (
          <div className="flex items-center gap-6">
            <InlineConfirm onConfirm={() => {}} onCancel={() => {}} />
            <InlineConfirm question="Remove link?" confirmLabel="Remove" cancelLabel="Cancel" onConfirm={() => {}} onCancel={() => {}} />
          </div>
        ),
      },
      {
        name: 'Badge', keys: ['Badge'], desc: 'Status is the only colored element: success, warning, danger, info. Counts stay neutral.',
        render: () => (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="status" status="success">Done</Badge>
            <Badge variant="status" status="warning">Due soon</Badge>
            <Badge variant="status" status="danger">Overdue</Badge>
            <Badge variant="status" status="info">In progress</Badge>
            <Badge variant="count" count={7} />
          </div>
        ),
      },
      {
        name: 'Tag', keys: ['Tag', 'FigmaTag', 'Pill'], desc: 'White-12% fill chips. User/label colour is allowed; chrome stays neutral.',
        render: () => (
          <div className="flex flex-wrap items-center gap-3">
            <Tag>Design</Tag>
            <Tag color="stone" size="sm" icon={<Icon icon={Star} size={12} />}>Starred</Tag>
            <FigmaTag icon={<Icon icon={Folder} size={12} weight="fill" style={{ color: 'var(--yellow-dot)' }} />}>TechSpark</FigmaTag>
          </div>
        ),
      },
      {
        name: 'PriorityBadge', keys: ['PriorityBadge', 'PriorityBars', 'priority', 'signal'], desc: 'The one priority representation app-wide. Semantic signal-bars: low = neutral ink, med = warning, high = danger. Colour carries meaning; nothing else does.',
        render: () => (
          <div className="flex flex-wrap items-center gap-4">
            <PriorityBadge level="high" variant="chip" />
            <PriorityBadge level="med" variant="chip" />
            <PriorityBadge level="low" variant="chip" />
            <span className="h-4 w-px bg-line-soft" />
            <PriorityBadge level="high" variant="bars" />
            <PriorityBadge level="med" variant="bars" />
            <PriorityBadge level="low" variant="bars" />
          </div>
        ),
      },
      {
        name: 'Avatar', keys: ['Avatar'], desc: 'Neutral fills, rounded square. Letters over ink washes — never colored.',
        render: () => (
          <div className="flex items-center gap-3">
            <Avatar name="Rushil Shah" size="sm" />
            <Avatar name="Rushil Shah" />
            <Avatar name="Darshil" size="lg" />
          </div>
        ),
      },
      {
        name: 'Kbd · Divider', keys: ['Kbd', 'Divider'], desc: 'Keyboard hints in mono; hairline dividers define hierarchy instead of shadows.',
        render: () => (
          <div className="flex w-full max-w-[320px] flex-col gap-4">
            <div className="flex items-center gap-2">
              <Kbd keys={['meta', 'K']} />
              <span className="text-[12px]" style={{ color: 'var(--color-ink-500)' }}>Command palette</span>
            </div>
            <Divider />
          </div>
        ),
      },
      {
        name: 'Icon', keys: ['Icon'], desc: 'One icon seam (components/ds/icons) — 16px in rows and buttons, 18–20px in headers.',
        render: () => (
          <div className="flex items-center gap-4">
            <Icon icon={Search} size={16} />
            <Icon icon={Settings} size={18} />
            <Icon icon={Check} size={20} weight="bold" />
            <Icon icon={Trash} size={24} strokeWidth={1.25} />
          </div>
        ),
      },
    ],
  },
  {
    label: 'Forms',
    items: [
      {
        name: 'Input', keys: ['TextInput', 'Input', 'Field'], desc: 'Fields wrap label + control + hint. Focus is a grayscale ring.',
        render: () => (
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-[220px]"><Field label="Email"><TextInput placeholder="you@studio.com" /></Field></div>
            <div className="w-[220px]"><Field label="Disabled"><TextInput placeholder="Read only" disabled /></Field></div>
          </div>
        ),
      },
      {
        name: 'Textarea', keys: ['Textarea'], desc: 'Multiline input — same field grammar.',
        render: () => (
          <div className="w-[320px]"><Field label="Notes"><Textarea placeholder="Write something…" rows={3} /></Field></div>
        ),
      },
      { name: 'Select', keys: ['Select'], desc: 'Radix select styled to the B&G popover spec.', render: () => <SelectDemo /> },
      { name: 'Checkbox · Switch', keys: ['Checkbox', 'Switch', 'Toggle', 'SwitchTrack'], desc: 'Square checkboxes (tasks are never radio circles). Toggles are monochrome — ink track when on.', render: () => <StatefulDemos /> },
    ],
  },
  {
    label: 'Navigation',
    items: [
      { name: 'Tabs', keys: ['Tabs'], desc: 'Underline tabs for detail views.', render: () => <TabsDemo /> },
      { name: 'Segmented', keys: ['SegmentedControl', 'Segmented'], desc: 'All view toggles (List/Board/Calendar…) use the segmented control.', render: () => <SegmentedDemo /> },
      {
        name: 'Breadcrumbs', keys: ['Breadcrumbs'], desc: 'Quiet path trail in panel headers.',
        render: () => <Breadcrumbs items={[{ label: 'Projects', href: '#' }, { label: 'TechSpark', href: '#' }, { label: 'Invoice' }]} />,
      },
    ],
  },
  {
    label: 'Overlays',
    items: [
      {
        name: 'Popover', keys: ['Popover', 'PopoverTrigger', 'PopoverContent'], desc: '#1E1E1E surface, hairline ring, #262626 header strip, 12px radius.',
        render: () => (
          <Popover>
            <PopoverTrigger asChild><Button variant="secondary" iconRight={<ChevronDown className="size-4" />}>Open popover</Button></PopoverTrigger>
            <PopoverContent>
              <div className="flex min-w-[180px] flex-col gap-1.5 p-3">
                <div className="text-[14px] font-medium" style={{ color: 'var(--color-ink-800)' }}>Popover content</div>
                <div className="text-[12px]" style={{ color: 'var(--color-ink-500)' }}>Portalled + focus-managed by Radix.</div>
              </div>
            </PopoverContent>
          </Popover>
        ),
      },
      {
        name: 'Dropdown menu', keys: ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuSeparator'], desc: '32px items, 8px inset, destructive rows in danger ink.',
        render: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="secondary" icon={<Settings className="size-4" />}>Open menu</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem><Check className="size-4" /> Mark done</DropdownMenuItem>
              <DropdownMenuItem><Plus className="size-4" /> Add item</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><Trash className="size-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
      {
        name: 'Tooltip', keys: ['Tooltip', 'TooltipProvider'], desc: 'Inverted #303030 surface. Every icon-only control gets one.',
        render: () => (
          <Tooltip content="I'm a tooltip · Esc">
            <Button variant="ghost">Hover me</Button>
          </Tooltip>
        ),
      },
    ],
  },
  {
    label: 'Layout',
    items: [
      {
        name: 'Panel', keys: ['Panel', 'PanelHeader', 'PanelBody'], desc: 'The B&G card: #1E1E1E shell + quiet 14px header band + #303030 inner card with its own 12px radius.',
        render: () => (
          <div className="w-full max-w-[520px]">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={Star} size={18} />} title="Panel title" count={3} />
              <PanelBody>
                <div className="p-4 text-[14px] leading-5" style={{ color: 'var(--color-ink-800)' }}>
                  Inner card body — surfaces separate by contrast, not borders.
                </div>
              </PanelBody>
            </Panel>
          </div>
        ),
      },
      {
        name: 'Skeleton', keys: ['Skeleton'], desc: 'Loading placeholders — quiet ink washes, no shimmer color.',
        render: () => (
          <div className="flex w-[280px] flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        ),
      },
    ],
  },
];

/* ── Portal ──────────────────────────────────────────────────────────────── */

export function DsPortal() {
  const flat = useMemo(() => GROUPS.flatMap((g) => g.items), []);
  const [selected, setSelected] = useState(flat[0].name);
  const entry = flat.find((e) => e.name === selected) ?? flat[0];
  const usedIn = useMemo(() => {
    const files = new Set<string>();
    entry.keys.forEach((k) => (DS_USAGE[k] ?? []).forEach((f) => files.add(f)));
    return [...files].sort();
  }, [entry]);

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0">
        {/* Side rail — the component list */}
        <nav aria-label="Components" className="flex w-[230px] shrink-0 flex-col gap-4 overflow-y-auto border-r p-3" style={{ borderColor: 'var(--color-border-soft)' }}>
          {GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--color-ink-500)' }}>{g.label}</div>
              {g.items.map((e) => {
                const active = e.name === selected;
                const count = e.keys.reduce((n, k) => n + (DS_USAGE[k]?.length ?? 0), 0);
                return (
                  <button
                    key={e.name}
                    onClick={() => setSelected(e.name)}
                    className="zb-nav-item flex h-8 items-center justify-between gap-2 rounded-lg border-none px-2 text-left text-[14px]"
                    style={{
                      background: active ? 'var(--color-surface-selected)' : 'transparent',
                      color: active ? 'var(--color-ink-900)' : 'var(--color-text-secondary)',
                      fontWeight: active ? 500 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    <span className="truncate">{e.name}</span>
                    {count > 0 && <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--color-ink-400)' }}>{count}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Preview column */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-8 py-8">
            <header className="flex flex-col gap-1.5">
              <h2 className="text-[24px] font-medium leading-none" style={{ color: 'var(--color-ink-900)' }}>{entry.name}</h2>
              <p className="text-[14px] leading-5" style={{ color: 'var(--color-ink-600)' }}>{entry.desc}</p>
            </header>

            {/* Live preview on the sunken card surface */}
            <section className="rounded-panel p-6" style={{ background: 'var(--color-paper-2)' }}>
              {entry.render()}
            </section>

            {/* Used in — the real import scan */}
            <section className="flex flex-col gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--color-ink-500)' }}>
                Used in {usedIn.length > 0 ? `${usedIn.length} ${usedIn.length === 1 ? 'file' : 'files'}` : 'the design system only'}
              </div>
              {usedIn.length > 0 && (
                <ul className="flex flex-col">
                  {usedIn.map((f) => (
                    <li key={f} className="flex h-8 items-center rounded-md px-2 text-[13px]" style={{ color: 'var(--color-ink-600)' }}>
                      <code className="truncate">{f}</code>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
