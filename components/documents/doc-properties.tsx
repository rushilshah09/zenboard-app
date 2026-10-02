'use client';
// Document properties — the Notion-style property system in the Zenboard design
// language (measured from the "Add a property" HiFi, minus the AI features):
//   · a typed property row: type glyph · name · value editor
//   · "Add a property" → PropertyEditor popover: name field + searchable type
//     list (Basic / Advanced groups)
//   · click a property name → rename · change type · delete
//   · per-type value editors: text/number/url/email/phone/place · checkbox ·
//     date · select / status / multi-select (with create) · read-only computed
//     (created/edited time & by, id) · person
// Persisted inside the page content JSON (see documents-view · DocMeta).
// Styling is DS-token driven (Tailwind utilities); the only inline styles left
// are user/option colours (palette) — the sanctioned escape hatch.
import { useEffect, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import {
  Search, Plus, Check, Trash2, X, MapPin } from "@/components/ds/icons";
import { Icon, Checkbox, TextInput, toast, DatePicker, OVERLAY_CLASS } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { formatDay, formatDayTime } from '@/lib/date';
import { PALETTE_NAMES, palette, type PaletteName } from '@/lib/palette';

// The property VOCABULARY (types, labels, groups, option model) is shared with
// database properties — see lib/properties.ts. What stays here is the page-level
// SHAPE: a page has one value per property, so `DocProp` carries the value
// alongside the definition, where a database keeps the definition in a column
// and the values on the rows. That difference is real; the type list was not.
export type { PropType, PropOption } from '@/lib/properties';
import {
  PROP_TYPES, propLabel, propTypesFor, isComputed, isOptioned,
  type PropType, type PropOption,
} from '@/lib/properties';
import { propIcon } from '@/components/documents/property-icons';
import { createClient } from '@/lib/supabase/client';
import { recordHref, resolveRefs, type EntityRef } from '@/lib/connected';
import { useMentionSearch } from '@/components/documents/mention-menu';
import type { RecordHit } from '@/lib/search';
import { evalPageFormula, formulaDisplay } from '@/lib/page-formula';
import { FormulaEditor } from '@/components/documents/formula-editor';
import { listAttachments } from '@/lib/actions/attachments';
import { useAttachmentUpload, openAttachment } from '@/lib/use-attachment';
import type { Attachment, AttachmentOwner } from '@/lib/attachments';
import { isTempId } from '@/lib/temp-id';

export { PROP_TYPES, propLabel };
export { propIcon };

export type DocProp = {
  id: string; name: string; type: PropType;
  value?: string;          // text-likes + date (ISO) + place
  checked?: boolean;       // checkbox
  options?: PropOption[];  // select / multi_select / status definitions
  selected?: string[];     // chosen option ids
  /**
   * files — attachment row ids (§7H, 0033), never paths or URLs. The bytes are
   * owned by the PAGE; this records which of them this property lists, so two
   * files properties on one page can hold different files.
   */
  fileIds?: string[];
  /**
   * relation — record references. Ids only: labels are resolved live, because a
   * relation whose label went stale when its target was renamed is worse than a
   * text field. These are also collected into `mentions` on save, so a relation
   * is a real edge in the fabric rather than a private list (lib/mentions).
   */
  records?: EntityRef[];
  /**
   * formula — the expression, in the SAME shape `PropDef.formula` uses, because
   * it is the same language evaluated by the same engine (lib/page-formula).
   */
  formula?: { expr: string };
};

// The types this surface offers, from the ONE registry.
const PAGE_TYPES = propTypesFor('page');



// Every property popover wears the one overlay chrome (OVERLAY_CLASS, ds/ui/menu.tsx).
// Width is per-popover geometry, so it stays inline.
const PANEL = `${OVERLAY_CLASS} absolute left-0 top-[calc(100%+4px)] z-dropdown bg-popover p-2 origin-top-left zb-enter [animation:zb-pop-in_var(--duration-base)_var(--ease-out-quiet)]`;

export type PropContext = { userName: string; createdAt?: string; updatedAt?: string; pageId: string };

// ── Public: the property list (rows + Add a property) ────────────────────────
export function PropertyList({ props, onChange, ctx }: {
  props: DocProp[]; onChange: (next: DocProp[]) => void; ctx: PropContext;
}) {
  const [addOpen, setAddOpen] = useState(false);
  // The undo below fires up to 8s after the delete, by which point the `props`
  // captured in that closure is stale — reinserting into it would silently
  // revert whatever was edited in between. This ref is the live list.
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);

  const patch = (id: string, p: Partial<DocProp>) => onChange(props.map((x) => (x.id === id ? { ...x, ...p } : x)));
  // Removing a property drops whatever was typed into it. It's one field on one
  // page, so it doesn't warrant a dialog inside a popover — but it does warrant
  // a way back (INTERACTION_STANDARDS §2.2).
  const remove = (id: string) => {
    const i = props.findIndex((x) => x.id === id);
    if (i < 0) return;
    const gone = props[i];
    onChange(props.filter((x) => x.id !== id));
    toast({
      message: `“${gone.name || propLabel(gone.type)}” removed.`,
      action: { label: 'Undo', onAction: () => {
        const cur = latest.current;
        if (cur.some((x) => x.id === gone.id)) return;
        onChange([...cur.slice(0, i), gone, ...cur.slice(i)]);
      } },
    });
  };
  const add = (name: string, type: PropType) => {
    const prop: DocProp = { id: 'p' + Date.now().toString(36), name: name.trim() || propLabel(type), type };
    if (type === 'checkbox') prop.checked = false;
    if (isOptioned(type)) { prop.options = []; prop.selected = []; }
    onChange([...props, prop]);
    setAddOpen(false);
  };
  return (
    <div className="flex flex-col gap-0.5">
      {props.map((p) => <PropertyRow key={p.id} prop={p} all={props} ctx={ctx} onPatch={(x) => patch(p.id, x)} onRemove={() => remove(p.id)} />)}
      <span className="relative inline-flex">
        <button onClick={() => setAddOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={addOpen}
          className="doc-chipbtn -mx-1.5 inline-flex h-7 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-1.5 text-left text-ui text-ink-500">
          <Icon icon={Plus} size={14} /> Add a property
        </button>
        {addOpen && <PropertyEditor onClose={() => setAddOpen(false)} onPickType={(t, name) => add(name, t)} />}
      </span>
    </div>
  );
}

// ── One property row ─────────────────────────────────────────────────────────
function PropertyRow({ prop, all, ctx, onPatch, onRemove }: {
  prop: DocProp; all: DocProp[]; ctx: PropContext; onPatch: (p: Partial<DocProp>) => void; onRemove: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const Glyph = propIcon(prop.type);
  return (
    <div className="group flex min-h-7 items-start gap-2">
      <span className="relative inline-flex shrink-0">
        <button onClick={() => setEditOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={editOpen} title={propLabel(prop.type)}
          className="doc-chipbtn -mx-1.5 inline-flex h-7 min-w-[160px] max-w-[200px] cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-1.5 text-left text-ink-500">
          <Icon icon={Glyph} size={16} weight={isComputed(prop.type) ? 'fill' : 'regular'} className="shrink-0" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-ui text-ink-500">{prop.name || propLabel(prop.type)}</span>
        </button>
        {editOpen && (
          <PropertyEditor
            prop={prop} onClose={() => setEditOpen(false)}
            onRename={(name) => onPatch({ name })}
            onPickType={(t) => onPatch({ type: t, ...(t === 'checkbox' ? { checked: false } : {}), ...(isOptioned(t) ? { options: prop.options ?? [], selected: [] } : {}) })}
            formula={prop.type === 'formula' ? { expr: prop.formula?.expr ?? '', props: all, ctx, onExpr: (expr) => onPatch({ formula: { expr } }) } : undefined}
            onDelete={() => { setEditOpen(false); onRemove(); }}
          />
        )}
      </span>
      <div className="prop-cell -mx-1.5 min-w-0 flex-1 px-1.5">
        <PropValue prop={prop} all={all} ctx={ctx} onPatch={onPatch} />
      </div>
    </div>
  );
}

// ── Value editors, dispatched by type ────────────────────────────────────────
const EMPTY = 'text-ui text-ink-500';
const QUIET_INPUT = 'prop-input w-full min-w-0 border-0 bg-transparent px-0 py-1 text-ui text-ink-800 outline-none';

function PropValue({ prop, all, ctx, onPatch }: { prop: DocProp; all: DocProp[]; ctx: PropContext; onPatch: (p: Partial<DocProp>) => void }) {
  const t = prop.type;
  if (t === 'checkbox') {
    return (
      <Checkbox checked={!!prop.checked} onCheckedChange={() => onPatch({ checked: !prop.checked })} aria-label="Toggle" className="mt-1" />
    );
  }
  if (isComputed(t)) {
    if (t === 'created_by' || t === 'last_edited_by') return <PersonValue name={ctx.userName} />;
    // formula / rollup have no engine yet, so they have no value to show. They
    // used to fall through this chain's default and render the CURRENT USER'S
    // NAME — a property that looked like an answer and was not one. Both are
    // withdrawn from the picker now (lib/properties.ts), so this is reached only
    // by a property saved before that, and saying so plainly is the only honest
    // rendering left.
    // A formula is computed here, by the same engine the database uses. An
    // expression that is empty or invalid reads as "–" rather than as a value:
    // the engine cannot tell those apart (both are null) but a person can, and
    // the editor beside it says which.
    if (t === 'formula') {
      const v = evalPageFormula(prop, all, { pageId: ctx.pageId, title: '', createdAt: ctx.createdAt, updatedAt: ctx.updatedAt });
      const text = formulaDisplay(v);
      return <span className={cn(text ? 'text-ui text-ink-800' : EMPTY, 'inline-block pt-1')}>{text || (prop.formula?.expr?.trim() ? '–' : 'No expression')}</span>;
    }
    // rollup aggregates across a relation and has no engine on a page yet; it is
    // withheld from the picker, so this is only a property saved before that.
    if (t === 'rollup') {
      return <span className={cn(EMPTY, 'inline-block pt-1')}>Not available yet</span>;
    }
    const text =
      t === 'created_time' ? fmtDateTime(ctx.createdAt) :
      t === 'last_edited_time' ? fmtDateTime(ctx.updatedAt) :
      ctx.pageId.replace(/^tmp-/, '').slice(0, 8); // id
    return <span className={cn(EMPTY, 'inline-block pt-1')}>{text}</span>;
  }
  if (t === 'person') return <PersonValue name={ctx.userName} />;
  if (t === 'date') return <DateValue value={prop.value} onChange={(v) => onPatch({ value: v })} />;
  if (t === 'place') return <PlaceValue value={prop.value} onChange={(v) => onPatch({ value: v })} />;
  if (t === 'relation') return <RelationValue records={prop.records ?? []} onChange={(records) => onPatch({ records })} />;
  if (t === 'files') return <FilesValue ids={prop.fileIds ?? []} pageId={ctx.pageId} onChange={(fileIds) => onPatch({ fileIds })} />;
  if (isOptioned(t)) return <OptionValue prop={prop} onPatch={onPatch} />;
  // text-likes
  const inputMode = t === 'number' ? 'numeric' : t === 'url' ? 'url' : t === 'email' ? 'email' : t === 'phone' ? 'tel' : 'text';
  const isLink = (t === 'url' || t === 'email') && !!prop.value?.trim();
  if (isLink) {
    const href = t === 'email' ? `mailto:${prop.value}` : (/^https?:\/\//i.test(prop.value!) ? prop.value! : `https://${prop.value}`);
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap pt-1 text-ui text-[var(--accent-text)] no-underline"
        onDoubleClick={(e) => { e.preventDefault(); }}>{prop.value}</a>
    );
  }
  return (
    <input value={prop.value ?? ''} onChange={(e) => onPatch({ value: e.target.value })} placeholder="Empty"
      inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']} autoComplete="off" data-1p-ignore data-lpignore="true"
      className={QUIET_INPUT} />
  );
}

function PersonValue({ name }: { name: string }) {
  const initial = (name || 'U').charAt(0).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 pt-[3px]">
      <span aria-hidden className="grid size-[18px] place-items-center rounded-full bg-surface-fill text-caption font-medium text-ink-600">{initial}</span>
      <span className="text-ui text-ink-800">{name}</span>
    </span>
  );
}

// Stable empty map, so "still resolving" never re-renders the chips for nothing.
const NO_LABELS: ReadonlyMap<string, string> = new Map();

// ── Relation value ───────────────────────────────────────────────────────────
//
// A relation points at a RECORD, not at a row of one nominated database. That is
// the deliberate difference from Notion: there, a relation is configured against
// a target database first, and can only ever reach rows of it. Here the fabric
// already addresses every record uniformly, so the picker searches all of them
// and one property can hold a client and the project it belongs to — which is
// what people actually put in a "Related" field.
//
// Labels are resolved LIVE (`resolveRefs`) rather than stored beside the id.
// A relation whose label went stale when the target was renamed is worse than a
// text field, because it looks authoritative. Same call as the Connected panel,
// so a deleted target reads as a tombstone here too rather than vanishing.
function RelationValue({ records, onChange }: {
  records: EntityRef[]; onChange: (next: EntityRef[]) => void;
}) {
  const [open, setOpen] = useState(false);
  useFocusReturn(open);
  const [q, setQ] = useState('');
  const [resolved, setResolved] = useState<{ key: string; labels: Map<string, string> } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, open, () => { setOpen(false); setQ(''); });

  // Reuses the @-typeahead's search hook — debounce, request ordering and the
  // "keep the old list only while narrowing" rule are already correct there.
  const { hits, loading } = useMentionSearch(open ? q.trim() : null);

  const key = records.map((r) => `${r.type}:${r.id}`).join(',');
  useEffect(() => {
    if (!records.length) return;
    let gone = false;
    void resolveRefs(createClient(), records).then((m) => { if (!gone) setResolved({ key, labels: m }); });
    return () => { gone = true; };
    // Keyed by the refs' VALUE: `records` is a fresh array on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Derived, not reset inside the effect — and the key is doing real work: while
  // a newly added reference resolves, the PREVIOUS labels must not be painted
  // against the new ids, or a chip briefly shows another record's name.
  const done = resolved?.key === key;
  const labels = done ? resolved.labels : NO_LABELS;

  const has = (h: RecordHit) => records.some((r) => r.type === h.type && r.id === h.id);
  const add = (h: RecordHit) => {
    if (!has(h)) onChange([...records, { type: h.type, id: h.id }]);
    setQ('');
  };

  return (
    <span ref={ref} className="relative flex min-w-0 flex-wrap items-center gap-1 py-[3px]">
      {records.map((r) => {
        const label = labels.get(`${r.type}:${r.id}`);
        const href = recordHref(r.type, r.id);
        // No label back = the target is gone. Kept and struck through, never
        // dropped: a reference that disappears looks like our bug, not a delete.
        // Resolved-and-absent is a tombstone; not-yet-resolved is a placeholder.
        // Asking whether ANY label came back instead would leave a page whose
        // targets were ALL deleted showing an ellipsis for ever.
        const gone = done && !label;
        return (
          <span key={`${r.type}:${r.id}`} className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-surface-fill pl-2 pr-1">
            <Icon icon={propIcon('relation')} size={12} className="shrink-0 text-ink-500" />
            {href && !gone ? (
              <a href={href} onClick={(e) => e.stopPropagation()}
                className="min-w-0 truncate text-caption text-ink-800 no-underline">{label ?? '…'}</a>
            ) : (
              <span className={cn('min-w-0 truncate text-caption', gone ? 'text-ink-500 line-through' : 'text-ink-800')}>
                {gone ? 'Deleted' : label ?? '…'}
              </span>
            )}
            <button onClick={() => onChange(records.filter((x) => !(x.type === r.type && x.id === r.id)))}
              aria-label={`Remove ${label ?? 'reference'}`}
              className="doc-chipbtn grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-500">
              <Icon icon={X} size={12} />
            </button>
          </span>
        );
      })}

      <button onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}
        className="doc-row inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-caption text-ink-500">
        <Icon icon={Plus} size={12} /> {records.length ? 'Add' : 'Add a relation'}
      </button>

      {open && (
        <span className={PANEL} style={{ width: 280 }}>
          {/* Focus IS in this field, unlike the editor's @ menu — so this is a
              real combobox with `aria-activedescendant`, which that menu
              deliberately cannot be without mis-announcing the whole document. */}
          <TextInput size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            role="combobox" aria-expanded aria-controls="rel-list" aria-autocomplete="list"
            placeholder="Search records…" autoComplete="off" data-1p-ignore data-lpignore="true" />
          <div id="rel-list" role="listbox" aria-label="Records" className="mt-1.5 flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
            {loading && !hits.length && <div className="px-2 py-1 text-caption text-ink-500">Searching…</div>}
            {!loading && !hits.length && <div className="px-2 py-1 text-caption text-ink-500">{q.trim() ? 'Nothing matches.' : 'Type to search.'}</div>}
            {hits.map((h) => (
              <button key={h.key} role="option" aria-selected={has(h)} onClick={() => add(h)}
                className="doc-row flex h-[30px] min-w-0 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left">
                <Icon icon={propIcon('relation')} size={12} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{h.title}</span>
                {h.meta && <span className="shrink-0 text-caption text-ink-500">{h.meta}</span>}
                {has(h) && <Icon icon={Check} size={12} className="shrink-0 text-ink-600" />}
              </button>
            ))}
          </div>
        </span>
      )}
    </span>
  );
}

// ── Place value ──────────────────────────────────────────────────────────────
// A place is an address, so it stays a plain editable string — the field is not
// the interesting part, getting there is. Notion resolves places against a maps
// provider and stores coordinates; we deliberately do not, because that means an
// API key, a per-keystroke request and somebody's address leaving the app while
// they type. A link, opened only when clicked, buys the same usefulness.
function PlaceValue({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const q = (value ?? '').trim();
  return (
    <span className="flex min-w-0 items-center gap-1">
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Empty"
        aria-label="Place" autoComplete="off" data-1p-ignore data-lpignore="true" className={QUIET_INPUT} />
      {q && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`}
          target="_blank" rel="noreferrer" aria-label={`Open ${q} in maps`} title="Open in maps"
          onClick={(e) => e.stopPropagation()}
          className="doc-chipbtn grid size-[22px] shrink-0 place-items-center rounded-xs text-ink-500">
          <Icon icon={MapPin} size={14} />
        </a>
      )}
    </span>
  );
}

// ── Files value ──────────────────────────────────────────────────────────────
// The property lists ATTACHMENT IDS; the files themselves belong to the page
// (§7H, 0033). That split is what lets two files properties on one page hold
// different files while the bytes stay owned — and it is why this is not just
// `<AttachmentsPanel>`, which by design shows everything the page owns.
function FilesValue({ ids, pageId, onChange }: {
  ids: string[]; pageId: string; onChange: (ids: string[]) => void;
}) {
  // A `tmp-` page has not been written yet, so there is no row to own a file.
  const owner: AttachmentOwner | null = isTempId(pageId) ? null : { page_id: pageId };
  const [rows, setRows] = useState<Attachment[]>([]);
  const { upload, busy, error } = useAttachmentUpload(owner);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!owner) return;
    let gone = false;
    void listAttachments({ page_id: pageId }).then((r) => { if (!gone) setRows(r); });
    return () => { gone = true; };
    // Keyed by the page, not by the ids: uploading appends locally, so refetching
    // on every id change would be a round trip that tells us what we just did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const chosen = ids.map((id) => byId.get(id)).filter((a): a is Attachment => !!a);

  async function take(list: FileList | null) {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      const saved = await upload(file);
      if (!saved) continue;
      setRows((cur) => [...cur, saved]);
      onChange([...ids, saved.id]);
    }
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1 py-[3px]">
      <input ref={inputRef} type="file" multiple hidden aria-hidden tabIndex={-1}
        onChange={(e) => { void take(e.target.files); e.target.value = ''; }} />

      {chosen.map((a) => (
        <span key={a.id} className="group/f inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-surface-fill pl-2 pr-1">
          <button onClick={() => void openAttachment(a.id)}
            className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-caption text-ink-800">
            {a.filename}
          </button>
          <button onClick={() => onChange(ids.filter((x) => x !== a.id))}
            aria-label={`Remove ${a.filename}`}
            className="doc-chipbtn grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-500">
            <Icon icon={X} size={12} />
          </button>
        </span>
      ))}

      {/* The bytes are not deleted here — removing a chip removes it from THIS
          property, and the file stays on the page's Files list. Deleting bytes is
          irreversible and belongs where it can be confirmed. */}
      {owner ? (
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="doc-row inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-caption text-ink-500">
          <Icon icon={Plus} size={12} /> {busy ? 'Uploading…' : chosen.length ? 'Add' : 'Add a file'}
        </button>
      ) : (
        <span className={EMPTY}>Save the page first</span>
      )}
      {error && <span className="text-caption text-danger-600">{error}</span>}
    </span>
  );
}

// ── Date value ───────────────────────────────────────────────────────────────
function DateValue({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  useFocusReturn(open);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, open, () => setOpen(false));
  return (
    <span ref={ref} className="relative inline-flex">
      {/* The DS picker brings its own popover, presets and Clear — this used to
          hand-roll a panel around a native date input, so a document property
          opened a different calendar from every other date in the app. */}
      <DatePicker
        aria-label="Date"
        value={value || null}
        onValueChange={onChange}
        trigger={(
          <button type="button"
            className={cn('inline-flex cursor-pointer items-center border-0 bg-transparent pt-1 text-ui', value ? 'text-ink-800' : 'text-ink-500')}>
            {value ? fmtDate(value) : 'Empty'}
          </button>
        )}
      />
    </span>
  );
}

// ── Select / Status / Multi-select value + editor ────────────────────────────
function OptionValue({ prop, onPatch }: { prop: DocProp; onPatch: (p: Partial<DocProp>) => void }) {
  const [open, setOpen] = useState(false);
  useFocusReturn(open);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, open, () => setOpen(false));
  const options = prop.options ?? [];
  const selected = prop.selected ?? [];
  const multi = prop.type === 'multi_select';
  const chosen = options.filter((o) => selected.includes(o.id));
  const toggle = (id: string) => {
    const next = multi ? (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]) : [id];
    onPatch({ selected: next });
    if (!multi) setOpen(false);
  };
  const create = (label: string) => {
    const color = PALETTE_NAMES[(options.length + 1) % PALETTE_NAMES.length];
    const opt: PropOption = { id: 'o' + Date.now().toString(36), name: label, color };
    const nextOpts = [...options, opt];
    onPatch({ options: nextOpts, selected: multi ? [...selected, opt.id] : [opt.id] });
    if (!multi) setOpen(false);
  };
  return (
    <span ref={ref} className="relative flex min-w-0">
      <button onClick={() => setOpen((v) => !v)} className="flex min-h-7 w-full cursor-pointer flex-wrap items-center gap-1 border-0 bg-transparent py-[3px] text-left">
        {chosen.length ? chosen.map((o) => <OptChip key={o.id} o={o} status={prop.type === 'status'} />) : <span className={EMPTY}>Empty</span>}
      </button>
      {open && <OptionEditor options={options} selected={selected} status={prop.type === 'status'} onToggle={toggle} onCreate={create}
        onRecolor={(id, color) => onPatch({ options: options.map((o) => (o.id === id ? { ...o, color } : o)) })}
        onDeleteOption={(id) => onPatch({ options: options.filter((o) => o.id !== id), selected: selected.filter((s) => s !== id) })} />}
    </span>
  );
}

function OptChip({ o, status }: { o: PropOption; status?: boolean }) {
  const c = palette(o.color);
  if (status) return (
    <span className="inline-flex items-center gap-1.5 text-caption leading-none text-ink-800">
      {/* Option colour is user content — the sanctioned inline escape. */}
      <span className="size-2 rounded-full" style={{ background: c.dot }} />{o.name}
    </span>
  );
  return <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full px-1.5 text-caption leading-none" style={{ background: c.bg, color: c.text }}>{o.name}</span>;
}

function OptionEditor({ options, selected, status, onToggle, onCreate, onRecolor, onDeleteOption }: {
  options: PropOption[]; selected: string[]; status?: boolean;
  onToggle: (id: string) => void; onCreate: (label: string) => void;
  onRecolor: (id: string, color: PaletteName) => void; onDeleteOption: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  const query = q.trim();
  const filtered = options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));
  const exact = options.some((o) => o.name.toLowerCase() === query.toLowerCase());
  return (
    <span className={PANEL} style={{ width: 260 }}>
      <TextInput size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && query && !exact) onCreate(query); }}
        placeholder="Search for an option…" autoComplete="off" data-1p-ignore data-lpignore="true" />
      <div className="px-0.5 pt-2 pb-1 text-caption text-ink-500">Select an option{query && !exact ? ' or create one' : ''}</div>
      <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
        {filtered.map((o) => (
          <div key={o.id} className="group flex items-center gap-1.5 rounded-sm">
            <button onClick={() => onToggle(o.id)} className="doc-row flex h-[30px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left">
              <OptChip o={o} status={status} />
              <span className="flex-1" />
              {selected.includes(o.id) && <span className="text-ink-600"><Icon icon={Check} size={14} /></span>}
            </button>
            <span className="relative inline-flex">
              <button onClick={() => setColorFor(colorFor === o.id ? null : o.id)} aria-label="Option color" className="reveal-on-hover doc-chipbtn grid size-[22px] cursor-pointer place-items-center rounded-xs border-0 bg-transparent">
                {/* User option colour. */}
                <span className="size-3 rounded-full" style={{ background: palette(o.color).dot }} />
              </button>
              {colorFor === o.id && (
                <span className={cn(PANEL, 'grid grid-cols-3 gap-1')} style={{ width: 120 }}>
                  {PALETTE_NAMES.map((n) => (
                    <button key={n} onClick={() => { onRecolor(o.id, n); setColorFor(null); }} title={n} className="grid size-[26px] cursor-pointer place-items-center rounded-xs border-0 bg-transparent">
                      <span className="size-4 rounded-full" style={{ background: palette(n).dot, boxShadow: o.color === n ? '0 0 0 2px var(--color-surface-raised), 0 0 0 3px var(--accent)' : 'none' }} />
                    </button>
                  ))}
                </span>
              )}
            </span>
            <button onClick={() => onDeleteOption(o.id)} aria-label="Delete option" className="reveal-on-hover doc-chipbtn grid size-[22px] cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-500">
              <Icon icon={X} size={12} />
            </button>
          </div>
        ))}
        {query && !exact && (
          <button onClick={() => onCreate(query)} className="doc-row flex h-8 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-meta text-ink-600">
            <Icon icon={Plus} size={14} /> Create <span className="inline-flex h-5 items-center rounded-full px-1.5" style={{ background: palette(PALETTE_NAMES[(options.length + 1) % PALETTE_NAMES.length]).bg, color: palette(PALETTE_NAMES[(options.length + 1) % PALETTE_NAMES.length]).text }}>{query}</span>
          </button>
        )}
        {!filtered.length && !query && <div className="px-2 py-1 text-caption text-ink-500">Type to create an option</div>}
      </div>
    </span>
  );
}

// ── Formula editor (page side) ───────────────────────────────────────────────
// The editor itself is shared with the database — see components/documents/
// formula-editor.tsx. All this supplies is the page's evaluation context.
function PageFormulaEditor({ expr, props, ctx, onExpr }: {
  expr: string; props: DocProp[]; ctx: PropContext; onExpr: (expr: string) => void;
}) {
  return (
    <FormulaEditor
      expr={expr}
      onExpr={onExpr}
      evaluate={(e) => evalPageFormula(
        { id: '__preview', name: '', type: 'formula', formula: { expr: e } },
        props,
        { pageId: ctx.pageId, title: '', createdAt: ctx.createdAt, updatedAt: ctx.updatedAt },
      )}
    />
  );
}

// ── Add / edit property popover ──────────────────────────────────────────────
function PropertyEditor({ prop, onClose, onPickType, onRename, onDelete, formula }: {
  prop?: DocProp; onClose: () => void;
  onPickType: (t: PropType, name: string) => void; onRename?: (name: string) => void; onDelete?: () => void;
  /** Present only while editing a formula property — see FormulaEditor. */
  formula?: { expr: string; props: DocProp[]; ctx: PropContext; onExpr: (expr: string) => void };
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [name, setName] = useState(prop?.name ?? '');
  const [q, setQ] = useState('');
  useOutside(ref, true, onClose);
  const editing = !!prop;
  const query = q.trim().toLowerCase();
  const results = PAGE_TYPES.filter((t) => t.label.toLowerCase().includes(query));
  const groups: ('Basic' | 'Advanced')[] = ['Basic', 'Advanced'];
  return (
    <span ref={ref} role="dialog" aria-label={editing ? 'Edit property' : 'New property'} className={PANEL} style={{ width: 280 }}>
      <TextInput size="sm" autoFocus={!editing} value={name} onChange={(e) => { setName(e.target.value); onRename?.(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !editing) { onPickType('text', name); } if (e.key === 'Escape') onClose(); }}
        placeholder="Property name" autoComplete="off" data-1p-ignore data-lpignore="true" />
      {formula && <PageFormulaEditor {...formula} />}
      <div className="flex items-center gap-1.5 px-0.5 pt-2.5 pb-1">
        <span className="text-overline text-ink-500">Type</span>
        <span className="text-ink-500"><Icon icon={Search} size={12} /></span>
        <input data-chromeless value={q} onChange={(e) => setQ(e.target.value)} placeholder="" autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-caption text-ink-600 outline-none" />
      </div>
      <div className="flex max-h-[288px] flex-col overflow-y-auto">
        {groups.map((g) => {
          const items = results.filter((t) => t.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              {!query && <div className="px-2 pt-2 pb-1 text-overline text-ink-500">{g}</div>}
              {items.map((t) => {
                const on = prop?.type === t.type;
                return (
                  <button key={t.type} onClick={() => onPickType(t.type, name)}
                    className={cn('doc-row flex h-8 cursor-pointer items-center gap-2.5 rounded-sm border-0 px-2 text-left text-ink-600', on ? 'bg-surface-hover' : 'bg-transparent')}>
                    <Icon icon={propIcon(t.type)} size={16} className="shrink-0" />
                    <span className="flex-1 text-ui text-ink-800">{t.label}</span>
                    {on && <span className="text-ink-600"><Icon icon={Check} size={14} /></span>}
                  </button>
                );
              })}
            </div>
          );
        })}
        {!results.length && <div className="px-2 py-3 text-center text-meta text-ink-500">No property types</div>}
      </div>
      {editing && onDelete && (
        <>
          <div className="my-1.5 border-t border-line-soft" />
          <button onClick={onDelete} className="doc-row flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-sm border-0 bg-transparent px-2 text-left text-ui text-danger-600">
            <Icon icon={Trash2} size={16} /> Delete property
          </button>
        </>
      )}
    </span>
  );
}

// ── shared helpers ───────────────────────────────────────────────────────────
function useOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOut: () => void) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [ref, active, onOut]);
}
// A property value is a standalone fact on the page, so both shapes carry the
// year — unlike a row in a list, there's no surrounding context to infer it.
const fmtDate = (iso?: string) => (iso ? formatDay(iso, { year: true }) ?? iso : '');
const fmtDateTime = (iso?: string) => (iso ? formatDayTime(iso, { year: true }) ?? iso : '–');
