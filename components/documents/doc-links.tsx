'use client';
// "Linked to" — the writer side of the fabric for documents (§3.4).
//
// `pages.project_id` and `pages.client_id` have existed since 0007 and the
// Connected panel reads them, but nothing in Documents could ever set them:
// `project_id` was writable only at creation (and only from Project Docs), and
// `client_id` had no writer anywhere in the app. So a doc's Connected panel was
// empty by construction no matter how much work it belonged to.
//
// Two quiet rows, matching the properties zone directly above them rather than
// inventing a new idiom. No filled-accent element, so the doc keeps its one
// accent for the editor. Clearing is a first-class action — a doc that moved to
// a different client should not have to keep the old one.
import { useEffect, useState } from 'react';
import { Folder, Users } from '@/components/ds/icons';
import { Icon, Combobox, toast, type ComboOption } from '@/components/ds/ui';
import { createClient } from '@/lib/supabase/client';
import { setPageLinks } from '@/lib/actions/library';

type Row = { id: string; name: string };

export interface DocLinksProps {
  pageId: string;
  /** Server-loaded starting values — used for an instant first paint, then confirmed. */
  projectId: string | null;
  clientId: string | null;
  /** Fired after a successful write so the host can refresh its Connected panel. */
  onChange?: (next: { projectId: string | null; clientId: string | null }) => void;
}

export function DocLinks({ pageId, projectId, clientId, onChange }: DocLinksProps) {
  const [projects, setProjects] = useState<Row[] | null>(null);
  const [clients, setClients] = useState<Row[] | null>(null);
  const [project, setProject] = useState(projectId);
  const [client, setClient] = useState(clientId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = createClient();
      const [p, c, own] = await Promise.all([
        db.from('projects').select('id,name').order('name'),
        db.from('clients').select('id,name').order('name'),
        // This doc's CURRENT links, read rather than trusted. The `pages` rows the
        // host holds are from the initial server load, so after linking a doc,
        // navigating away and back would otherwise show "No project" again — the
        // write succeeded, the cached row just never heard about it. Also covers
        // the loader's pre-0007 fallback select, which omits both columns.
        db.from('pages').select('project_id,client_id').eq('id', pageId).maybeSingle(),
      ]);
      if (cancelled) return;
      setProjects((p.data as Row[]) ?? []);
      setClients((c.data as Row[]) ?? []);
      const links = own.data as { project_id: string | null; client_id: string | null } | null;
      if (links) { setProject(links.project_id); setClient(links.client_id); }
    })();
    return () => { cancelled = true; };
  }, [pageId]);

  // Optimistic: the row updates immediately and rolls back only if the write
  // fails, because picking a project should feel like a choice, not a request.
  async function commit(kind: 'project' | 'client', value: string | null) {
    const prevProject = project;
    const prevClient = client;
    if (kind === 'project') setProject(value); else setClient(value);

    const res = await setPageLinks(pageId, kind === 'project' ? { projectId: value } : { clientId: value });
    if ('error' in res) {
      setProject(prevProject); setClient(prevClient);
      toast({ message: res.error, variant: 'error' });
      return;
    }
    onChange?.({
      projectId: kind === 'project' ? value : project,
      clientId: kind === 'client' ? value : client,
    });
  }

  const opts = (rows: Row[] | null): ComboOption[] =>
    (rows ?? []).map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="flex flex-col gap-0.5">
      <LinkRow
        icon={Folder} label="Project"
        value={project} options={opts(projects)} loading={projects === null}
        empty="Empty" onValueChange={(v) => commit('project', v)}
      />
      <LinkRow
        icon={Users} label="Client"
        value={client} options={opts(clients)} loading={clients === null}
        empty="Empty" onValueChange={(v) => commit('client', v)}
      />
    </div>
  );
}

// Shaped to match PropertyRow in doc-properties.tsx exactly — same 28px rung, same
// 160–200px label button, same muted "Empty" value — so the link rows read as two
// more properties rather than a foreign control bolted underneath. A permanently
// bordered input here looked like a form dropped into a document.
function LinkRow({
  icon, label, value, options, loading, empty, onValueChange,
}: {
  icon: typeof Folder; label: string; value: string | null; options: ComboOption[];
  loading: boolean; empty: string; onValueChange: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.value === value)?.label;

  return (
    <div className="group flex min-h-7 items-start gap-2">
      <span className="-mx-1.5 inline-flex h-7 min-w-[160px] max-w-[200px] shrink-0 items-center gap-2 px-1.5 text-left text-ink-500">
        <Icon icon={icon} size={16} className="shrink-0" />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-ui text-ink-500">{label}</span>
      </span>
      <div className="prop-cell -mx-1.5 min-w-0 flex-1 px-1.5">
        {editing ? (
          <Combobox
            value={value}
            options={options}
            loading={loading}
            placeholder={`Search ${label.toLowerCase()}s…`}
            aria-label={`${label} this document belongs to`}
            onValueChange={(v) => { onValueChange(v); setEditing(false); }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="focus-ring w-full rounded-sm py-1 text-left text-ui text-ink-800"
            aria-label={current ? `${label}: ${current}. Change` : `Set ${label.toLowerCase()}`}
          >
            {current ?? <span className="text-ink-500">{empty}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
