// Built-in project templates (§7E "templates as retention"). A freelancer reruns
// the same engagement over and over; "New project from template" seeds its
// sections and tasks with RELATIVE dates (day 0 / +7 / +14…) so the whole shape
// lands ready to work. Templates live in code — no migration — mirroring
// lib/form-templates.ts. Voice + rules per the constitution: sentence case,
// one concept per name, every task under a real section, kept short.
//
// The plan is a PURE transform (buildTemplatePlan) so it's unit-tested without a
// DB; the server action (createProjectFromTemplate) just inserts what it returns.

export type TemplateTask = {
  title: string;
  /** Section name — must match one of the template's `sections`. */
  section?: string;
  /** Days from creation; the scheduled date skips weekends to the next workday. */
  day?: number;
  priority?: 'low' | 'med' | 'high';
};

export type ProjectTemplate = {
  key: string;
  name: string;
  hint: string;
  /** Gallery grouping (e.g. "Client work"). */
  category: string;
  sections: string[];
  tasks: TemplateTask[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: 'client-onboarding',
    name: 'Client onboarding',
    hint: 'Kick off a new engagement',
    category: 'Client work',
    sections: ['Kickoff', 'Setup'],
    tasks: [
      { title: 'Send the welcome note and intake questionnaire', section: 'Kickoff', day: 0, priority: 'high' },
      { title: 'Draft and send the agreement', section: 'Kickoff', day: 1, priority: 'high' },
      { title: 'Schedule the kickoff call', section: 'Kickoff', day: 1 },
      { title: 'Collect brand assets and account access', section: 'Setup', day: 3 },
      { title: 'Set up the shared folder and project workspace', section: 'Setup', day: 3 },
      { title: 'Confirm scope, milestones, and timeline', section: 'Kickoff', day: 5 },
    ],
  },
  {
    key: 'brand-identity',
    name: 'Brand identity',
    hint: 'Logo and brand system',
    category: 'Client work',
    sections: ['Discovery', 'Design', 'Delivery'],
    tasks: [
      { title: 'Run the brand discovery questionnaire', section: 'Discovery', day: 0, priority: 'high' },
      { title: 'Build the moodboard and pick a direction', section: 'Discovery', day: 3 },
      { title: 'Present three logo directions', section: 'Design', day: 7 },
      { title: 'Refine the chosen direction', section: 'Design', day: 12 },
      { title: 'Write the brand guidelines', section: 'Delivery', day: 18 },
      { title: 'Package and hand off the final assets', section: 'Delivery', day: 21, priority: 'high' },
    ],
  },
  {
    key: 'website-build',
    name: 'Website build',
    hint: 'Design through launch',
    category: 'Client work',
    sections: ['Discovery', 'Design', 'Build', 'Launch'],
    tasks: [
      { title: 'Agree the sitemap and content plan', section: 'Discovery', day: 0 },
      { title: 'Wireframe the key pages', section: 'Discovery', day: 4 },
      { title: 'Design the key pages', section: 'Design', day: 9 },
      { title: 'Build the pages', section: 'Build', day: 16 },
      { title: 'Content load and QA pass', section: 'Build', day: 24 },
      { title: 'Launch and hand over', section: 'Launch', day: 28, priority: 'high' },
    ],
  },
  {
    key: 'content-retainer',
    name: 'Content retainer',
    hint: 'A monthly content cycle',
    category: 'Ongoing',
    sections: ['Plan', 'Produce', 'Review'],
    tasks: [
      { title: "Plan the month's topics", section: 'Plan', day: 0 },
      { title: 'Draft the pieces', section: 'Produce', day: 3 },
      { title: 'Edit and design', section: 'Produce', day: 10 },
      { title: 'Send for client review', section: 'Review', day: 14 },
      { title: 'Schedule and publish', section: 'Review', day: 18, priority: 'high' },
    ],
  },
];

// Resolve a relative day offset to a YYYY-MM-DD date, nudging Sat/Sun to Monday
// so a template's dates never land the freelancer on a weekend.
export function offsetToWorkday(base: Date, days: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  const dow = d.getDay(); // 0 = Sun, 6 = Sat
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type PlannedTask = { title: string; section: string | null; scheduledDate: string; priority: 'low' | 'med' | 'high' };

// Pure: expand a template into the sections + dated tasks to create. Unknown
// section references degrade to loose (null) rather than silently dropping a task.
export function buildTemplatePlan(tpl: ProjectTemplate, base: Date = new Date()): { sections: string[]; tasks: PlannedTask[] } {
  const known = new Set(tpl.sections);
  const tasks: PlannedTask[] = tpl.tasks.map((t) => ({
    title: t.title,
    section: t.section && known.has(t.section) ? t.section : null,
    scheduledDate: offsetToWorkday(base, t.day ?? 0),
    priority: t.priority ?? 'low',
  }));
  return { sections: [...tpl.sections], tasks };
}
