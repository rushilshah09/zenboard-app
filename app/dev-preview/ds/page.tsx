'use client';
// Dev-only design-system playground — renders the canonical primitives so their
// geometry can be verified against DESIGN_SYSTEM.md §5 (buttons/inputs 28/32/36,
// switch 34×20, tag 20/r-sm, popover anatomy, checkbox 16). 404s outside dev.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { Settings, Search, Flag, Folder, Trash2 } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { Button, IconButton, Input, Field, Toggle, Pill, Card, Checkbox, Kbd, Tooltip, Divider, Spinner, Avatar } from '@/components/ui/primitives';
import { Popover, PopoverHeader, MenuList, MenuRow, MenuSeparator, MenuGroupLabel } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';
import { Bold, Italic, Underline, Code } from "@/components/ds/icons";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ width: 72, fontSize: 'var(--text-caption-size)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 'var(--text-label-size)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{title}</h3>
      {children}
    </section>
  );
}

export default function DsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [status, setStatus] = useState('doing');
  const [labels, setLabels] = useState<string[]>(['design']);
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)', padding: 40 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <Group title="Button — sizes (28 / 32 / 36)">
          <Row label="sm 28"><Button size="sm" variant="primary" icon={Settings}>Customise</Button><Button size="sm" variant="secondary">Customise</Button><Button size="sm" variant="primary" icon={Settings} /></Row>
          <Row label="md 32"><Button size="md" variant="primary" icon={Settings}>Customise</Button><Button size="md" variant="secondary">Customise</Button><Button size="md" variant="primary" icon={Settings} /></Row>
          <Row label="lg 36"><Button size="lg" variant="primary" icon={Settings}>Customise</Button><Button size="lg" variant="secondary">Customise</Button><Button size="lg" variant="primary" icon={Settings} /></Row>
        </Group>
        <Group title="Button — variants (primary = neutral dark · accent = rare brand CTA)">
          <Row label="all"><Button variant="primary">Primary</Button><Button variant="secondary">Secondary</Button><Button variant="tinted">Tinted</Button><Button variant="ghost">Ghost</Button><Button variant="dark">Dark</Button><Button variant="danger">Danger</Button><Button variant="danger-soft">Danger soft</Button></Row>
        </Group>
        <Group title="Input (h 28 / 32 / 36 · r 8 · paper-2 · shadow-xs)">
          <Field label="Label" hint="This is helper text"><Input id="ds-in" placeholder="Password" /></Field>
          <Input icon={Search} placeholder="Search…" />
          <Input icon={Search} type="password" placeholder="Password" defaultValue="secret" />
          <Input placeholder="Invalid field" invalid defaultValue="oops" />
        </Group>
        <Group title="Switch (34×20 · thumb 16) · Checkbox (16 · r-xs) · Kbd">
          <Row label="state">
            <Toggle on={on} onChange={() => setOn((v) => !v)} />
            <Toggle on={!on} onChange={() => setOn((v) => !v)} />
            <Toggle on={on} onChange={() => setOn((v) => !v)} size="sm" />
            <Checkbox checked={checked} onChange={() => setChecked((v) => !v)} label="Demo" />
            <Checkbox checked={false} indeterminate label="Mixed" />
            <Kbd>⌘K</Kbd>
            <Tooltip label="Mark as default"><Button variant="ghost" size="sm" icon={Settings} /></Tooltip>
          </Row>
        </Group>
        <Group title="Tag / Pill (§5.34: h20 · r-sm · chip trios · dot · remove)">
          <Row label="tones">
            <Pill tone="neutral">Neutral</Pill>
            <Pill tone="accent">Accent</Pill>
            <Pill tone="green" dot>Done</Pill>
            <Pill tone="blue" dot>In progress</Pill>
            <Pill tone="red" dot onRemove={() => {}}>High</Pill>
            <Pill tone="yellow" dot>Waiting</Pill>
            <Pill tone="purple">Design</Pill>
          </Row>
        </Group>
        <Group title="Popover + Menu (§5.24/§5.16: r-lg · line-pop ring · overlay shadow · 32px rows)">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <Popover variant="rich" width={230} className="overflow-hidden" style={{ position: 'static' }}>
              <PopoverHeader>Change priority</PopoverHeader>
              <MenuList>
                <MenuGroupLabel>Priority</MenuGroupLabel>
                <MenuRow icon={Flag} selected>High</MenuRow>
                <MenuRow icon={Flag}>Medium</MenuRow>
                <MenuRow icon={Folder} trailing={<Kbd>P</Kbd>}>Move to project…</MenuRow>
                <MenuSeparator />
                <MenuRow icon={Trash2} destructive>Delete task</MenuRow>
              </MenuList>
            </Popover>
          </div>
        </Group>
        <Group title="Select (§5.29 · single + multi · dots · searchable + create)">
          <div style={{ display: 'flex', gap: 16, maxWidth: 520 }}>
            <div style={{ flex: 1 }}>
              <Select
                value={status}
                onChange={(v) => setStatus(v as string)}
                options={[
                  { value: 'todo', label: 'To do', dot: 'var(--gray-dot)' },
                  { value: 'doing', label: 'In progress', dot: 'var(--blue-dot)' },
                  { value: 'done', label: 'Done', dot: 'var(--green-dot)' },
                ]}
                placeholder="Set status…"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select
                multi
                value={labels}
                onChange={(v) => setLabels(v as string[])}
                options={[
                  { value: 'design', label: 'Design', dot: 'var(--purple-dot)' },
                  { value: 'bug', label: 'Bug', dot: 'var(--red-dot)' },
                  { value: 'urgent', label: 'Urgent', dot: 'var(--orange-dot)' },
                ]}
                placeholder="Add labels…"
                onCreate={(name) => setLabels((l) => [...l, name.toLowerCase()])}
              />
            </div>
          </div>
        </Group>
        <Group title="IconButton (toolbar · 28/32/36 square · active toggle)">
          <Row label="rest">
            <IconButton icon={Bold} label="Bold" />
            <IconButton icon={Italic} label="Italic" active />
            <IconButton icon={Underline} label="Underline" />
            <IconButton icon={Code} label="Code" />
            <Divider vertical />
            <IconButton icon={Trash2} label="Delete" tone="danger" />
            <IconButton icon={Settings} label="Settings" size="sm" />
          </Row>
        </Group>
        <Group title="Avatar (§5.4) · Spinner · Divider">
          <Row label="avatar">
            <Avatar name="Rushil Shah" size={24} />
            <Avatar name="Mira Patel" size={28} />
            <Avatar name="TechSpark" size={24} square />
            <Spinner />
            <Button variant="primary" size="sm"><Spinner className="border-(--on-primary)" /> Saving</Button>
          </Row>
        </Group>
        <Group title="Card">
          <Card className="p-4"><span style={{ fontSize: 'var(--text-small-size)', color: 'var(--ink-2)' }}>Send invoice for July to TechSpark</span></Card>
        </Group>
      </div>
    </div>
  );
}
