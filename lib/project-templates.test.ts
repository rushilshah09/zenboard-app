import { describe, it, expect } from 'vitest';
import { PROJECT_TEMPLATES, offsetToWorkday, buildTemplatePlan } from './project-templates';

const dateISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('offsetToWorkday', () => {
  const base = new Date(2026, 6, 1); // an arbitrary anchor

  it('never returns a Saturday or Sunday, for any offset', () => {
    for (let d = 0; d <= 45; d++) {
      const dow = new Date(offsetToWorkday(base, d) + 'T00:00:00').getDay();
      expect(dow === 0 || dow === 6).toBe(false);
    }
  });

  it('keeps weekday landings and nudges weekend landings to Monday', () => {
    for (let d = 0; d <= 45; d++) {
      const raw = new Date(base); raw.setDate(raw.getDate() + d);
      const got = offsetToWorkday(base, d);
      if (raw.getDay() === 6) { const m = new Date(raw); m.setDate(m.getDate() + 2); expect(got).toBe(dateISO(m)); }
      else if (raw.getDay() === 0) { const m = new Date(raw); m.setDate(m.getDate() + 1); expect(got).toBe(dateISO(m)); }
      else expect(got).toBe(dateISO(raw));
    }
  });
});

describe('buildTemplatePlan', () => {
  it('preserves sections and task count, and resolves every section', () => {
    for (const t of PROJECT_TEMPLATES) {
      const plan = buildTemplatePlan(t, new Date(2026, 6, 1));
      expect(plan.sections).toEqual(t.sections);
      expect(plan.tasks.length).toBe(t.tasks.length);
      for (const task of plan.tasks) {
        if (task.section !== null) expect(t.sections).toContain(task.section);
        expect(new Date(task.scheduledDate + 'T00:00:00').getDay()).not.toBe(0);
        expect(new Date(task.scheduledDate + 'T00:00:00').getDay()).not.toBe(6);
      }
    }
  });

  it('drops an unknown section reference to loose rather than dropping the task', () => {
    const plan = buildTemplatePlan(
      { key: 'x', name: 'X', hint: 'h', category: 'c', sections: ['A'], tasks: [{ title: 't', section: 'Ghost' }] },
      new Date(2026, 6, 1),
    );
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].section).toBeNull();
  });
});

describe('PROJECT_TEMPLATES integrity', () => {
  it('has unique keys', () => {
    const keys = PROJECT_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every task references a real section, and copy is present', () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(t.name.trim()).not.toBe('');
      expect(t.hint.trim()).not.toBe('');
      expect(t.category.trim()).not.toBe('');
      expect(t.tasks.length).toBeGreaterThan(0);
      for (const task of t.tasks) {
        expect(task.title.trim()).not.toBe('');
        if (task.section) expect(t.sections).toContain(task.section);
      }
    }
  });
});
