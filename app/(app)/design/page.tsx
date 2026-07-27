// Design system — the DS portal. Auth is enforced by the (app) layout.
// A living reference of every component the app ships: side rail lists them
// (with real usage counts); the preview column renders live variants and the
// files each component is used in.
import { DsPortal } from '@/components/design-system/ds-portal';

export const metadata = { title: 'Design system — Zenboard' };

export default function DesignSystemPage() {
  return <DsPortal />;
}
