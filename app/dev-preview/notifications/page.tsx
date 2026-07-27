'use client';
// Dev-only harness for the shell notification bell. The real bell lives behind
// auth (it reads the owner's notifications through RLS); here we seed demo rows so
// the button, unread badge, and panel can be verified without a session. 404s in prod.
import { notFound } from 'next/navigation';
import { NotificationsBell } from '@/components/shell/notifications-bell';

const iso = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();

const DEMO = [
  { id: 'n1', kind: 'portal.request', title: 'New request from Sarah Chen', body: 'Add a dark-mode logo · Brand identity', link: { href: '/projects/x' }, read: false, created_at: iso(4) },
  { id: 'n2', kind: 'portal.approval', title: 'Changes requested on Brand guidelines v1', body: 'Can the accent be a touch warmer?', link: { href: '/projects/x' }, read: false, created_at: iso(52) },
  { id: 'n3', kind: 'form.response', title: 'Sarah completed a form', body: 'Design feedback — round 2', link: { href: '/forms/x/responses' }, read: false, created_at: iso(180) },
  { id: 'n4', kind: 'portal.reply', title: 'Sarah replied', body: 'Send the updated brand colors · Brand identity', link: { href: '/projects/x' }, read: true, created_at: iso(1500) },
];

export default function NotificationsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)', padding: 24 }}>
      {/* A stand-in for the shell top bar so the bell sits in a realistic frame. */}
      <div style={{ height: 44, background: 'var(--paper)', border: '1px solid var(--color-border-panel)', borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <NotificationsBell demo={DEMO} />
      </div>
    </div>
  );
}
