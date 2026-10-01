'use client';
// Dev-only: the Zenboard cast and the six launch social posts (4:5, export at
// 1080×1350). Headlines are live text over Zen Shape art. 404s in prod.
import { notFound } from 'next/navigation';
import { Person, SocialArt, ZB_MARK, CAST, type CastName, type SocialName } from '@/components/illustrations/ink';

type Post = { name: SocialName; eyebrow: string; title: string; ink: 'dark' | 'light' };
const POSTS: Post[] = [
  { name: 'launch', eyebrow: 'Introducing Zenboard', title: 'One calm place for everything you run.', ink: 'dark' },
  { name: 'portal', eyebrow: 'Client portal', title: 'Your client sees the work, not the workspace.', ink: 'dark' },
  { name: 'focus', eyebrow: 'Focus', title: 'Deep work, on purpose.', ink: 'light' },
  { name: 'paid', eyebrow: 'Invoices', title: 'Tracked time becomes paid time.', ink: 'dark' },
  { name: 'inbox', eyebrow: 'Inbox', title: 'Capture now. Plan later.', ink: 'light' },
  { name: 'cast', eyebrow: 'For independents', title: 'Built for people who run their own thing.', ink: 'dark' },
];
const ROLES: Record<CastName, string> = { maya: 'Maya · you, a studio of one', theo: 'Theo · developer', ines: 'Ines · consultant', sam: 'Sam · the client' };

function SocialPost({ post }: { post: Post }) {
  const fg = post.ink === 'dark' ? 'var(--zs-ink)' : 'var(--zs-paper)';
  return (
    <article data-post={post.name} style={{ position: 'relative', width: 432, aspectRatio: '4 / 5', borderRadius: 12, overflow: 'hidden', containerType: 'inline-size' }}>
      <SocialArt name={post.name} size={432} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', inset: '7.4cqw 7.4cqw auto', color: fg }}>
        <p style={{ margin: 0, font: '600 3.2cqw/1 var(--font-geist-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.72 }}>{post.eyebrow}</p>
        <h3 style={{ margin: '3cqw 0 0', font: '600 8.4cqw/1.04 var(--font-geist-sans)', letterSpacing: '-0.03em', maxWidth: '80cqw', textWrap: 'balance' }}>{post.title}</h3>
      </div>
      <div style={{ position: 'absolute', right: '7.4cqw', bottom: '6cqw', display: 'flex', alignItems: 'center', gap: '1.6cqw', color: fg }}>
        <svg viewBox="0 0 20 20" width="4.4%" style={{ width: '4.4cqw', height: '4.4cqw' }} aria-hidden><path d={ZB_MARK} fill="currentColor" /></svg>
        <span style={{ font: '600 3.4cqw/1 var(--font-geist-sans)', letterSpacing: '-0.01em' }}>zenboard</span>
      </div>
    </article>
  );
}

export default function SocialPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main style={{ background: '#F7F7F5', minHeight: '100dvh', padding: 40, display: 'flex', flexDirection: 'column', gap: 48 }}>
      <section id="cast" style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {(Object.keys(CAST) as CastName[]).map((n) => (
          <figure key={n} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Person name={n} size={150} />
            <figcaption style={{ font: '12px var(--font-geist-sans)', opacity: 0.6 }}>{ROLES[n]}</figcaption>
          </figure>
        ))}
      </section>
      <section id="posts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 432px)', gap: 24 }}>
        {POSTS.map((p) => <SocialPost key={p.name} post={p} />)}
      </section>
    </main>
  );
}
