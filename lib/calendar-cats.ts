// Calendar "calendars" (colored categories) for the rail's MY CALENDARS list and
// event coloring. Zenboard's calendar_events aren't tagged by module yet, so an
// event's calendar is derived client-side from a stable hash — enough to give the
// grid Notion-style colored calendars with working show/hide toggles. When events
// gain a real category column, only `calendarOf` changes.
import { palette, type PaletteColor, type PaletteName } from './palette';
import type { CalEvent } from './calendar';

export type Cal = { id: string; name: string; hue: PaletteName };

// The fixed module calendars shown under "MY CALENDARS" (matches the HiFi rail).
export const MY_CALENDARS: Cal[] = [
  { id: 'task', name: 'Task', hue: 'blue' },
  { id: 'horizon', name: 'Horizon', hue: 'purple' },
  { id: 'projects', name: 'Projects', hue: 'green' },
  { id: 'clients', name: 'Clients', hue: 'orange' },
  { id: 'money', name: 'Money', hue: 'yellow' },
  { id: 'documents', name: 'Documents', hue: 'pink' },
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable calendar for an event (client-side grouping until events are tagged). */
export function calendarOf(e: CalEvent): Cal {
  return MY_CALENDARS[hash(e.id || e.title || 'x') % MY_CALENDARS.length];
}

/** Palette color for a calendar hue. */
export function calColor(hue: PaletteName): PaletteColor {
  return palette(hue);
}
