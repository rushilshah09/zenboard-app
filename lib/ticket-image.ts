// ── SAVING A TICKET AS A PICTURE ────────────────────────────────────────────
//
// The saved pass is the SAME drawing the page shows (components/site/waitlist/ticket-art.ts), so it
// cannot drift from the ticket on screen: the front artwork is rasterised, then the print (name,
// number, address) is written over it.
//
// THE PRINT IS DRAWN ON THE CANVAS, NOT IN THE SVG, because a `<text>` inside an SVG loaded as an
// image is rendered with no access to the page's webfonts: it would quietly fall back to a system
// face. Drawn here, it uses the font the page set it in, in the logo glyphs' own gold ramp, laid
// along the same axis as on screen, with the same struck-in lip.
//
// The SVG is built in memory and is same-origin, so the canvas is never tainted and `toBlob` works.

import { DEFS, PRINT, PRINT_AXIS, PRINT_STOPS, TICKET_BOX, TICKET_FRONT } from '@/components/site/waitlist/ticket-art';

// 2×: a 900px request becomes an 1800px file, which is what social cards want.
const SCALE = 2;
const ADDRESS = 'zenboard.life';

function loadSvg(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ticket artwork failed to rasterise')); };
    img.src = url;
  });
}

/** The front of the ticket at `width` device pixels, with the print set in `family`. */
export async function drawPass({ width, number, name, family }: {
  width: number;
  /** The digits as they are printed, e.g. `081`. */
  number: string;
  name?: string | null;
  /** The font-family the page set the print in. */
  family: string;
}): Promise<HTMLCanvasElement | null> {
  const k = width / TICKET_BOX.width;
  const height = Math.round(TICKET_BOX.height * k);
  const { x, y, width: w, height: h } = TICKET_BOX;
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${width}" height="${height}" fill="none"><defs>${DEFS}</defs>${TICKET_FRONT}</svg>`;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try { ctx.drawImage(await loadSvg(markup), 0, 0, width, height); } catch { return null; }

  await document.fonts?.ready;
  const at = (px: number, py: number): [number, number] => [(px - x) * k, (py - y) * k];
  const gold = ctx.createLinearGradient(...at(PRINT_AXIS.x1, PRINT_AXIS.y1), ...at(PRINT_AXIS.x2, PRINT_AXIS.y2));
  for (const [offset, colour] of PRINT_STOPS) gold.addColorStop(Number(offset), colour);

  ctx.font = `450 ${PRINT.size * k}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  const lines: [string, { x: number; y: number }, CanvasTextAlign][] = [
    ...(name ? [[name, PRINT.name, 'left'] as [string, { x: number; y: number }, CanvasTextAlign]] : []),
    [number, PRINT.number, 'right'],
    [ADDRESS, PRINT.address, 'left'],
  ];
  for (const [text, pos, align] of lines) {
    const [tx, ty] = at(pos.x, pos.y);
    ctx.textAlign = align;
    // Struck in: the wall's shadow above, the lip catching light below, then the gold.
    ctx.fillStyle = 'rgba(84, 58, 14, 0.55)';
    ctx.fillText(text, tx, ty - 0.45 * k);
    ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
    ctx.fillText(text, tx, ty + 0.45 * k);
    ctx.fillStyle = gold;
    ctx.fillText(text, tx, ty);
  }
  return canvas;
}

/**
 * Rasterise the ticket `el` is showing at `width` CSS pixels and hand back a PNG blob.
 * Returns null when the browser refuses a canvas or the artwork cannot be drawn.
 */
export async function ticketBlob(el: HTMLElement, width = 900): Promise<Blob | null> {
  const print = el.querySelector('.zb-ticket-print');
  const family = print instanceof Element ? getComputedStyle(print).fontFamily || 'system-ui, sans-serif' : 'system-ui, sans-serif';
  const number = el.querySelector('.zb-ticket-number')?.textContent ?? '';
  const name = el.querySelector('.zb-ticket-name')?.textContent ?? null;
  const canvas = await drawPass({ width: width * SCALE, number, name, family });
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
