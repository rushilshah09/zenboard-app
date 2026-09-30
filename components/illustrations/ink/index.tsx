'use client';
// Illustrations — public surface.
//   Zen Ink (watercolor):  <Spot name="inbox" />, <Scene name="inboxZero" />
//   Zen Bold (flat, editorial, Zenboard colors):  <IconBadge name="inbox" />,
//   <BoldScene name="conversation" />
import { Ink, type InkProps } from './kit';
import { SPOTS, type SpotName } from './spots';
import { SCENES, type SceneName } from './scenes';
import { BADGES, BOLD_SCENES, type BadgeName, type BoldSceneName } from './bold';
import { SITE, type SiteIllustrationName } from './site';

export { Ink, type Art, type Part, type Tone } from './kit';
export { SPOTS, type SpotName } from './spots';
export { SCENES, type SceneName } from './scenes';
export { BADGES, BOLD_SCENES, type BadgeName, type BoldSceneName } from './bold';
export { SITE, type SiteIllustrationName } from './site';

type Common = Omit<InkProps, 'art'>;

export function Spot({ name, size = 96, ...rest }: Common & { name: SpotName }) {
  return <Ink art={SPOTS[name]} size={size} {...rest} />;
}

export function Scene({ name, size = 320, ...rest }: Common & { name: SceneName }) {
  return <Ink art={SCENES[name]} size={size} {...rest} />;
}

export function IconBadge({ name, size = 96, ...rest }: Common & { name: BadgeName }) {
  return <Ink art={BADGES[name]} size={size} {...rest} />;
}

export function BoldScene({ name, size = 320, ...rest }: Common & { name: BoldSceneName }) {
  return <Ink art={BOLD_SCENES[name]} size={size} {...rest} />;
}

/** zenboard.life feature-card illustrations. Wrap in `.ill-brand` for the brand palette. */
export function SiteIllustration({ name, size = 360, ...rest }: Common & { name: SiteIllustrationName }) {
  return <Ink art={SITE[name]} size={size} {...rest} />;
}

/** The website's icon set: Zen Ink spots, one per feature card and hub tile. */
export const SITE_ICONS: { label: string; spot: SpotName }[] = [
  { label: 'Home', spot: 'sun' }, { label: 'Inbox', spot: 'inbox' }, { label: 'Tasks', spot: 'tasks' },
  { label: 'Calendar', spot: 'calendar' }, { label: 'Focus', spot: 'focus' }, { label: 'Goals', spot: 'goals' },
  { label: 'Habits', spot: 'habits' }, { label: 'Projects', spot: 'folder' }, { label: 'Docs', spot: 'docs' },
  { label: 'Client portal', spot: 'link' }, { label: 'Clients', spot: 'clients' }, { label: 'Forms', spot: 'forms' },
  { label: 'Finance', spot: 'finance' }, { label: 'What they see', spot: 'eye' }, { label: 'Requests', spot: 'ai' },
  { label: 'Approvals', spot: 'shield' }, { label: 'Invoices', spot: 'invoice' }, { label: 'Zenboard AI', spot: 'ai' },
];
