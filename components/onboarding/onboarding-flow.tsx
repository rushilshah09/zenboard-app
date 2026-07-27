'use client';
// First-run onboarding = the first planning ritual (MASTER_PRODUCT_PLAN §7U).
// Three questions, no gallery, no tour: what you do (seeds role + rate) · what's
// live right now (creates a real project + today's first tasks, the first one
// starred) · when your day ends (day-end time). Then land on Home with the plan
// already real. Teaches exactly three keys (⌘K · ⏎ · e). Built on the DS,
// skippable at any point.
import { useState } from 'react';
import { Sparkles, ArrowRight, ChevronLeft, Moon, Folder, type IconType } from '@/components/ds/icons';
import { Button, Icon, Field, TextInput, RadioGroup, RadioCard, Kbd } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { updateProfile, updatePreferences, type ProfileRole } from '@/lib/actions/profile';
import { addProject } from '@/lib/actions/projects';
import { addTask } from '@/lib/actions/tasks';

const ROLES: { id: ProfileRole; label: string; hint: string }[] = [
  { id: 'freelancer', label: 'Freelancer', hint: 'Clients, projects, invoices' },
  { id: 'founder', label: 'Founder', hint: 'Building a company' },
  { id: 'individual', label: 'Individual', hint: 'Personal focus & habits' },
];
const TOTAL = 3;
const TASK_PLACEHOLDERS = ['Draft the brief', 'Email the client', 'Sketch three directions'];
const todayISO = () => new Date().toISOString().slice(0, 10);

export function OnboardingFlow({ email, suggestedName }: { email: string; suggestedName: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(suggestedName);
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [rate, setRate] = useState('');
  const [projectName, setProjectName] = useState('');
  const [tasks, setTasks] = useState(['', '', '']);
  const [dayEnd, setDayEnd] = useState('17:00');
  const [busy, setBusy] = useState(false);

  const setTask = (i: number, v: string) => setTasks((t) => t.map((x, idx) => (idx === i ? v : x)));
  const filledTasks = tasks.map((t) => t.trim()).filter(Boolean);

  async function saveIdentity() {
    if (!name.trim() || !role) return;
    setBusy(true);
    await updateProfile({
      full_name: name.trim() || null,
      role,
      hourly_rate: role === 'freelancer' ? parseFloat(rate) || 0 : undefined,
    });
    setBusy(false);
    setStep(1);
  }

  async function finish() {
    setBusy(true);
    // Make the plan real (§7U): a project + today's first tasks, the first starred.
    let projectId: string | null = null;
    if (projectName.trim()) {
      const p = await addProject({ name: projectName.trim() });
      if ('id' in p) projectId = p.id;
    }
    for (let i = 0; i < filledTasks.length; i++) {
      await addTask({ title: filledTasks[i], projectId, scheduledDate: todayISO(), highlight: i === 0 });
    }
    await updatePreferences({ dayEnd });
    await updateProfile({ onboarding_complete: true });
    // Hard nav so the (app) shell re-reads the fresh profile + the seeded plan.
    window.location.assign('/today');
  }

  async function skip() {
    setBusy(true);
    await updateProfile({ full_name: name.trim() || null, role: role ?? undefined, onboarding_complete: true });
    window.location.assign('/today');
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-surface-sunken px-6">
      <button
        type="button"
        onClick={skip}
        disabled={busy}
        className="focus-ring absolute right-6 top-5 rounded-sm px-2 py-1 text-caption text-ink-500 transition-colors hover:text-ink-800 disabled:opacity-50"
      >
        Skip setup
      </button>

      <div className="w-[min(520px,100%)] rounded-2xl border border-line bg-surface-raised p-8 shadow-lift-3" style={{ animation: 'fadein 240ms' }}>
        {/* progress */}
        <div className="mb-7 flex gap-1.5">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-base', i <= step ? 'bg-[var(--accent)]' : 'bg-line-soft')} />
          ))}
        </div>

        {step === 0 && (
          <StepShell icon={Sparkles} kicker="Welcome to Zenboard" title="Let’s set up your first day.">
            <div className="flex flex-col gap-5">
              <Field label="What should we call you?">
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && role) saveIdentity(); }}
                  placeholder="Your name"
                  autoFocus
                  autoComplete="off" data-1p-ignore data-lpignore="true"
                />
                <p className="text-meta text-ink-500">{email}</p>
              </Field>

              <RadioGroup legend="What brings you here?" value={role ?? undefined} onValueChange={(v) => setRole(v as ProfileRole)}>
                <div className="flex flex-col gap-2">
                  {ROLES.map((r) => (
                    <RadioCard key={r.id} value={r.id} label={r.label} description={r.hint} />
                  ))}
                </div>
              </RadioGroup>

              {role === 'freelancer' && (
                <Field label="Your hourly rate" optional>
                  <TextInput
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) saveIdentity(); }}
                    prefix="$"
                    unit="/hr"
                    inputMode="decimal"
                    placeholder="100"
                    autoComplete="off" data-1p-ignore data-lpignore="true"
                  />
                </Field>
              )}
            </div>
            <Footer>
              <Button variant="primary" disabled={!name.trim() || !role || busy} onClick={saveIdentity} iconRight={<Icon icon={ArrowRight} size={16} />}>
                Continue
              </Button>
            </Footer>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell icon={Folder} kicker="Your work" title="What’s live right now?">
            <p className="-mt-3 mb-5 text-ui text-ink-500">We’ll set up your first project and put its opening steps on today’s plan.</p>
            <div className="flex flex-col gap-5">
              <Field label="Main project" optional>
                <TextInput
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Acme rebrand"
                  autoFocus
                  autoComplete="off" data-1p-ignore data-lpignore="true"
                />
              </Field>
              <Field label="First things to do" optional>
                <div className="flex flex-col gap-2">
                  {tasks.map((t, i) => (
                    <TextInput
                      key={i}
                      value={t}
                      onChange={(e) => setTask(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setStep(2); }}
                      placeholder={TASK_PLACEHOLDERS[i]}
                      aria-label={`Task ${i + 1}`}
                      autoComplete="off" data-1p-ignore data-lpignore="true"
                    />
                  ))}
                </div>
              </Field>
            </div>
            <Footer onBack={() => setStep(0)} busy={busy}>
              <Button variant="primary" disabled={busy} onClick={() => setStep(2)} iconRight={<Icon icon={ArrowRight} size={16} />}>
                Continue
              </Button>
            </Footer>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell icon={Moon} kicker="Your rhythm" title="When does your day end?">
            <p className="-mt-3 mb-5 text-ui text-ink-500">Zenboard nudges a 3-minute shutdown around then, so you can actually stop.</p>
            <div className="flex flex-col gap-6">
              <Field label="Day ends at">
                <input
                  type="time"
                  value={dayEnd}
                  onChange={(e) => setDayEnd(e.target.value)}
                  aria-label="Day ends at"
                  className="focus-ring h-10 w-40 rounded-md border border-line bg-surface-raised px-3 text-body tabular-nums text-ink-900"
                />
              </Field>

              {/* Teach exactly three keys (§7U) — nothing else. */}
              <div className="rounded-lg border border-line-soft bg-surface-sunken p-4">
                <p className="mb-2.5 text-caption font-medium text-ink-500">Three keys to know</p>
                <ul className="flex flex-col gap-2 text-ui text-ink-700">
                  <li className="flex items-center gap-2"><Kbd keys={['mod', 'K']} /> <span>capture anything, from anywhere</span></li>
                  <li className="flex items-center gap-2"><Kbd keys={['Enter']} /> <span>open a task</span></li>
                  <li className="flex items-center gap-2"><Kbd keys={['e']} /> <span>mark it done</span></li>
                </ul>
              </div>
            </div>
            <Footer onBack={() => setStep(1)} busy={busy}>
              <Button variant="primary" disabled={busy} onClick={finish} iconRight={<Icon icon={ArrowRight} size={16} />}>
                {busy ? 'Setting up…' : 'Enter Zenboard'}
              </Button>
            </Footer>
          </StepShell>
        )}
      </div>
    </div>
  );
}

function StepShell({ icon, kicker, title, children }: { icon: IconType; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-1.5 text-caption font-medium uppercase tracking-[0.08em] text-ink-500">
        <Icon icon={icon} size={14} /> {kicker}
      </div>
      <h1 className="mb-5 text-title-1 font-medium text-balance text-ink-900">{title}</h1>
      {children}
    </div>
  );
}

function Footer({ children, onBack, busy }: { children: React.ReactNode; onBack?: () => void; busy?: boolean }) {
  return (
    <div className="mt-7 flex items-center gap-2">
      {onBack && (
        <Button variant="ghost" onClick={onBack} disabled={busy} icon={<Icon icon={ChevronLeft} size={16} />}>
          Back
        </Button>
      )}
      <span className="flex-1" />
      {children}
    </div>
  );
}
