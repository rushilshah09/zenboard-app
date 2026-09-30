'use client';
// Zen Ink — public surface. `<Spot name="inbox" />` for single objects,
// `<Scene name="inboxZero" />` for the detailed compositions.
import { Ink, type InkProps } from './kit';
import { SPOTS, type SpotName } from './spots';
import { SCENES, type SceneName } from './scenes';

export { Ink, type Art, type Part, type Tone } from './kit';
export { SPOTS, type SpotName } from './spots';
export { SCENES, type SceneName } from './scenes';

type Common = Omit<InkProps, 'art'>;

export function Spot({ name, size = 96, ...rest }: Common & { name: SpotName }) {
  return <Ink art={SPOTS[name]} size={size} {...rest} />;
}

export function Scene({ name, size = 320, ...rest }: Common & { name: SceneName }) {
  return <Ink art={SCENES[name]} size={size} {...rest} />;
}
