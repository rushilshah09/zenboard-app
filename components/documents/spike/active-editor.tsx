'use client';
// M0 spike — the single live ProseMirror instance, mounted into whichever
// block has focus (Gate A). Everything else on the page stays static HTML.
// PM history is NOT installed: every doc change is reported upward so the
// app-level History (history.ts) is the one undo authority (Gate B).
import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { toggleMark } from 'prosemirror-commands';
import { schema, spansToDoc, docToSpans, plain, splitSpans, type RichSpan, type SpikeKind } from './rich';

export type ActiveEditorHandle = { view: EditorView | null };

// '# ' / '## ' / '### ' / '- ' typed at the start of a text block → convert.
const MD_PREFIX: [RegExp, SpikeKind][] = [
  [/^### $/, 'h3'], [/^## $/, 'h2'], [/^# $/, 'h1'], [/^- $/, 'bullet'],
];

export function ActiveEditor({ block, offset, onText, onConvert, onSplit, onMergeBack, onNavigate, onMove, onUndo, onRedo, onKeyPaint, handleRef }: {
  block: { id: string; type: SpikeKind; spans: RichSpan[] };
  offset: number;
  // Reports carry the new spans + caret offsets so the parent owns all state.
  onText: (spans: RichSpan[], caretBefore: number, caretAfter: number) => void;
  onConvert: (kind: SpikeKind, literal: RichSpan[]) => void;
  onSplit: (before: RichSpan[], after: RichSpan[]) => void;
  onMergeBack: () => void;
  onNavigate: (dir: -1 | 1) => void;
  onMove: (dir: -1 | 1) => boolean;
  onUndo: () => boolean; onRedo: () => boolean;
  onKeyPaint: (paintMs: number, syncMs: number) => void;
  handleRef: React.MutableRefObject<ActiveEditorHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Latest callbacks without re-creating the view. Synced in a layout effect
  // (before any PM event can fire) to satisfy react-hooks/refs.
  const cb = useRef({ onText, onConvert, onSplit, onMergeBack, onNavigate, onMove, onUndo, onRedo, onKeyPaint });
  useLayoutEffect(() => {
    cb.current = { onText, onConvert, onSplit, onMergeBack, onNavigate, onMove, onUndo, onRedo, onKeyPaint };
  });

  useEffect(() => {
    const host = hostRef.current!;
    const doc = spansToDoc(block.spans);
    const max = doc.content.size - 1; // inline positions live in [1, size-1]
    const sel = TextSelection.create(doc, Math.max(1, Math.min(1 + offset, max)));

    const view: EditorView = new EditorView(host, {
      state: EditorState.create({
        doc, selection: sel,
        plugins: [
          keymap({
            'Mod-z': () => cb.current.onUndo(),
            'Mod-Shift-z': () => cb.current.onRedo(),
            'Mod-y': () => cb.current.onRedo(),
            'Mod-b': toggleMark(schema.marks.b),
            'Mod-i': toggleMark(schema.marks.i),
            'Mod-u': toggleMark(schema.marks.u),
            'Mod-Shift-s': toggleMark(schema.marks.s),
            'Mod-e': toggleMark(schema.marks.c),
            'Mod-Shift-ArrowUp': () => cb.current.onMove(-1),
            'Mod-Shift-ArrowDown': () => cb.current.onMove(1),
            'Enter': (state) => {
              const at = state.selection.head - 1;
              const [a, b] = splitSpans(docToSpans(state.doc), Math.max(0, at));
              cb.current.onSplit(a, b);
              return true;
            },
            'Backspace': (state) => {
              if (state.selection.empty && state.selection.head <= 1 && state.selection.$head.parentOffset === 0) {
                cb.current.onMergeBack();
                return true;
              }
              return false;
            },
            'ArrowUp': (state) => {
              if (state.selection.empty && state.selection.head <= 1) { cb.current.onNavigate(-1); return true; }
              return false;
            },
            'ArrowDown': (state) => {
              if (state.selection.empty && state.selection.head >= state.doc.content.size - 1) { cb.current.onNavigate(1); return true; }
              return false;
            },
          }),
        ],
      }),
      dispatchTransaction(tr: Transaction) {
        const t0 = performance.now();
        const caretBefore = view.state.selection.head - 1;
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) {
          const spans = docToSpans(next.doc);
          const caretAfter = next.selection.head - 1;
          cb.current.onText(spans, caretBefore, caretAfter);
          // Markdown block conversion — after the literal text (incl. the just-
          // typed space) is committed to the app model, so one undo restores it.
          if (block.type === 'text') {
            const text = plain(spans);
            for (const [re, kind] of MD_PREFIX) {
              if (re.test(text)) { cb.current.onConvert(kind, spans); break; }
            }
          }
          const syncMs = performance.now() - t0; // JS cost: PM apply + span sync + history
          requestAnimationFrame(() => cb.current.onKeyPaint(performance.now() - t0, syncMs));
        }
      },
    });
    const handle = handleRef.current;
    handle.view = view;
    view.focus();
    return () => { handle.view = null; view.destroy(); };
    // The parent remounts via `key` whenever block identity/type/position
    // changes; spans changes from our own typing must NOT remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, block.type]);

  return <div ref={hostRef} className="sp-pm" style={{ display: 'contents' }} />;
}
