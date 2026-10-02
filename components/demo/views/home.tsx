'use client';
// Home, as Alex opens it: the product's own Today view on the studio's day (fixtures.ts).
import * as React from 'react';
import { TodayView } from '@/components/today/today-view';
import { PERSON, PROJECTS, homeDay } from '../fixtures';

export default function HomeDemo() {
  const day = React.useMemo(() => homeDay(), []);
  return (
    <TodayView
      name={PERSON.first}
      initialTasks={day.tasks}
      waiting={day.waiting}
      content={day.content}
      projects={PROJECTS}
      subByParent={{}}
      initialHabits={day.habits}
      events={day.events}
      meetings={day.meetings}
      workHours={{ start: 9 * 60, end: 17 * 60 }}
      errors={{ tasks: false, habits: false, events: false }}
      // The day's rituals are done, so Home opens on the plan rather than on a prompt about it.
      planned
      shutdown
    />
  );
}
