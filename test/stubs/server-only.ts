// `server-only` throws by design when a module reaches a client bundle. Vitest
// runs plain Node with no Next.js transform, so it follows the import literally
// and fails to resolve the package at all.
//
// The chain is legitimate and only exists at the type level in a real build: a
// client store imports a `'use server'` action, and Next replaces that module
// with an RPC stub on the client, so the server module never ships. `next build`
// proves that; this stub just lets the test runner walk the same graph.
export {};
