"use client";

import * as React from "react";
import { PanelLeft } from "@/lib/icons";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";

/**
 * Show/hide the rail beside a hub.
 *
 * ── IT LIVES IN THE HEADER, NEVER IN THE RAIL ──────────────────────────────
 * Documents learned this the hard way: the toggle used to sit inside the rail,
 * so the control that brings the rail back disappeared along with it. One
 * button, always in the same place, both states.
 *
 * Extracted because Documents had it and Projects did not — the same hub
 * shape, one with a way to reclaim the width and one without. `HubLayout`
 * renders it for every hub now, so a rail is collapsible by construction
 * rather than by whoever remembered.
 */
export function RailToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <IconButton
      size="sm"
      label={hidden ? "Show sidebar" : "Hide sidebar"}
      aria-expanded={!hidden}
      icon={<Icon icon={PanelLeft} size={16} />}
      onClick={onToggle}
    />
  );
}
