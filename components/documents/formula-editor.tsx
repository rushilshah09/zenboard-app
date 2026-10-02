'use client';
// The formula language's authoring surface — one component, both surfaces.
//
// Built around a single affordance: THE RESULT, LIVE, UNDER THE FIELD. A formula
// language without one is a guessing game — save, look at the row, come back,
// change a bracket. Notion shows the result while you type and that is the one
// reason its formulas are usable by people who do not write code. Ours evaluates
// on every keystroke because the evaluator is synchronous over a row already in
// memory; there is nothing to wait for.
//
// The ONLY thing it needs from a host is `evaluate`. A page hands it
// `evalPageFormula` over its property list; a database hands it `evalFormula`
// over a sample row. Neither shape leaks in here, which is what lets the same
// editor serve both without either importing the other's model.
import { useId } from 'react';
import { formulaDisplay } from '@/lib/page-formula';
import type { FormulaValue } from '@/lib/db-engine';

export type FormulaEditorProps = {
  expr: string;
  onExpr: (expr: string) => void;
  /** Evaluate `expr` in the host's context. `null` means empty OR invalid. */
  evaluate: (expr: string) => FormulaValue;
  /**
   * What the live result is computed against, when that is not obvious. A
   * database formula applies to every row but can only be previewed against
   * one, and not saying which would make a surprising number look like a bug.
   */
  sampleLabel?: string;
};

export function FormulaEditor({ expr, onExpr, evaluate, sampleLabel }: FormulaEditorProps) {
  // Ids must be unique: two of these can be mounted at once (a page property
  // popover behind a database header menu), and a duplicated id would point
  // `aria-describedby` at the wrong result.
  const uid = useId();
  const exprId = `fx-expr-${uid}`;
  const resultId = `fx-result-${uid}`;

  const trimmed = expr.trim();
  const value = trimmed ? evaluate(expr) : null;
  const shown = formulaDisplay(value);
  // Empty, invalid and "correctly evaluates to nothing" are all `null` to the
  // engine. Here there is a person to tell apart the middle one — the only one
  // of the three they can act on.
  const state = !trimmed ? 'empty' : value === null ? 'invalid' : 'ok';

  return (
    <div className="px-0.5 pt-2.5">
      <label className="mb-1 block text-overline text-ink-500" htmlFor={exprId}>
        Expression
      </label>
      <textarea
        id={exprId} value={expr} onChange={(e) => onExpr(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
        placeholder={'prop("Rate") * prop("Hours")'}
        spellCheck={false} autoComplete="off" data-1p-ignore data-lpignore="true"
        aria-describedby={resultId}
        className="w-full resize-none rounded-sm border border-line-strong bg-surface-raised px-2 py-1.5 font-mono text-caption text-ink-800 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      />
      <div id={resultId} role="status" className="flex min-h-5 items-center gap-1.5 pt-1 text-caption">
        {state === 'ok' && (
          <>
            <span className="text-ink-500">=</span>
            <span className="truncate text-ink-800">{shown || 'nothing'}</span>
            {sampleLabel && <span className="shrink-0 truncate text-ink-500">· {sampleLabel}</span>}
          </>
        )}
        {state === 'invalid' && <span className="text-danger-600">That expression isn&rsquo;t valid.</span>}
        {state === 'empty' && (
          <span className="text-ink-500">
            Reference a property with <span className="font-mono">prop(&quot;Name&quot;)</span>.
          </span>
        )}
      </div>
    </div>
  );
}
