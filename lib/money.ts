// THE money vocabulary — the same idea as lib/date.ts, for the other kind of
// number a person reads.
//
// Before this there were SIX formatters for one format. Three wrote
// `'$' + Math.round(n).toLocaleString(…)`, two of them pinning `'en-US'` and
// one not, so a non-US user saw "$3,600" on Finance and "$3.600" on a client in
// the same session. The portal used `Intl.NumberFormat(style:'currency')`,
// which is the only one that would have said "US$" outside the US. Feedback had
// its own compact "$37k". Connected had a fourth rounding rule.
//
// LOCALE RULE — identical to lib/date.ts: client components pass no locale and
// get the user's own grouping; SERVER-generated strings pass an explicit
// `{ locale }`, because formatting with the user's locale on the server would
// use the SERVER's and mismatch on hydration.
//
// CURRENCY: the app is single-currency (USD) today and the symbol is written as
// a plain "$" on purpose — `style: 'currency'` renders "US$3,600" in most
// non-US locales, which is louder than anything on these screens needs to be.
// When multi-currency arrives it lands here, and only here.

export type MoneyOpts = {
  locale?: string;
  /**
   * Keep the cents when there are any. Off by default: a KPI strip, a pipeline
   * card and an invoice list all read better whole, and "$3,600.00" is noise.
   * Turn it on where the exact figure is the point — a client's invoice.
   */
  exact?: boolean;
};

/** "$3,600" — and "$3,600.42" with `exact` when there are cents. */
export function formatMoney(n: number | null | undefined, opts: MoneyOpts = {}): string {
  // `Number(null)` is 0, not NaN — without this guard a missing amount renders
  // as "$0", which is a different claim from "we don't have a figure".
  if (n === null || n === undefined) return '–';
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  const cents = opts.exact && !Number.isInteger(v);
  return '$' + (cents ? v : Math.round(v)).toLocaleString(opts.locale, {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

/**
 * "$37k" / "$1.2M" — for stat strips and column headers where the magnitude is
 * the message and the digits are not. Below 1000 it is just `formatMoney`.
 */
export function formatMoneyCompact(n: number | null | undefined, opts: MoneyOpts = {}): string {
  // `Number(null)` is 0, not NaN — without this guard a missing amount renders
  // as "$0", which is a different claim from "we don't have a figure".
  if (n === null || n === undefined) return '–';
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  const abs = Math.abs(v);
  if (abs < 1000) return formatMoney(v, opts);
  const [div, suffix] = abs >= 1_000_000 ? [1_000_000, 'M'] : [1000, 'k'];
  const scaled = (v / div).toLocaleString(opts.locale, { maximumFractionDigits: 1 });
  return `$${scaled}${suffix}`;
}
