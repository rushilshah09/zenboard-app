import { cn } from "@/lib/cn";

// design-system.md §4.45 / §2.10.5 — a skeleton IS the layout with content
// removed. paper-5 base, one shared paper-3 shimmer band per group (not one
// animation per element). aria-hidden; the container carries aria-busy.

export function Skeleton({ className, shape = "block" }: { className?: string; shape?: "line" | "circle" | "block" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block overflow-hidden bg-paper-5",
        shape === "line" && "h-3 rounded-xs",
        shape === "circle" && "rounded-full",
        shape === "block" && "rounded-md",
        className,
      )}
    >
      <span
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-paper-3 to-transparent motion-safe:animate-[shimmer_1.4s_ease-in-out_infinite]"
        style={{ transform: "translateX(-100%)" }}
      />
    </span>
  );
}

/** Text-paragraph skeleton — varied widths so it reads as prose, not a barcode. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-[92%]", "w-[60%]", "w-[85%]", "w-[70%]"];
  return (
    <span aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} shape="line" className={i === lines - 1 ? "w-[60%]" : widths[i % widths.length]} />
      ))}
    </span>
  );
}

/** A list-row skeleton matching §4.48's geometry. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-10 items-center gap-2 px-2", className)}>
      <Skeleton shape="circle" className="size-5 shrink-0" />
      <Skeleton shape="line" className="w-2/5" />
      <span className="flex-1" />
      <Skeleton shape="line" className="w-16" />
    </span>
  );
}
