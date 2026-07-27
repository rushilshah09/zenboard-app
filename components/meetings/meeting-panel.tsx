'use client';
// Meeting panel — the "2.2" card from MASTER_PRODUCT_PLAN.md. A meeting is a
// client conversation you keep a transcript/notes for, and the place feedback
// is born: type an ask, it becomes a first-class feedback item (source='meeting',
// linked back to this meeting and client) that then flows into the Feedback board
// and its revenue rollup. Transcript + extracted Feedback, in one calm panel.
import { useState } from 'react';
import { MessageSquare, CornerDownLeft } from '@/components/ds/icons';
import { Icon, Badge, Button, Modal, Textarea, TextInput } from '@/components/ds/ui';
import { type FeedbackItem, FEEDBACK_TONE, FEEDBACK_LABEL } from '@/components/feedback/feedback-board';

export type MeetingItem = {
  id: string; client_id: string | null; title: string; notes: string | null;
  met_at: string; created_at?: string | null;
};

const sectionLabel = 'text-caption font-medium tracking-[0.02em] text-ink-500';
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

function metDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function MeetingPanel({ meeting, feedback, onClose, onSaveNotes, onAddFeedback, onDelete }: {
  meeting: MeetingItem;
  feedback: FeedbackItem[];
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  onAddFeedback: (title: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t) { onAddFeedback(t); setDraft(''); } };

  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} size="lg"
      title={meeting.title} description={metDate(meeting.met_at)}
      footer={<><Button variant="dangerGhost" onClick={onDelete}>Delete meeting</Button><span className="flex-1" /><Button variant="secondary" onClick={onClose}>Done</Button></>}>
      <div className="flex flex-col gap-6">
        {/* Transcript / running notes */}
        <div>
          <div className={`${sectionLabel} mb-2`}>Transcript</div>
          <Textarea
            defaultValue={meeting.notes ?? ''}
            onBlur={(e) => onSaveNotes(e.target.value)}
            placeholder="Paste the transcript, or jot what was said…"
            rows={6}
          />
        </div>

        {/* Feedback extracted from this meeting */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className={sectionLabel}>Feedback</span>
            <span className="tabular-nums text-caption text-ink-500">{feedback.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                placeholder="What did they ask for? Pull it out as feedback…"
                autoComplete="off" data-1p-ignore data-lpignore="true"
              />
            </div>
            <Button variant={draft.trim() ? 'primary' : 'secondary'} disabled={!draft.trim()} iconRight={<Icon icon={CornerDownLeft} size={14} />} onClick={add}>Add</Button>
          </div>

          <div className="mt-3">
            {feedback.length === 0 ? (
              <div className="flex items-center gap-2 py-1.5 text-ui text-ink-500">
                <Icon icon={MessageSquare} size={15} className="text-ink-400" />
                Nothing pulled out yet — capture what they asked for above.
              </div>
            ) : feedback.map((f) => {
              const stake = f.deals.reduce((a, d) => a + d.value, 0);
              return (
                <div key={f.id} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
                  <span className="shrink-0 tabular-nums text-caption text-ink-400">#{f.number}</span>
                  <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{f.title}</span>
                  {stake > 0 && <span className="shrink-0 tabular-nums text-caption text-ink-500">{money(stake)}</span>}
                  <Badge status={FEEDBACK_TONE[f.status]}>{FEEDBACK_LABEL[f.status]}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
