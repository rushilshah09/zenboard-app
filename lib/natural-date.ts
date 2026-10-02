// Typed dates ("tomorrow", "next fri", "friday 9am"), read by chrono-node.
//
// chrono-node is about 78 KB gzipped, and nothing needs it until someone types a
// date. Imported statically, it shipped with every screen that can show the date
// picker or the reminder chip, which is most of the app. It now loads on intent
// (a typed-date field gaining focus, the reminder panel opening) and stays for
// the visit.
//
// Because it is fetched on intent, the parser is almost always here by the time
// text is submitted, and `naturalDateParser()` hands it over synchronously, as
// the static import did. `parseNaturalDate()` covers the rare case where it is
// not yet (a slow network, a paste straight into Enter).

type Chrono = typeof import('chrono-node');
type ParseOption = Parameters<Chrono['parseDate']>[2];

/** The loader behind the exports below; separate so a failed load can be tested. */
export function createNaturalDate(load: () => Promise<Chrono>) {
  let parser: Chrono | null = null;
  let pending: Promise<Chrono | null> | null = null;

  /** Start loading the parser. Safe to call on every focus. */
  const loadNaturalDate = (): Promise<Chrono | null> => {
    if (parser) return Promise.resolve(parser);
    pending ??= load().then(
      (m) => (parser = m),
      // Offline, or a chunk that failed: forget the attempt so the next one retries.
      () => {
        pending = null;
        return null;
      },
    );
    return pending;
  };

  /** The parser if it has arrived, else null (and loading starts). */
  const naturalDateParser = (): Chrono | null => {
    if (!parser) void loadNaturalDate();
    return parser;
  };

  /** Read `text` as a date once the parser is here. Null when it is not a date, or the parser could not load. */
  const parseNaturalDate = async (text: string, ref?: Date, option?: ParseOption): Promise<Date | null> => {
    const chrono = await loadNaturalDate();
    return chrono ? chrono.parseDate(text, ref, option) : null;
  };

  return { loadNaturalDate, naturalDateParser, parseNaturalDate };
}

export const { loadNaturalDate, naturalDateParser, parseNaturalDate } = createNaturalDate(() => import('chrono-node'));
