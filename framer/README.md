# Framer Gesture Components

Custom code components for Framer. A visitor turns on their camera, and their
**hand in the air** moves your slides — swipe left/right, hold an open palm to
play/pause, pinch to select.

Everything runs **inside the visitor's browser**. No video, no image and no
tracking data is ever uploaded anywhere.

| File | What it is |
| --- | --- |
| `GestureCameraNav.tsx` | The camera + hand tracking. This is the one you always need. |
| `GestureSlider.tsx` | Optional slider that follows the gestures automatically. |

---

## 1. Add the code to Framer

1. Open your Framer project.
2. Left panel → **Assets** → **Code** → **+** → **New Code File**.
3. Name it `GestureCameraNav`, delete the sample code, paste the **whole**
   `GestureCameraNav.tsx` file.
4. Repeat for `GestureSlider` if you want the ready-made slider.

No packages to install. The hand-tracking library loads from a CDN at runtime.

## 2. Put it on the page

Drag **Gesture Camera Nav** onto your page. A small floating panel in a corner
works well — around `280 × 200`. It is responsive, so any size is fine.

The camera **never turns on inside the Framer canvas**. Use **Preview** (open in
a new tab) or the **published site** to test it.

## 3. Connect it to your slider

Pick whichever one matches your site. You can use more than one at a time.

### Option A — Framer events (best for Framer's own components)

1. Select the component → **Properties** panel → keep **Framer events** on.
2. Open the **Interactions** tab.
3. You will see `onNext`, `onPrev`, `onFirst`, `onLast`, `onPlayPause`,
   `onSelect`, `onGesture`.
4. Wire `onNext` → your slider's **Next** action, `onPrev` → **Previous**.

### Option B — Click target (works with any slider that has arrow buttons)

1. In Framer, give your slider's next arrow a layer **name**, e.g. `Next`, and
   the previous arrow `Previous`.
2. Turn on **Click target** and leave the defaults:
   - Next CSS: `[data-framer-name='Next']`
   - Prev CSS: `[data-framer-name='Previous']`

Any CSS selector works — `#next-btn`, `.swiper-button-next`, etc.

### Option C — Keyboard

Turn on **Keyboard**. The component sends `ArrowRight` / `ArrowLeft` (and
`Home`, `End`, `Space`, `Enter`) to the page. Useful for lightboxes and
libraries that already listen to arrow keys.

### Option D — Use the included slider

Drop **Gesture Slider** on the same page and add your slides to it. It connects
itself, no setup needed.

## 4. Default gestures

| Gesture | Action |
| --- | --- |
| Move hand **left** quickly | Next |
| Move hand **right** quickly | Previous |
| **Open palm ✋** held ~0.65 s | Play / pause |
| **Fist ✊** held | Previous |
| **Victory ✌️** held | Next |
| **Pinch 👌** (thumb + index touch) | Select |

Every one of these is a dropdown in the properties panel. Set any gesture to any
action, or to **Do nothing** to switch it off.

Two tuning dials matter most:

- **Sensitivity** — higher means a smaller hand movement counts as a swipe.
  Start at `0.5`. If slides skip by accident, lower it.
- **Cooldown** — the quiet time after a gesture fires (default `900 ms`). Raise
  it if one swipe moves two slides.

## 5. Custom code on your own page

The component also broadcasts a browser event, so you can drive anything:

```js
window.addEventListener("zenboard:gesture", (event) => {
  const { action, gesture } = event.detail
  // action: "next" | "prev" | "first" | "last" | "playPause" | "select" | ...
  // gesture: "swipeLeft" | "openPalm" | "pinch" | ...
  console.log(action, gesture)
})

// or with the helper that is attached to window:
const stop = window.ZenGesture.subscribe(({ action }) => {
  if (action === "next") myCarousel.slideNext()
})
```

Paste that inside Framer → **Site Settings** → **General** → **Custom Code** →
*End of `<body>` tag*, or into an Embed layer.

---

## Troubleshooting

**Nothing happens on the Framer canvas.**
That is on purpose. Browsers block cameras in the editor's iframe. Test in
Preview (new tab) or on the published site.

**"Camera access was blocked".**
Click the camera icon in the browser address bar and allow it, then press
**Try again**. The site must be served over `https://` — Framer published sites
always are.

**It works on desktop but not inside another site's iframe.**
The parent page must allow it: `<iframe allow="camera; fullscreen">`.

**Slides jump two at a time.**
Lower **Sensitivity** or raise **Cooldown**.

**Swipe direction feels backwards.**
Swap the actions on **Swipe ←** and **Swipe →**, or turn **Mirror** off.

**It feels slow on older laptops.**
Lower **Tracking FPS** to `15`, and turn **Hand overlay** off.

**Poses fire while I am swiping.**
That is already prevented — poses are only read when the hand is still. If it
still happens, raise **Hold time**.

---

## Privacy

- The camera stream is only used in memory, frame by frame.
- Nothing is recorded, stored, or sent to a server.
- The model file and the tracking runtime are downloaded from a public CDN
  (jsDelivr / unpkg / Google's model host). You can self-host the `.task` model
  and point the **Model URL** property at your own copy.
- Visitors must press **Turn on camera** first (unless you switch **Start** to
  *Automatic*, which is not recommended).

## Browser support

Chrome, Edge, Safari 16+, Firefox, and mobile Safari / Chrome on Android.
Requires WebAssembly and `getUserMedia`. Falls back to a clear message when the
device has no camera.

## Accessibility

- Real `<button>` elements, keyboard focusable, with labels.
- Every recognised action is announced to screen readers via `aria-live`.
- Honours `prefers-reduced-motion`.
- Gestures are always an *addition* — arrows, dots, drag and arrow keys keep
  working, so nobody depends on having a camera or a free hand.

## Note for this repository

These files are for Framer only and are excluded from the Next.js build
(`tsconfig.json` → `exclude`, `eslint.config.mjs` → `globalIgnores`). They
import `framer` and `framer-motion`, which exist inside Framer's own build
environment, not in this app.
