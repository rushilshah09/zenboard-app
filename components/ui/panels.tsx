// The framed-panel CARD pattern now lives in the design system
// (design-system/src/components/ui/panel.tsx → mirrored to components/ds/ui/panel).
// This module re-exports it so existing call sites keep importing from
// '@/components/ui/panels', while all card styling (radius, elevation, surfaces,
// the single-border architecture) is token-driven and owned by the DS — change a
// token once and every panel across the app updates. Never restyle a card here.
export { Panel, PanelHeader, PanelBody, type PanelProps } from '@/components/ds/ui/panel';
