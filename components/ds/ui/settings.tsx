import * as React from "react";
import { cn } from "@/lib/cn";
import { Pencil } from "@/lib/icons";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { AnchorRow } from "./anchor-row";

// Settings pattern — grouped preference rows (reference-measured density,
// Zenboard skin). A pane opens with SettingsPaneHeader (title-3 + one quiet
// line), then SettingsSections: a lead heading over a hairline, rows below with
// whitespace-only separation. A SettingsRow is text left (ui title + meta
// description), control on the trailing edge; a control that needs the full
// width (segmented, swatch grid) passes layout="stack". Rows are py-3 so
// adjacent rows sit 24px apart; sections sit 40px apart via the pane stack.

export function SettingsPaneHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-1", className)}>
      <h2 className="text-title-3 text-ink-900">{title}</h2>
      {description && <p className="text-ui text-ink-500">{description}</p>}
    </header>
  );
}

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <section className={cn("flex flex-col", className)}>
      <div className="border-b border-line pb-2">
        <h3 className="text-lead font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-0.5 text-meta text-ink-500">{description}</p>}
      </div>
      <div className="flex flex-col pt-1">{children}</div>
    </section>
  );
}

export interface SettingsRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Leading 16px glyph in a 32px well — integrations/providers, not plain prefs. */
  icon?: React.ReactNode;
  control?: React.ReactNode;
  /**
   * The setting's CURRENT VALUE as readable text ("Disabled", "One page",
   * "3 responses"). Pair with `onEdit` for values that need a picker or a field.
   *
   * This is the row grammar that makes a settings page scannable: because every
   * row reads `label | value | edit`, you can take in the whole current state by
   * running down one column. A page of expanded inputs shows you controls, not
   * answers. Prefer `control` only where the control IS the answer — a Switch
   * already shows its state, so it toggles in place and needs no value or pencil.
   */
  value?: React.ReactNode;
  /** Opens the editor for `value`. Renders the trailing pencil. */
  onEdit?: () => void;
  /** Accessible name for the pencil; defaults to "Edit <title>". */
  editLabel?: string;
  /** stack = control on its own line under the text, for full-width controls. */
  layout?: "inline" | "stack";
  className?: string;
}

export function SettingsRow({
  title, description, icon, control, value, onEdit, editLabel, layout = "inline", className,
}: SettingsRowProps) {
  // THE row (components/ds/ui/anchor-row.tsx) with settings' own trailing grammar on it:
  // `label | value | edit`, so you can take in a whole pane by running down one column.
  return (
    <AnchorRow
      icon={icon}
      title={title}
      description={description}
      layout={layout}
      className={cn("py-3", className)}
      trailing={(control || value != null || onEdit) ? (
        <>
          {value != null && <span className="truncate text-ui text-ink-600">{value}</span>}
          {control}
          {onEdit && (
            <IconButton
              label={editLabel ?? (typeof title === "string" ? `Edit ${title.toLowerCase()}` : "Edit")}
              variant="ghost"
              size="xs"
              icon={<Icon icon={Pencil} size={14} />}
              onClick={onEdit}
            />
          )}
        </>
      ) : undefined}
    />
  );
}
