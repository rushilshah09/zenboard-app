import { describe, it, expect } from 'vitest';
import { oembedEndpoint, fromOembed, isBareUrl, isVideoUrl, pasteOptions, hostOf, mentionLabel } from './unfurl';

describe('isBareUrl', () => {
  it('accepts a lone http(s) URL', () => {
    expect(isBareUrl('https://www.youtube.com/watch?v=4FmKpQkoPa4&t=2s')).toBe(true);
    expect(isBareUrl('  http://example.com/a/b  ')).toBe(true);
  });
  it('rejects a URL with text around it', () => {
    // The paste-as menu must not interrupt pasting a sentence that has a link in
    // it — that would make ordinary pasting hostile.
    expect(isBareUrl('watch this https://youtu.be/x')).toBe(false);
    expect(isBareUrl('https://youtu.be/x watch this')).toBe(false);
  });
  it('rejects non-web schemes and plain text', () => {
    expect(isBareUrl('mailto:a@b.com')).toBe(false);
    expect(isBareUrl('javascript:alert(1)')).toBe(false);
    expect(isBareUrl('hello')).toBe(false);
    expect(isBareUrl('')).toBe(false);
  });
});

describe('isVideoUrl', () => {
  it('knows the players it can actually embed', () => {
    expect(isVideoUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isVideoUrl('https://youtu.be/abc')).toBe(true);
    expect(isVideoUrl('https://vimeo.com/12345')).toBe(true);
    expect(isVideoUrl('https://cdn.example.com/clip.mp4')).toBe(true);
  });
  it('does not claim an arbitrary page is a video', () => {
    // Offering "Embed video" for a blog post and rendering a broken frame is
    // worse than not offering it.
    expect(isVideoUrl('https://example.com/post')).toBe(false);
    expect(isVideoUrl('https://notyoutube.com.evil.test/x')).toBe(false);
  });
});

describe('pasteOptions', () => {
  it('offers Embed video only for embeddable links, Mention first always', () => {
    const vid = pasteOptions('https://youtu.be/abc').map((o) => o.value);
    expect(vid).toEqual(['mention', 'video', 'bookmark', 'url']);
    const page = pasteOptions('https://example.com/post').map((o) => o.value);
    expect(page).toEqual(['mention', 'bookmark', 'url']);
  });
});

describe('hostOf', () => {
  it('drops www and survives non-URLs', () => {
    expect(hostOf('https://www.github.com/x')).toBe('github.com');
    expect(hostOf('not a url')).toBe('not a url');
  });
});

describe('mentionLabel', () => {
  it('puts the author in front of the title', () => {
    expect(mentionLabel({ url: 'https://youtu.be/x', title: "What's Your ENGLISH Level?", author: 'Brian Wiles' }))
      .toBe("Brian Wiles · What's Your ENGLISH Level?");
  });
  it('does not repeat a name the title already contains', () => {
    expect(mentionLabel({ url: 'https://x.test', title: 'GitHub - zenboard/app', siteName: 'GitHub' }))
      .toBe('GitHub - zenboard/app');
  });
  it('falls back to the host rather than showing a raw URL', () => {
    // A mention whose visible text is still the URL defeats the point of it.
    expect(mentionLabel({ url: 'https://www.example.com/a' })).toBe('example.com');
  });
});

describe('oEmbed: platforms that describe themselves', () => {
  it('asks the platform for the five that have an open endpoint, and nobody else', () => {
    expect(oembedEndpoint('https://youtu.be/jNQXAC9IVRw')).toBe('https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fyoutu.be%2FjNQXAC9IVRw');
    expect(oembedEndpoint('https://www.tiktok.com/@a/video/1')).toMatch(/^https:\/\/www\.tiktok\.com\/oembed\?url=/);
    expect(oembedEndpoint('https://x.com/a/status/1')).toMatch(/^https:\/\/publish\.x\.com\/oembed\?/);
    expect(oembedEndpoint('https://vimeo.com/123')).toMatch(/^https:\/\/vimeo\.com\/api\/oembed\.json\?url=/);
    expect(oembedEndpoint('https://open.spotify.com/episode/abc')).toMatch(/^https:\/\/open\.spotify\.com\/oembed\?url=/);
    expect(oembedEndpoint('https://instagram.com/reel/xyz'), 'Instagram has no open endpoint').toBeNull();
    expect(oembedEndpoint('https://example.studio/work')).toBeNull();
  });

  it('the link travels as a parameter — the address fetched is always the platform', () => {
    const endpoint = new URL(oembedEndpoint('https://youtube.com/watch?v=jNQXAC9IVRw&next=http://10.0.0.1/')!);
    expect(endpoint.hostname).toBe('www.youtube.com');
    expect(endpoint.searchParams.get('url')).toBe('https://youtube.com/watch?v=jNQXAC9IVRw&next=http://10.0.0.1/');
  });

  it('reads a YouTube answer into a card', () => {
    const meta = fromOembed({
      title: 'Me at the zoo', author_name: 'jawed', provider_name: 'YouTube',
      thumbnail_url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
    }, 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(meta).toEqual({
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', title: 'Me at the zoo', author: 'jawed',
      siteName: 'YouTube', image: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
    });
  });

  it("names a post on X by its words, and the site X — not the endpoint's \"Twitter\"", () => {
    const meta = fromOembed({
      author_name: 'Someone', provider_name: 'Twitter',
      html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Hooks that actually work: open on the result &amp; never on the logo.<br>A thread 🧵</p>&mdash; Someone (@someone)</blockquote>',
    }, 'https://x.com/someone/status/1');
    expect(meta?.title).toBe('Hooks that actually work: open on the result & never on the logo. A thread 🧵');
    expect(meta?.siteName).toBe('X');
    expect(meta?.author).toBe('Someone');
  });

  it('keeps a thumbnail only over https, and says nothing when there is nothing', () => {
    expect(fromOembed({ title: 'T', thumbnail_url: 'http://insecure.example/a.jpg' }, 'https://vimeo.com/1')?.image).toBeUndefined();
    expect(fromOembed({ provider_name: 'YouTube' }, 'https://youtu.be/jNQXAC9IVRw')).toBeNull();
    expect(fromOembed(null, 'https://youtu.be/jNQXAC9IVRw')).toBeNull();
    expect(fromOembed([], 'https://youtu.be/jNQXAC9IVRw')).toBeNull();
  });

  it('reads a REAL answer from X (captured from publish.x.com, 2026-09-14)', () => {
    // Live markup, not a hand-written guess at it — the shape a mapper is wrong about is the real one.
    const live = {"url": "https://x.com/jack/status/20", "author_name": "jack", "html": "<blockquote class=\"twitter-tweet\" data-dnt=\"true\"><p lang=\"en\" dir=\"ltr\">just setting up my twttr</p>&mdash; jack (@jack) <a href=\"https://x.com/jack/status/20?ref_src=twsrc%5Etfw\">March 21, 2006</a></blockquote>\n\n", "provider_name": "X"};
    const meta = fromOembed(live, 'https://x.com/jack/status/20');
    expect(meta).toMatchObject({ title: 'just setting up my twttr', author: 'jack', siteName: 'X' });
  });

  it('keeps a long post to a line', () => {
    const long = 'word '.repeat(80);
    const meta = fromOembed({ html: `<p>${long}</p>` }, 'https://x.com/a/status/2');
    expect(meta!.title!.length).toBeLessThanOrEqual(160);
    expect(meta!.title!.endsWith('…')).toBe(true);
  });
});
