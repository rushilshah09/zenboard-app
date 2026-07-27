import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for the first staging deploy (no R2 incremental cache yet —
// add `incrementalCache: r2IncrementalCache` + an R2 bucket later for ISR).
export default defineCloudflareConfig();
