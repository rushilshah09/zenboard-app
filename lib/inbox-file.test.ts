import { describe, expect, it } from 'vitest';

import {
  MIN_CONFIDENCE, confidenceOf, consumedWords, duplicateOf, historyProject, indexHistory, minScore,
  historyLabel, indexBuckets, namedProject, proposeAll, proposeFor, saidDate, saysSomething,
  scoreBuckets, unplaced,
  type FileProject, type FiledTask,
} from './inbox-file';

const PROJECTS: FileProject[] = [
  { id: 'p-mer', name: 'Brand refresh', client: 'Meridian Coffee' },
  { id: 'p-fern', name: 'Lobby screens', client: 'Fernwood Hotels' },
  { id: 'p-atlas', name: 'Packaging v2', client: 'Atlas Coffee' },
];

const FILED: FiledTask[] = [
  { title: 'Send two alternative palettes', projectId: 'p-mer' },
  { title: 'Small-size test of the mark on the cup template', projectId: 'p-mer' },
  { title: 'Palette review with Priya', projectId: 'p-mer' },
  { title: 'Wire up the lobby screen analytics', projectId: 'p-fern' },
  { title: 'Book the screen install', projectId: 'p-fern' },
  { title: 'Revised dieline for the kraft stock', projectId: 'p-atlas' },
  { title: 'Check print costs with the supplier', projectId: 'p-atlas' },
];

const index = indexHistory(FILED);
const nothingOpen: { id: string; title: string }[] = [];

describe('the filing history, read as evidence', () => {
  it('counts a word once per task, not once per mention', () => {
    const i = indexHistory([{ title: 'Palette palette palette', projectId: 'p-mer' }]);
    expect(i.byBucket.get('p-mer')?.get('palette')).toBe(1);
  });

  it('a word only one project uses beats a word several share', () => {
    const only = scoreBuckets('dieline', index).find((r) => r.bucketId === 'p-atlas')!;
    const shared = scoreBuckets('screen', index).find((r) => r.bucketId === 'p-fern')!;
    // "dieline" appears in one project once; "screen" in one project twice — but both are unique to
    // their project, so support is what separates them. The point of the assertion is that a
    // distinctive word scores at all, and that repetition adds to it rather than replacing it.
    expect(only.score).toBeGreaterThan(0);
    expect(shared.score).toBeGreaterThan(only.score);
  });

  it('says nothing when a thought shares only the words every to-do shares', () => {
    // "Follow up" and "send" are dropped as glue, so this thought has no distinguishing word at all.
    expect(scoreBuckets('Follow up and send', index)).toEqual([]);
    expect(historyProject('Follow up and send', index, PROJECTS)).toBeUndefined();
  });

  it('reads a plural as the word it is', () => {
    // "Send two alternative palettes" is filed in Brand refresh; "palette ideas" has to reach it.
    expect(historyProject('Palette ideas', index, PROJECTS)?.evidence)
      .toBe('2 tasks in Brand refresh mention “palette”.');
  });

  it('places a thought by the word its project is the only one to use', () => {
    const p = historyProject('Redo the dieline', index, PROJECTS);
    expect(p?.projectId).toBe('p-atlas');
    expect(p?.source).toBe('history');
    expect(p?.evidence).toBe('1 task in Packaging v2 mention“dieline”.'.replace('mention“', 'mentions “'));
  });

  it('pluralises the receipt by how many tasks back it up', () => {
    expect(historyProject('Redo the dieline', index, PROJECTS)?.evidence)
      .toBe('1 task in Packaging v2 mentions “dieline”.');
    expect(historyProject('Palette ideas', index, PROJECTS)?.evidence)
      .toBe('2 tasks in Brand refresh mention “palette”.');
  });

  it('refuses when two projects match about equally', () => {
    const split = indexHistory([
      { title: 'Studio photography brief', projectId: 'p-mer' },
      { title: 'Studio photography shortlist', projectId: 'p-fern' },
    ]);
    expect(historyProject('Studio photography costs', split, PROJECTS)).toBeUndefined();
  });

  it('the bar for "one distinctive word" scales with how many projects there are', () => {
    // A word unique to one project scores log(1 + projects), so the bar has to move with it or a
    // three-project workspace could never place anything a nine-project one could.
    const three = indexHistory(FILED);
    const nine = indexHistory([...FILED, ...Array.from({ length: 6 }, (_, i) => ({ title: `Thing ${i}`, projectId: `p-${i}` }))]);
    expect(minScore(nine)).toBeGreaterThan(minScore(three));
    expect(scoreBuckets('dieline', three)[0].score).toBeGreaterThan(minScore(three));
    expect(scoreBuckets('dieline', nine)[0].score).toBeGreaterThan(minScore(nine));
  });

  it('confidence rises with the evidence and falls when a rival matches', () => {
    const bar = minScore(index);
    const alone = confidenceOf([{ bucketId: 'a', score: 5, token: 'x', tasks: 2 }], bar);
    const contested = confidenceOf([
      { bucketId: 'a', score: 5, token: 'x', tasks: 2 },
      { bucketId: 'b', score: 4, token: 'y', tasks: 2 },
    ], bar);
    expect(alone).toBeGreaterThan(contested);
    expect(alone).toBeLessThanOrEqual(1);
    expect(confidenceOf([], bar)).toBe(0);
    expect(confidenceOf([{ bucketId: 'a', score: 0.4, token: 'x', tasks: 1 }], bar)).toBe(0);
  });
});

describe('a thought that names where it goes', () => {
  it('takes the project name over any amount of word overlap', () => {
    const p = namedProject('Palette pass for Lobby screens', PROJECTS);
    expect(p?.projectId).toBe('p-fern');
    expect(p?.evidence).toBe('You wrote “Lobby screens”.');
  });

  it('takes the client name and says whose project it is', () => {
    const p = namedProject('Invoice Meridian Coffee for the first stage', PROJECTS);
    expect(p?.projectId).toBe('p-mer');
    expect(p?.evidence).toBe('You wrote “Meridian Coffee”, and Brand refresh is their project.');
  });

  // THE CONTROL. Half a client's name is an ordinary word to somebody, and matching it is the one
  // mistake that would destroy trust in the whole feature: a thought filed under the wrong client.
  it('never takes half a name, however distinctive it looks', () => {
    expect(namedProject('Coffee with Dev on Tuesday', PROJECTS)).toBeUndefined();
    expect(namedProject('Atlas of typefaces to buy', PROJECTS)).toBeUndefined();
    expect(namedProject('Meridianal survey notes', PROJECTS)).toBeUndefined();
    expect(namedProject('Ring Fernwood about the install', PROJECTS)).toBeUndefined();
    expect(namedProject('Ask Ivy about it', [{ id: 'p', name: 'Site', client: 'Ivy Co' }])).toBeUndefined();
  });

  it('learns the abbreviation instead: once you have filed "Fernwood" there, it knows', () => {
    const learned = indexHistory([...FILED, { title: 'Fernwood invoice for stage one', projectId: 'p-fern' }]);
    expect(historyProject('Ring Fernwood about the install', learned, PROJECTS)?.projectId).toBe('p-fern');
  });

  it('prefers the name it was given over the history score', () => {
    // "palette" points hard at Brand refresh; the words say Packaging v2, and the words win.
    expect(proposeFor({ id: 't', title: 'Palette for Packaging v2' }, PROJECTS, index, nothingOpen).project?.projectId)
      .toBe('p-atlas');
  });
});

describe('a date the thought says', () => {
  const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('quotes the words the person typed, not the chip we would have drawn', () => {
    // The regression this pins: the receipt read ‘You wrote "Due Thu 1 Oct"’ — our own
    // formatting, quoted back at them as if it were their sentence.
    const d = saidDate('Send the quote by Thursday', PROJECTS);
    expect(d.due?.evidence).toBe('You wrote “by Thursday”.');
    expect(d.scheduled).toBeUndefined();
  });

  it('proposes nothing when no date was written', () => {
    expect(saidDate('Send the quote', PROJECTS)).toEqual({});
  });

  it('resolves a date forward, never into a day that has gone', () => {
    // The capture grammar only knows today and forward, so a thought captured weeks ago that says
    // "Friday" proposes the COMING Friday — the only reading anyone can act on.
    const today = isoOf(new Date());
    const d = saidDate('Ring the printer today', PROJECTS);
    expect(d.scheduled?.date).toBe(today);
    expect(d.scheduled?.evidence).toBe('You wrote “today”.');
    expect(saidDate('Dieline revision by Friday', PROJECTS).due!.date >= today).toBe(true);
  });

  it('says nothing rather than quote the wrong day', () => {
    // Two dates, and the second rule only found its own because the first had already taken the
    // other one out of the way. Running it alone lands somewhere else, so there is no honest
    // receipt and therefore no proposal.
    const d = saidDate('Send the quote by Monday, then call Friday', PROJECTS);
    expect(d.due?.evidence).toBe('You wrote “by Monday”.');
    expect(d.scheduled).toBeUndefined();
  });

  it('recovers a consumed phrase exactly, and nothing when none was', () => {
    expect(consumedWords('send the quote by Thursday', 'send the quote')).toBe('by Thursday');
    expect(consumedWords('send the quote', 'send the quote')).toBe('');
  });
});

describe('a thought already written down', () => {
  const open = [
    { id: 't-1', title: 'Send Meridian two alternative palettes' },
    { id: 't-2', title: 'Book the screen install' },
  ];

  it('finds the same thought said differently', () => {
    expect(duplicateOf('Send the two alternative palettes to Meridian', open)?.taskId).toBe('t-1');
  });

  it('does not call a different subject a duplicate', () => {
    expect(duplicateOf('Send Meridian the invoice', open)).toBeUndefined();
    expect(duplicateOf('Book the photographer', open)).toBeUndefined();
  });

  it('never calls a thought its own duplicate', () => {
    const one = [{ id: 't-1', title: 'Send Meridian two alternative palettes' }];
    expect(proposeFor({ id: 't-1', title: 'Send Meridian two alternative palettes' }, PROJECTS, index, one).duplicate)
      .toBeUndefined();
  });

  it('only calls a wordless thought a duplicate when it is repeated exactly', () => {
    const open2 = [{ id: 'x', title: 'Follow up' }];
    expect(duplicateOf('Follow up', open2)?.taskId).toBe('x');
    expect(duplicateOf('Follow up again', open2)).toBeUndefined();
  });
});

describe('a label the person would have put on it', () => {
  const LABELS = [{ id: 'l-wait', name: 'Waiting' }, { id: 'l-errand', name: 'Errand' }];
  const LABELLED = [
    { title: 'Chase Priya for the signed estimate', bucketId: 'l-wait' },
    { title: 'Chase the printer for a delivery date', bucketId: 'l-wait' },
    { title: 'Pick up the paper samples', bucketId: 'l-errand' },
  ];
  const labelIndex = indexBuckets(LABELLED);

  it('reads the labels off tasks worded like this one', () => {
    const l = historyLabel('Chase the supplier', labelIndex, LABELS);
    expect(l?.labelId).toBe('l-wait');
    expect(l?.evidence).toBe('2 tasks labelled Waiting mention \u201cchase\u201d.');
  });

  it('stays quiet when the words say nothing about a label', () => {
    expect(historyLabel('Renew the domain', labelIndex, LABELS)).toBeUndefined();
  });

  // A label is not a home: the two answers are reached independently, and the surface keeps them on
  // separate keys so one press never agrees to two things (lib/inbox-file.ts `historyLabel`).
  it('answers separately from the filing, each on its own evidence', () => {
    const both = proposeFor({ id: 'x', title: 'Chase the supplier' }, PROJECTS, index, nothingOpen,
      { index: labelIndex, all: LABELS });
    // "chase" is a Waiting word and "supplier" a Packaging v2 word; each proposal cites its own.
    expect(both.label?.evidence).toContain('\u201cchase\u201d');
    expect(both.project?.evidence).toContain('\u201csupplier\u201d');

    // And a thought only the labels know about gets a label and no home at all.
    const labelOnly = proposeFor({ id: 'y', title: 'Chase the signed estimate' }, PROJECTS, index, nothingOpen,
      { index: labelIndex, all: LABELS });
    expect(labelOnly.label?.labelId).toBe('l-wait');
    expect(labelOnly.project).toBeUndefined();
  });

  it('is absent entirely when the person keeps no labels', () => {
    const all = proposeAll([{ id: 'x', title: 'Chase the supplier' }], PROJECTS, FILED, nothingOpen,
      { filed: [], all: [] });
    expect(all[0].label).toBeUndefined();
  });
});

describe('the whole Inbox at once', () => {
  const thoughts = [
    { id: 'i-1', title: 'Two more palette options' },
    { id: 'i-2', title: 'Renew the domain' },
    { id: 'i-3', title: 'Dieline revision by Friday' },
  ];

  it('places what it can and leaves the rest alone', () => {
    const all = proposeAll(thoughts, PROJECTS, FILED, nothingOpen);
    expect(all.find((p) => p.thoughtId === 'i-1')?.project?.projectId).toBe('p-mer');
    expect(all.find((p) => p.thoughtId === 'i-2')?.project).toBeUndefined();
    expect(all.find((p) => p.thoughtId === 'i-3')?.project?.projectId).toBe('p-atlas');
    expect(all.find((p) => p.thoughtId === 'i-3')?.due?.evidence).toBe('You wrote \u201cby Friday\u201d.');
  });

  it('hands a model only what the rules could not place', () => {
    const all = proposeAll(thoughts, PROJECTS, FILED, nothingOpen);
    expect(unplaced(all, thoughts).map((t) => t.id)).toEqual(['i-2']);
  });

  it('says nothing at all about a thought it has nothing to say about', () => {
    const [p] = proposeAll([{ id: 'x', title: 'Renew the domain' }], PROJECTS, FILED, nothingOpen);
    expect(saysSomething(p)).toBe(false);
  });

  it('proposes nothing when there is no history and no name to go on', () => {
    const all = proposeAll(thoughts, PROJECTS, [], nothingOpen);
    expect(all.every((p) => !p.project)).toBe(true);
  });

  it('every proposal it makes clears the bar it publishes', () => {
    const all = proposeAll(thoughts, PROJECTS, FILED, nothingOpen);
    for (const p of all) if (p.project) expect(p.project.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });
});
