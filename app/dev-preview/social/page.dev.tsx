// ── FOUNDER BANNERS ─────────────────────────────────────────────────────────
//
// The founder's profile banners for LinkedIn (1584×396) and X (1500×500), composed from the
// website's own parts so a banner can never drift from the site it points to: the page's ground and
// its hairline, the drawn lockup, the hero's line in its two tones, and the showcase picture (the
// brand's rose warming into the day, the mark printed over it in light) with the product itself
// lifted onto it and cut by the frame: a glimpse of something larger than the banner, the same shape
// the website uses for it.
//
// Both networks lay the person's photo over the LOWER LEFT of the banner, so the words start to the
// right of it and nothing that matters sits beneath it. `?b=linkedin|x` picks a board; `&safe=1`
// draws the photo where each network puts it on a desktop profile, to check exactly that.
//
// A SERVER page so the board can be read from `searchParams`. Exported by headless Chrome at the
// board's own size and DPR 2 (the upload is twice the network's recommended pixels, so it stays sharp
// on a retina screen after the network re-encodes it):
//   chrome --headless=new --hide-scrollbars --window-size=1584,396 --force-device-scale-factor=2 \
//     --virtual-time-budget=20000 --screenshot=linkedin.png 'http://localhost:3000/dev-preview/social?b=linkedin'

import { Logo } from '@/components/ds/ui';
import { AppWindow } from '@/components/site/app-window';
import { Halftone } from '@/components/site/halftone';
import { Mesh } from '@/components/site/visual';

type Board = {
  width: number;
  height: number;
  /** Where the words start, clear of the photo. */
  words: number;
  /** Where the picture starts; the hairline between them is the site's own line. */
  picture: number;
  /** The profile photo each network lays over its banner on a desktop profile, in banner pixels. */
  photo: { x: number; y: number; d: number };
};

const BOARDS = {
  // LinkedIn draws the banner at about half size (804px wide) with a 152px photo 24px in from the
  // left, overlapping the banner's foot by about 100px.
  // The words start a little further in than the desktop photo needs, because the phone app's photo
  // is larger for the banner's size and reaches about 30% across.
  linkedin: { width: 1584, height: 396, words: 452, picture: 1024, photo: { x: 47, y: 199, d: 300 } },
  // X draws it at 600×200 with a 134px photo 16px in, overlapping the foot by half its height.
  x: { width: 1500, height: 500, words: 420, picture: 1008, photo: { x: 40, y: 333, d: 335 } },
} satisfies Record<string, Board>;

type BoardId = keyof typeof BOARDS;
const isBoard = (b: string | undefined): b is BoardId => !!b && b in BOARDS;

export default async function SocialPreview({ searchParams }: { searchParams: Promise<{ b?: string; safe?: string }> }) {
  const { b, safe } = await searchParams;
  const board = BOARDS[isBoard(b) ? b : 'linkedin'];
  const { width, height, words, picture, photo } = board;

  return (
    <div className="relative overflow-hidden bg-line" style={{ width, height }}>
      {/* `next dev` pins its badge to the corner of every page, and a capture would carry it. */}
      <style>{'nextjs-portal { display: none !important; }'}</style>
      {/* The words, on the page's own ground and nothing else. The hero's half mark was tried beside
          them (2026-09-29) and lost: its recognisable part lands under the profile photo, and what
          is left of it on a plain ground reads as grey noise. The print belongs on the picture. */}
      <div className="absolute inset-y-0 start-0 bg-background" style={{ width: picture - 1 }}>
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: words, width: picture - words - 40 }}>
          <Logo height={34} className="text-ink-900" />
          {/* The hero's one line, split where its sentence breaks, the second clause in the second tone. */}
          <h1 className="mt-8 font-editorial text-headline text-ink-900">
            <span className="block">One calm workspace</span>
            <span className="block text-site-second">to run your business.</span>
          </h1>
          <p className="mt-6 text-title-2 font-medium text-ink-700">zenboard.life</p>
        </div>
      </div>

      {/* The showcase picture, and the product on it at its real measure, cut by the frame. */}
      <div className="site-field site-field-hero absolute inset-y-0 end-0 overflow-hidden" style={{ width: width - picture }}>
        <Mesh />
        <Halftone mark={{ x: 0.62, y: 0.5, size: 1.5 }} pitch={7} className="site-screen" />
        <div className="absolute" style={{ left: 56, top: 56, width: 1180 }}>
          <div className="site-glass rounded-xl">
            <AppWindow />
          </div>
        </div>
      </div>

      {safe && (
        <span
          aria-hidden
          className="absolute rounded-full border-2 border-danger-600 bg-danger-100"
          style={{ left: photo.x, top: photo.y, width: photo.d, height: photo.d }}
        />
      )}
    </div>
  );
}
