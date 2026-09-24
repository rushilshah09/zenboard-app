import type { NextConfig } from "next";

// The dev-preview harnesses are named `page.dev.tsx`, and `dev.tsx` is a page
// extension ONLY while `next dev` is running. A production build never sees them
// as routes, so none of their code is compiled or bundled.
//
// This is a SIZE constraint, not just tidiness: the 34 harnesses compiled to
// 3.6 MB of server output against the real app's 1.4 MB, which put the worker at
// 3.15 MiB gzipped — and Cloudflare refused the upload at the 3 MiB limit.
// Routing them to `notFound()` (app/dev-preview/layout.tsx, kept as a second
// line of defence) hides them but still ships every byte.
const devPreview = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  pageExtensions: devPreview
    ? ["dev.tsx", "tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js"],

  experimental: {
    // THE CLIENT CACHE, turned back on.
    //
    // Every route here is `force-dynamic`, and since Next 15 the `dynamic`
    // stale time defaults to ZERO — meaning a page is never reused, so going
    // Tasks → Projects → Tasks re-rendered the whole page on the server both
    // times. The second visit cost exactly as much as the first, for data that
    // had not changed.
    //
    // 30 seconds is the window in which a return visit paints INSTANTLY from
    // what the browser already has. It is safe to be that generous only
    // because of the other half of the pattern: `app/(app)/template.tsx`
    // stamps every render, and `RevalidateOnStale` notices a stamp that came
    // out of a cache and refreshes behind the user. Fast first, correct a
    // moment later — which is how Notion feels, and why it is worth doing in
    // that order.
    //
    // `static` (5 min by default) covers prefetched and static payloads; 180s
    // is a deliberate trim, because the shell and loading states here are
    // cheap to re-fetch and a stale nav rail is more confusing than a slow one.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

// Enables getCloudflareContext() (Cloudflare bindings/env) during `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
