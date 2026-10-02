import { describe, it, expect } from 'vitest';
import {
  safeFilename, attachmentKind, formatBytes, rejectReason, attachmentPath, unplacedUploads,
  ATTACHMENT_MAX_BYTES,
} from './attachments';

describe('safeFilename', () => {
  it('keeps an ordinary name and its extension', () => {
    expect(safeFilename('Brief v2.pdf')).toBe('Brief v2.pdf');
  });

  it('strips any directory part — a storage key must not escape its prefix', () => {
    // The one that matters: without this, a crafted name walks out of the
    // per-user prefix the whole ownership model rests on.
    expect(safeFilename('../../secrets.pdf')).toBe('secrets.pdf');
    expect(safeFilename('/etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\me\\scan.png')).toBe('scan.png');
  });

  it('flattens exotic characters rather than passing them to storage', () => {
    expect(safeFilename('re;port*<>.pdf')).toBe('re port.pdf');   // trailing run is trimmed
    expect(safeFilename('naïve—file.txt')).toBe('na ve file.txt');
  });

  it('never returns an empty name', () => {
    expect(safeFilename('')).toBe('file');
    expect(safeFilename('***')).toBe('file');
    expect(safeFilename('.')).toBe('.');
  });

  it('caps a runaway name', () => {
    const out = safeFilename('a'.repeat(400) + '.pdf');
    expect(out.length).toBeLessThanOrEqual(129);
    expect(out.endsWith('.pdf')).toBe(true);
  });
});

describe('attachmentKind', () => {
  it('trusts the MIME type first', () => {
    expect(attachmentKind('image/png', 'x.bin')).toBe('image');
    expect(attachmentKind('application/pdf', 'x.bin')).toBe('pdf');
    expect(attachmentKind('video/mp4', 'x.bin')).toBe('video');
    expect(attachmentKind('audio/mpeg', 'x.bin')).toBe('audio');
  });

  it('falls back to the extension — real uploads arrive as octet-stream', () => {
    expect(attachmentKind('application/octet-stream', 'scan.pdf')).toBe('pdf');
    expect(attachmentKind(null, 'photo.HEIC'.toLowerCase())).toBe('file');
    expect(attachmentKind(undefined, 'clip.mov')).toBe('video');
    expect(attachmentKind('', 'art.webp')).toBe('image');
  });

  it('calls anything unrecognised a file rather than guessing', () => {
    expect(attachmentKind('application/zip', 'bundle.zip')).toBe('file');
    expect(attachmentKind(null, 'no-extension')).toBe('file');
    expect(attachmentKind(null, null)).toBe('file');
  });
});

describe('formatBytes', () => {
  it('reads the way a file browser does (decimal units)', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2400)).toBe('2.4 kB');
    expect(formatBytes(2_400_000)).toBe('2.4 MB');
    expect(formatBytes(25 * 1000 * 1000)).toBe('25 MB');
  });

  it('drops the decimal above ten so a column stays one width', () => {
    expect(formatBytes(9_900)).toBe('9.9 kB');
    expect(formatBytes(11_000)).toBe('11 kB');
  });

  it('returns nothing rather than NaN for a missing size', () => {
    for (const v of [null, undefined, NaN, -5]) expect(formatBytes(v)).toBe('');
  });
});

describe('rejectReason', () => {
  it('accepts an ordinary file', () => {
    expect(rejectReason({ size: 1_000_000, name: 'a.pdf' })).toBeNull();
  });

  it('explains the limit in the same units the OS showed', () => {
    const msg = rejectReason({ size: ATTACHMENT_MAX_BYTES + 1, name: 'big.mov' })!;
    expect(msg).toContain('big.mov');
    expect(msg).toContain('25 MB');
  });

  it('refuses an empty file — an upload that would land as nothing', () => {
    expect(rejectReason({ size: 0, name: 'empty.txt' })).toContain('empty');
  });

  it('accepts exactly the limit', () => {
    expect(rejectReason({ size: ATTACHMENT_MAX_BYTES, name: 'edge.bin' })).toBeNull();
  });
});

describe('attachmentPath', () => {
  const uid = '9f1c2b7e-4d3a-4c8b-9f10-2ab7c6de5401';

  it('prefixes with the owner, so a path is self-describing', () => {
    expect(attachmentPath(uid, 'abc123', 'Brief.pdf')).toBe(`${uid}/abc123-Brief.pdf`);
  });

  it('sanitises the name it embeds', () => {
    // The traversal has to die here too, not only in safeFilename's own test —
    // this is the function that actually builds the key.
    expect(attachmentPath(uid, 'abc123', '../../../etc/passwd')).toBe(`${uid}/abc123-passwd`);
  });

  it('gives two same-named files different keys', () => {
    expect(attachmentPath(uid, 'aaa', 'scan.pdf')).not.toBe(attachmentPath(uid, 'bbb', 'scan.pdf'));
  });
});

describe('unplacedUploads — the files a page holds and no longer shows', () => {
  const id = (n: number) => `3f9a1c2e-1111-4a2b-8c3d-00000000000${n}`;
  const files = [1, 2, 3, 4, 5].map((n) => ({ id: id(n), filename: `f${n}.webp` }));
  const stored = {
    content: {
      blocks: [{ id: 'b1', type: 'image', text: '', fileId: id(1) }, { id: 'b2', type: 'image', text: '' }],
      cover: `attachment:${id(2)}`,
      props: [{ id: 'pr1', type: 'files', fileIds: [id(3)] }],
    },
  };

  it('a file a block, the cover or a property points at is shown; the rest are not', () => {
    expect(unplacedUploads(files, stored).map((f) => f.filename)).toEqual(['f4.webp', 'f5.webp']);
  });

  it('a file the editor has placed but not yet saved is shown', () => {
    expect(unplacedUploads(files, stored, [id(4), undefined]).map((f) => f.filename)).toEqual(['f5.webp']);
  });

  it('keeps the order the files were uploaded in', () => {
    expect(unplacedUploads([...files].reverse(), null).map((f) => f.filename)).toEqual(['f5.webp', 'f4.webp', 'f3.webp', 'f2.webp', 'f1.webp']);
  });
});

