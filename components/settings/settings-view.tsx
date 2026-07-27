'use client';
// Settings — a grouped nav rail (Account / App) beside a single settings pane,
// the two-pane layout reference-measured from the settings-dialog capture and
// rebuilt on DS primitives (SettingsPaneHeader/Section/Row). Account edits the
// profile (name + default hourly rate); Appearance hosts theme/density/accent/
// sound; Keyboard documents the real wired shortcuts; About is app info.
import { Fragment, useEffect, useRef, useState } from 'react';
import { User, Palette, Keyboard as KeyboardIcon, Info, Plug, Settings, Check, Download, Upload, Sparkles, type IconType } from "@/components/ds/icons";
import { PageHeader } from '@/components/ui/page-header';
import { ViewContainer } from '@/components/ui/view-container';
import {
  Icon, Button, Field, TextInput, Kbd, Badge,
  SettingsPaneHeader, SettingsSection, SettingsRow,
} from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { updateProfile } from '@/lib/actions/profile';
import { importTasks } from '@/lib/actions/tasks';
import { parseTasksCsv, type ImportResult } from '@/lib/import-tasks';
import { Appearance } from '@/components/settings/appearance';
import { Connections } from '@/components/settings/connections';
import { SHORTCUT_GROUPS } from '@/components/shell/keyboard-shortcuts';

export type GcalStatus = { connected: boolean; lastSynced: string | null; eventCount: number | null };

type SectionId = 'account' | 'appearance' | 'connections' | 'automations' | 'import' | 'export' | 'keyboard' | 'about';
const NAV_GROUPS: { label: string; items: { id: SectionId; label: string; icon: IconType }[] }[] = [
  {
    label: 'Account',
    items: [
      { id: 'account', label: 'Account', icon: User },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'connections', label: 'Connections', icon: Plug },
    ],
  },
  {
    label: 'App',
    items: [
      { id: 'automations', label: 'Automations', icon: Sparkles },
      { id: 'import', label: 'Import', icon: Upload },
      { id: 'export', label: 'Export', icon: Download },
      { id: 'keyboard', label: 'Keyboard shortcuts', icon: KeyboardIcon },
      { id: 'about', label: 'About', icon: Info },
    ],
  },
];

export function SettingsView({ email, initialName, initialRate, gcal }: { email: string; initialName: string; initialRate: number; gcal: GcalStatus }) {
  const [section, setSection] = useState<SectionId>('account');
  // Deep-linkable: `/settings?section=import` opens straight to a pane (the Tasks
  // empty-state import entry point, §7U). Read AFTER mount — NOT in the useState
  // initializer — so SSR and the first client render both start at 'account';
  // reading window.location during render is a hydration mismatch.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('section');
    const valid: SectionId[] = ['account', 'appearance', 'connections', 'automations', 'import', 'export', 'keyboard', 'about'];
    if (s && (valid as string[]).includes(s)) setSection(s as SectionId);
  }, []);

  return (
    <ViewContainer className="pt-[var(--view-pt)] pb-[var(--view-pb)]" style={{ animation: 'fadein 220ms' }}>
      <PageHeader icon={Settings} title="Settings" subtitle="Your account, the way you work." style={{ marginBottom: 'var(--view-gap)' }} />

      <div className="flex flex-wrap items-start gap-8">
        {/* Nav rail — grouped, selected item is a filled pill (never an edge bar). */}
        <nav aria-label="Settings sections" className="flex w-52 shrink-0 flex-col gap-5 max-sm:w-full max-sm:flex-row max-sm:gap-4 max-sm:overflow-x-auto max-sm:pb-1">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5 max-sm:flex-row max-sm:gap-1">
              <div className="px-2 pb-1 text-caption font-medium text-ink-500 max-sm:hidden">{g.label}</div>
              {g.items.map((s) => {
                const on = s.id === section;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    aria-current={on ? 'true' : undefined}
                    className={cn(
                      "focus-ring flex h-8 shrink-0 items-center gap-2 rounded-sm px-2 text-start text-ui transition-colors duration-fast",
                      on ? "bg-surface-active font-medium text-ink-900" : "text-ink-600 hover:bg-surface-hover hover:text-ink-800",
                    )}
                  >
                    <Icon icon={s.icon} size={16} className={on ? "text-ink-800" : "text-ink-500"} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Active pane — one column, capped at a readable measure. */}
        <div className="min-w-0 max-w-2xl flex-1 basis-96">
          {section === 'account' && <AccountPane email={email} initialName={initialName} initialRate={initialRate} />}
          {section === 'appearance' && <Appearance />}
          {section === 'connections' && <Connections connected={gcal.connected} lastSynced={gcal.lastSynced} eventCount={gcal.eventCount} />}
          {section === 'automations' && <AutomationsPane />}
          {section === 'import' && <ImportPane />}
          {section === 'export' && <ExportPane />}
          {section === 'keyboard' && <KeyboardPane />}
          {section === 'about' && <AboutPane />}
        </div>
      </div>
    </ViewContainer>
  );
}

function AccountPane({ email, initialName, initialRate }: { email: string; initialName: string; initialRate: number }) {
  const [name, setName] = useState(initialName);
  const [rate, setRate] = useState(String(initialRate || ''));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = name.trim() !== initialName.trim() || (parseFloat(rate) || 0) !== (initialRate || 0);

  async function save() {
    setState('saving');
    const res = await updateProfile({ full_name: name.trim() || null, hourly_rate: parseFloat(rate) || 0 });
    if ('error' in res) setState('error');
    else { setState('saved'); setTimeout(() => setState('idle'), 1800); }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Account" description="Your profile and billing defaults." />
      <SettingsSection title="Profile">
        <div className="flex max-w-sm flex-col gap-5 pt-4">
          <Field label="Display name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="off" data-1p-ignore data-lpignore="true" />
          </Field>
          <Field label="Email" helper="The email you sign in with.">
            <TextInput value={email} readOnly disabled />
          </Field>
          <Field label="Default hourly rate" helper="Used to value unbilled time and pre-fill invoices.">
            <TextInput prefix="$" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" placeholder="120" autoComplete="off" data-1p-ignore data-lpignore="true" />
          </Field>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" onClick={save} disabled={!dirty} loading={state === 'saving'}>
              Save changes
            </Button>
            {state === 'saved' && (
              <span className="flex items-center gap-1.5 text-meta text-ink-600" role="status">
                <Icon icon={Check} size={14} /> Saved
              </span>
            )}
            {state === 'error' && <span className="text-meta text-danger-600" role="alert">Couldn&apos;t save — try again.</span>}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

function ImportPane() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [state, setState] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setResult(null); setFileName(''); if (inputRef.current) inputRef.current.value = ''; };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setState('idle');
    setResult(parseTasksCsv(await f.text()));
  }

  async function runImport() {
    if (!result?.tasks.length) return;
    setState('importing');
    try {
      const res = await importTasks(result.tasks);
      if ('error' in res) setState('error');
      else { setCount(res.count); setState('done'); reset(); }
    } catch {
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Import" description="Coming from another app? Bring your tasks with you." />
      <SettingsSection title="From a CSV">
        <SettingsRow
          title="Tasks"
          description="A Todoist or TickTick CSV export, or any spreadsheet with a title column (covers Things). Everything lands in your Inbox to triage."
          control={
            <>
              <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" aria-label="Choose a CSV file" />
              <Button variant="secondary" size="sm" icon={<Icon icon={Upload} size={14} />} onClick={() => inputRef.current?.click()}>
                Choose CSV
              </Button>
            </>
          }
        />
      </SettingsSection>

      {result && (
        <div className="rounded-lg border border-line-soft bg-surface-sunken p-4">
          <div className="mb-1 text-ui text-ink-800">
            <span className="font-medium">{fileName}</span> · detected {result.format === 'todoist' ? 'Todoist' : result.format === 'ticktick' ? 'TickTick' : 'a generic CSV'}
          </div>
          <p className="text-caption text-ink-500">
            <b className="tabular-nums text-ink-800">{result.tasks.length}</b> task{result.tasks.length === 1 ? '' : 's'} ready
            {result.skipped > 0 && <> · {result.skipped} row{result.skipped === 1 ? '' : 's'} skipped</>}.
          </p>
          {result.tasks.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1">
              {result.tasks.slice(0, 5).map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-caption text-ink-600">
                  <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-400" />
                  <span className="truncate">{t.title}</span>
                </li>
              ))}
              {result.tasks.length > 5 && <li className="ps-3 text-caption text-ink-400">+{result.tasks.length - 5} more</li>}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={runImport} disabled={!result.tasks.length} loading={state === 'importing'}>
              Import {result.tasks.length} task{result.tasks.length === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {state === 'done' && (
        <span className="flex items-center gap-1.5 text-meta text-ink-600" role="status">
          <Icon icon={Check} size={14} /> Imported {count} task{count === 1 ? '' : 's'} to your Inbox.
        </span>
      )}
      {state === 'error' && <span className="text-meta text-danger-600" role="alert">Couldn’t import — check the file and try again.</span>}
    </div>
  );
}

// The automation doctrine (§7 clerk doctrine) — Zenboard's calm, anti-surprise
// stance, stated in-app before the engine ships. Honest "Planned" status on each
// moment; nothing here claims to run yet.
const AUTOMATION_PRINCIPLES: { title: string; body: string }[] = [
  { title: 'Draft, never send', body: 'Zenboard prepares the message, the task, the invoice — nothing leaves or changes until you say yes.' },
  { title: 'Scoped, not autonomous', body: 'Every automation has one trigger and one narrow job. No open-ended agent roaming your data.' },
  { title: 'One quiet nudge a day', body: 'We aim for roughly one notification a day. If an automation can’t stay calm, we don’t ship it.' },
  { title: 'Always reversible', body: 'Anything Zenboard does on your behalf can be undone in a click.' },
];
const AUTOMATION_MOMENTS: { title: string; body: string }[] = [
  { title: 'Triage suggestions', body: 'New captures get filed into the right list — as a suggestion you confirm, not a silent move.' },
  { title: 'Follow-ups & drafts', body: 'A follow-up after a meeting, a task from a promise, an invoice from logged time — drafted for your review.' },
  { title: 'Recall & Ask', body: 'Ask “what did I decide about this?” in the command bar and get the answer, linked to its source.' },
  { title: 'Morning digest', body: 'One calm summary of the day ahead, so you never open Zenboard to a wall of red.' },
];

function AutomationsPane() {
  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Automations" description="Zenboard automates the busywork — never the thinking." />
      <SettingsSection title="How Zenboard automates">
        <div className="flex flex-col gap-4 pt-3">
          {AUTOMATION_PRINCIPLES.map((p) => (
            <div key={p.title} className="flex gap-3">
              <Icon icon={Check} size={16} className="mt-0.5 shrink-0 text-ink-500" />
              <div className="min-w-0">
                <div className="text-ui font-medium text-ink-900">{p.title}</div>
                <div className="text-caption leading-relaxed text-ink-500">{p.body}</div>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
      <SettingsSection title="What it will handle">
        {AUTOMATION_MOMENTS.map((m) => (
          <SettingsRow key={m.title} title={m.title} description={m.body} control={<Badge status="neutral">Planned</Badge>} />
        ))}
      </SettingsSection>
    </div>
  );
}

function ExportPane() {
  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Export" description="Your work is yours — take it anywhere, any time." />
      <SettingsSection title="Download">
        <SettingsRow
          title="Tasks"
          description="Every task as a CSV — dates, projects, labels, notes."
          control={
            <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={14} />}
              onClick={() => { window.location.href = '/api/export/tasks'; }}>
              Download CSV
            </Button>
          }
        />
        <SettingsRow
          title="Projects"
          description="Every project as Markdown — sections, checklists, subtasks."
          control={
            <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={14} />}
              onClick={() => { window.location.href = '/api/export/projects'; }}>
              Download Markdown
            </Button>
          }
        />
        <SettingsRow
          title="Calendar"
          description="Every event as an .ics file — import into Apple, Google, or Outlook Calendar."
          control={
            <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={14} />}
              onClick={() => { window.location.href = '/api/export/calendar'; }}>
              Download .ics
            </Button>
          }
        />
      </SettingsSection>
    </div>
  );
}

function KeyboardPane() {
  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Keyboard shortcuts" description="Shortcuts pause while you're typing in a field." />
      <div className="flex flex-col gap-10">
        {SHORTCUT_GROUPS.map((g) => (
          <SettingsSection key={g.title} title={g.title}>
            {g.items.map((it, i) => (
              <SettingsRow
                key={it.label + i}
                title={it.label}
                className="py-2"
                control={
                  g.title === 'Go to' && it.keys.length > 1 ? (
                    <span className="flex items-center gap-1.5">
                      {it.keys.map((k, j) => (
                        <Fragment key={j}>
                          {j > 0 && <span className="text-caption text-ink-400">then</span>}
                          <Kbd keys={[k]} />
                        </Fragment>
                      ))}
                    </span>
                  ) : (
                    <Kbd keys={it.keys} />
                  )
                }
              />
            ))}
          </SettingsSection>
        ))}
      </div>
    </div>
  );
}

const APP_VERSION = '1.0.0-beta';

function AboutPane() {
  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="About" description="A quiet operating system for your work and life." />
      <SettingsSection title="Zenboard">
        <SettingsRow title="Version" className="py-2" control={<span className="font-mono text-mono-sm text-ink-600">{APP_VERSION}</span>} />
        <SettingsRow title="Workspace" className="py-2" control={<span className="text-meta text-ink-600">Personal</span>} />
        <SettingsRow title="Made for" className="py-2" control={<span className="text-meta text-ink-600">Calm, focused freelancers</span>} />
        <SettingsRow
          title="Automations"
          className="py-2"
          control={
            <a href="/automations" className="focus-ring rounded-sm text-meta text-ink-600 transition-colors duration-fast hover:text-ink-800">
              What Zenboard does automatically
            </a>
          }
        />
      </SettingsSection>
    </div>
  );
}
