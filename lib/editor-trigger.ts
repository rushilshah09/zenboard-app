// One rule for "the caret is inside a typed menu trigger".
//
// The block editor has two of these — `/` opens the block menu, `@` opens the
// mention picker — and they answer the same question against the same text.
// Before this they would have been two nearly-identical regex clumps inlined in
// `setRich`, which is how the two menus quietly drift: `/` tolerating something
// `@` doesn't for no reason anybody chose.
//
// Pure and synchronous, so the rules below are testable without an editor.

export type EditorTrigger = {
  /** Index of the trigger character in the text. */
  at: number;
  /** Everything between the trigger character and the caret. */
  query: string;
};

export type TriggerOptions = {
  /**
   * Close once the query passes this many characters. `/` has no cap: its query
   * is a command name, so a long one is simply a typo you are about to fix.
   * `@` allows spaces (record titles have them), and without a cap a stray `@`
   * would leave a menu hanging open across a whole paragraph.
   */
  maxQuery?: number;
};

/**
 * The trigger the caret currently sits in, or null.
 *
 * Only the LAST occurrence before the caret is considered — never an earlier
 * one. So typing an email inside an open query (`@ping sarah@corp.com`) closes
 * the menu instead of quietly re-targeting it at the older `@`, which is both
 * simpler to predict and what you want: someone typing an address is not
 * picking a record. Between the two menus, the trigger nearer the caret wins,
 * so `@` inside an open slash query hands over rather than fighting it.
 *
 * The rules, in the order they reject:
 *  - the trigger character must appear at or before the caret (`@` typed and
 *    then arrowed away from is not a trigger);
 *  - it must start a word — index 0 or preceded by whitespace. This is the rule
 *    that keeps `name@example.com` and `and/or` out of the menus entirely,
 *    without any special-casing for either;
 *  - the query may not START with whitespace, so typing `@ ` dismisses at once —
 *    the one keystroke that reliably means "I meant the literal character";
 *  - the query may not span a line break;
 *  - the query may not exceed `maxQuery`.
 */
export function triggerAt(
  text: string,
  caret: number,
  char: string,
  opts: TriggerOptions = {},
): EditorTrigger | null {
  const upto = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const at = upto.lastIndexOf(char);
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;

  const query = upto.slice(at + char.length);
  if (/^\s/.test(query)) return null;
  if (query.includes('\n')) return null;
  if (opts.maxQuery !== undefined && query.length > opts.maxQuery) return null;

  return { at, query };
}
