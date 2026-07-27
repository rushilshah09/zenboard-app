'use client';
// Dev-only proof harness for the shadcn design-system (@/components/ds). Renders a
// representative slice so we can confirm the ported ds-theme.css token/utility
// layer makes DS components render correctly (light + dark) inside zenboard-web,
// before migrating any Documents call sites. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { Plus, Check, Trash, Search, Settings, ChevronDown, Star } from "@/components/ds/icons";
import {
  Button, IconButton, Badge, Tag, Tooltip, TooltipProvider, Divider,
  Icon, Mark, Logo,
  Select, Checkbox, Switch, TextInput, Field, Tabs,
  Popover, PopoverTrigger, PopoverContent,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  ToggleGroup, ToggleGroupItem,
} from '@/components/ds/ui';

const VARIANTS = ['primary', 'secondary', 'ghost', 'quiet', 'danger', 'dangerGhost', 'link'] as const;
const SIZES = ['xs', 'sm', 'md', 'lg'] as const;

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="text-caption" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div>
    </section>
  );
}

export default function DsShadcnPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);
  const [tab, setTab] = useState('one');
  const [sel, setSel] = useState('med');

  return (
    <TooltipProvider>
      <div style={{ minHeight: '100dvh', background: 'var(--color-surface-desk)', padding: 48 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div>
            <h1 className="text-title-1" style={{ color: 'var(--color-ink-900)' }}>Design-system proof</h1>
            <p className="text-body" style={{ color: 'var(--color-ink-600)', marginTop: 4 }}>
              DS components from <code>@/components/ds/ui</code> rendering against the ported <code>ds-theme.css</code>.
            </p>
          </div>

          <Row title="Button · variants">
            {VARIANTS.map((v) => <Button key={v} variant={v}>{v}</Button>)}
          </Row>
          <Row title="Button · sizes / icon / loading / disabled">
            {SIZES.map((s) => <Button key={s} size={s} variant="primary">{s}</Button>)}
            <Button variant="secondary" icon={<Plus className="size-4" />}>With icon</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button variant="secondary" disabled>Disabled</Button>
            <IconButton label="Add" icon={<Plus className="size-4" />} variant="secondary" />
            <IconButton label="Search" icon={<Search className="size-4" />} />
          </Row>

          <Row title="Badge / Tag / Tooltip">
            <Badge variant="status" status="success">Success</Badge>
            <Badge variant="status" status="warning">Warning</Badge>
            <Badge variant="status" status="danger">Danger</Badge>
            <Badge variant="count" count={7} />
            <Tag>Design</Tag>
            <Tag color="stone" size="sm" icon={<Icon icon={Star} size={12} />}>Highlight</Tag>
            <Tooltip content="I'm a tooltip · Esc">
              <Button variant="ghost">Hover me</Button>
            </Tooltip>
          </Row>

          <Row title="Icon wrapper (Tabler) / brand">
            <Icon icon={Search} size={16} />
            <Icon icon={Settings} size={20} />
            <Icon icon={Check} size={20} weight="bold" />
            <Icon icon={Trash} size={24} strokeWidth={1.25} />
            <Icon icon={ChevronDown} size={16} style={{ color: 'var(--color-accent)' }} />
            <Mark size={24} />
            <Logo height={22} />
          </Row>

          <Divider />

          <Row title="Form controls">
            <div style={{ width: 220 }}>
              <Field label="Email"><TextInput placeholder="you@studio.com" /></Field>
            </div>
            <div style={{ width: 200 }}>
              <Field label="Priority">
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
              </Field>
            </div>
            <Checkbox label="Checkbox" checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
            <Switch label="Switch" checked={on} onCheckedChange={setOn} />
          </Row>

          <Row title="Tabs">
            <Tabs
              items={[{ value: 'one', label: 'Overview' }, { value: 'two', label: 'Activity' }, { value: 'three', label: 'Settings' }]}
              value={tab}
              onValueChange={setTab}
            />
            <span className="text-meta" style={{ color: 'var(--color-ink-500)' }}>active: {tab}</span>
          </Row>

          <Row title="Overlays (Radix) — click to open">
            <Popover>
              <PopoverTrigger asChild><Button variant="secondary" iconRight={<ChevronDown className="size-4" />}>Popover</Button></PopoverTrigger>
              <PopoverContent>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                  <div className="text-ui" style={{ fontWeight: 600 }}>Popover content</div>
                  <div className="text-meta" style={{ color: 'var(--color-ink-500)' }}>Portalled + focus-managed by Radix.</div>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="secondary" icon={<Settings className="size-4" />}>Menu</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem><Check className="size-4" /> Mark done</DropdownMenuItem>
                <DropdownMenuItem><Plus className="size-4" /> Add item</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Trash className="size-4" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>

          <Row title="ToggleGroup (shadcn/Radix) — ink chrome, single + multi">
            <ToggleGroup type="single" defaultValue="board" aria-label="View">
              <ToggleGroupItem value="list">List</ToggleGroupItem>
              <ToggleGroupItem value="board">Board</ToggleGroupItem>
              <ToggleGroupItem value="calendar">Calendar</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="multiple" variant="outline" spacing={1} defaultValue={['b']} aria-label="Format">
              <ToggleGroupItem value="b"><span style={{ fontWeight: 700 }}>B</span></ToggleGroupItem>
              <ToggleGroupItem value="i"><span style={{ fontStyle: 'italic' }}>I</span></ToggleGroupItem>
              <ToggleGroupItem value="u"><span style={{ textDecoration: 'underline' }}>U</span></ToggleGroupItem>
            </ToggleGroup>
          </Row>

          <Row title="Table (shadcn) — themed to B&G tokens">
            <div style={{ width: '100%' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right tabular-nums">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>INV-014</TableCell>
                    <TableCell>Meridian Studio</TableCell>
                    <TableCell className="text-right tabular-nums">$4,200</TableCell>
                  </TableRow>
                  <TableRow data-state="selected">
                    <TableCell>INV-018</TableCell>
                    <TableCell>Fernwood Hotels</TableCell>
                    <TableCell className="text-right tabular-nums">$2,800</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>INV-021</TableCell>
                    <TableCell>Atlas Coffee</TableCell>
                    <TableCell className="text-right tabular-nums">$1,150</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Row>
        </div>
      </div>
    </TooltipProvider>
  );
}
