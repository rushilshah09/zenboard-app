'use client';
// Settings — a grouped nav rail (Account / App) beside a single settings pane,
// the two-pane layout reference-measured from the settings-dialog capture and
// rebuilt on DS primitives (SettingsPaneHeader/Section/Row). Account edits the
// profile (name + default hourly rate); Appearance hosts theme/density/accent/
// sound; Keyboard documents the real wired shortcuts; About is app info.
import { Fragment, useEffect, useRef, useState } from 'react';
import { User, Palette, Keyboard as KeyboardIcon, Info, Plug, Settings, Check, Download, Upload, Sparkles, Tag as TagIcon, Link as LinkIcon, Bell, type IconType } from "@/components/ds/icons";
import { PageHeader } from '@/components/ui/page-header';
import { PageLayout } from '@/components/ui/page-layout';
import {
  Icon, Button, Field, TextInput, Kbd, Badge, Switch, toast, useConfirm,
  SettingsPaneHeader, SettingsSection, SettingsRow,
  TimePicker,
} from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { updateProfile, updatePreferences, getCalendarFeedToken, rotateCalendarFeedToken } from '@/lib/actions/profile';
import { formatMinutes, parseClock } from '@/lib/date';
import { workMinutes, writeWorkHours, DEFAULT_WORK_HOURS, type WorkHours } from '@/lib/capacity';
import { toClock, todayISO, formatDay } from '@/lib/date';
import { writeDigestPrefs, vacationThrough, DEFAULT_DIGEST_PREFS, type DigestPrefs } from '@/lib/digest';
import { AUTOMATIONS, CLERK_MOMENTS, STATUS_LABEL, liveCount } from '@/lib/automations';
import { importTasks } from '@/lib/actions/tasks';
import { parseTasksCsv, type ImportResult } from '@/lib/import-tasks';
import { parseNotionMarkdown, isImportableDoc, type ImportedDoc } from '@/lib/import-docs';
import { importDocs } from '@/lib/actions/library';
import { Appearance } from '@/components/settings/appearance';
import { Connections } from '@/components/settings/connections';
import { LabelsPane } from '@/components/settings/labels-pane';
import { SHORTCUT_GROUPS } from '@/components/shell/keyboard-shortcuts';

export type GcalStatus = { connected: boolean; lastSynced: string | null; eventCount: number | null };

type SectionId = 'account' | 'notifications' | 'appearance' | 'connections' | 'labels' | 'automations' | 'import' | 'export' | 'keyboard' | 'about';
const NAV_GROUPS: { label: string; items: { id: SectionId; label: string; icon: IconType }[] }[] = [
  {
    label: 'Account',
    items: [
      { id: 'account', label: 'Account', icon: User },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'connections', label: 'Connections', icon: Plug },
    ],
  },
  {
    label: 'App',
    items: [
      { id: 'labels', label: 'Labels', icon: TagIcon },
      { id: 'automations', label: 'Automations', icon: Sparkles },
      { id: 'import', label: 'Import', icon: Upload },
      { id: 'export', label: 'Export', icon: Download },
      { id: 'keyboard', label: 'Keyboard shortcuts', icon: KeyboardIcon },
      { id: 'about', label: 'About', icon: Info },
    ],
  },
];

export function SettingsView({ email, initialName, initialRate, gcal, workHours = DEFAULT_WORK_HOURS, digest = DEFAULT_DIGEST_PREFS }: {
  email: string; initialName: string; initialRate: number; gcal: GcalStatus;
  /** The hours the user says they work (§7C), from `profiles.preferences`. */
  workHours?: WorkHours;
  /** Morning-digest settings (§7O channel 2), from the same jsonb. */
  digest?: DigestPrefs;
}) {
  const [section, setSection] = useState<SectionId>('account');
  // Deep-linkable: `/settings?section=import` opens straight to a pane (the Tasks
  // empty-state import entry point, §7U). Read AFTER mount — NOT in the useState
  // initializer — so SSR and the first client render both start at 'account';
  // reading window.location during render is a hydration mismatch.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('section');
    const valid: SectionId[] = ['account', 'notifications', 'appearance', 'connections', 'labels', 'automations', 'import', 'export', 'keyboard', 'about'];
    if (s && (valid as string[]).includes(s)) setSection(s as SectionId);
  }, []);

  // No header row: Settings has no page-level actions, so the band would be a
  // hairline under nothing. Passing <PageLayout> no header props is how a page
  // says that — it renders the column alone.
  return (
    <PageLayout>
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
          {section === 'account' && <AccountPane email={email} initialName={initialName} initialRate={initialRate} initialHours={workHours} />}
          {section === 'notifications' && <NotificationsPane initial={digest} />}
          {section === 'appearance' && <Appearance />}
          {section === 'connections' && <Connections connected={gcal.connected} lastSynced={gcal.lastSynced} eventCount={gcal.eventCount} />}
          {section === 'automations' && <AutomationsPane />}
          {section === 'import' && <ImportPane />}
          {section === 'labels' && <LabelsPane />}
          {section === 'export' && <ExportPane />}
          {section === 'keyboard' && <KeyboardPane />}
          {section === 'about' && <AboutPane />}
        </div>
      </div>
    </PageLayout>
  );
}

function AccountPane({ email, initialName, initialRate, initialHours }: {
  email: string; initialName: string; initialRate: number; initialHours: WorkHours;
}) {
  const [name, setName] = useState(initialName);
  const [rate, setRate] = useState(String(initialRate || ''));
  // Work hours as the `HH:MM` strings the time inputs speak; `lib/capacity`
  // owns the conversion in both directions so the settings pane and the
  // capacity rule can never disagree about what "17:00" means.
  const initialClock = writeWorkHours(initialHours);
  const [dayStart, setDayStart] = useState(initialClock.dayStart);
  const [dayEnd, setDayEnd] = useState(initialClock.dayEnd);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hoursValid = parseClock(dayStart) !== undefined && parseClock(dayEnd) !== undefined;
  const dirty = name.trim() !== initialName.trim()
    || (parseFloat(rate) || 0) !== (initialRate || 0)
    || dayStart !== initialClock.dayStart
    || dayEnd !== initialClock.dayEnd;

  const dayLength = hoursValid
    ? formatMinutes(workMinutes({ start: parseClock(dayStart)!, end: parseClock(dayEnd)! }))
    : null;

  async function save() {
    setState('saving');
    const [profile, prefs] = await Promise.all([
      updateProfile({ full_name: name.trim() || null, hourly_rate: parseFloat(rate) || 0 }),
      // Merged into the preferences jsonb, never overwriting it — accent,
      // density, timezone and the calendar-feed token all live in the same blob.
      hoursValid ? updatePreferences({ dayStart, dayEnd }) : Promise.resolve({ ok: true } as const),
    ]);
    if ('error' in profile || 'error' in prefs) setState('error');
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

          {/* Work hours (§7C). Onboarding asked for the end of the day once and
              there was no way to change the answer afterwards — and nothing
              read it. It is now the day that Home, the Week board and the
              morning plan all measure against, so it has to be editable. */}
          <Field
            label="Work hours"
            helper={dayLength
              ? `A ${dayLength} day. Used to tell you whether a day's plan fits.`
              : 'Enter both times as HH:MM.'}
          >
            <div className="flex items-center gap-2">
              <TimePicker aria-label="Work day starts at" className="w-32" value={dayStart} onValueChange={setDayStart} />
              <span aria-hidden className="text-meta text-ink-500">to</span>
              <TimePicker aria-label="Work day ends at" className="w-32" value={dayEnd} onValueChange={setDayEnd} durationFrom={dayStart} />
            </div>
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

/**
 * Notifications — §7O's whole surface in one pane, which is short on purpose.
 *
 * The in-app bell and time reminders need no settings (they are things you
 * asked for, one at a time). The digest is the only thing here that speaks
 * without being asked each time, so it is the only thing that needs a switch —
 * and §7O requires that switch to be honoured instantly, which is why turning
 * it off is one boolean and clears no other state.
 */
function NotificationsPane({ initial }: { initial: DigestPrefs }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [at, setAt] = useState(toClock(initial.atMinutes));
  const [vacationUntil, setVacationUntil] = useState(initial.vacationUntil);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const atMinutes = parseClock(at);
  const onVacation = !!vacationUntil && todayISO() <= vacationUntil;

  async function save(next: Partial<DigestPrefs>) {
    const merged = { enabled, atMinutes: atMinutes ?? initial.atMinutes, vacationUntil, ...next };
    setEnabled(merged.enabled);
    if (next.vacationUntil !== undefined) setVacationUntil(merged.vacationUntil);
    setState('saving');
    // The write is a MERGE into the digest object and never touches `lastSent`
    // — that value belongs to the worker, and clearing it here would let a
    // settings tweak send a second digest in one morning.
    const res = await updatePreferences({ digest: writeDigestPrefs(merged) });
    if ('error' in res) setState('error');
    else { setState('saved'); setTimeout(() => setState('idle'), 1800); }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Notifications" description="One message a day, at most. Everything else waits for a ritual." />

      <SettingsSection title="Morning digest">
        <SettingsRow
          title="Send a morning digest"
          description="What's on today, what's late, and anything your clients sent overnight — in one email."
          control={<Switch checked={enabled} onCheckedChange={(v) => save({ enabled: v })} aria-label="Send a morning digest" />}
        />
        {enabled && (
          <SettingsRow
            title="Send it at"
            description="Your local time. If we miss it by more than three hours, we skip the day rather than send a stale one."
            control={(
              <div className="flex items-center gap-2">
                <TimePicker
                  aria-label="Send the digest at"
                  className="w-32"
                  value={at}
                  onValueChange={(v) => {
                    setAt(v);
                    const mins = parseClock(v);
                    if (mins !== undefined && mins !== initial.atMinutes) save({ atMinutes: mins });
                  }}
                />
              </div>
            )}
          />
        )}
      </SettingsSection>

      <SettingsSection title="Vacation">
        <SettingsRow
          title={onVacation ? `Silent through ${formatDay(vacationUntil) ?? vacationUntil}` : 'Not on vacation'}
          // A DATE, not a toggle: a vacation switch is the kind of thing you
          // forget to turn back on, and then the product is quietly broken in a
          // way that looks like it is working.
          description="Pauses the digest until the date passes, then resumes on its own. Nothing is lost — it is all still on Today when you get back."
          control={(
            <div className="flex items-center gap-2">
              {onVacation ? (
                <Button size="sm" onClick={() => save({ vacationUntil: null })}>I&rsquo;m back</Button>
              ) : (
                [3, 7, 14].map((d) => (
                  <Button key={d} size="sm" onClick={() => save({ vacationUntil: vacationThrough(todayISO(), d) })}>
                    {d} days
                  </Button>
                ))
              )}
            </div>
          )}
        />
      </SettingsSection>

      <div className="flex items-center gap-3" aria-live="polite">
        {state === 'saving' && <span className="text-meta text-ink-500">Saving…</span>}
        {state === 'saved' && (
          <span className="flex items-center gap-1.5 text-meta text-ink-600" role="status">
            <Icon icon={Check} size={14} /> Saved
          </span>
        )}
        {state === 'error' && <span className="text-meta text-danger-600" role="alert">Couldn&apos;t save — try again.</span>}
      </div>
    </div>
  );
}

function ImportPane() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [state, setState] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Notion import — its own state, because a docs import and a tasks import can
  // sit unfinished side by side and neither should clear the other's preview.
  const [docs, setDocs] = useState<ImportedDoc[] | null>(null);
  const [docState, setDocState] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [docCount, setDocCount] = useState(0);
  const docInputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setResult(null); setFileName(''); if (inputRef.current) inputRef.current.value = ''; };
  const resetDocs = () => { setDocs(null); if (docInputRef.current) docInputRef.current.value = ''; };

  async function onDocFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => isImportableDoc(f.name));
    if (!picked.length) return;
    setDocState('idle');
    // Read in parallel — these are local files, and a 200-page export read one
    // at a time is a visibly slow start to something that should feel instant.
    setDocs(await Promise.all(picked.map(async (f) => parseNotionMarkdown(f.name, await f.text()))));
  }

  async function runDocImport() {
    if (!docs?.length) return;
    setDocState('importing');
    try {
      const res = await importDocs(docs);
      if ('error' in res) setDocState('error');
      else { setDocCount(res.count); setDocState('done'); resetDocs(); }
    } catch {
      setDocState('error');
    }
  }

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

      <SettingsSection title="From Notion">
        <SettingsRow
          title="Documents"
          description="Export your Notion workspace as Markdown, then pick the .md files. Titles, headings, lists, to-dos, quotes and code come across; page properties arrive as text."
          control={
            <>
              <input ref={docInputRef} type="file" multiple accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={onDocFiles} className="hidden" aria-label="Choose Markdown files" />
              <Button variant="secondary" size="sm" icon={<Icon icon={Upload} size={14} />} onClick={() => docInputRef.current?.click()}>
                Choose files
              </Button>
            </>
          }
        />
      </SettingsSection>

      {docs && (
        <div className="rounded-lg border border-line-soft bg-surface-sunken p-4">
          <p className="mb-1 text-ui text-ink-800">
            <b className="tabular-nums">{docs.length}</b> document{docs.length === 1 ? '' : 's'} ready
          </p>
          <ul className="mt-2.5 flex flex-col gap-1">
            {docs.slice(0, 5).map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-caption text-ink-600">
                <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-400" />
                <span className="truncate">{d.title}</span>
                <span className="shrink-0 text-ink-500">{d.blocks.length} block{d.blocks.length === 1 ? '' : 's'}</span>
              </li>
            ))}
            {docs.length > 5 && <li className="ps-3 text-caption text-ink-500">+{docs.length - 5} more</li>}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={runDocImport} loading={docState === 'importing'}>
              Import {docs.length} document{docs.length === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetDocs}>Cancel</Button>
          </div>
        </div>
      )}

      {docState === 'done' && (
        <span className="flex items-center gap-1.5 text-meta text-ink-600" role="status">
          <Icon icon={Check} size={14} /> Imported {docCount} document{docCount === 1 ? '' : 's'} to Docs.
        </span>
      )}
      {docState === 'error' && <span className="text-meta text-danger-600" role="alert">Couldn’t import those files — try again.</span>}

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
              {result.tasks.length > 5 && <li className="ps-3 text-caption text-ink-500">+{result.tasks.length - 5} more</li>}
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

function AutomationsPane() {
  const live = liveCount();
  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader
        title="Automations"
        description="Zenboard automates the busywork — never the thinking. There is no rule builder, and this is the whole list."
      />

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

      {/* "What it WILL handle" was the old heading, over a list of four things
          none of which it handled — including one that had shipped that morning.
          The claim is now in the present tense because it is now true, and the
          count is derived rather than written, so it cannot go stale. */}
      <SettingsSection title={`What it does — ${live} running`}>
        {AUTOMATIONS.map((a) => (
          <SettingsRow
            key={a.id}
            title={a.title}
            description={`${a.trigger}. ${a.body}`}
            control={(
              <Badge status={a.status === 'on' ? 'success' : a.status === 'gated' ? 'info' : 'neutral'}>
                {STATUS_LABEL[a.status]}
              </Badge>
            )}
          />
        ))}
        {/* Honest about the middle state: "Ready" means built and waiting on a
            database migration, which is neither on nor planned. Saying either
            would be a lie in a different direction. */}
        {AUTOMATIONS.some((a) => a.status === 'gated') && (
          <p className="pt-3 text-caption leading-relaxed text-ink-500">
            <b className="font-medium text-ink-700">Ready</b> means built and waiting on a database update — it starts working on its own once that is applied, with nothing to switch on.
          </p>
        )}
      </SettingsSection>

      <SettingsSection title="When the clerk arrives">
        {CLERK_MOMENTS.map((m) => (
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
        {/* Three sheets, not one file: an invoice has many lines and many
            payments, so a single flat CSV would either repeat every invoice per
            line or collapse the lines into one unreadable cell. These are the
            three a bookkeeper actually opens. */}
        <SettingsRow
          title="Finance"
          description="For your accountant — invoices with totals and balances, their line items, and payments received."
          control={
            <span className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={14} />}
                onClick={() => { window.location.href = '/api/export/finance?sheet=invoices'; }}>
                Invoices
              </Button>
              <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={14} />}
                onClick={() => { window.location.href = '/api/export/finance?sheet=items'; }}>
                Line items
              </Button>
              <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={14} />}
                onClick={() => { window.location.href = '/api/export/finance?sheet=payments'; }}>
                Payments
              </Button>
            </span>
          }
        />
      </SettingsSection>

      {/* A download is a snapshot; a subscription stays true. Both belong here —
          the file is for archiving and for tools that only import, the feed is
          for the calendar you actually look at. */}
      <SettingsSection title="Subscribe">
        <CalendarFeedRow />
      </SettingsSection>
    </div>
  );
}

/**
 * The calendar feed URL (principle 11 · "your plan in any calendar app").
 *
 * Minted on first reveal rather than on page load: the URL is a bearer
 * capability into someone's schedule, so an account that never subscribes never
 * has one to leak.
 */
function CalendarFeedRow() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const url = token && typeof window !== 'undefined'
    ? `${window.location.origin}/api/feed/${token}/calendar.ics`
    : '';

  async function reveal() {
    setBusy(true);
    const res = await getCalendarFeedToken();
    setBusy(false);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setToken(res.token);
  }

  async function rotate() {
    const ok = await confirm({
      title: 'Generate a new link?',
      body: 'Any calendar already subscribed will stop updating and has to be re-added with the new link.',
      actionLabel: 'Generate new link',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await rotateCalendarFeedToken();
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setToken(res.token);
    toast({ message: 'New link generated. Old subscriptions have stopped.', variant: 'success' });
  }

  return (
    <>
      <SettingsRow
        title="Calendar feed"
        description="A private link your calendar app keeps in sync — events and scheduled tasks, updating about once an hour. Anyone with the link can see your schedule."
        control={
          token ? (
            <span className="flex flex-wrap items-center justify-end gap-2">
              <TextInput
                size="sm" value={url} readOnly aria-label="Calendar feed link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 sm:w-[280px]"
              />
              <Button variant="secondary" size="sm" icon={<Icon icon={LinkIcon} size={14} />}
                onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); toast({ message: 'Link copied.' }); }}>
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={rotate}>Reset</Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" loading={busy} onClick={reveal}
              icon={<Icon icon={LinkIcon} size={14} />}>
              Get link
            </Button>
          )
        }
      />
      {confirmDialog}
    </>
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
                          {j > 0 && <span className="text-caption text-ink-500">then</span>}
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
