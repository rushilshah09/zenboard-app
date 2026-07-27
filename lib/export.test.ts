// Export serializers — principle 11's floor, tested.
import { describe, it, expect } from 'vitest';
import { csvEscape, tasksToCsv, projectsToMarkdown, type ExportTask, type ExportProject } from './export';

const task = (over: Partial<ExportTask> = {}): ExportTask => ({
  title: 'Write the brief', notes: null, done: false, status: 'todo', priority: 'low',
  scheduled_date: '2026-07-21', due_date: null, estimate_minutes: 30,
  completed_at: null, created_at: '2026-07-20T10:00:00Z', recurrence: null,
  is_inbox: false, space: 'Work', project: 'Acme', section: null, parent: null, labels: [],
  ...over,
});

describe('csvEscape', () => {
  it('quotes only when needed and doubles inner quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('two\nlines')).toBe('"two\nlines"');
  });
});

describe('tasksToCsv', () => {
  it('emits a header plus one CRLF row per task', () => {
    const csv = tasksToCsv([task()]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('Title,Status,Priority,Scheduled')).toBe(true);
    expect(lines[1]).toContain('Write the brief');
    expect(lines[1]).toContain('Acme');
  });
  it('survives titles with commas, quotes and newlines', () => {
    const csv = tasksToCsv([task({ title: 'call "Sam", then\nemail' })]);
    expect(csv).toContain('"call ""Sam"", then\nemail"');
  });
  it('renders recurrence through the contract and joins labels', () => {
    const csv = tasksToCsv([task({ recurrence: { freq: 'weekly', byday: 5 }, labels: ['Errand', 'Waiting'] })]);
    expect(csv).toContain('Every Friday');
    expect(csv).toContain('"Errand, Waiting"');
  });
  it('falls back to done/todo when status is null', () => {
    const csv = tasksToCsv([task({ status: null, done: true })]);
    expect(csv.split('\r\n')[1].split(',')[1]).toBe('done');
  });
});

describe('projectsToMarkdown', () => {
  const project = (over: Partial<ExportProject> = {}): ExportProject => ({
    name: 'Acme rebrand', status: 'active', client: 'Acme', space: 'Work',
    created_at: '2026-07-01T00:00:00Z', sections: [], tasks: [],
    ...over,
  });

  it('renders headings, checklists, and nested subtasks', () => {
    const md = projectsToMarkdown([project({
      sections: [{
        name: 'Design',
        tasks: [{
          title: 'Logo drafts', done: false, notes: null, scheduled_date: null,
          due_date: '2026-07-28', estimate_minutes: 60,
          subtasks: [{ title: 'Sketches', done: true, notes: null, scheduled_date: null, due_date: null, estimate_minutes: null, subtasks: [] }],
        }],
      }],
    })], '2026-07-20');
    expect(md).toContain('# Zenboard projects — exported 2026-07-20');
    expect(md).toContain('## Acme rebrand');
    expect(md).toContain('Status: active · Client: Acme · Space: Work');
    expect(md).toContain('### Design');
    expect(md).toContain('- [ ] Logo drafts (due 2026-07-28 · 60m)');
    expect(md).toContain('  - [x] Sketches');
  });
  it('keeps multiline notes as indented continuation lines', () => {
    const md = projectsToMarkdown([project({
      tasks: [{ title: 'Brief', done: false, notes: 'line one\nline two', scheduled_date: null, due_date: null, estimate_minutes: null, subtasks: [] }],
    })], '2026-07-20');
    expect(md).toContain('- [ ] Brief\n  line one\n  line two');
  });
  it('says so when a project has no tasks', () => {
    expect(projectsToMarkdown([project()], '2026-07-20')).toContain('_No tasks._');
  });
});
