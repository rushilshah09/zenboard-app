import * as React from "react";
import { Bell, Inbox } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { IconButton } from "./icon-button";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Button } from "./button";
import { EmptyState } from "./states";

// design-system.md §4.42 — a persistent, addressed message about something that
// happened, usually by someone else. Bell badge is berry (attention), not red
// (alarm). Reading the feed does NOT mark read; clicking a row does.

export interface Notification {
  id: string;
  actor: string;
  verb: string;
  object: string;
  context?: string;
  time: string; // relative, e.g. "2h"
  unread?: boolean;
  mention?: boolean;
  section: "Today" | "Earlier this week" | "Older";
}

export interface NotificationsBellProps {
  items: Notification[];
  onRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationsBell({ items, onRead, onMarkAllRead }: NotificationsBellProps) {
  const [tab, setTab] = React.useState<"All" | "Unread" | "Mentions">("All");
  const unread = items.filter((n) => n.unread).length;
  const shown = items.filter((n) => (tab === "All" ? true : tab === "Unread" ? n.unread : n.mention));
  const sections = ["Today", "Earlier this week", "Older"] as const;

  return (
    <Popover>
      {/* The trigger is the BUTTON — ARIA on a span is a violation. The badge
          is a sibling overlay; the count lives in the button's label (§4.7). */}
      <span className="relative inline-flex">
        <PopoverTrigger asChild>
          <IconButton
            label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            icon={<Bell className="size-4" />}
            variant="ghost"
          />
        </PopoverTrigger>
        {unread > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5">
            <Badge variant="count" count={unread} />
          </span>
        )}
      </span>
      <PopoverContent flush align="end" className="w-[400px] max-w-[calc(100vw-32px)]">
        <div className="flex max-h-[520px] flex-col">
          <header className="flex items-center gap-3 border-b border-line-soft px-3 pb-2 pt-3">
            <h3 className="flex-1 text-title-4 text-ink-900">Notifications</h3>
            <Button variant="quiet" size="xs" onClick={onMarkAllRead}>
              Mark all read
            </Button>
          </header>
          <div role="tablist" aria-label="Filter notifications" className="flex gap-1 border-b border-line-soft px-3 py-2">
            {(["All", "Unread", "Mentions"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "focus-ring h-7 rounded-sm px-2.5 text-ui transition-colors duration-instant",
                  tab === t ? "bg-paper-4 font-medium text-ink-900" : "text-ink-600 hover:bg-paper-3",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1 [overscroll-behavior:contain]">
            {shown.length === 0 ? (
              <EmptyState
                size="inline"
                illustration={<Inbox className="size-8" strokeWidth={1.5} />}
                title="You're all caught up"
                description="Notifications about mentions, comments, and due tasks will land here."
              />
            ) : (
              sections.map((sec) => {
                const rows = shown.filter((n) => n.section === sec);
                if (!rows.length) return null;
                return (
                  <div key={sec}>
                    <div className="sticky top-0 bg-paper px-3 py-1.5 text-overline uppercase text-ink-500">{sec}</div>
                    {rows.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onRead(n.id)}
                        className={cn(
                          "focus-ring relative flex w-full items-start gap-3 rounded-sm p-3 text-start transition-colors duration-instant hover:bg-paper-3",
                          n.unread && "bg-berry-050",
                        )}
                      >
                        {n.unread && <span aria-hidden className="absolute start-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-berry-500" />}
                        <Avatar name={n.actor} size="md" decorative />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body text-ink-700">
                            <span className="font-medium text-ink-900">{n.actor}</span> {n.verb}{" "}
                            <span className="font-medium text-ink-900">{n.object}</span>
                          </span>
                          {n.context && <span className="block text-meta text-ink-500">{n.context}</span>}
                        </span>
                        <span className="shrink-0 font-mono text-mono-sm text-ink-400">{n.time}</span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
