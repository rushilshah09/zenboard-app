'use client';
// Illustrations — public surface.
//   Zen Ink (watercolor):  <Spot name="inbox" />, <Scene name="inboxZero" />
//   Zen Bold (flat, editorial, Zenboard colors):  <IconBadge name="inbox" />,
//   <BoldScene name="conversation" />
import { Ink, type InkProps } from './kit';
import { SPOTS, type SpotName } from './spots';
import { SCENES, type SceneName } from './scenes';
import { BADGES, BOLD_SCENES, type BadgeName, type BoldSceneName } from './bold';

export { Ink, type Art, type Part, type Tone } from './kit';
export { SPOTS, type SpotName } from './spots';
export { SCENES, type SceneName } from './scenes';
export { BADGES, BOLD_SCENES, type BadgeName, type BoldSceneName } from './bold';

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
