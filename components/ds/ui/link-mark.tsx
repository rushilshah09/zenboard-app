"use client";

import * as React from "react";
import {
  Globe, YoutubeLogo, XLogo, InstagramLogo, TiktokLogo, LinkedinLogo, ThreadsLogo, FacebookLogo,
  PinterestLogo, BehanceLogo, DribbbleLogo, SpotifyLogo, TwitchLogo, RedditLogo, MediumLogo, FigmaLogo,
  GithubLogo, type IconType,
} from "@/lib/icons";
import { cn } from "@/lib/cn";
import { platformOf, platformOfChannel, type PlatformId } from "@/lib/platforms";
import { Icon } from "./icon";

// WHERE A LINK IS FROM, drawn as a mark — one rule for every surface that shows
// a link (the Content inbox and library, the bookmark card, a piece's channel):
//
//   1. a PLATFORM a creator knows by its logo → that logo, in ink, filled;
//   2. any other site → its own favicon;
//   3. nothing to show → a globe.
//
// The rule used to be written out three times (inbox row, library card, bookmark
// card), each with its own favicon-or-globe fallback — and a favicon is a site's
// choice of colours, which in a black-and-white interface read as coloured dots.
// Platform glyphs come from the ONE icon family (components/ds/icons.ts), so they
// sit beside every other glyph as equals; decorative, because the site's name is
// always written beside them.

const MARKS: Partial<Record<PlatformId, IconType>> = {
  youtube: YoutubeLogo, x: XLogo, instagram: InstagramLogo, tiktok: TiktokLogo, linkedin: LinkedinLogo,
  threads: ThreadsLogo, facebook: FacebookLogo, pinterest: PinterestLogo, behance: BehanceLogo,
  dribbble: DribbbleLogo, spotify: SpotifyLogo, twitch: TwitchLogo, reddit: RedditLogo,
  medium: MediumLogo, figma: FigmaLogo, github: GithubLogo,
};

/** Steps of the icon scale: a card's meta, a site line, a row — and 20 where a mark stands in for a picture. */
export type MarkSize = 12 | 14 | 16 | 20;
// Written out as whole classes: Tailwind only generates what it can read in source.
const SIZE_CLASS: Record<MarkSize, string> = { 12: "size-3", 14: "size-3.5", 16: "size-4", 20: "size-5" };

/** A platform's mark, if it has one. Exported so a caller can ask before reserving space. */
export const markFor = (platform: PlatformId | null): IconType | undefined => (platform ? MARKS[platform] : undefined);

export interface LinkMarkProps {
  url?: string | null;
  /** The site's own icon, from the link's metadata — used only off-platform. */
  favicon?: string | null;
  size?: MarkSize;
  className?: string;
}

export function LinkMark({ url, favicon, size = 16, className }: LinkMarkProps) {
  const mark = markFor(platformOf(url));
  const [faviconOk, setFaviconOk] = React.useState(true);
  if (mark) return <Icon icon={mark} size={size} weight="fill" className={cn("text-ink-800", className)} />;
  if (favicon && faviconOk) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- any site's favicon; next/image needs a known host */
      <img src={favicon} alt="" aria-hidden width={size} height={size}
        className={cn("shrink-0 rounded-[3px]", SIZE_CLASS[size], className)} onError={() => setFaviconOk(false)} />
    );
  }
  return <Icon icon={Globe} size={size} className={cn("text-ink-500", className)} />;
}

/**
 * The mark of the platform a piece goes out on, from its free-text channel —
 * "YouTube", "Instagram Reels". Nothing at all for a channel that is not a
 * platform ("Newsletter"): the name alone is already right there.
 */
export function ChannelMark({ channel, size = 12, className }: { channel?: string | null; size?: MarkSize; className?: string }) {
  const mark = markFor(platformOfChannel(channel));
  return mark ? <Icon icon={mark} size={size} weight="fill" className={cn("text-ink-700", className)} /> : null;
}
