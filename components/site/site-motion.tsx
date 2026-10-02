'use client';
// ── THE WEBSITE ARRIVES AS IT IS READ ───────────────────────────────────────
//
// One quiet component, mounted once on every page of the site (globals.css, "the website arrives as
// it is read"). What is still below the window when the page wakes waits, hidden (`data-shown=
// "false"`), and arrives as it scrolls into view. A part marked `data-reveal` arrives by itself; the
// parts inside a `data-reveal-group` arrive together when the group comes into view, in reading order,
// so a section's name, its heading and its list land as one sentence rather than three. What is
// already on screen, or above it, when the script wakes is left alone: it has been seen, and hiding it
// to bring it back is a flash.
//
// None of it is needed to read the page: with no script every word is simply there. Less motion keeps
// the fades and drops the movement (the stylesheet decides).

import * as React from 'react';

/** How far into the window a part comes before it arrives: a tenth of its height, from the bottom. */
const MARGIN = '0px 0px -10% 0px';
/** The most steps the last part of one arrival waits: past this, sequence starts to read as delay. */
const MAX_STEPS = 12;

export function SiteMotion() {
  React.useEffect(() => arrivals(document), []);
  return null;
}

/** How many steps a part takes up in its arrival: a heading's words spill past its own step. */
function weight(part: HTMLElement): number {
  if (part.dataset.reveal !== 'words') return 1;
  return 1 + Math.floor(part.querySelectorAll('.site-word').length / 2);
}

/** Top to bottom, and left to right along a row (tops within 16px are one row). */
function readingOrder(a: Element, b: Element): number {
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  return Math.round(ra.top / 16) - Math.round(rb.top / 16) || ra.left - rb.left;
}

/** Takes the arrival's marks off once the part has landed, so nothing of it outlives it: a part's own
    transitions (a hover wash, a press) are its again. */
function settle(part: HTMLElement) {
  const kind = part.dataset.reveal;
  const words = kind === 'words' ? part.querySelectorAll('.site-word') : null;
  const last = words ? words[words.length - 1] : part;
  const done = (e: TransitionEvent) => {
    const landed = kind === 'rule'
      ? e.target === part && e.pseudoElement === '::before' && e.propertyName === 'transform'
      : e.target === last && e.propertyName === 'opacity';
    if (!landed) return;
    part.removeEventListener('transitionend', done);
    part.removeAttribute('data-shown');
    part.style.removeProperty('--reveal-i');
  };
  part.addEventListener('transitionend', done);
}

/** A section's loops start from their first frame when it is first seen (user, 2026-09-28: "all
    animation start when they appear in viewport"). The gate in globals.css holds them at the start
    until then; this takes back the moment they ran before this script woke. Transitions are left
    alone: they are the arrival itself. */
function rewind(part: HTMLElement) {
  if (typeof part.getAnimations !== 'function' || typeof CSSAnimation === 'undefined') return;
  for (const a of part.getAnimations({ subtree: true })) if (a instanceof CSSAnimation) a.currentTime = 0;
}

export function arrivals(doc: Document): () => void {
  const win = doc.defaultView;
  if (!win || typeof win.IntersectionObserver !== 'function') return () => {};

  // Every part, gathered under what brings it in: its group, or itself.
  const groups = new Map<HTMLElement, HTMLElement[]>();
  for (const part of doc.querySelectorAll<HTMLElement>('[data-reveal]')) {
    const trigger = part.closest<HTMLElement>('[data-reveal-group]') ?? part;
    const parts = groups.get(trigger);
    if (parts) parts.push(part); else groups.set(trigger, [part]);
  }

  let waiting: HTMLElement[] = [];
  let frame = 0;
  const release = () => {
    frame = 0;
    const triggers = waiting.sort(readingOrder);
    waiting = [];
    // Whatever came into view together arrives together, in reading order: each thing a step behind
    // the one before it, and the parts of a group in sequence from there.
    triggers.forEach((trigger, first) => {
      let step = first;
      for (const part of groups.get(trigger) ?? []) {
        // Not drawn at this width, or in a panel that is not the one showing: simply there when it is.
        if (!part.getClientRects().length) {
          part.removeAttribute('data-shown');
          continue;
        }
        part.style.setProperty('--reveal-i', String(Math.min(step, MAX_STEPS)));
        settle(part);
        if (part.dataset.reveal === 'rule') rewind(part);
        part.setAttribute('data-shown', 'true');
        step += weight(part);
      }
    });
  };
  const io = new win.IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      waiting.push(e.target as HTMLElement);
    }
    if (waiting.length && !frame) frame = win.requestAnimationFrame(release);
  }, { rootMargin: MARGIN });

  const fold = win.innerHeight;
  for (const [trigger, parts] of groups) {
    // On screen or above it as the page wakes: already seen. (A part with no box, `display: none` at
    // this width, measures 0 and is left alone too: there is nothing to bring in.)
    if (trigger.getBoundingClientRect().top < fold) continue;
    for (const part of parts) part.setAttribute('data-shown', 'false');
    io.observe(trigger);
  }

  return () => {
    io.disconnect();
    win.cancelAnimationFrame(frame);
  };
}
