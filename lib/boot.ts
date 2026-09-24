// The two names the boot splash is remembered by — shared so the blocking boot script, the CSS
// and the component cannot drift apart (`components/shell/boot-splash.tsx`).
//
// Session, not local: "the first time you open the app" means this tab's visit, not this device
// forever. Close the tab, come back tomorrow, and the app introduces itself once more.
export const BOOT_KEY = 'zb-booted';
export const BOOTED_ATTR = 'data-booted';
