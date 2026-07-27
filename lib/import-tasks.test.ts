import { describe, it, expect } from 'vitest';
import { parseCsv, detectFormat, parseTasksCsv } from './import-tasks';

describe('parseCsv (RFC 4180)', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('honors quoted fields with commas and newlines', () => {
    expect(parseCsv('a,b\n"x,y","line1\nline2"')).toEqual([['a', 'b'], ['x,y', 'line1\nline2']]);
  });
  it('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"she said ""hi"""')).toEqual([['a'], ['she said "hi"']]);
  });
  it('strips a BOM and handles CRLF + trailing newline', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('detectFormat', () => {
  it('detects Todoist by its signature headers', () => {
    expect(detectFormat(['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT'])).toBe('todoist');
  });
  it('detects TickTick by its signature headers', () => {
    expect(detectFormat(['Folder Name', 'List Name', 'Title', 'Content', 'Priority', 'Status'])).toBe('ticktick');
  });
  it('falls back to generic', () => {
    expect(detectFormat(['Title', 'Due', 'Project'])).toBe('generic');
  });
});

describe('parseTasksCsv — Todoist export', () => {
  const CSV = [
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
    'task,Email Mira,follow up on brief,4,1,Me,,2026-01-05,en,',
    'task,Buy stamps,,1,1,Me,,,en,',
    'section,Later,,,,,,,,',
    'note,some note,,,,,,,,',
    'task,Recurring standup,,3,1,Me,,every day,en,',
  ].join('\n');

  it('imports only task rows, skipping sections/notes', () => {
    const r = parseTasksCsv(CSV);
    expect(r.format).toBe('todoist');
    expect(r.tasks.map((t) => t.title)).toEqual(['Email Mira', 'Buy stamps', 'Recurring standup']);
    expect(r.skipped).toBe(2); // section + note
  });
  it('maps priority 4→high, 3→med, 1→low', () => {
    const r = parseTasksCsv(CSV);
    expect(r.tasks.map((t) => t.priority)).toEqual(['high', 'low', 'med']);
  });
  it('takes a real due date but drops recurring phrases', () => {
    const r = parseTasksCsv(CSV);
    expect(r.tasks[0].dueDate).toBe('2026-01-05');
    expect(r.tasks[0].notes).toBe('follow up on brief');
    expect(r.tasks[2].dueDate).toBeNull(); // "every day" → null
  });
});

describe('parseTasksCsv — generic CSV', () => {
  const CSV = [
    'Title,Notes,Priority,Due,Project,Status',
    'Draft proposal,"needs scope, then price",High,2026-02-01,Acme,',
    'Send invoice,,normal,,Acme,done',
    ',orphan with no title,,,,',
  ].join('\n');

  it('maps headers case-insensitively and by synonyms', () => {
    const r = parseTasksCsv(CSV);
    expect(r.format).toBe('generic');
    expect(r.tasks).toHaveLength(2);
    expect(r.skipped).toBe(1); // the titleless row
    expect(r.tasks[0]).toMatchObject({
      title: 'Draft proposal',
      notes: 'needs scope, then price',
      priority: 'high',
      dueDate: '2026-02-01',
      projectName: 'Acme',
      done: false,
    });
  });
  it('detects completion from a status column', () => {
    const r = parseTasksCsv(CSV);
    expect(r.tasks[1]).toMatchObject({ title: 'Send invoice', priority: 'med', done: true });
  });
  it('returns nothing for a header-only or empty file', () => {
    expect(parseTasksCsv('Title,Due').tasks).toEqual([]);
    expect(parseTasksCsv('').tasks).toEqual([]);
  });
});

describe('parseTasksCsv — TickTick export (metadata preamble)', () => {
  const CSV = [
    '"Date: 2026-01-01T00:00:00+0000"',
    '"Version: 6.0"',
    '',
    '"Folder Name","List Name","Title","Content","Start Date","Due Date","Priority","Status"',
    '"","Work","Ship the redesign","final QA pass","","2026-03-10T09:00:00+0000","5","0"',
    '"","Personal","Book flights","","","","3","0"',
    '"","Work","Old task","","","","0","2"',
    '"","Work","Abandoned idea","","","","1","-1"',
  ].join('\n');

  it('skips the metadata preamble and detects TickTick', () => {
    expect(parseTasksCsv(CSV).format).toBe('ticktick');
  });
  it('maps priority 5→high, 3→med, 0→low and List Name→project', () => {
    const r = parseTasksCsv(CSV);
    expect(r.tasks[0]).toMatchObject({ title: 'Ship the redesign', priority: 'high', dueDate: '2026-03-10', notes: 'final QA pass', projectName: 'Work', done: false });
    expect(r.tasks[1]).toMatchObject({ title: 'Book flights', priority: 'med', projectName: 'Personal' });
  });
  it('marks status 2 done and skips won’t-do (-1)', () => {
    const r = parseTasksCsv(CSV);
    expect(r.tasks.find((t) => t.title === 'Old task')).toMatchObject({ done: true, priority: 'low' });
    expect(r.tasks.map((t) => t.title)).not.toContain('Abandoned idea');
    expect(r.skipped).toBe(1);
  });
});

describe('parseTasksCsv — Things-style generic (When/Deadline/Area)', () => {
  const CSV = [
    'Title,Notes,When,Deadline,Area,Tags,Status',
    'Renew passport,bring photos,2026-04-01,2026-04-15,Personal,errand,open',
    'Ship v2,,,,Work,,completed',
  ].join('\n');

  it('maps Things columns through generic synonyms', () => {
    const r = parseTasksCsv(CSV);
    expect(r.format).toBe('generic');
    expect(r.tasks[0]).toMatchObject({ title: 'Renew passport', notes: 'bring photos', scheduledDate: '2026-04-01', dueDate: '2026-04-15', projectName: 'Personal', done: false });
    expect(r.tasks[1]).toMatchObject({ title: 'Ship v2', done: true, projectName: 'Work' });
  });
});
