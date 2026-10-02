// ── THE PAGE BLUEPRINT ──────────────────────────────────────────────────────
//
// The website and SEO plan (claude.ai/code/artifact/e19cb780-07dd-4f4d-beaa-fbf7b096af8b): every page
// answers the same eight questions, in the same order, so a reader who stops early still leaves with the
// answer. These are those answers' shapes, on the page's own lattice, so a new page is its words and its
// pictures and nothing else:
//
//   1 What problem does Zenboard solve?   `PageHero`: the problem in the reader's words, then the promise
//   2 Who is it for?                       `PageHero`'s `who`: the audience named, with a link to its page
//   3 Why does this matter?               `SectionHead` + `Points`: the cost, with no invented statistic
//   4 How does Zenboard solve it?         `Proof`: three points, the product itself working, one screen each
//   5 What does the workflow look like?   `Steps`: one real job from start to finish
//   6 Why not separate tools?             `Replaces`: the tools in use now, and where each job moves
//   7 Why trust Zenboard?                 `Points` again: the live product, import and export, your data
//   8 What next?                          `Closing`: start free and see it working, and the pages it works with
//
// Every claim a page makes is one the product keeps today (the plan's truth table: one owner, clients on
// a portal, no seats, no built-in AI, no online payments). site.test.ts holds the pages to it.

import Link from 'next/link';
import * as React from 'react';
import { ArrowRight, type IconType } from '@/components/ds/icons';
import { Icon, button, cardInteractiveClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { type MarkPlacement } from './halftone';
import { SIGN_UP, SIGN_UP_LABEL } from './site-chrome';
import { CardLine, Cell, Eyebrow, IconTile, Row, Stage, type Field, type Hue } from './visual';
import { Title, Words } from './words';

/** A lobe of the mark rising from a picture's outer bottom corner (the areas' own placements). */
export const LOBE_RIGHT: MarkPlacement = { x: 1.1, y: 1.1, size: 1.5, turn: 0.5 };
export const LOBE_LEFT: MarkPlacement = { x: -0.1, y: 1.1, size: 1.5, turn: -0.25 };

/** Where "See it working" goes: the product itself, on a sample studio's day, on the home page. */
export const SEE_IT = '/#product';

const step = (n: number) => ({ '--rise-step': n }) as React.CSSProperties;

/** The two actions every page offers, in the same order everywhere: start, or look first. */
function Actions({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)} style={style}>
      <Link href={SIGN_UP} className={button({ variant: 'primary', size: 'lg' })}>{SIGN_UP_LABEL}</Link>
      <Link href={SEE_IT} className={cn(button({ variant: 'ghost', size: 'lg' }), 'group')}>
        See it working
        <Icon icon={ArrowRight} size={16} nudge="end" />
      </Link>
    </div>
  );
}

/**
 * THE FIRST SCREEN (questions 1, 2 and 8): the page's name as a tag, the problem and the promise as a
 * two-tone title, the line under it, who it is for, and the two actions; beside it, the product doing
 * the thing, on its chapter's picture. It arrives on CSS alone, the title a word at a time.
 */
export function PageHero({ hue, icon, eyebrow, title, then, lede, who, field, mark = LOBE_RIGHT, visual }: {
  hue: Hue;
  icon: IconType;
  eyebrow: string;
  /** The headline's first clause, in ink… */
  title: string;
  /** …and its second, in the quieter tone (words.tsx `Title`). */
  then: string;
  lede: React.ReactNode;
  /** Who it is for, named plainly, with a link to their own page where there is one. */
  who?: React.ReactNode;
  field: Field;
  mark?: MarkPlacement;
  visual: React.ReactNode;
}) {
  const words = title.split(' ').length;
  return (
    <Row aria-labelledby="page-title">
      <Cell pad className="flex flex-col justify-center pb-14 pt-16 sm:pb-20 sm:pt-20 lg:col-span-6 lg:pb-24 lg:pt-24">
        <Eyebrow hue={hue} icon={icon} className="site-rise zb-enter self-start">{eyebrow}</Eyebrow>
        <h1 id="page-title" className="site-rise-words zb-enter mt-6 max-w-[16ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline" style={step(1)}>
          <Words>{title}</Words>{' '}<span className="text-site-second"><Words from={words}>{then}</Words></span>
        </h1>
        <div className="site-rise zb-enter mt-6 max-w-[540px] text-lead leading-6 text-ink-600" style={step(5)}>{lede}</div>
        {who && <p className="site-rise zb-enter mt-4 max-w-[540px] text-ui text-ink-500" style={step(6)}>{who}</p>}
        <Actions className="site-rise zb-enter mt-8" style={step(7)} />
      </Cell>
      <Stage field={field} mark={mark} className="min-h-[26rem] sm:min-h-[34rem] lg:col-span-6">
        {visual}
      </Stage>
    </Row>
  );
}

/** A section's opening, the same everywhere on the site (`.site-head`): its name as a tag, a two-tone
 *  title, and a line beside it on a wide screen. */
export function SectionHead({ id, hue = 'neutral', icon, eyebrow, title, then, lede }: {
  id: string; hue?: Hue; icon: IconType; eyebrow: string; title: string; then: string; lede?: React.ReactNode;
}) {
  return (
    <Cell pad className="site-head">
      <div data-reveal-group className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
        <div>
          <Eyebrow hue={hue} icon={icon} data-reveal="rise">{eyebrow}</Eyebrow>
          <h2 id={id} data-reveal="words" className="mt-6 text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline"><Title then={then}>{title}</Title></h2>
        </div>
        {lede && <p data-reveal="rise" className="max-w-[416px] text-lead leading-6 text-ink-600">{lede}</p>}
      </div>
    </Cell>
  );
}

export type Point = { icon: IconType; title: string; body: string; href?: string; link?: string };

/** Three or four short points, a cell each: the cost (question 3) and the reasons to trust it (7). */
export function Points({ points, hue }: { points: Point[]; hue?: Hue }) {
  const span = points.length === 4 ? 'md:col-span-6 lg:col-span-3' : points.length === 2 ? 'md:col-span-6' : 'md:col-span-6 lg:col-span-4';
  return (
    <>
      {points.map((p) => (
        <Cell key={p.title} pad data-reveal-group className={cn('flex flex-col gap-5 py-8 sm:py-10', span)}>
          <span data-reveal="rise"><IconTile icon={p.icon} hue={hue} /></span>
          <CardLine title={p.title} body={p.body} className="max-w-[26rem]" />
          {p.href && (
            <Link href={p.href} data-reveal="rise" className="focus-ring group mt-auto inline-flex items-center gap-1 self-start rounded-xs text-ui font-medium text-ink-900">
              {p.link ?? 'Learn more'}<Icon icon={ArrowRight} size={14} nudge="end" />
            </Link>
          )}
        </Cell>
      ))}
    </>
  );
}

/** THE PROOF (question 4): one row per point, its words beside the product doing it, the rows turning
 *  sides down the page the way the home page's chapters do. */
export function Proof({ field, rows }: {
  field: Field;
  rows: { icon: IconType; hue?: Hue; title: string; body: string; visual: React.ReactNode; field?: Field; href?: string; link?: string }[];
}) {
  return (
    <>
      {rows.map((r, i) => {
        const flip = i % 2 === 1;
        return (
          <React.Fragment key={r.title}>
            <Cell pad data-reveal-group className={cn('flex flex-col justify-center gap-5 py-12 sm:py-16 lg:col-span-5', flip ? 'lg:order-2' : '')}>
              <span data-reveal="rise" className="flex items-center gap-3">
                <IconTile icon={r.icon} hue={r.hue} />
                <span className="text-ui font-medium tabular-nums text-ink-500">{String(i + 1).padStart(2, '0')}</span>
              </span>
              <h3 data-reveal="words" className="max-w-[18ch] text-balance font-editorial text-title-1 text-ink-900"><Words>{r.title}</Words></h3>
              <p data-reveal="rise" className="max-w-[26rem] text-body-lg text-ink-600">{r.body}</p>
              {r.href && (
                <Link href={r.href} data-reveal="rise" className="focus-ring group inline-flex items-center gap-1 self-start rounded-xs text-ui font-medium text-ink-900">
                  {r.link ?? 'Learn more'}<Icon icon={ArrowRight} size={14} nudge="end" />
                </Link>
              )}
            </Cell>
            <Stage field={r.field ?? field} mark={flip ? LOBE_LEFT : LOBE_RIGHT} flip={flip} className={cn('min-h-[26rem] sm:min-h-[34rem] lg:col-span-7', flip ? 'lg:order-1' : '')}>
              {r.visual}
            </Stage>
          </React.Fragment>
        );
      })}
    </>
  );
}

/** THE WORKFLOW (question 5): one real job, start to finish, a numbered cell a step. */
export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  const span = steps.length === 3 ? 'md:col-span-4' : 'md:col-span-6 lg:col-span-3';
  return (
    <>
      {steps.map((s, i) => (
        <Cell key={s.title} pad data-reveal-group className={cn('flex flex-col gap-4 py-8 sm:py-10', span)}>
          <span data-reveal="rise" className="grid size-9 place-items-center rounded-md border border-line bg-surface-raised text-ui font-medium tabular-nums text-ink-900">{i + 1}</span>
          <CardLine title={s.title} body={s.body} className="max-w-[24rem]" />
        </Cell>
      ))}
    </>
  );
}

/** WHAT IT REPLACES (question 6): each tool in use now, the job it does, and where that job lives in
 *  Zenboard. A real table, because it is one: three columns a reader compares down. */
export function Replaces({ rows }: { rows: { now: string; job: string; place: string; href?: string }[] }) {
  return (
    <Cell pad className="pb-12 sm:pb-16">
      <div data-reveal="rise" className="overflow-hidden rounded-xl border border-line">
        <table className="w-full border-collapse text-start">
          <thead>
            <tr className="bg-surface-fill text-caption text-ink-600">
              <th scope="col" className="px-4 py-2.5 text-start font-medium sm:px-5">What you use now</th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium max-sm:hidden sm:px-5">The job it does</th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium sm:px-5">Where it lives in Zenboard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.now} className="border-t border-line-soft align-top">
                <th scope="row" className="px-4 py-3.5 text-start text-ui font-medium text-ink-900 sm:px-5">{r.now}</th>
                <td className="px-4 py-3.5 text-ui text-ink-600 max-sm:hidden sm:px-5">{r.job}</td>
                <td className="px-4 py-3.5 text-ui text-ink-900 sm:px-5">
                  {r.href ? <Link href={r.href} className="site-link focus-ring rounded-xs">{r.place}</Link> : r.place}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cell>
  );
}

/** WHAT NEXT (question 8): the page's last word, the two actions again, and the pages it works with. */
export function Closing({ title, then, lede, related }: {
  title: string; then: string; lede: string;
  related: { href: string; icon: IconType; hue?: Hue; title: string; body: string }[];
}) {
  return (
    <Row aria-labelledby="next-title">
      <Cell pad data-reveal-group className="site-head lg:col-span-6">
        <h2 id="next-title" data-reveal="words" className="max-w-[16ch] text-balance font-editorial text-headline-sm text-ink-900 sm:text-headline"><Title then={then}>{title}</Title></h2>
        <p data-reveal="rise" className="mt-6 max-w-[440px] text-lead leading-6 text-ink-600">{lede}</p>
        <Actions className="mt-8" />
      </Cell>
      <Cell pad className="flex flex-col justify-center gap-3 py-12 lg:col-span-6">
        <p data-reveal="rise" className="text-ui font-medium text-ink-500">Works with</p>
        {related.map((r) => (
          <Link key={r.href} href={r.href} data-reveal="rise" className={cardInteractiveClass('group flex items-start gap-4 p-5')}>
            <IconTile icon={r.icon} hue={r.hue} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-body-lg font-medium text-ink-900">
                {r.title}<Icon icon={ArrowRight} size={16} nudge="end" className="text-ink-500" />
              </span>
              <span className="mt-1 block text-ui text-ink-600">{r.body}</span>
            </span>
          </Link>
        ))}
      </Cell>
    </Row>
  );
}
