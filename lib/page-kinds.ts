// THE one rule for which module owns a `pages` row.
//
// `pages` is Zenboard's general document substrate, and more than one module
// stores its objects there — a doc, a template, a database, and now a piece of
// content (lib/content.ts). That is deliberate and it is why content needed no
// migration: a script IS a document, so it inherits the editor, comments,
// versions, mentions and portal sharing for free.
//
// THE COST, if nobody writes this down: a content piece is a page with no
// folder, and Documents' default view is "pages with no folder" — so every
// video in the pipeline showed up in Docs as a stray untitled document. Not
// duplicated data, which would be bad; the SAME object appearing in a module
// that has no business with it, which is worse. PRODUCT_CONTEXT calls that
// creating "another place they have to manage".
//
// So: a page belongs to Documents unless another module has claimed its type.
// The next module that stores a page adds one line here rather than rediscovering
// this in three query files.

/** Page types owned by a module other than Documents. */
export const CLAIMED_PAGE_TYPES: ReadonlySet<string> = new Set([
  'content',   // lib/content.ts — the Content module's pipeline
]);

/**
 * Should this page appear in Documents?
 *
 * Unknown and absent types say YES on purpose. A page whose type nobody
 * recognises is still someone's writing, and the failure mode of hiding it is
 * silent and permanent; the failure mode of showing it is a row in a list.
 */
export function isDocumentPage(type: string | null | undefined): boolean {
  return !(typeof type === 'string' && CLAIMED_PAGE_TYPES.has(type));
}
