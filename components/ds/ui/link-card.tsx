"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { hostOf, type LinkMeta } from "@/lib/unfurl";
import { safeHref } from "@/lib/safe-url";
import { LinkMark } from "./link-mark";

// A link, shown as a PREVIEW of the page it points to rather than a bordered
// URL: the site's favicon and name, the page's title, a line of description, and
// its image. Notion's bookmark block is the reference.
//
// PRESENTATIONAL. The card draws what it is given; the feature brings the
// metadata (`useLinkMeta`), the same split as the DS board and its drag. It was
// written inside the document editor as `BookmarkCard`, and moved here when the
// Content library became its second reader — a second copy is how two cards that
// should agree about a link quietly stop agreeing.
//
// Every part is optional. A site that blocks us, serves no Open Graph tags, or
// has no image still gets a clean card from what did arrive, down to just the
// hostname.

export interface LinkCardProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "title"> {
  url: string;
  /** `undefined` while loading, `null` when the page gave us nothing. */
  meta: LinkMeta | null | undefined;
  /**
   * YOUR words about the link. They win over the scraped description: a site's
   * og:description is whatever it chose ("Sign in to continue", "Figma"), while a
   * note someone took the trouble to write is the sentence that belongs here.
   */
  note?: string;
  /** Overrides the page's title — for a name the person gave the link. */
  title?: string;
  /** Overrides the site line — for who made it, when the person said. */
  site?: string;
}

export function LinkCard({ url, meta, note, title, site, className, ...rest }: LinkCardProps) {
  const host = hostOf(url);
  const heading = title?.trim() || meta?.title?.trim() || host;
  const desc = note ?? meta?.description?.trim();
  const [imgOk, setImgOk] = React.useState(true);
  const showImage = !!meta?.image && imgOk;

  return (
    <a
      href={safeHref(url) ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "bookmark-card flex overflow-hidden rounded-md border border-line bg-paper-2 no-underline transition-colors duration-fast hover:wash-over",
        className,
      )}
      {...rest}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* A platform's own mark, else the site's favicon, else a globe (link-mark.tsx). */}
          <LinkMark url={url} favicon={meta?.favicon} size={14} />
          <span className="truncate text-caption text-ink-500">{site?.trim() || meta?.siteName?.trim() || host}</span>
        </span>
        <span className="line-clamp-1 text-body font-medium text-ink-900">{heading}</span>
        {desc && (
          <span className={cn("line-clamp-2 text-caption leading-normal",
            // A note you wrote reads in ink; a scraped blurb stays quieter, so the
            // card says at a glance whose words these are.
            note ? "text-ink-800" : "text-ink-600")}>{desc}</span>
        )}
        <span className="truncate text-caption text-ink-500">{url}</span>
      </span>
      {showImage && (
        /* eslint-disable-next-line @next/next/no-img-element -- any site's og:image; next/image needs a known host */
        <img src={meta!.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)}
          className="hidden w-[180px] shrink-0 self-stretch border-l border-line object-cover sm:block" />
      )}
    </a>
  );
}
