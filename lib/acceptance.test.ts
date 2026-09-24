import { describe, it, expect } from 'vitest';
import {
  validateSignerName, validateSignerEmail, canonicalizeForSignature,
  acceptanceStatus, acceptanceFor, acceptStatement, acceptLabel,
  DEFAULT_STATEMENT, DEFAULT_LABEL, type Acceptance,
} from './acceptance';
import { blocksToText, blocksToMarkdown, toBlocks, serialize, newLeaf, isLeafBlock, isTextBlock, type Block } from './blocks';

const b = (over: Partial<Block> & { type: Block['type'] }): Block =>
  ({ id: 'b1', text: '', ...over });

describe('terms', () => {
  it('falls back to the click-wrap default when the owner writes nothing', () => {
    expect(acceptStatement(undefined)).toBe(DEFAULT_STATEMENT);
    expect(acceptStatement({ statement: '   ' })).toBe(DEFAULT_STATEMENT);
    expect(acceptLabel({ label: '' })).toBe(DEFAULT_LABEL);
  });

  it('uses the owner’s words when there are any', () => {
    expect(acceptStatement({ statement: 'I agree to the retainer.' })).toBe('I agree to the retainer.');
    expect(acceptLabel({ label: 'Sign' })).toBe('Sign');
  });
});

describe('validateSignerName', () => {
  it('accepts the names people actually sign with', () => {
    for (const name of ['Sam', 'sam', 'Dr. A. Roy-Smith', '王伟', "O'Neill", 'Ana María']) {
      expect(validateSignerName(name)).toEqual({ name });
    }
  });

  it('collapses stray whitespace rather than storing it', () => {
    expect(validateSignerName('  Sam   Patel ')).toEqual({ name: 'Sam Patel' });
  });

  it('refuses a click-through: no letters is not a signature', () => {
    for (const junk of ['.', '...', '1234', '   ', '--']) {
      expect(validateSignerName(junk)).toHaveProperty('error');
    }
  });

  it('refuses one character, and anything past the column width', () => {
    expect(validateSignerName('S')).toHaveProperty('error');
    expect(validateSignerName('a'.repeat(121))).toHaveProperty('error');
  });
});

describe('validateSignerEmail', () => {
  it('is optional — blank is valid and stores null', () => {
    expect(validateSignerEmail('')).toEqual({ email: null });
    expect(validateSignerEmail(null)).toEqual({ email: null });
  });

  it('lowercases what it keeps', () => {
    expect(validateSignerEmail(' Sam@Studio.CO ')).toEqual({ email: 'sam@studio.co' });
  });

  it('refuses an address that would bounce', () => {
    for (const bad of ['sam', 'sam@', '@studio.co', 'sam@studio', 'a b@c.co']) {
      expect(validateSignerEmail(bad)).toHaveProperty('error');
    }
  });
});

describe('canonicalizeForSignature', () => {
  const doc = (over: Partial<Block> = {}): Block[] => [
    b({ type: 'h1', text: 'Brand identity' }),
    b({ id: 'b2', type: 'text', text: 'Two rounds of concepts.', ...over }),
  ];

  it('ignores block ids — they are storage keys, not terms', () => {
    const a = canonicalizeForSignature(doc());
    const c = canonicalizeForSignature(doc().map((x, i) => ({ ...x, id: `re-minted-${i}` })));
    expect(c).toBe(a);
  });

  it('ignores inline formatting — bolding a word changes no term', () => {
    const plain = canonicalizeForSignature(doc());
    const bold = canonicalizeForSignature(doc({ spans: [{ text: 'Two rounds of concepts.', b: true }] }));
    expect(bold).toBe(plain);
  });

  it('changes when a word changes', () => {
    expect(canonicalizeForSignature(doc({ text: 'Three rounds of concepts.' })))
      .not.toBe(canonicalizeForSignature(doc()));
  });

  it('changes when a PRICE changes — the part a signature is about', () => {
    const items = [{ id: 'i1', description: 'Identity', quantity: 1, unitAmount: 4000 }];
    const before = canonicalizeForSignature([b({ type: 'lineitems', items })]);
    const after = canonicalizeForSignature([
      b({ type: 'lineitems', items: [{ ...items[0], unitAmount: 4500 }] }),
    ]);
    expect(after).not.toBe(before);
  });

  it('changes when a row is silently added or removed', () => {
    const one = [{ id: 'i1', description: 'Identity', quantity: 1, unitAmount: 4000 }];
    const two = [...one, { id: 'i2', description: 'Extras', quantity: 1, unitAmount: 500 }];
    expect(canonicalizeForSignature([b({ type: 'lineitems', items: two })]))
      .not.toBe(canonicalizeForSignature([b({ type: 'lineitems', items: one })]));
  });

  it('changes when the STATEMENT is reworded after signing', () => {
    expect(canonicalizeForSignature([b({ type: 'accept', accept: { statement: 'I agree, and waive refunds.' } })]))
      .not.toBe(canonicalizeForSignature([b({ type: 'accept' })]));
  });

  it('notices an uploaded image being swapped for another', () => {
    const img = (fileId: string) => [b({ type: 'image', text: 'Front of pack', fileId })];
    expect(canonicalizeForSignature(img('3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c4d')))
      .not.toBe(canonicalizeForSignature(img('0b7d2f41-2222-4c3d-9e8f-1a2b3c4d5e6f')));
  });

  it('can read a document the way a signature taken before 2026-09-21 saw it — its uploads invisible', () => {
    // A document was read through a normalize() that dropped every upload's reference, so an uploaded image was
    // hashed as an empty src. `uploads: false` reproduces exactly that reading, and nothing else.
    const withUpload = [b({ type: 'image', text: 'Front of pack', fileId: '3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c4d' })];
    const asTheyWereRead = [b({ type: 'image', text: 'Front of pack' })];
    expect(canonicalizeForSignature(withUpload, { uploads: false })).toBe(canonicalizeForSignature(asTheyWereRead));
    // An image linked by URL was never invisible, and a document with no uploads reads the same either way.
    const linked = [b({ type: 'image', text: '', src: 'https://example.com/a.png' })];
    expect(canonicalizeForSignature(linked, { uploads: false })).toBe(canonicalizeForSignature(linked));
  });

  it('notices a to-do being ticked and a table cell being rewritten', () => {
    expect(canonicalizeForSignature([b({ type: 'todo', text: 'Deposit', checked: true })]))
      .not.toBe(canonicalizeForSignature([b({ type: 'todo', text: 'Deposit', checked: false })]));
    expect(canonicalizeForSignature([b({ type: 'table', rows: [['A'], ['1']] })]))
      .not.toBe(canonicalizeForSignature([b({ type: 'table', rows: [['A'], ['2']] })]));
  });
});

describe('acceptanceStatus', () => {
  const rec: Acceptance = {
    id: 'a1', blockId: 'b1', signerName: 'Sam', signerEmail: null,
    acceptedAt: '2026-08-04T10:00:00Z', statement: DEFAULT_STATEMENT,
    contentHash: 'hash-at-signing', amount: 4000, invoiceId: null,
  };

  it('is awaiting with no record', () => {
    expect(acceptanceStatus(null, ['anything'])).toBe('awaiting');
  });

  it('is accepted when the document still says what it said', () => {
    expect(acceptanceStatus(rec, ['hash-at-signing'])).toBe('accepted');
  });

  it('is accepted when a signature taken before uploads survived a reload matches the upload-blind reading', () => {
    // The document now carries its image's reference, so its own fingerprint changed the day the fix shipped;
    // the signature was taken against the reading with the reference missing, which is still offered.
    expect(acceptanceStatus(rec, ['fingerprint-with-the-upload', 'hash-at-signing'])).toBe('accepted');
  });

  it('is edited once the document has moved on', () => {
    expect(acceptanceStatus(rec, ['a-different-hash', 'another-reading'])).toBe('edited');
  });

  it('does not cry tampering when the current hash is simply unknown', () => {
    // The portal renders acceptances without recomputing the hash. Reporting
    // "edited" there would accuse the owner every single time.
    expect(acceptanceStatus(rec, null)).toBe('accepted');
    expect(acceptanceStatus(rec, [])).toBe('accepted');
    expect(acceptanceStatus(rec)).toBe('accepted');
  });
});

describe('acceptanceFor', () => {
  const mk = (blockId: string): Acceptance => ({
    id: `a-${blockId}`, blockId, signerName: 'Sam', signerEmail: null,
    acceptedAt: '2026-08-04T10:00:00Z', statement: '', contentHash: '', amount: null, invoiceId: null,
  });

  it('matches a signature to its own block, and only its own', () => {
    const all = [mk('b1'), mk('b2')];
    expect(acceptanceFor(all, 'b2')?.id).toBe('a-b2');
    expect(acceptanceFor(all, 'b3')).toBeNull();
    expect(acceptanceFor(null, 'b1')).toBeNull();
  });
});

// The two paperwork blocks keep their content in a payload rather than in
// `text`, so every serializer has to be taught about them by hand. This is the
// regression guard for the case that already bit once: falling through to
// `b.text` made a proposal's prices vanish from the client portal.
describe('paperwork blocks survive serialization', () => {
  const items = [
    { id: 'i1', description: 'Identity', quantity: 1, unitAmount: 4000 },
    { id: 'i2', description: 'Guidelines', quantity: 2, unitAmount: 750.5 },
  ];

  it('flattens prices to readable text, with a total that matches the rows', () => {
    const text = blocksToText([b({ type: 'lineitems', items })]);
    expect(text).toContain('Identity — 1 × 4000.00 = 4000.00');
    expect(text).toContain('Guidelines — 2 × 750.50 = 1501.00');
    expect(text).toContain('Total 5501.00');
  });

  it('flattens the accept block to the words that were agreed', () => {
    expect(blocksToText([b({ type: 'accept', accept: { statement: 'I agree.' } })])).toBe('I agree.');
    expect(blocksToText([b({ type: 'accept' })])).toBe(DEFAULT_STATEMENT);
  });

  it('exports an accept block as a signable line, not a placeholder', () => {
    const md = blocksToMarkdown([b({ type: 'accept', accept: { label: 'Sign' } })]);
    expect(md).toContain(DEFAULT_STATEMENT);
    expect(md).toContain('Sign:');
  });

  it('leaves an empty line-items block out of the text entirely', () => {
    expect(blocksToText([b({ type: 'lineitems', items: [] })])).toBe('');
  });
});

// `normalize()` is the trust boundary for pages.content: it rebuilds each block
// from named fields, so a payload it does not know about is DROPPED. That is the
// right default, and it is also how line-items rows came back empty after a
// reload — the block survived the round trip with none of its prices.
describe('paperwork blocks survive the storage round trip', () => {
  const round = (blocks: Block[]): Block[] => toBlocks(JSON.parse(JSON.stringify(serialize(blocks))));

  it('keeps every price, and keeps it as a number', () => {
    const items = [
      { id: 'i1', description: 'Identity', quantity: 1, unitAmount: 4000 },
      { id: 'i2', description: 'Guidelines', quantity: 2, unitAmount: 750.5 },
    ];
    expect(round([b({ type: 'lineitems', items })])[0].items).toEqual(items);
  });

  it('repairs numbers that arrive as strings instead of returning NaN', () => {
    const raw = { blocks: [{ id: 'b1', type: 'lineitems', text: '', items: [{ id: 'i1', description: 'X', quantity: '2', unitAmount: '99.5' }] }] };
    expect(toBlocks(raw)[0].items).toEqual([{ id: 'i1', description: 'X', quantity: 2, unitAmount: 99.5 }]);
  });

  it('falls back rather than dropping a row with a missing quantity', () => {
    const raw = { blocks: [{ id: 'b1', type: 'lineitems', text: '', items: [{ description: 'X' }] }] };
    const [row] = toBlocks(raw)[0].items!;
    expect([row.quantity, row.unitAmount, row.description]).toEqual([1, 0, 'X']);
  });

  it('keeps the terms an accept block was authored with', () => {
    const accept = { statement: 'I agree to the retainer.', label: 'Sign', requireEmail: true };
    expect(round([b({ type: 'accept', accept })])[0].accept).toEqual(accept);
  });

  it('ignores junk in the terms rather than trusting stored JSON', () => {
    const raw = { blocks: [{ id: 'b1', type: 'accept', text: '', accept: { statement: 42, label: 'Sign', requireEmail: 0 } }] };
    expect(toBlocks(raw)[0].accept).toEqual({ label: 'Sign' });
  });
});

// LEAF_TYPES and newLeaf answer two halves of one question, and a type listed in
// the first with no seed in the second inserts an empty shell.
describe('leaf blocks', () => {
  it('seeds every leaf that needs a payload to be usable', () => {
    expect(newLeaf('table').rows?.length).toBeGreaterThan(0);
    expect(newLeaf('lineitems').items).toHaveLength(1);
    expect(newLeaf('accept').accept).toEqual({});
    expect(newLeaf('divider').text).toBe('');
  });

  it('separates the blocks you can type in from the ones you cannot', () => {
    expect(isLeafBlock('accept')).toBe(true);
    expect(isLeafBlock('lineitems')).toBe(true);
    expect(isLeafBlock('image')).toBe(true);
    expect(isTextBlock('accept')).toBe(false);
    // A database has text but is a view onto rows — excluded for its own reason.
    expect(isTextBlock('collection')).toBe(false);
    expect(isTextBlock('quote')).toBe(true);
  });
});
