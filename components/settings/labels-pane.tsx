'use client';
// Settings → Labels. The management surface labels never had (§5.2 #3): until
// now a label could only be born inside the task-detail drawer's picker, could
// never be renamed at all, and `deleteLabel` sat in the actions file with zero
// callers. So a typo'd or duplicate label was permanent.
//
// A label is a *view over* tasks, never a container for them — deleting one
// drops the chip from its tasks and touches nothing else. The row says so
// plainly before you confirm.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash, Check, X } from '@/components/ds/icons';
import {
  Icon, Button, IconButton, TextInput, ColorPalette, EmptyState, Tag, toast,
  SettingsPaneHeader, SettingsSection, InlineConfirm,
} from '@/components/ds/ui';
import { createClient } from '@/lib/supabase/client';
import { createLabel, renameLabel, setLabelColor, deleteLabel } from '@/lib/actions/labels';
import { type LabelColor } from '@/lib/labelColor';

type LabelRow = { id: string; name: string; color: LabelColor; count: number };

export function LabelsPane() {
  const [labels, setLabels] = useState<LabelRow[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftColor, setDraftColor] = useState<LabelColor>('stone');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  // Read through the browser client like every other label surface, so a DB
  // predating 0014 degrades to an honest note instead of erroring.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = createClient();
      const { data, error } = await db.from('labels').select('id, name, color').order('name');
      if (cancelled) return;
      if (error) { setSupported(false); setLabels([]); return; }
      const rows = (data as { id: string; name: string; color: string | null }[]) ?? [];
      const { data: links } = await db.from('task_labels').select('label_id');
      const counts = new Map<string, number>();
      for (const l of (links as { label_id: string }[]) ?? []) counts.set(l.label_id, (counts.get(l.label_id) ?? 0) + 1);
      setLabels(rows.map((r) => ({
        id: r.id, name: r.name,
        color: (r.color ?? 'stone') as LabelColor,
        count: counts.get(r.id) ?? 0,
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  const total = useMemo(() => labels?.length ?? 0, [labels]);

  async function add() {
    const name = draft.trim();
    if (!name) return;
    setDraft(''); setAdding(false);
    const color = draftColor;
    setDraftColor('stone');
    const res = await createLabel(name, color);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setLabels((ls) => [...(ls ?? []), { id: res.id, name, color, count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function commitRename(id: string) {
    const name = editName.trim();
    const before = labels?.find((l) => l.id === id);
    setEditing(null);
    if (!name || !before || name === before.name) return;
    setLabels((ls) => (ls ?? []).map((l) => (l.id === id ? { ...l, name } : l)).sort((a, b) => a.name.localeCompare(b.name)));
    const res = await renameLabel(id, name);
    if ('error' in res) {
      setLabels((ls) => (ls ?? []).map((l) => (l.id === id ? { ...l, name: before.name } : l)));
      toast({ message: res.error, variant: 'error' });
    }
  }

  async function recolor(id: string, color: LabelColor) {
    const before = labels?.find((l) => l.id === id)?.color ?? 'stone';
    setLabels((ls) => (ls ?? []).map((l) => (l.id === id ? { ...l, color } : l)));
    const res = await setLabelColor(id, color);
    if ('error' in res) {
      setLabels((ls) => (ls ?? []).map((l) => (l.id === id ? { ...l, color: before } : l)));
      toast({ message: res.error, variant: 'error' });
    }
  }

  async function remove(row: LabelRow) {
    setLabels((ls) => (ls ?? []).filter((l) => l.id !== row.id));
    const res = await deleteLabel(row.id);
    if ('error' in res) {
      setLabels((ls) => [...(ls ?? []), row].sort((a, b) => a.name.localeCompare(b.name)));
      toast({ message: res.error, variant: 'error' });
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Labels" description="Cross-cutting tags for tasks. A label is a view over your work: deleting one never deletes a task." />

      <SettingsSection title={total > 0 ? `${total} ${total === 1 ? 'label' : 'labels'}` : 'Labels'}>
        {!supported ? (
          <p className="py-1.5 text-ui text-ink-500">Labels aren&rsquo;t available on this database yet.</p>
        ) : labels === null ? (
          <p className="py-1.5 text-ui text-ink-500">Loading&hellip;</p>
        ) : labels.length === 0 && !adding ? (
          <EmptyState
            size="inline"
            illustration={<Icon icon={Plus} size={20} />}
            title="No labels yet"
            description="Label a task from its detail panel, or start one here."
            primary={<Button variant="secondary" size="sm" onClick={() => setAdding(true)}>New label</Button>}
          />
        ) : (
          <div className="flex flex-col">
            {labels.map((l) => (
              <div key={l.id} className="group flex min-h-11 items-center gap-3 border-b border-line-soft py-2 last:border-0">
                {editing === l.id ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <TextInput
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(l.id);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        aria-label={`Rename ${l.name}`}
                      />
                    </div>
                    <IconButton label="Save name" variant="ghost" size="xs" icon={<Icon icon={Check} size={14} />} onClick={() => commitRename(l.id)} />
                    <IconButton label="Cancel rename" variant="ghost" size="xs" icon={<Icon icon={X} size={14} />} onClick={() => setEditing(null)} />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(l.id); setEditName(l.name); }}
                      className="focus-ring min-w-0 flex-1 rounded-sm text-left"
                      aria-label={`Rename ${l.name}`}
                    >
                      <Tag color={l.color}>{l.name}</Tag>
                    </button>
                    <span className="shrink-0 tabular-nums text-caption text-ink-500">
                      {l.count === 0 ? 'Unused' : `${l.count} ${l.count === 1 ? 'task' : 'tasks'}`}
                    </span>
                    <div className="reveal-on-hover shrink-0">
                      <ColorPalette value={l.color} onValueChange={(c) => recolor(l.id, c as LabelColor)} aria-label={`Colour for ${l.name}`} />
                    </div>
                    {confirming === l.id ? (
                      <InlineConfirm
                        // Say what actually happens: the chip leaves N tasks,
                        // the tasks themselves survive.
                        question={l.count > 0 ? `Remove from ${l.count} ${l.count === 1 ? 'task' : 'tasks'}?` : 'Delete label?'}
                        confirmLabel="Delete"
                        cancelLabel="Keep"
                        onConfirm={() => { setConfirming(null); remove(l); }}
                        onCancel={() => setConfirming(null)}
                        className="shrink-0"
                      />
                    ) : (
                      <div className="reveal-on-hover shrink-0">
                        <IconButton label={`Delete ${l.name}`} variant="ghost" size="xs" icon={<Icon icon={Trash} size={14} />} onClick={() => setConfirming(l.id)} />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {adding ? (
              <div className="flex flex-col gap-2 border-t border-line-soft py-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <TextInput
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
                      placeholder="Label name"
                      aria-label="New label name"
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={add} disabled={!draft.trim()}>Add</Button>
                  <IconButton label="Cancel" variant="ghost" size="sm" icon={<Icon icon={X} size={16} />} onClick={() => { setAdding(false); setDraft(''); }} />
                </div>
                {/* Colour is meaning on a tag (§4.8) — chosen, never auto-assigned. */}
                <ColorPalette value={draftColor} onValueChange={(c) => setDraftColor(c as LabelColor)} aria-label="New label colour" />
              </div>
            ) : (
              <div className="pt-3">
                <Button variant="ghost" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>New label</Button>
              </div>
            )}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
