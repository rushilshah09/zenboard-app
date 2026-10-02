import { describe, it, expect } from 'vitest';
import { platformOf, platformOfChannel, youtubeId, platformThumbnail, isMissingThumbnail, PLATFORMS, PLATFORM_IDS } from './platforms';

describe('which platform a link is on', () => {
  it('knows the places creators publish to and save from', () => {
    expect(platformOf('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe('youtube');
    expect(platformOf('https://youtu.be/jNQXAC9IVRw')).toBe('youtube');
    expect(platformOf('https://x.com/someone/status/1')).toBe('x');
    expect(platformOf('https://twitter.com/someone/status/1'), 'the old domain is still X').toBe('x');
    expect(platformOf('https://www.instagram.com/reel/xyz/')).toBe('instagram');
    expect(platformOf('https://www.tiktok.com/@creator/video/1')).toBe('tiktok');
    expect(platformOf('https://www.linkedin.com/posts/abc')).toBe('linkedin');
    expect(platformOf('https://open.spotify.com/episode/abc'), 'a subdomain').toBe('spotify');
  });

  it('matches a domain and its subdomains, never a lookalike', () => {
    expect(platformOf('https://m.youtube.com/watch?v=jNQXAC9IVRw')).toBe('youtube');
    expect(platformOf('https://notyoutube.com/watch')).toBeNull();
    expect(platformOf('https://youtube.com.evil.example/watch')).toBeNull();
    expect(platformOf('https://example.studio/work')).toBeNull();
  });

  it('is null for anything that is not a web address', () => {
    for (const bad of [null, undefined, '', 'youtube', 'javascript:alert(1)', 'mailto:a@x.com']) {
      expect(platformOf(bad as string | null | undefined), String(bad)).toBeNull();
    }
  });

  it('every platform has a name and at least one domain', () => {
    for (const id of PLATFORM_IDS) {
      expect(PLATFORMS[id].name.trim(), id).not.toBe('');
      expect(PLATFORMS[id].hosts.length, id).toBeGreaterThan(0);
    }
  });
});

describe('which platform a channel names', () => {
  it('reads the name, an alias, or the name and a word', () => {
    expect(platformOfChannel('YouTube')).toBe('youtube');
    expect(platformOfChannel('  instagram ')).toBe('instagram');
    expect(platformOfChannel('Twitter')).toBe('x');
    expect(platformOfChannel('X')).toBe('x');
    expect(platformOfChannel('YouTube Shorts')).toBe('youtube');
    expect(platformOfChannel('Instagram Reels')).toBe('instagram');
  });

  it('never reads a longer word as its prefix', () => {
    expect(platformOfChannel('Xero')).toBeNull();
    expect(platformOfChannel('Newsletter')).toBeNull();
    expect(platformOfChannel('')).toBeNull();
    expect(platformOfChannel(null)).toBeNull();
  });
});

describe('a YouTube video, without asking YouTube', () => {
  it('finds the id in every address YouTube gives out', () => {
    const ID = 'jNQXAC9IVRw';
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=12s`,
      `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`, `https://m.youtube.com/watch?v=${ID}`,
    ]) expect(youtubeId(url), url).toBe(ID);
  });

  it('refuses an id that could not be real, and every other site', () => {
    expect(youtubeId('https://youtube.com/watch?v=abc123'), 'too short to be a real id').toBeNull();
    expect(youtubeId('https://youtube.com/@channel')).toBeNull();
    expect(youtubeId('https://vimeo.com/123456789')).toBeNull();
  });

  it('points a card straight at the thumbnail', () => {
    expect(platformThumbnail('https://youtu.be/jNQXAC9IVRw')).toBe('https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg');
    expect(platformThumbnail('https://instagram.com/reel/xyz')).toBeNull();
  });

  it("recognises YouTube's placeholder for a video with no thumbnail", () => {
    expect(isMissingThumbnail({ naturalWidth: 120, naturalHeight: 90 })).toBe(true);
    expect(isMissingThumbnail({ naturalWidth: 480, naturalHeight: 360 })).toBe(false);
  });
});
