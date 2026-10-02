'use client';
// ── EVERYONE ON THE WAITLIST ────────────────────────────────────────────────
//
// The table behind the admin gate (lib/admin.ts — the password, or an address in ADMIN_EMAILS). It is deliberately plain: this is a list of other
// people's email addresses, and the useful things to do with it are find one, count them, and take
// them somewhere else.
//
// SEARCH AND SORT HAPPEN HERE, not in the database. The whole list is already on the page — a
// waitlist is hundreds of rows, not millions — so filtering in the browser is instant and costs no
// round trip. When this list is big enough for that to stop being true, the honest fix is paging in
// `listWaitlist`, not a debounce here.
//
// THE EXPORT IS BUILT FROM WHAT IS ON SCREEN, so a filtered export contains exactly the rows the
// person filtered to — a Download that quietly gives you everything when you asked for a subset is
// the kind of thing people only discover after they have sent it to somebody.

import * as React from 'react';
import { Download, Search } from '@/components/ds/icons';
import { DataTable, Icon, TextInput, button, type Column } from '@/components/ds/ui';
import { todayISO } from '@/lib/date';
import { formatTicket } from '@/lib/waitlist';
import type { WaitlistRow } from '@/lib/waitlist-data';

/** One CSV field: quotes doubled, and the whole thing wrapped when it holds a comma, a quote or a
 *  newline. Without this an address or a name with a comma silently shifts every later column. */
function csvField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: WaitlistRow[]): string {
  const head = ['number', 'email', 'name', 'username', 'source', 'joined_at'];
  const body = rows.map((r) =>
    [String(r.number), r.email, r.name ?? '', r.username ?? '', r.source, r.created_at].map(csvField).join(','),
  );
  return [head.join(','), ...body].join('\r\n');
}

function joinedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  const [q, setQ] = React.useState('');

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    // A handle is searched the way it is written down — with or without the @, either is found.
    const handle = needle.replace(/^@+/, '');
    return rows.filter((r) =>
      r.email.toLowerCase().includes(needle) ||
      (r.name ?? '').toLowerCase().includes(needle) ||
      (!!handle && (r.username ?? '').includes(handle)) ||
      String(r.number).includes(needle),
    );
  }, [rows, q]);

  const download = () => {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // `todayISO()` and not `toISOString().slice(0, 10)`: the second is the UTC date, so in IST
    // every export between midnight and 05:30 is filed under YESTERDAY. Client code passes no zone
    // — the browser already knows which day the person downloading this is standing in.
    a.download = `zenboard-waitlist-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  };

  const columns: Column<WaitlistRow>[] = [
    {
      key: 'number', header: 'No.', numeric: true, width: '84px',
      sortBy: (r) => r.number,
      cell: (r) => <span className="tabular-nums text-ink-600">{formatTicket(r.number)}</span>,
    },
    {
      key: 'email', header: 'Email',
      sortBy: (r) => r.email,
      cell: (r) => <span className="text-ink-900">{r.email}</span>,
    },
    {
      key: 'name', header: 'Name', width: '180px',
      sortBy: (r) => r.name ?? '',
      cell: (r) => <span className="text-ink-600">{r.name ?? '–'}</span>,
    },
    {
      // Sorted and searched on the bare handle; shown with the @ because that is how a person reads
      // it back. An unclaimed one is an en dash, the same as an absent name — not an empty cell,
      // which reads as a rendering fault rather than a choice somebody made.
      key: 'username', header: 'Username', width: '160px',
      sortBy: (r) => r.username ?? '',
      cell: (r) => (r.username ? <span className="text-ink-900">@{r.username}</span> : <span className="text-ink-500">–</span>),
    },
    {
      key: 'source', header: 'Source', width: '120px',
      sortBy: (r) => r.source,
      cell: (r) => <span className="text-ink-600">{r.source}</span>,
    },
    {
      key: 'created_at', header: 'Joined', width: '190px',
      sortBy: (r) => r.created_at,
      cell: (r) => <span className="tabular-nums text-ink-600">{joinedAt(r.created_at)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search by email, name, username or number"
            icon={<Icon icon={Search} size={16} />}
            onClear={q ? () => setQ('') : undefined}
            aria-label="Search the waitlist"
          />
        </div>
        <button type="button" onClick={download} disabled={!shown.length} className={button({ variant: 'secondary', size: 'md' })}>
          <Icon icon={Download} size={16} className="mr-1.5" />
          Export CSV
        </button>
      </div>

      <p aria-live="polite" className="text-caption text-ink-500">
        {q
          ? `${shown.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} shown`
          : `${rows.length.toLocaleString('en-US')} on the list`}
      </p>

      <DataTable
        caption="Everyone on the Zenboard waitlist"
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        minWidth="880px"
      />
    </div>
  );
}
