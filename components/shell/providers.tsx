'use client';
// App-wide client providers. TooltipProvider (design-system/src/main.tsx mirrors
// this) sets the shared 400ms/300ms hover-delay window for every DS Tooltip and
// IconButton — now that the primitives adapters render DS tooltips app-wide.
import { TooltipProvider } from '@/components/ds/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
