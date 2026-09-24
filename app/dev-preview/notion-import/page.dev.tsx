'use client';
// Dev-only harness for the Notion import dialog.
//
// It exists because the Documents harness re-enters a document on every
// interaction, so the grid toolbar that carries the Import button could not be
// clicked reliably — and "the button is wired, so the modal must open" is
// inference, not observation. This is the smallest tree that renders the real
// component, so opening it is a fact rather than an assumption.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ds/ui';
import { NotionImportModal } from '@/components/documents/notion-import';

export default function NotionImportHarness() {
  const [open, setOpen] = useState(false);
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <Button variant="secondary" onClick={() => setOpen(true)}>Import</Button>
      <NotionImportModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
