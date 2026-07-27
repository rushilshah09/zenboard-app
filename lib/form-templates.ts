// Starter templates — the six forms a studio actually sends. Plain data, so
// both the server action (seeding) and the create menu (listing) use one source.
//
// Every template is kept UNDER 10 questions: the research is unambiguous that
// completion falls off a cliff past that, and a template that models bad length
// teaches bad habits. Copy is Zenboard voice — sentence case, no slogans.
import { genBlockId, type FormBlock, type FormSettings } from '@/lib/form-schema';

export type FormTemplate = {
  key: string;
  name: string;
  hint: string;
  title: string;
  description: string;
  settings: FormSettings;
  /** Blocks without ids — ids are minted per form so answers stay attached. */
  blocks: Omit<FormBlock, 'id'>[];
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: 'intake',
    name: 'Client intake',
    hint: 'New enquiries',
    title: 'Tell us about your project',
    description: 'A few questions so we can work out whether we’re a good fit. Takes about three minutes.',
    settings: { mode: 'page', collectIdentity: true, thanks: 'Thanks — we’ll come back to you within two working days.' },
    blocks: [
      { type: 'short_text', label: 'What’s your company called?', required: true },
      { type: 'long_text', label: 'What are you hoping to make?', help: 'A sentence or two is plenty.', required: true },
      { type: 'select', label: 'What kind of work is it?', options: ['Brand identity', 'Website', 'Product design', 'Something else'], required: true },
      { type: 'dropdown', label: 'Roughly what’s the budget?', options: ['Under $5k', '$5–15k', '$15–40k', '$40k+', 'Not sure yet'] },
      { type: 'date', label: 'When would you like it live?' },
      { type: 'short_text', label: 'How did you hear about us?' },
    ],
  },
  {
    key: 'kickoff',
    name: 'Project kickoff brief',
    hint: 'Start of a project',
    title: 'Project kickoff brief',
    description: 'The details we need before we start. Answer what you can — we’ll fill the gaps together.',
    settings: { mode: 'page', thanks: 'Got it. We’ll review this before the kickoff call.' },
    blocks: [
      { type: 'long_text', label: 'What does success look like six months from now?', required: true },
      { type: 'long_text', label: 'Who are you trying to reach?', help: 'Your audience, in your own words.' },
      { type: 'multi_select', label: 'What do you need from us?', options: ['Strategy', 'Design', 'Copywriting', 'Build'] },
      { type: 'long_text', label: 'Anything we should avoid?', help: 'Colours, phrases, competitors, past attempts.' },
      { type: 'short_text', label: 'Who signs off on the work?' },
      { type: 'date', label: 'Is there a date this has to hit?' },
    ],
  },
  {
    key: 'feedback',
    name: 'Design feedback',
    hint: 'A review round',
    title: 'Feedback on this round',
    description: 'Tell us what’s working and what isn’t. Specific beats polite.',
    settings: { mode: 'focus', thanks: 'Thank you — we’ll fold this into the next round.' },
    blocks: [
      { type: 'rating', label: 'Overall, how does this feel?', required: true },
      { type: 'long_text', label: 'What’s working?', required: true },
      { type: 'long_text', label: 'What isn’t?', required: true },
      { type: 'yes_no', label: 'Is anything factually wrong?' },
      { type: 'long_text', label: 'What’s wrong?', showWhen: { fieldId: '', op: 'is', value: 'Yes' } }, // fieldId patched on seed
      { type: 'yes_no', label: 'Are you happy for us to proceed?' },
    ],
  },
  {
    key: 'testimonial',
    name: 'Testimonial request',
    hint: 'After a project',
    title: 'Would you say a few words?',
    description: 'If you enjoyed working with us, a short quote helps more than you’d think.',
    settings: { mode: 'focus', collectIdentity: true, thanks: 'Thank you — genuinely.' },
    blocks: [
      { type: 'long_text', label: 'What was it like working with us?', required: true },
      { type: 'long_text', label: 'What changed for your business?', help: 'Numbers are great if you have them.' },
      { type: 'rating', label: 'How likely are you to recommend us?' },
      { type: 'yes_no', label: 'May we use this publicly?', required: true },
      { type: 'short_text', label: 'How should we credit you?', help: 'Name, role, company.', showWhen: { fieldId: '', op: 'is', value: 'Yes' } },
    ],
  },
  {
    key: 'change',
    name: 'Change request',
    hint: 'Mid-project asks',
    title: 'Request a change',
    description: 'Tell us what you need and we’ll come back with what it takes.',
    settings: { mode: 'page', collectIdentity: true, thanks: 'Received. We’ll come back with scope and timing.' },
    blocks: [
      { type: 'short_text', label: 'What needs to change?', required: true },
      { type: 'long_text', label: 'Why — what problem does it solve?', required: true },
      { type: 'select', label: 'How urgent is it?', options: ['Blocking us', 'Soon', 'Whenever there’s room'], required: true },
      { type: 'yes_no', label: 'Does this replace something already agreed?' },
    ],
  },
  {
    key: 'review',
    name: 'Post-project review',
    hint: 'After delivery',
    title: 'How did that go?',
    description: 'Five minutes of honesty makes the next project better.',
    settings: { mode: 'focus', thanks: 'Thank you — this is how we get better.' },
    blocks: [
      { type: 'rating', label: 'How happy are you with what we delivered?', required: true },
      { type: 'rating', label: 'How was it to work with us day to day?', required: true },
      { type: 'long_text', label: 'What should we keep doing?' },
      { type: 'long_text', label: 'What should we do differently?' },
      { type: 'yes_no', label: 'Would you work with us again?' },
    ],
  },
];

export const templateByKey = (key?: string | null) =>
  (key ? FORM_TEMPLATES.find((t) => t.key === key) : undefined) ?? undefined;

/**
 * Mint real block ids for a template. Any `showWhen` written with an empty
 * fieldId is a "depends on the question directly above me" marker — resolved
 * here, once the ids exist.
 */
export function instantiate(template: FormTemplate): FormBlock[] {
  const blocks: FormBlock[] = template.blocks.map((b) => ({ ...b, id: genBlockId() }));
  for (let i = 0; i < blocks.length; i++) {
    const cond = blocks[i].showWhen;
    if (cond && !cond.fieldId) {
      if (i > 0) blocks[i] = { ...blocks[i], showWhen: { ...cond, fieldId: blocks[i - 1].id } };
      else { const { showWhen: _drop, ...rest } = blocks[i]; blocks[i] = rest; }
    }
  }
  return blocks;
}
