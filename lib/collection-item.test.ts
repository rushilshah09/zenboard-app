import { describe, it, expect } from 'vitest';
import { collectionSource, collectionType, collectionPicture, collectionTile, COLLECTION_TYPES } from './collection-item';
import { platformThumbnail } from './platforms';

// What a collected link IS, read from its address (COLLECTION_VIEW_BRIEF §33: "The system
// should automatically recognize URLs … Do not rely only on hardcoded domains"). A known
// platform is named; everywhere else is a Website, and the address still says what kind
// of thing it points at.
describe('collectionSource — where an item is from', () => {
  it('names a known platform, by its domain and never a lookalike', () => {
    expect(collectionSource('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe('YouTube');
    expect(collectionSource('https://instagram.com/p/abc')).toBe('Instagram');
    expect(collectionSource('https://youtube.com.evil.example/x')).toBe('Website');
  });

  it('calls everywhere else a Website, and says nothing without an address', () => {
    expect(collectionSource('https://randomwebsite.com/something')).toBe('Website');
    expect(collectionSource('')).toBeNull();
    expect(collectionSource('not a url')).toBeNull();
  });
});

describe('collectionType — what kind of thing it is', () => {
  it('reads the platform', () => {
    expect(collectionType('https://youtu.be/jNQXAC9IVRw')).toBe('Video');
    expect(collectionType('https://vimeo.com/1')).toBe('Video');
    expect(collectionType('https://www.instagram.com/p/abc/')).toBe('Social post');
    expect(collectionType('https://x.com/jack/status/20')).toBe('Social post');
    expect(collectionType('https://www.pinterest.com/pin/1/')).toBe('Image');
    expect(collectionType('https://open.spotify.com/track/1')).toBe('Audio');
  });

  it('reads the file at the end of the address', () => {
    expect(collectionType('https://example.com/file.pdf')).toBe('PDF');
    expect(collectionType('https://example.com/a/photo.JPG?w=2')).toBe('Image');
    expect(collectionType('https://cdn.example.com/clip.mp4')).toBe('Video');
    expect(collectionType('https://example.com/talk.mp3')).toBe('Audio');
    expect(collectionType('https://example.com/brief.docx')).toBe('Document');
  });

  it('is a Website otherwise, and Other with no address', () => {
    expect(collectionType('https://example.com/article')).toBe('Website');
    expect(collectionType(undefined)).toBe('Other');
  });

  it('only ever answers from the Type vocabulary', () => {
    for (const url of ['https://youtu.be/x', 'https://example.com/x.pdf', 'https://a.example/c', '', 'nonsense']) {
      expect(COLLECTION_TYPES).toContain(collectionType(url));
    }
  });
});

describe('collectionPicture — the best picture there is', () => {
  const yt = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

  it("prefers the platform's own thumbnail, which needs no request (§7)", () => {
    expect(platformThumbnail(yt)).toBeTruthy();
    expect(collectionPicture(yt, { url: yt, image: 'https://example.com/og.png' })).toBe(platformThumbnail(yt));
  });

  it("then the page's own image — https only", () => {
    const url = 'https://example.com/post';
    expect(collectionPicture(url, { url, image: 'https://example.com/og.png' })).toBe('https://example.com/og.png');
    expect(collectionPicture(url, { url, image: 'http://example.com/og.png' })).toBeNull();
  });

  it('uses an address that IS an image as its own picture — https only', () => {
    expect(collectionPicture('https://images.example.com/moodboard/poster.webp', null)).toBe('https://images.example.com/moodboard/poster.webp');
    expect(collectionPicture('http://images.example.com/poster.png', null)).toBeNull();
    // A pin is an Image by type, but its page is not a picture.
    expect(collectionPicture('https://www.pinterest.com/pin/1/', null)).toBeNull();
  });

  it('has nothing to offer without either, and the tile takes over', () => {
    expect(collectionPicture('https://example.com/post', null)).toBeNull();
    expect(collectionPicture(undefined, undefined)).toBeNull();
  });
});

describe('collectionTile — a picture made of words when there is none (§8, §34–35)', () => {
  it('names the type and the domain', () => {
    expect(collectionTile('https://www.example.com/article', 'Website')).toEqual({ type: 'Website', domain: 'example.com' });
  });

  it('still reads as intentional with no address at all', () => {
    expect(collectionTile(undefined, undefined)).toEqual({ type: 'Other', domain: null });
  });
});
