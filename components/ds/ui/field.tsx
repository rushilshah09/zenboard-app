import * as React from "react";
import { CircleAlert } from "@/lib/icons";
import { cn } from "@/lib/cn";

// design-system.md — GROUP B shared anatomy. Label always present & visible;
// we mark OPTIONAL, not required (asterisks become wallpaper). Error REPLACES
// helper, never stacks. label→control 6px, control→helper 6px, field→field 24px.
export interface FieldContextValue {
  id: string;
  describedBy?: string;
  errorId?: string;
  invalid: boolean;
}
const FieldCtx = React.createContext<FieldContextValue | null>(null);
export const useField = () => React.useContext(FieldCtx);

export interface FieldProps {
  label: string;
  optional?: boolean;
  helper?: string;
  error?: string;
  /** id for the control; generated when omitted. */
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, optional, helper, error, id: idProp, children, className }: FieldProps) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);

  return (
    <FieldCtx.Provider value={{ id, describedBy: helper ? helperId : undefined, errorId: invalid ? errorId : undefined, invalid }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="flex items-baseline gap-2 text-body font-medium text-ink-800">
          {label}
          {optional && <span className="text-meta font-normal text-ink-500">Optional</span>}
        </label>
        {children}
        {invalid ? (
          <p id={errorId} className="flex items-center gap-1 text-meta text-danger-600" role="alert">
            <CircleAlert className="size-3 shrink-0" aria-hidden />
            {error}
          </p>
        ) : (
          helper && (
            <p id={helperId} className="text-meta text-ink-500">
              {helper}
            </p>
          )
        )}
      </div>
    </FieldCtx.Provider>
  );
}

/** Wires a control to its surrounding <Field> — id, aria-describedby, aria-invalid. */
export function useFieldProps(ownProps: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
}) {
  const field = useField();
  if (!field) return ownProps;
  return {
    id: ownProps.id ?? field.id,
    "aria-describedby": ownProps["aria-describedby"] ?? (field.invalid ? field.errorId : field.describedBy),
    "aria-invalid": ownProps["aria-invalid"] ?? (field.invalid || undefined),
    "aria-errormessage": field.invalid ? field.errorId : undefined,
  };
}
