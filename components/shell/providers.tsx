'use client';
// App-wide client providers. TooltipProvider (design-system/src/main.tsx mirrors
// this) sets the shared 400ms/300ms hover-delay window for every DS Tooltip and
// IconButton — now that the primitives adapters render DS tooltips app-wide.
// From its own module, never the design-system barrel. This file is mounted by
// the ROOT layout, so whatever it imports ships on every page — /login, public
// forms and the client portal included. Importing the barrel here pulled the
// whole design system into those pages, the date parser and animation library
// with it: measured at 144 KB gzipped on /login alone.
import { TooltipProvider } from '@/components/ds/ui/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
