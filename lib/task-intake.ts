// THE one rule for a task that arrives from somewhere else in Zenboard — a form
// response, a client request, a meeting's action item. "Intake", not creation:
// you did not sit down to write this task, something you already had turned into
// one, and that is a different set of defaults from the task composer's.
//
// Three rules, each of which was already decided somewhere and is now decided
// here:
//
//   1. NO SCHEDULED DATE. `addTask` puts a task on TODAY unless it is going to
//      Inbox, which is right for a task you just typed into a day. It is wrong
//      here: agreeing to something in a Tuesday call is not agreeing to do it on
//      Tuesday, and silently loading someone's day is the fastest way to make
//      them stop trusting the plan. `lib/actions/portal.ts` and
//      `lib/actions/forms.ts` both already omit it; this writes it down.
//
//   2. A PROJECT OR THE INBOX, never neither. A task with no project and no
//      inbox flag is in no pile at all (lib/task-scopes.ts) — it exists and
//      appears nowhere, which is worse than not creating it.
//
//   3. A TITLE THAT ALWAYS EXISTS, clamped. Intake titles come from prose a
//      human wrote for another purpose, so they can be empty or enormous.
export const INTAKE_TITLE_MAX = 200;

export type IntakeTaskFields = {
  user_id: string;
  space_id: string;
  project_id: string | null;
  title: string;
  is_inbox: boolean;
};

export function intakeTask(input: {
  userId: string;
  spaceId: string;
  projectId?: string | null;
  title: string;
  /** Used when the source's text is empty — never a blank row. */
  fallbackTitle: string;
}): IntakeTaskFields {
  const projectId = input.projectId ?? null;
  return {
    user_id: input.userId,
    space_id: input.spaceId,
    project_id: projectId,
    title: input.title.trim().slice(0, INTAKE_TITLE_MAX) || input.fallbackTitle,
    is_inbox: !projectId,
  };
}
