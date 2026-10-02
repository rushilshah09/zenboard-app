'use client';
// First-run onboarding = the first planning ritual (MASTER_PRODUCT_PLAN §7U).
// Three questions, no gallery, no tour: what you do (seeds role + rate) · what's
// live right now (creates a real project + today's first tasks, the first one
// starred) · when your day ends (day-end time). Then land on Home with the plan
// already real. Teaches exactly three keys (⌘K · ⏎ · e). Built on the DS,
// skippable at any point.
import { useState } from 'react';
import { todayISO } from '@/lib/date';
import { Sparkles, ArrowRight, ChevronLeft, Moon, Folder, Users, Target, Flame, type IconType } from '@/components/ds/icons';
import { Button, Icon, Wordmark, StepDots, Field, TextInput, RadioGroup, RadioCard, Kbd, TimePicker, toast } from '@/components/ds/ui';
import { OnboardingPreview } from '@/components/onboarding/onboarding-preview';
import { updateProfile, updatePreferences, type ProfileRole } from '@/lib/actions/profile';
import { defaultModulesForRole } from '@/lib/nav-modules';
import { addProject } from '@/lib/actions/projects';
import { addTask } from '@/lib/actions/tasks';

const ROLES: { id: ProfileRole; label: string; hint: string; icon: IconType }[] = [
  { id: 'freelancer', label: 'Freelancer', hint: 'Clients, projects, invoices', icon: Users },
  { id: 'founder', label: 'Founder', hint: 'Building a company', icon: Target },
  { id: 'individual', label: 'Individual', hint: 'Personal focus & habits', icon: Flame },
];
const TOTAL = 3;
const TASK_PLACEHOLDERS = ['Draft the brief', 'Email the client', 'Sketch three directions'];

export function OnboardingFlow({ email, suggestedName, initialStep = 0, nowHour }: {
  email: string;
  suggestedName: string;
  /** The server's hour — see OnboardingPreview: the greeting must not read the clock in render. */
  nowHour?: number;
  /** Harness-only staging (`app/dev-preview/onboarding`): the server actions reject without a
   *  session, so a step past the first can only be reached by starting there. */
  initialStep?: number;
}) {
  const [step, setStep] = useState(initialStep);
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
    const res = await updateProfile({
      full_name: name.trim() || null,
      role,
      hourly_rate: role === 'freelancer' ? parseFloat(rate) || 0 : undefined,
    }).catch(() => ({ error: 'unreachable' as const }));
    setBusy(false);
    if ('error' in res) {
      toast({ message: 'Could not save that. Your answers are still here. Try again.', variant: 'error' });
      return;
    }
    setStep(1);
  }

  async function finish() {
    setBusy(true);
    const fail = () => {
      toast({ message: 'Could not finish setting up. Your answers are still here. Try again.', variant: 'error' });
      setBusy(false);
    };
    // Make the plan real (§7U): a project + today's first tasks, the first starred.
    let projectId: string | null = null;
    if (projectName.trim()) {
      const p = await addProject({ name: projectName.trim() }).catch(() => ({ error: 'unreachable' as const }));
      if ('error' in p) return fail();
      projectId = p.id;
    }
    for (let i = 0; i < filledTasks.length; i++) {
      const t = await addTask({ title: filledTasks[i], projectId, scheduledDate: todayISO(), highlight: i === 0 })
        .catch(() => ({ error: 'unreachable' as const }));
      if (t && typeof t === 'object' && 'error' in t) return fail();
    }
    // THE ROLE FINALLY DOES SOMETHING. Until now "What brings you here?" was
    // written to profiles.role and read by exactly one line (whether to ask for
    // an hourly rate), so somebody who chose "Personal focus & habits" still got
    // Clients, Finance, Forms, Messages and Content in their sidebar — and no way
    // to remove them. This seeds the rail from their answer; every module stays
    // one tick away in Sidebar control. Same round trip as `dayEnd`, because a
    // round trip is the whole cost here.
    const prefs = await updatePreferences({ dayEnd, navModules: defaultModulesForRole(role) })
      .catch(() => ({ error: 'unreachable' as const }));
    if ('error' in prefs) return fail();
    const done = await updateProfile({ onboarding_complete: true }).catch(() => ({ error: 'unreachable' as const }));
    if ('error' in done) return fail();
    // Hard nav so the (app) shell re-reads the fresh profile + the seeded plan.
    window.location.assign('/today');
  }

  async function skip() {
    setBusy(true);
    // Skipping still has to WRITE `onboarding_complete` — an unchecked skip that failed handed the
    // same person this same flow at their next sign-in.
    const res = await updateProfile({ full_name: name.trim() || null, role: role ?? undefined, onboarding_complete: true })
      .catch(() => ({ error: 'unreachable' as const }));
    // Seed the rail ONLY if they told us who they are before skipping. With no
    // role we know nothing, so we write nothing and the account stays
    // unconfigured — which renders every module. Guessing a shape for someone who
    // declined to answer is how a skip turns into six missing features.
    if (!('error' in res) && role) {
      // Not awaited into the failure path: they asked to leave. A rail that has
      // to be adjusted once is a smaller cost than a skip that refuses to skip.
      void updatePreferences({ navModules: defaultModulesForRole(role) }).catch(() => {});
    }
    if ('error' in res) {
      toast({ message: 'Could not skip just now. Try again in a moment.', variant: 'error' });
      setBusy(false);
      return;
    }
    window.location.assign('/today');
  }

  const preview = { step, name, role, projectName, tasks, dayEnd, nowHour };

  return (
    // The desk, and two sheets lying on it: the questions, and the day they are building. Below
    // `lg` the preview drops away rather than stacking — on a phone the questions are the only
    // thing worth the screen, and a picture above them would push the field off it. Same shell as
    // the sign-up screen, because signing up and setting up are one arrival.
    <div className="grid min-h-[100dvh] grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-w-0 flex-col overflow-hidden">
        {/* One header row: who this is, how far along, and the way out. */}
        <header className="flex items-center gap-3 px-7 py-5">
          <Wordmark />
          <div className="flex-1" />
          {/* A dash per step and the count — the shape the reference uses, and the
              one the DS now owns (the words live in its accessible name). */}
          <StepDots current={step + 1} total={TOTAL} />
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="focus-ring rounded-sm px-2 py-1 text-caption text-ink-500 transition-colors hover:text-ink-800 disabled:text-ink-500"
          >
            Skip setup
          </button>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 pb-10">
          <div className="zb-enter w-[min(460px,100%)]" style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>

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
                    <RadioCard key={r.id} value={r.id} label={r.label} description={r.hint} icon={<Icon icon={r.icon} size={16} />} />
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
              <Button variant="brand" size="lg" fullWidth disabled={!name.trim() || !role} loading={busy} onClick={saveIdentity} iconRight={<Icon icon={ArrowRight} size={16} />}>
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
              <Button variant="brand" size="lg" disabled={busy} onClick={() => setStep(2)} iconRight={<Icon icon={ArrowRight} size={16} />}>
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
                <TimePicker aria-label="Day ends at" className="w-40" value={dayEnd} onValueChange={setDayEnd} />
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
              <Button variant="brand" size="lg" loading={busy} onClick={finish} iconRight={<Icon icon={ArrowRight} size={16} />}>
                Enter Zenboard
              </Button>
            </Footer>
          </StepShell>
        )}
          </div>
        </div>

        {/* What the product is, in its own words — the line the browser tab already
            carries, and the same one the sign-up sheet ends with. It said "calm"
            here and "quiet" there; one product, one sentence. */}
        <footer className="px-7 py-5 text-label text-ink-500">A quiet operating system for your work and life.</footer>
      </div>

      <OnboardingPreview state={preview} />
    </div>
  );
}

function StepShell({ icon, kicker, title, children }: { icon: IconType; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-1.5 text-overline text-ink-500">
        <Icon icon={icon} size={14} /> {kicker}
      </div>
      <h1 className="font-editorial mb-5 text-title-1 font-medium text-balance text-ink-900">{title}</h1>
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
