import { describe, it, expect } from 'vitest';
import { DOC_COVERS, attachmentCover, coverAttachmentId, isImageCover, coverCss, randomCover } from './covers';

const ID = '3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c4d';

describe('attachmentCover / coverAttachmentId', () => {
  it('round-trips an attachment id', () => {
    expect(coverAttachmentId(attachmentCover(ID))).toBe(ID);
  });

  it('is null for every other kind of cover', () => {
    for (const c of ['sakura', 'https://example.com/a.jpg', 'data:image/webp;base64,AAAA', '', undefined]) {
      expect(coverAttachmentId(c)).toBeNull();
    }
  });

  it('is null for a prefix with nothing after it', () => {
    expect(coverAttachmentId('attachment:')).toBeNull();
  });

  it('does not mistake a gradient whose name contains the word', () => {
    expect(coverAttachmentId('my-attachment:thing')).toBeNull();
  });
});

describe('isImageCover', () => {
  it('recognises a stored upload', () => {
    expect(isImageCover(attachmentCover(ID))).toBe(true);
  });

  // Covers uploaded before the move to storage are real data-URLs in real
  // documents. There is no migration; the old form simply keeps rendering.
  it('still recognises a legacy inline cover', () => {
    expect(isImageCover('data:image/webp;base64,AAAA')).toBe(true);
  });

  it('recognises a pasted link', () => {
    expect(isImageCover('https://example.com/a.jpg')).toBe(true);
  });

  it('is false for a gradient and for nothing', () => {
    expect(isImageCover('sakura')).toBe(false);
    expect(isImageCover(undefined)).toBe(false);
  });
});

describe('gallery', () => {
  it('resolves a gradient id to CSS, and an upload to nothing', () => {
    expect(coverCss('sakura')).toContain('linear-gradient');
    // An image cover paints an <img>, not a background — a CSS value here would
    // draw a gradient behind a picture that is meant to fill the band.
    expect(coverCss(attachmentCover(ID))).toBeUndefined();
  });

  it('never hands back the cover you already have', () => {
    for (const c of DOC_COVERS) expect(randomCover(c.id)).not.toBe(c.id);
  });

  it('has unique ids', () => {
    expect(new Set(DOC_COVERS.map((c) => c.id)).size).toBe(DOC_COVERS.length);
  });
});
