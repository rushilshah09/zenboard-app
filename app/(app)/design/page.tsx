// Design system — the DS portal. Signed-out visitors are redirected by the (app)
// layout; this page reads nothing user-scoped, so it needs no check of its own.
// A living reference of every component the app ships: side rail lists them
// (with real usage counts); the preview column renders live variants and the
// files each component is used in.
import { DsPortal } from '@/components/design-system/ds-portal';
import { PageStamp } from '@/components/shell/page-stamp';

export const metadata = { title: 'Design system — Zenboard' };

export default function DesignSystemPage() {
  return (
    <>
      <PageStamp />
      <DsPortal />
    </>
  );
}
