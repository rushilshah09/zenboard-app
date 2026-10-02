// ── SAVING A TICKET AS A PICTURE ────────────────────────────────────────────
//
// The ticket on screen is two things: the artwork (public/site/ticket.svg) and the person's number
// drawn over it in HTML. The saved file is made the same way — the artwork rasterised, then the
// number written on top — so there is ONE drawing, not a second hand-built copy that drifts from
// it the first time the artwork changes.
//
// The first version of this file redrew the whole ticket on a canvas: the foil ramp, the notches,
// the teeth, the frame, the lockup. Every one of those was a second definition of something the
// design already specified, and all of it became wrong the moment the real Figma artwork arrived.
//
// THE NUMBER IS DRAWN, NOT BAKED IN, because a `<text>` inside an SVG loaded as an `<img>` is
// rendered by the browser with no access to the page's webfonts — it would quietly fall back to a
// system face and the saved ticket would be set in a different typeface from the one on screen.
// Drawing it on the canvas lets it use the number's own computed font.
//
// Same-origin SVG, so the canvas is never tainted and `toBlob` works.

import { TICKET_HOLDER, TICKET_CARD, TICKET_RATIO, CARD_INSET } from '@/components/site/waitlist/golden-ticket';

// 2×: a 600px request becomes a 1200px file, which is the width social cards want and about a
// quarter the bytes 3× produced (2.5 MB for one ticket is not a thing anyone wants to post).
const SCALE = 2;

/** Where the small print sits, as shares of the CARD's own box — the same measurements
 *  app/ticket.css positions the on-screen print with (Figma's own coordinates). */
const NUMBER_RIGHT = 0.9226;
const NAME_LEFT = 0.0783;
const BASELINE = 0.8798;
const NAME_BASELINE = 0.1206;
const PRINT_SIZE = 0.02513;

const cache = new Map<string, Promise<HTMLImageElement>>();

/** One of the two drawings, fetched once and shared: the PNG writer and the 3D textures both want
 *  them, and two requests for the same cached file is two decodes. */
export function loadArt(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { cache.delete(src); reject(new Error(`ticket artwork failed to load: ${src}`)); };
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

/** The card alone — the face of the 3D card, and the layer that slides out of the holder. */
export async function drawCard({ width, number, name, font, colour }: {
  width: number; number: string; name?: string | null; font: string; colour: string;
}): Promise<HTMLCanvasElement | null> {
  const height = Math.round(width / (1810.5 / 1116.48));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let art: HTMLImageElement;
  try { art = await loadArt(TICKET_CARD); } catch { return null; }
  ctx.drawImage(art, 0, 0, width, height);
  ctx.font = font.replace('{size}', String(width * PRINT_SIZE));
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillText(number, width * NUMBER_RIGHT, height * BASELINE);
  if (name) {
    ctx.textAlign = 'left';
    ctx.fillText(name, width * NAME_LEFT, height * NAME_BASELINE);
  }
  return canvas;
}

/** The holder alone — the black box the card sits in. */
export async function drawHolder(width: number): Promise<HTMLCanvasElement | null> {
  const height = Math.round(width / TICKET_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try { ctx.drawImage(await loadArt(TICKET_HOLDER), 0, 0, width, height); } catch { return null; }
  return canvas;
}

/**
 * THE WHOLE TICKET, card seated in its holder — what someone saves.
 *
 * Composed from the SAME two drawings the page shows and the 3D card is textured with, so a saved
 * ticket cannot drift from the one on screen.
 */
export async function drawTicket({ width, number, name, font, colour }: {
  width: number;
  /** The digits as they are printed, e.g. `081`. */
  number: string;
  name?: string | null;
  /** A CSS font shorthand's family and weight, taken from what is on screen. */
  font: string;
  colour: string;
}): Promise<HTMLCanvasElement | null> {
  const height = Math.round(width / TICKET_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try { ctx.drawImage(await loadArt(TICKET_HOLDER), 0, 0, width, height); } catch { return null; }
  const card = await drawCard({ width: Math.round(width * CARD_INSET.width), number, name, font, colour });
  if (!card) return null;
  ctx.drawImage(card, Math.round(width * CARD_INSET.left), Math.round(height * CARD_INSET.top));
  return canvas;
}

/** How the number is set, read off the element that is showing it — so a saved ticket and a 3D one
 *  are in the same typeface and colour as the page, never a system fallback. */
export function numberStyle(el: HTMLElement): { font: string; colour: string; text: string; name: string | null } {
  const numberEl = el.querySelector('.zb-ticket-number');
  const nameEl = el.querySelector('.zb-ticket-name');
  const name = nameEl instanceof HTMLElement ? nameEl.textContent : null;
  if (!(numberEl instanceof HTMLElement)) return { font: '500 {size}px system-ui, sans-serif', colour: '#f2dea8', text: '', name };
  const cs = getComputedStyle(numberEl);
  return {
    font: `${cs.fontWeight || '500'} {size}px ${cs.fontFamily || 'system-ui, sans-serif'}`,
    colour: cs.color || '#f2dea8',
    text: numberEl.textContent ?? '',
    name,
  };
}

/**
 * Rasterise the ticket `el` is showing at `width` CSS pixels and hand back a PNG blob.
 * Returns null when the browser refuses a canvas or the artwork cannot be fetched.
 */
export async function ticketBlob(el: HTMLElement, width = 900): Promise<Blob | null> {
  const { font, colour, text, name } = numberStyle(el);
  const canvas = await drawTicket({ width: width * SCALE, number: text, name, font, colour });
  if (!canvas) return null;
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Save a blob under `filename`, then release the object URL. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next frame: revoking synchronously can cancel the download in some browsers.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
