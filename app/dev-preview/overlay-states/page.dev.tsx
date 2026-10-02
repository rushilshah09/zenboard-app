'use client';
// Dev-only harness for OVERLAY STATES — every kind of place a state wash lands
// on the raised tier: a highlighted menu row carrying a shortcut and a
// description, a selected command item, a highlighted select option, a hovered
// radio card, a pressed toggle, and the New project dialog's cards. Built for
// the two-theme overlay sweep (2026-09-12), which found these rows invisible
// (a state painted in the popover's own tone) or below AA in dark (faint text
// on a washed popover). No session needed; 404s in production.
import { useState, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  Button, Select, RadioGroup, RadioCard,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ds/ui';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandShortcut } from '@/components/ds/ui/command';
import { NewProjectModal } from '@/components/projects/new-project-modal';

export default function OverlayStatesPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pressed, setPressed] = useState(true);
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="min-h-dvh bg-background p-6 text-ink-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <Section title="Menu row with a shortcut and a description">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              <DropdownMenuItem keys={['mod', 'D']} description="Copies its sections and tasks">Duplicate</DropdownMenuItem>
              <DropdownMenuItem keys={['mod', 'E']} description="Moves it out of your active list">Archive</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger>Delete project</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="Command item with a shortcut">
          <div className="w-80 overflow-hidden rounded-lg border border-line-strong bg-popover">
            <Command>
              <CommandInput placeholder="Search actions" />
              <CommandList>
                <CommandGroup heading="Actions">
                  <CommandItem>New task<CommandShortcut>⌘N</CommandShortcut></CommandItem>
                  <CommandItem>New document<CommandShortcut>⌘⇧D</CommandShortcut></CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </Section>

        <Section title="Select option">
          <div className="w-64">
            <Select
              aria-label="Status"
              defaultValue="doing"
              groups={[{ label: 'Status', options: [
                { value: 'todo', label: 'To do' },
                { value: 'doing', label: 'In progress' },
                { value: 'done', label: 'Done' },
              ] }]}
            />
          </div>
        </Section>

        <Section title="Radio card and pressed toggle">
          <RadioGroup defaultValue="blank" className="grid w-full max-w-md gap-2">
            <RadioCard value="blank" label="Blank project" description="Start from scratch" />
            <RadioCard value="launch" label="Client launch" description="4 sections · 12 tasks" />
          </RadioGroup>
          <Button toggle aria-pressed={pressed} onClick={() => setPressed((p) => !p)}>Bold</Button>
        </Section>

        <Section title="New project dialog">
          <Button onClick={() => setModalOpen(true)}>Open new project</Button>
          <NewProjectModal open={modalOpen} onOpenChange={setModalOpen} />
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-3">
      <h2 className="text-overline text-ink-500">{title}</h2>
      {children}
    </section>
  );
}
