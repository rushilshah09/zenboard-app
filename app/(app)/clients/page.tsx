// Clients — a calm CRM (clients + per-client notes), a lightweight lead pipeline,
// and each client's linked projects + invoices.
import { ClientsView, type ClientCard, type Lead } from '@/components/clients/clients-view';
import { type FeedbackItem } from '@/components/feedback/feedback-board';
import { type MeetingItem } from '@/components/meetings/meeting-panel';
import { type MeetingTaskRow } from '@/lib/meeting-actions';
import { currentProfile } from '@/lib/profile';
import { readPropLayout } from '@/lib/property-layout';
import { PageStamp } from '@/components/shell/page-stamp';
import { pageScope } from '@/lib/page-scope';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const { supabase, sid } = await pageScope();
  // ONE wave for everything that does not need another answer first. The forms,
  // their response tallies and the meeting→task edges used to follow this in
  // series, one round trip each. Responses are asked for without the forms'
  // ids: RLS scopes them to this person and a tally is only ever read for a
  // client form below, so the wider read changes no number, and the rows stay
  // on the server.
  const [
    { data: clients }, { data: notes }, { data: leads }, { data: projects }, { data: tasks }, { data: invoices },
    { data: items }, { data: fb }, { data: fbLinks }, { data: mtgs }, { data: formRows }, { data: respRows },
    { data: edgeRows, error: edgeErr },
  ] = await Promise.all([
    supabase.from('clients').select('id, name, role, contact, email, status, health, since, next_step, created_at').eq('space_id', sid).order('created_at'),
    supabase.from('client_notes').select('id, client_id, body, created_at').order('created_at', { ascending: false }),
    supabase.from('leads').select('id, name, contact, value, stage, source, note, created_at').order('created_at'),
    supabase.from('projects').select('id, name, color, client_id, status').eq('space_id', sid).not('client_id', 'is', null),
    supabase.from('tasks').select('project_id, done').eq('space_id', sid).not('project_id', 'is', null),
    supabase.from('invoices').select('id, number, client_id, status').not('client_id', 'is', null),
    supabase.from('invoice_items').select('invoice_id, quantity, unit_amount'),
    // Feedback + its deal links + meetings. These no-op (data:null) until 0016 is applied.
    supabase.from('feedback').select('id, number, title, body, status, source, client_id, meeting_id, task_id, created_at').order('created_at', { ascending: false }),
    supabase.from('feedback_deals').select('feedback_id, lead_id'),
    supabase.from('meetings').select('id, client_id, title, notes, met_at, created_at').order('met_at', { ascending: false }),
    // Forms + their response tallies. Both no-op (data:null) until 0020 is applied,
    // so the Forms section simply shows its empty state until then.
    supabase.from('forms').select('id, title, status, share_token, updated_at, client_id')
      .not('client_id', 'is', null).order('updated_at', { ascending: false }),
    supabase.from('form_responses').select('form_id, status'),
    // What each meeting has already turned into (PRODUCT_THINKING §8). The link is
    // a `mentions` edge, so this needs no column of its own — and an error here is
    // the 0027-shaped one, which turns the affordance off rather than breaking the
    // page (the same fetch-time capability pattern as `mentionsSupported`).
    supabase.from('mentions').select('source_id, target_id').eq('source_type', 'meeting').eq('target_type', 'task'),
  ]);

  const forms = (formRows as { id: string; title: string; status: 'draft' | 'live' | 'closed'; share_token: string | null; updated_at: string; client_id: string }[]) ?? [];
  const respTally = new Map<string, { responses: number; partials: number }>();
  for (const r of (respRows as { form_id: string; status: string }[]) ?? []) {
    const cur = respTally.get(r.form_id) ?? { responses: 0, partials: 0 };
    if (r.status === 'complete') cur.responses += 1; else cur.partials += 1;
    respTally.set(r.form_id, cur);
  }
  const formsByClient = new Map<string, ClientCard['forms']>();
  for (const f of forms) {
    const list = formsByClient.get(f.client_id) ?? [];
    list.push({
      id: f.id, title: f.title, status: f.status, shareToken: f.share_token, updatedAt: f.updated_at,
      responses: respTally.get(f.id)?.responses ?? 0, partials: respTally.get(f.id)?.partials ?? 0,
    });
    formsByClient.set(f.client_id, list);
  }

  const ns = (notes as { id: string; client_id: string; body: string; created_at: string }[]) ?? [];
  const ts = (tasks as { project_id: string; done: boolean }[]) ?? [];
  const its = (items as { invoice_id: string; quantity: number; unit_amount: number }[]) ?? [];
  const projs = ((projects as { id: string; name: string; color: string | null; client_id: string; status: string }[]) ?? []).map((p) => {
    const mine = ts.filter((t) => t.project_id === p.id);
    return { id: p.id, name: p.name, color: p.color, client_id: p.client_id, status: p.status, open: mine.filter((t) => !t.done).length, total: mine.length };
  });
  const invs = ((invoices as { id: string; number: string; client_id: string; status: string }[]) ?? []).map((inv) => ({
    id: inv.id, number: inv.number, client_id: inv.client_id, status: inv.status,
    amount: its.filter((i) => i.invoice_id === inv.id).reduce((a, i) => a + Number(i.quantity) * Number(i.unit_amount), 0),
  }));

  const withRelations: ClientCard[] = ((clients as Omit<ClientCard, 'notes' | 'projects' | 'invoices' | 'forms'>[]) ?? []).map((c) => ({
    ...c,
    notes: ns.filter((n) => n.client_id === c.id),
    projects: projs.filter((p) => p.client_id === c.id),
    invoices: invs.filter((i) => i.client_id === c.id),
    forms: formsByClient.get(c.id) ?? [],
  }));

  // Feedback with its revenue rollup — attach each linked deal's value.
  const leadRows = (leads as Lead[]) ?? [];
  const links = (fbLinks as { feedback_id: string; lead_id: string }[]) ?? [];
  const feedbackItems: FeedbackItem[] = ((fb as Omit<FeedbackItem, 'deals'>[]) ?? []).map((f) => ({
    ...f,
    deals: links
      .filter((l) => l.feedback_id === f.id)
      .map((l) => leadRows.find((d) => d.id === l.lead_id))
      .filter((d): d is Lead => Boolean(d))
      .map((d) => ({ id: d.id, name: d.name, value: d.value })),
  }));

  const meetingRows = (mtgs as MeetingItem[]) ?? [];

  // The edges came with the first wave. Their tasks are the one read here that
  // truly depends on another answer, and an account with no edges skips it.
  const meetingTasksSupported = !edgeErr;
  const edges = (edgeRows as { source_id: string; target_id: string }[]) ?? [];
  const { data: mTaskRows } = edges.length
    ? await supabase.from('tasks').select('id, title, done, project_id').in('id', edges.map((e) => e.target_id))
    : { data: [] };
  const mTasks = new Map(((mTaskRows as { id: string; title: string; done: boolean; project_id: string | null }[]) ?? []).map((t) => [t.id, t]));
  // A dangling edge (the task was deleted) is DROPPED, not shown as a tombstone:
  // this list is "what this meeting produced that still exists", and an item
  // whose task is gone should be offered for promotion again.
  const meetingTasks: MeetingTaskRow[] = edges.flatMap((e) => {
    const t = mTasks.get(e.target_id);
    return t ? [{ meetingId: e.source_id, taskId: t.id, title: t.title, done: t.done, projectId: t.project_id }] : [];
  });

  return (
    <>
      <PageStamp />
      <ClientsView
        initialClients={withRelations} initialLeads={leadRows}
        initialFeedback={feedbackItems} initialMeetings={meetingRows}
        initialMeetingTasks={meetingTasks} meetingTasksSupported={meetingTasksSupported}
        // Not a round trip: `currentProfile` is request-cached and the (app)
        // layout has already awaited it for the name, timezone and pins.
        propertyLayout={readPropLayout((await currentProfile())?.preferences, 'client')}
      />
    </>
  );
}
