"use client";

// Website icon tiles in the Zen Shape language (components/illustrations/ink).
// Each is an IconType-compatible component, so the site's Eyebrow, FeatureCard
// and hub tiles take them in place of glyph icons. The tile draws its own
// rounded field, so the containers only size and shadow it.
import type { CSSProperties } from "react";
import type { IconType } from "@/components/ds/icons";
import { ShapeTile, type ShapeTileName } from "@/components/illustrations/ink";

function tile(name: ShapeTileName): IconType {
  function SiteTile({ size, className, style }: { size?: number | string; className?: string; style?: CSSProperties }) {
    return <ShapeTile name={name} size={typeof size === "number" ? size : undefined} className={className} style={style} />;
  }
  SiteTile.displayName = `SiteTile(${name})`;
  return SiteTile;
}

// Section eyebrows
export const TileEverything = tile("everything");
export const TileTeam = tile("team");
// Client portal feature cards — each matches its card's copy
export const TileLink = tile("link");           // One link, no login
export const TileVisibility = tile("visibility"); // You choose what they see
export const TileRequests = tile("requests");   // Requests become tasks
export const TileApprovals = tile("approvals"); // Approvals, on the record
export const TileInvoices = tile("receipt");    // Invoices, next to the work
// Hub: one tile per product area
export const TileInbox = tile("inbox");
export const TileTasks = tile("tasks");
export const TileCalendar = tile("calendar");
export const TileFocus = tile("focus");
export const TileGoals = tile("goals");
export const TileHabits = tile("streak");
export const TileDocs = tile("docs");
export const TileProjects = tile("projects");
export const TilePortal = tile("clientPortal");
export const TileFinance = tile("finance");
export const TileClients = tile("clients");
export const TileForms = tile("forms");
