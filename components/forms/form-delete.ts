import type { ConfirmOptions } from '@/components/ds/ui';
import type { FormSummary } from '@/lib/forms';

// One sentence for "what disappears with this form", shared by the hub and the
// embedded panel. Deleting a form cascades to its responses, and the two lists
// used to delete on a single click without saying so — someone could lose a
// month of client submissions and only find out afterwards.
//
// The count is the whole point: "This can't be undone" is boilerplate people
// skim, "Its 24 responses go with it" is a fact that stops them.
export function formDeleteConfirm(f: Pick<FormSummary, 'title' | 'responses' | 'partials'>): ConfirmOptions {
  const total = f.responses + f.partials;
  const answers = total === 0
    ? 'It has no responses yet.'
    : `Its ${total} ${total === 1 ? 'response' : 'responses'} ${total === 1 ? 'is' : 'are'} deleted too.`;
  return {
    title: `Delete “${f.title || 'Untitled form'}”?`,
    body: `${answers} This can’t be undone.`,
    actionLabel: 'Delete form',
  };
}
