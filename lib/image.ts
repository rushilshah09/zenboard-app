// Client-side image intake. One canvas pipeline, two outputs:
//
//   · `downscaleImage` → a Blob, for images that go to storage (0033 image
//     blocks). This is the path that scales.
//   · `fileToDataUrl` → a data-URL, for the two places an inline value is still
//     right: page ICONS, and a cover on a page too new to have an id yet.
//
// Icons stay inline deliberately. An icon is 180px square (~10 KB), lives in its
// own `pages.icon` column rather than the content blob, and renders in LISTS —
// the documents rail draws dozens at once. Turning each into a stored file would
// trade ten kilobytes for a signed-URL round trip per row, which is the wrong
// trade in the only place it would be felt. Covers are the opposite case and
// moved to storage (§7H): 1600px, one per open document, and they sat in
// `pages.content`, which is re-read on every open and copied into
// `page_versions` on every save.
//
// They share `renderToCanvas` so the resize, the centre-crop and the format
// choice cannot drift between them — the thing that decides a picture's quality
// should not depend on where the bytes are about to be stored.
//
// Covers cap at 1600px wide; icons are centre-cropped to a square.

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type ImageOpts = { max: number; square?: boolean; quality?: number };

/**
 * Decode, resize and (optionally) centre-crop, returning the canvas plus the
 * MIME type it should be encoded as.
 *
 * WebP when the browser encodes it, else JPEG — except PNG/WebP sources, which
 * keep their alpha. The WebP probe is a one-pixel `toDataURL`, which is cheap
 * and, unlike a UA sniff, actually asks the encoder that will do the work.
 */
async function renderToCanvas(file: File, opts: ImageOpts): Promise<{ canvas: HTMLCanvasElement; mime: string; quality: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Not an image');
  if (file.size > MAX_FILE_BYTES) throw new Error('Image is too large (max 8 MB)');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image'));
      el.src = url;
    });
    const { max, square, quality = 0.85 } = opts;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2; sy = (sh - side) / 2; sw = side; sh = side;
    }
    const scale = Math.min(1, max / sw);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const webpOk = probe.toDataURL('image/webp', quality).startsWith('data:image/webp');
    const mime = webpOk ? 'image/webp' : (keepAlpha ? 'image/png' : 'image/jpeg');
    return { canvas, mime, quality };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downscaled bytes, for upload. */
export async function downscaleImage(file: File, opts: ImageOpts): Promise<{ blob: Blob; mime: string }> {
  const { canvas, mime, quality } = await renderToCanvas(file, opts);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw new Error('Could not encode image');
  return { blob, mime };
}

/** Downscaled bytes as a data-URL, for the fields that store one inline. */
export async function fileToDataUrl(file: File, opts: ImageOpts): Promise<string> {
  const { canvas, mime, quality } = await renderToCanvas(file, opts);
  return canvas.toDataURL(mime, quality);
}

/** `photo.heic` → `photo.webp`, so a stored file's name matches its real bytes. */
export function reencodedName(filename: string, mime: string): string {
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const stem = filename.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}.${ext}`;
}
