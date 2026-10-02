'use client';
// "Add to collection" (COLLECTION_PLAN K4, COLLECTION_VIEW_BRIEF §11). One field: paste a link into
// it and the item is collected at once; type a note or links and press Enter. Files are one row
// below — or dropped anywhere on the Collection.
import { useRef, useState } from 'react';
import { Link, Upload } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { MenuField } from '@/components/ds/ui/menu';
import { cn } from '@/lib/cn';
import { parseCollectable } from '@/lib/collect';
import { POP_LABEL, POP_ROW, POP_SEPARATOR } from './db-pop';

export function CollectComposer({ onCollect, onFiles, canUpload }: {
  /** Collect what was pasted or typed. The panel is closed by its owner. */
  onCollect: (text: string) => void;
  /** Files picked to add. */
  onFiles: (files: File[]) => void;
  /** False while the Collection's page is still being created: there is nowhere to upload to yet. */
  canUpload: boolean;
}) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className={POP_LABEL}>Add to collection</div>
      <div className="px-1 pb-1">
        <MenuField autoFocus value={text} aria-label="Link or note" placeholder="Paste a link or write a note"
          icon={<Icon icon={Link} size={16} />}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // Links pasted into an empty field are the whole act (§10): no Enter to press.
            if (text.trim()) return;
            const pasted = e.clipboardData.getData('text/plain');
            if (!parseCollectable(pasted).urls.length) return;
            e.preventDefault();
            onCollect(pasted);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing || !text.trim()) return;
            e.preventDefault();
            onCollect(text);
          }} />
      </div>
      <div className={POP_SEPARATOR} />
      <button type="button" className={cn(POP_ROW, 'zb-press disabled:cursor-default disabled:text-ink-500')} disabled={!canUpload}
        onClick={() => fileRef.current?.click()}>
        <Icon icon={Upload} size={16} className="text-ink-600" />
        Upload files
      </button>
      <input ref={fileRef} type="file" multiple hidden aria-hidden tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }} />
    </div>
  );
}
