// The loading boundary for every /(app) route — Next renders this while the
// page's data is in flight, so a navigation paints the new screen's shape
// immediately instead of freezing on the old one.
//
// The fallback itself lives in components/shell/app-loading.tsx; see the note
// there about importing DS pieces from their modules rather than the barrel,
// which is what makes this file safe to sit in every route's module graph.
export { AppLoading as default } from '@/components/shell/app-loading';
