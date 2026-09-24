'use client';
// Form → Settings, as a PLACE (its own route + tab) rather than a rail you
// toggled from the builder.
//
// Structure follows DESIGN_REFERENCES R1 (Cloudflare Workers → Settings): grouped
// sections, each with a one-line description explaining why it exists, and a
// uniform `label | value | edit` row. The point of that grammar is scannability —
// you can read what this form is currently set to by running down one column.
// A page of expanded inputs shows you controls, not answers.
//
// Switches keep their control and toggle in place: a Switch already IS its own
// value, so giving it a pencil would add a click for nothing (R1 "Refuse").
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from '@/components/ds/icons';
import {
  Button, Icon, IconButton, Switch, TextInput, Textarea, SegmentedControl,
  SettingsSection, SettingsRow, toast,
 DatePicker,} from '@/components/ds/ui';
import { updateForm, setFormStatus, setFormInPortal } from '@/lib/actions/forms';
import type { FormSettings } from '@/lib/form-schema';
import { formatDay } from '@/lib/date';

type Props = {
  formId: string;
  initial: FormSettings;
  status: 'draft' | 'live' | 'closed';
  questionCount: number;
  canPortal: boolean;
  inPortal: boolean;
};

export function FormSettingsPage({ formId, initial, status: initialStatus, questionCount, canPortal, inPortal: initialInPortal }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<FormSettings>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [inPortal, setInPortal] = useState(initialInPortal);
  const [editing, setEditing] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave, same 800ms rhythm as every other autosaving surface
  // (INTERACTION_STANDARDS §2.3) — no Save button for single fields.
  //
  // The pending value is passed INTO queueSave rather than read back from a ref.
  // Mirroring state into a ref during render is a render-phase write; here it is
  // also unnecessary, since `set` already computes the next value in an event
  // handler where `settings` is the current one.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function queueSave(next: FormSettings) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await updateForm(formId, { settings: next });
      if (res && 'error' in res) toast({ message: res.error, variant: 'error' });
    }, 800);
  }
  const set = (patch: Partial<FormSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    queueSave(next);
  };

  // A row being edited swaps its value for the field; committing closes it. One
  // row at a time, so the page never turns back into a wall of inputs.
  const editor = (key: string, field: React.ReactNode) => (
    <div className="flex items-center gap-1.5">
      {field}
      <IconButton label="Done" variant="ghost" size="xs" icon={<Icon icon={Check} size={14} />} onClick={() => setEditing(null)} />
    </div>
  );
  const isEditing = (key: string) => editing === key;

  async function changeStatus(next: 'live' | 'closed') {
    const prev = status;
    setStatus(next);
    const res = await setFormStatus(formId, next);
    if (res && 'error' in res) { setStatus(prev); toast({ message: res.error, variant: 'error' }); return; }
    toast({ message: next === 'closed' ? 'No longer accepting responses.' : 'Form reopened.' });
    router.refresh();
  }

  async function changePortal(next: boolean) {
    setInPortal(next);
    const res = await setFormInPortal(formId, next);
    if (res && 'error' in res) { setInPortal(!next); toast({ message: res.error, variant: 'error' }); }
  }

  const closeAtLabel = settings.closeAt
    ? formatDay(settings.closeAt)
    : 'Never';

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-5 py-8 sm:px-8">
      <SettingsSection
        title="Filling"
        description="How the form behaves for the person answering it."
      >
        <SettingsRow
          title="Layout"
          description={settings.mode === 'focus'
            ? 'One question at a time — best for anything longer than a few questions.'
            : 'The whole form on one calm page.'}
          control={
            <SegmentedControl
              aria-label="Filling mode"
              value={settings.mode ?? 'page'}
              onValueChange={(v) => set({ mode: v === 'focus' ? 'focus' : 'page' })}
              options={[{ value: 'page', label: 'One page' }, { value: 'focus', label: 'One question' }]}
            />
          }
        />
        <SettingsRow
          title="Thank-you message"
          description="Shown once they submit."
          value={isEditing('thanks') ? undefined : (settings.thanks?.trim() || 'Default')}
          onEdit={isEditing('thanks') ? undefined : () => setEditing('thanks')}
          layout={isEditing('thanks') ? 'stack' : 'inline'}
          control={isEditing('thanks')
            ? editor('thanks', (
                <Textarea
                  autoFocus rows={3} className="w-full"
                  value={settings.thanks ?? ''}
                  placeholder="Thank you. Your response has been sent."
                  aria-label="Thank-you message"
                  onChange={(e) => set({ thanks: e.target.value })}
                />
              ))
            : undefined}
        />
      </SettingsSection>

      <SettingsSection
        title="Access"
        description="Who can answer, and for how long."
      >
        <SettingsRow
          title="Ask who they are"
          description="Adds name and email at the end."
          control={<Switch checked={!!settings.collectIdentity} onCheckedChange={(v) => set({ collectIdentity: v })} />}
        />
        <SettingsRow
          title="Spam check"
          description="Adds a Cloudflare Turnstile challenge before someone can submit."
          control={<Switch checked={!!settings.turnstile} onCheckedChange={(v) => set({ turnstile: v })} />}
        />
        <SettingsRow
          title="Response limit"
          description="Stop accepting once this many arrive."
          value={isEditing('limit') ? undefined : (settings.limit ? `${settings.limit} responses` : 'No limit')}
          onEdit={isEditing('limit') ? undefined : () => setEditing('limit')}
          control={isEditing('limit')
            ? editor('limit', (
                <TextInput
                  autoFocus size="sm" inputMode="numeric" unit="responses" aria-label="Response limit"
                  value={settings.limit ? String(settings.limit) : ''}
                  placeholder="No limit"
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    set({ limit: Number.isFinite(n) && n > 0 ? n : null });
                  }}
                />
              ))
            : undefined}
        />
        <SettingsRow
          title="Close on"
          description="After this date the form stops accepting responses."
          value={isEditing('closeAt') ? undefined : closeAtLabel}
          onEdit={isEditing('closeAt') ? undefined : () => setEditing('closeAt')}
          control={isEditing('closeAt')
            ? editor('closeAt', (
                <DatePicker
                  aria-label="Close on" className="w-[168px]"
                  value={settings.closeAt ?? null}
                  onValueChange={(iso) => set({ closeAt: iso || null })}
                />
              ))
            : undefined}
        />
        <SettingsRow
          title="Accepting responses"
          description={status === 'draft' ? 'Publish the form to start collecting.' : status === 'live' ? 'The link is open.' : 'The link shows a closed notice.'}
          value={status === 'draft' ? 'Not published' : status === 'live' ? 'Open' : 'Closed'}
          control={status === 'live' ? (
            <Button variant="secondary" size="sm" onClick={() => changeStatus('closed')}>Stop</Button>
          ) : status === 'closed' ? (
            <Button variant="secondary" size="sm" onClick={() => changeStatus('live')}>Reopen</Button>
          ) : undefined}
        />
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="What happens when a response lands."
      >
        <SettingsRow
          title="Email me"
          description="A note to your account email when someone completes it."
          control={<Switch checked={!!settings.notifyByEmail} onCheckedChange={(v) => set({ notifyByEmail: v })} />}
        />
        <SettingsRow
          title="Webhook"
          description="Each completed response is POSTed here as JSON."
          value={isEditing('webhook') ? undefined : (settings.webhookUrl || 'Off')}
          onEdit={isEditing('webhook') ? undefined : () => setEditing('webhook')}
          layout={isEditing('webhook') ? 'stack' : 'inline'}
          control={isEditing('webhook')
            ? editor('webhook', (
                <TextInput
                  autoFocus size="sm" type="url" className="w-full" aria-label="Webhook URL"
                  value={settings.webhookUrl ?? ''}
                  placeholder="https://…"
                  onChange={(e) => set({ webhookUrl: e.target.value.trim() || null })}
                />
              ))
            : undefined}
        />
      </SettingsSection>

      {canPortal && (
        <SettingsSection
          title="Client portal"
          description="Whether this form appears in the project's portal."
        >
          <SettingsRow
            title="Show in the portal"
            description={status === 'live'
              ? 'Appears under Forms for this project’s client.'
              : 'Publish the form to surface it.'}
            control={<Switch checked={inPortal} onCheckedChange={changePortal} />}
          />
        </SettingsSection>
      )}

      <SettingsSection
        title="Payments"
        description="Charge a deposit or fee when someone submits."
      >
        {/* On hold until we pick a provider available in India (Stripe isn't;
            Razorpay is the likely choice). The schema and renderer stay dormant
            so wiring a provider later just re-enables this row. */}
        <SettingsRow
          title="Collect a payment"
          description="Provider setup is on the way."
          value="Coming soon"
        />
      </SettingsSection>

      <p className="text-meta text-ink-500">
        {questionCount} question{questionCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}
