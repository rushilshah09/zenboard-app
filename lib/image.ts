// Client-side image intake for covers and page icons. Files are downscaled on
// a canvas and stored inline as data-URLs inside the page content / icon field,
// so uploads work with no storage bucket. Covers cap at 1600px wide; icons are
// center-cropped to a square.

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function fileToDataUrl(
  file: File,
  opts: { max: number; square?: boolean; quality?: number },
): Promise<string> {
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
    // WebP when the browser encodes it, else JPEG. PNGs with alpha stay PNG.
    const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
