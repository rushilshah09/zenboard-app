// Measurement tool only — never imported by the app.
//
// A deterministic, plausible "established studio" account for the mock
// Supabase: one space, 8 projects, ~170 tasks, 25 docs with real block bodies,
// 120 days of habit history. Shapes follow the columns the app selects. Ids
// are deterministic, so every run serves byte-identical data. "Today" is the
// fixture user's own calendar date (Asia/Kolkata), so Home and Focus have a
// real day to show whenever the harness runs.
'use strict';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER_EMAIL = 'mock-studio@example.test';
const SPACE_ID = '00000000-0000-4000-8000-0000000000a1';
const TIME_ZONE = 'Asia/Kolkata';

function buildFixtures() {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let idn = 1000;
  const uid = () => `10000000-0000-4000-8000-${(idn++).toString(16).padStart(12, '0')}`;
  const TODAY = process.env.MOCK_TODAY
    || new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = (off) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
  const ts = (off, hh = 10) => `${day(off)}T${String(hh).padStart(2, '0')}:00:00+00:00`;
  const WORDS = ['brief', 'review', 'draft', 'shoot', 'edit', 'invoice', 'proposal', 'call', 'moodboard', 'storyboard', 'copy', 'deck', 'sync', 'plan', 'retouch', 'deliver', 'feedback', 'scope', 'budget', 'contract'];
  const title = (n = 3) => { const w = Array.from({ length: n }, () => pick(WORDS)); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(' '); };
  const PARA = 'We agreed to keep the first cut short and let the client react to motion before sound. The second pass adds captions, colour and the product close-up the brand team asked for on Tuesday.';

  const db = {};
  db.spaces = [{ id: SPACE_ID, user_id: USER_ID, name: 'Studio', emoji: '🌿', color: '#7B8B5F', tag: 'WORK', sort_order: 0 }];
  const clients = Array.from({ length: 6 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, name: ['Northwind', 'Acme Foods', 'Lumen Labs', 'Kestrel', 'Oakhouse', 'Parallel'][i], role: 'Marketing lead', contact: 'Sam', email: `c${i}@client.test`, status: 'active', health: pick(['good', 'watch']), since: day(-200 + i * 20), next_step: 'Send revised scope', created_at: ts(-300 + i) }));
  db.clients = clients;
  const projects = Array.from({ length: 8 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, name: ['Spring campaign', 'Brand refresh', 'Product launch film', 'Website', 'Social retainer', 'Annual report', 'Podcast', 'Packaging'][i], color: pick(['#E5484D', '#3E63DD', '#30A46C', '#F76B15', '#8E4EC6']), status: i < 6 ? 'active' : 'paused', client_id: i < 5 ? clients[i].id : null, created_at: ts(-120 + i * 5), updated_at: ts(-2), icon: null, deadline: day(20 + i * 7), deadline_label: 'Launch', portal_enabled: i < 2, portal_token: i < 2 ? `ptok${i}` : null, share_progress: true, share_completed_tasks: false, share_open_tasks: true, share_timeline: true, share_files: false, share_invoices: false, allow_requests: true, portal_intro: null }));
  db.projects = projects;
  const sections = projects.slice(0, 5).flatMap((p) => ['Discovery', 'Production'].map((n, j) => ({ id: uid(), user_id: USER_ID, project_id: p.id, name: n, sort_order: j, client_visible: j === 0, status: j === 0 ? 'done' : 'active', due_date: day(10 + j * 10) })));
  db.sections = sections;
  const tasks = [];
  const mk = (o) => { const t = { id: uid(), user_id: USER_ID, space_id: SPACE_ID, title: title(pick([2, 3, 4])), notes: null, priority: pick(['low', 'med', 'high']), done: false, highlight: false, scheduled_date: null, due_date: null, is_inbox: false, estimate_minutes: pick([null, 15, 30, 60, 90]), elapsed_minutes: 0, recurrence: null, completed_at: null, sort_order: tasks.length, created_at: ts(-60 + (tasks.length % 60)), updated_at: ts(-1), project_id: null, parent_task_id: null, goal_id: null, list_id: null, section_id: null, client_visible: false, remind_at: null, reminded_at: null, status: null, event_id: null, request_id: null, ...o }; tasks.push(t); return t; };
  for (let i = 0; i < 8; i++) mk({ scheduled_date: TODAY, project_id: i % 2 ? pick(projects).id : null });
  mk({ highlight: true }); mk({ highlight: true, project_id: projects[0].id });
  for (let i = 0; i < 3; i++) mk({ scheduled_date: day(-1) });
  for (let i = 0; i < 20; i++) mk({ scheduled_date: day(1 + (i % 6)), project_id: i % 3 ? pick(projects).id : null });
  for (let i = 0; i < 10; i++) mk({ is_inbox: true });
  for (let i = 0; i < 45; i++) { const p = projects[i % 6]; const s = sections.find((x) => x.project_id === p.id && x.sort_order === i % 2); mk({ project_id: p.id, section_id: s ? s.id : null, due_date: i % 4 === 0 ? day(3 + i) : null }); }
  for (let i = 0; i < 40; i++) mk({ done: true, completed_at: ts(-(i % 20)), scheduled_date: day(-(i % 20)), project_id: i % 2 ? pick(projects).id : null });
  const parents = tasks.filter((t) => t.project_id && !t.done).slice(0, 14);
  for (const p of parents) for (let k = 0; k < 3; k++) mk({ parent_task_id: p.id, project_id: p.project_id, done: k === 0, title: title(2) });
  db.tasks = tasks;
  db.task_links = [{ id: uid(), task_id: tasks[2].id, blocked_by_task_id: tasks[30].id, user_id: USER_ID }];
  db.labels = ['Urgent', 'Client', 'Admin', 'Creative'].map((n, i) => ({ id: uid(), name: n, color: pick(['red', 'blue', 'green']), sort_order: i, space_id: SPACE_ID, user_id: USER_ID }));
  db.task_labels = tasks.slice(0, 10).map((t, i) => ({ task_id: t.id, label_id: db.labels[i % 4].id, user_id: USER_ID }));
  db.task_lists = [{ id: uid(), name: 'Errands', color: null, sort_order: 0, space_id: SPACE_ID, user_id: USER_ID }, { id: uid(), name: 'Reading', color: null, sort_order: 1, space_id: SPACE_ID, user_id: USER_ID }];
  db.saved_views = [{ id: uid(), name: 'This week', filter: { view: 'upcoming' }, sort_order: 0, space_id: SPACE_ID, user_id: USER_ID }];
  db.calendar_events = Array.from({ length: 10 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, title: pick(['Client call', 'Crit', 'Shoot', 'Review', 'Standup']), starts_at: ts(i - 3, 9 + (i % 6)), ends_at: ts(i - 3, 10 + (i % 6)), all_day: i === 7, source: i % 4 === 0 ? 'google' : 'manual', task_id: null, color: null, description: null, location: null }));
  for (let i = 0; i < 3; i++) db.calendar_events.push({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, title: 'Focus block', starts_at: ts(0, 5 + i * 2), ends_at: ts(0, 6 + i * 2), all_day: false, source: 'manual', task_id: null, color: null, description: null, location: null });
  db.habits = ['Morning pages', 'Walk', 'Read 20 min', 'Inbox zero', 'Stretch'].map((t, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, title: t, schedule_kind: 'daily', schedule_days: null, schedule_count: null, active: true, created_at: ts(-150 + i), time_of_day: 'any', goal_target: null, goal_period: null, sort_order: i, archived: false, color: null }));
  db.habit_logs = db.habits.flatMap((h, hi) => Array.from({ length: 120 }, (_, d) => ({ id: uid(), user_id: USER_ID, habit_id: h.id, log_date: day(-d), done: (d + hi) % 3 !== 0, count: null, status: 'done' })).filter((l) => l.done));
  db.rituals = [{ id: uid(), user_id: USER_ID, type: 'daily_plan', ritual_date: TODAY, completed_at: ts(0, 3), highlight_task_id: null }];
  db.goals = Array.from({ length: 4 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, title: pick(['Grow retainer revenue', 'Ship the reel', 'Hire an editor', 'Launch the course']), note: null, horizon: pick(['month', 'quarter', 'year']), target_date: day(60 + i * 30), status: 'active', progress: 20 * i, project_id: projects[i].id, retro: null, behind: i === 1, progress_at_review: null, created_at: ts(-90 + i) }));
  db.milestones = db.goals.flatMap((g) => [0, 1].map((k) => ({ id: uid(), user_id: USER_ID, goal_id: g.id, project_id: null, title: title(2), done: k === 0, due_date: null, sort_order: k, migrated_at: null })));
  db.invoices = Array.from({ length: 10 }, (_, i) => ({ id: uid(), user_id: USER_ID, number: `INV-${String(i + 1).padStart(3, '0')}`, client_id: clients[i % 5].id, project_id: projects[i % 5].id, status: ['paid', 'paid', 'sent', 'overdue', 'draft'][i % 5], due_date: day(-20 + i * 5), issue_date: day(-40 + i * 5), notes: null, created_at: ts(-40 + i * 5) }));
  db.invoice_items = db.invoices.flatMap((inv) => [0, 1, 2].map((k) => ({ id: uid(), invoice_id: inv.id, description: title(3), quantity: 1 + k, unit_amount: 250 + 100 * k, time_entry_id: null, sort_order: k })));
  db.payments = db.invoices.filter((x) => x.status === 'paid').map((inv, i) => ({ id: uid(), user_id: USER_ID, invoice_id: inv.id, amount: 1200 + 100 * i, paid_on: day(-10 - i), method: 'bank' }));
  db.time_entries = Array.from({ length: 40 }, (_, i) => ({ id: uid(), user_id: USER_ID, project_id: projects[i % 6].id, task_id: null, minutes: 30 + (i % 5) * 15, started_at: ts(-(i % 20), 9), billed: i % 3 === 0, billable: true, invoiced_invoice_id: null }));
  db.project_activity = Array.from({ length: 30 }, (_, i) => ({ id: uid(), user_id: USER_ID, project_id: projects[i % 6].id, type: pick(['note', 'status', 'client_update']), body: PARA.slice(0, 80 + (i % 5) * 20), created_at: ts(-(i % 25), 12) }));
  db.client_notes = clients.flatMap((c) => [0, 1].map((k) => ({ id: uid(), user_id: USER_ID, client_id: c.id, body: PARA, created_at: ts(-30 + k) })));
  db.leads = Array.from({ length: 6 }, (_, i) => ({ id: uid(), user_id: USER_ID, name: `Lead ${i + 1}`, contact: 'Alex', value: 2000 + i * 1500, stage: pick(['new', 'qualified', 'proposal', 'won']), source: 'referral', note: null, created_at: ts(-50 + i) }));
  db.meetings = clients.slice(0, 4).map((c, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, client_id: c.id, title: 'Kick-off', notes: `${PARA} ${PARA}`, met_at: ts(-10 - i), created_at: ts(-10 - i) }));
  db.feedback = Array.from({ length: 5 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, number: i + 1, title: title(4), body: PARA, status: pick(['open', 'planned']), source: 'call', client_id: clients[i % 4].id, meeting_id: db.meetings[i % 4].id, task_id: null, created_at: ts(-20 + i) }));
  db.feedback_deals = [{ feedback_id: db.feedback[0].id, lead_id: db.leads[0].id, user_id: USER_ID }];
  db.mentions = db.meetings.slice(0, 3).map((m, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, source_type: 'meeting', source_id: m.id, target_type: 'task', target_id: tasks[40 + i].id, anchor: null, created_at: ts(-5) }));
  db.approvals = [{ id: uid(), project_id: projects[0].id, page_id: null, title: 'Storyboard v2', status: 'awaiting', note: null, created_at: ts(-3) }, { id: uid(), project_id: projects[1].id, page_id: null, title: 'Logo lockup', status: 'approved', note: null, created_at: ts(-12) }];
  db.client_requests = [0, 1, 2].map((i) => ({ id: uid(), project_id: projects[i].id, name: 'Client', title: title(3), body: PARA, status: ['pending', 'needs_info', 'approved'][i], client_id: clients[i].id, task_id: null, resolution_note: null, created_at: ts(-6 + i), updated_at: ts(-2) }));
  db.request_messages = db.client_requests.flatMap((r) => [0, 1].map((k) => ({ id: uid(), request_id: r.id, author: k ? 'team' : 'client', body: PARA.slice(0, 120), client_facing: true, created_at: ts(-5 + k) })));
  db.forms = [0, 1, 2].map((i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, title: ['Project intake', 'Feedback survey', 'Shoot brief'][i], description: null, status: ['live', 'draft', 'closed'][i], share_token: `ftok${i}`, updated_at: ts(-7 + i), client_id: i === 0 ? clients[0].id : null, project_id: i === 1 ? projects[1].id : null, content: { fields: [] }, settings: {}, version: 1, show_in_portal: false }));
  db.form_responses = Array.from({ length: 12 }, (_, i) => ({ id: uid(), form_id: db.forms[i % 3].id, status: i % 4 ? 'complete' : 'partial', created_at: ts(-(i % 10)), task_id: null }));
  db.folders = ['Clients', 'Templates', 'Internal', 'Archive'].map((n, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, name: n, parent_folder_id: null, sort_order: i, created_at: ts(-200 + i) }));
  const blocks = (n) => Array.from({ length: n }, (_, k) => ({ id: `b${idn}-${k}`, type: k === 0 ? 'h2' : k % 5 === 0 ? 'todo' : 'text', text: k === 0 ? 'Overview' : PARA, checked: false }));
  db.pages = [
    ...Array.from({ length: 20 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, folder_id: i % 3 ? db.folders[i % 4].id : null, parent_id: null, title: `${title(2)} notes`, type: i === 3 ? 'template' : 'doc', content: { blocks: blocks(8 + (i % 10) * 2) }, tags: [], updated_at: ts(-(i % 15)), created_at: ts(-60 + i), sort_index: i, is_pinned: i === 0, is_favorite: i === 1, archived_at: null, icon: null, project_id: i % 4 === 0 ? projects[i % 6].id : null, client_id: null, database_id: null, client_visible: false })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: uid(), user_id: USER_ID, space_id: SPACE_ID, folder_id: null, parent_id: null, title: `Reel ${i + 1}`, type: 'content', content: { pipeline: { stage: pick(['idea', 'script', 'shoot', 'edit']), format: 'reel', shootAt: day(i), publishAt: day(i + 3) }, blocks: blocks(6) }, tags: [], updated_at: ts(-i), created_at: ts(-30 + i), sort_index: 100 + i, is_pinned: false, is_favorite: false, archived_at: null, icon: null, project_id: null, client_id: null, database_id: null, client_visible: false })),
  ];
  db.profiles = [{ id: USER_ID, full_name: 'Mock Studio', avatar_url: null, onboarding_complete: true, hourly_rate: 120, preferences: { timezone: TIME_ZONE, pins: [{ type: 'project', id: projects[0].id, label: projects[0].name }], gcal_connected: false }, created_at: ts(-300), updated_at: ts(-1) }];
  db.notifications = Array.from({ length: 5 }, (_, i) => ({ id: uid(), user_id: USER_ID, kind: 'request', title: 'New client request', body: PARA.slice(0, 60), link: '/projects', read: i > 1, created_at: ts(-i) }));
  for (const t of ['comments', 'attachments', 'acceptances', 'memories', 'collections', 'collection_rows', 'page_links', 'page_versions', 'calendar_connections', 'task_comments', 'task_activity', 'portal_links', 'portal_requests', 'page_templates', 'ai_conversations', 'ai_messages', 'form_versions']) db[t] = [];
  return db;
}

module.exports = { buildFixtures, USER_ID, USER_EMAIL, SPACE_ID, TIME_ZONE };
