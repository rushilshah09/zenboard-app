'use client';
// Canonical UI primitives — now a THIN ADAPTER over the single design-system
// source (components/ds/ui, generated from design-system/src at :5175). Each
// export keeps its existing app-facing API so no feature call site changes, but
// renders the DS component underneath. A few app-specific pieces the DS has no
// equivalent for (RadioIndicator, QuickAddRow, SwitchTrack, Spinner) and the
// lossy form fields (Field/Input/Textarea) stay token-driven locals — they use
// the same DS-aligned tokens (globals.css) and now render the DS Tabler Icon,
// so the legacy legacy icon set is fully gone from this layer.
import { forwardRef } from 'react';
import { Plus, type IconType } from '@/components/ds/icons';
import {
  Button as DSButton,
  SplitButton as DSSplitButton,
  Card as DSCard,
  Tag,
  Tooltip as DSTooltip,
  Kbd as DSKbd,
  Switch,
  Checkbox as DSCheckbox,
  IconButton as DSIconButton,
  Divider as DSDivider,
  Avatar as DSAvatar,
  TextInput,
  Textarea as DSTextarea,
  Icon,
} from '@/components/ds/ui';

type Cx = (string | false | null | undefined)[];
export const cx = (...c: Cx) => c.filter(Boolean).join(' ');

// ── Button ───────────────────────────────────────────────────
// Legacy variants map onto the DS button (berry `accent` → DS primary; the app's
// neutral-solid `primary`/`dark` → the DS `neutral` variant added for Zenboard;
// `tinted` → DS tinted). Icons are Tabler components, wrapped in the DS <Icon>.
export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'tinted' | 'accent' | 'dark' | 'danger' | 'danger-soft';
export type BtnSize = 'sm' | 'md' | 'lg';

const V: Record<BtnVariant, 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger' | 'dangerGhost' | 'neutral' | 'tinted'> = {
  // v4 audit row 1: ONE primary treatment app-wide — accent. (`dark` stays the
  // explicit neutral-solid escape hatch for the rare deliberate dark fill.)
  primary: 'primary', dark: 'neutral', accent: 'primary', secondary: 'secondary',
  ghost: 'ghost', tinted: 'tinted', danger: 'danger', 'danger-soft': 'dangerGhost',
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BtnVariant; size?: BtnSize; block?: boolean;
    icon?: IconType; iconRight?: IconType;
  }
>(function Button({ variant = 'secondary', size = 'md', block, icon: Lead, iconRight: Trail, className, children, ...props }, ref) {
  return (
    <DSButton
      ref={ref}
      variant={V[variant]}
      size={size}
      iconOnly={!children}
      icon={Lead ? <Icon icon={Lead} size={16} /> : undefined}
      iconRight={Trail ? <Icon icon={Trail} size={16} /> : undefined}
      className={cx(block && 'w-full', className)}
      {...props}
    >
      {children}
    </DSButton>
  );
});

// ── SplitButton ──────────────────────────────────────────────
export function SplitButton({ variant = 'secondary', size = 'md', icon: Lead, onClick, onMenuClick, disabled, children, className, menuLabel }: {
  variant?: BtnVariant; size?: BtnSize; icon?: IconType; menuIcon?: IconType;
  onClick?: () => void; onMenuClick?: () => void; disabled?: boolean;
  children: React.ReactNode; className?: string; menuLabel?: string;
}) {
  return (
    <DSSplitButton
      variant={V[variant]}
      size={size}
      icon={Lead ? <Icon icon={Lead} size={16} /> : undefined}
      onClick={onClick}
      onMenuOpen={onMenuClick}
      disabled={disabled}
      className={className}
      menuLabel={menuLabel ?? 'More options'}
    >
      {children}
    </DSSplitButton>
  );
}

// ── Card ─────────────────────────────────────────────────────
export function Card({ className, hoverable, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) {
  return <DSCard interactive={hoverable} className={className} {...props} />;
}

// ── Field (label + hint + error wrapper) ─────────────────────
// Kept token-driven (DS Field uses an "optional" affordance; the app marks
// required). Same tokens as the DS, no icon → no legacy.
export function Field({ label, hint, error, required, htmlFor, children, className }: {
  label?: string; hint?: string; error?: string; required?: boolean; htmlFor?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-body font-medium text-ink-800">
          {label} {required && <span className="text-[var(--accent)]">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="text-caption text-danger-600">{error}</span> : hint ? <span className="text-caption text-ink-500">{hint}</span> : null}
    </div>
  );
}

// ── Input / Textarea ─────────────────────────────────────────
// Now pure delegations to the DS TextInput / Textarea (no caller uses the old
// arbitrary `trailing` slot). `fieldSize` → DS `size`, `invalid` → aria-invalid,
// leading icon → the DS <Icon>. Zero hand-rolled tokens remain here.
type FieldSize = 'sm' | 'md' | 'lg';

export const Input = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & { icon?: IconType; invalid?: boolean; fieldSize?: FieldSize }
>(function Input({ icon: Lead, invalid, fieldSize = 'md', ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      size={fieldSize}
      icon={Lead ? <Icon icon={Lead} size={16} /> : undefined}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return <DSTextarea ref={ref} {...props} />;
  },
);

// ── Pill / Tag ───────────────────────────────────────────────
// The legacy chip maps onto the DS Tag (rectangle label). Legacy tone → DS
// LabelColor. `dot` has no DS Tag equivalent and is dropped (rare).
type Tone =
  | 'neutral' | 'accent'
  | 'gray' | 'brown' | 'orange' | 'yellow' | 'amber' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
const TONE_COLOR: Record<Tone, 'stone' | 'berry' | 'rust' | 'ochre' | 'moss' | 'teal' | 'slate' | 'indigo' | 'plum' | 'clay'> = {
  neutral: 'stone', accent: 'berry', gray: 'slate', brown: 'clay', orange: 'rust',
  yellow: 'ochre', amber: 'ochre', green: 'moss', blue: 'teal', purple: 'plum', pink: 'berry', red: 'rust',
};
export function Pill({ tone = 'neutral', onRemove, className, children }: {
  tone?: Tone; dot?: boolean; onRemove?: () => void; className?: string; children: React.ReactNode;
}) {
  return (
    <Tag color={TONE_COLOR[tone]} size="sm" onRemove={onRemove} className={className}>
      {children}
    </Tag>
  );
}

// ── Tooltip ──────────────────────────────────────────────────
export function Tooltip({ label, side = 'bottom', children }: {
  label: string; side?: 'top' | 'bottom'; children: React.ReactNode; className?: string;
}) {
  return <DSTooltip content={label} side={side}>{children}</DSTooltip>;
}

// ── RadioIndicator ───────────────────────────────────────────
// Presentational sidebar-control marker; no DS equivalent (DS Radio is a full
// control). Kept local on DS-aligned tokens.
export function RadioIndicator({ checked, className }: { checked?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block w-4 h-4 rounded-full shrink-0 transition-[background,border-color,box-shadow] duration-150', !checked && 'border border-line-strong', className)}
      style={checked ? { background: 'var(--color-paper-2)', boxShadow: 'inset 0 0 0 5px var(--accent)' } : undefined}
    />
  );
}

// ── QuickAddRow ──────────────────────────────────────────────
// App-specific wide "＋ Add" affordance; no DS equivalent. Renders the DS Icon.
export function QuickAddRow({ label = 'Add Task', onClick, className }: { label?: string; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex items-center gap-2.5 w-full h-12 px-4 bg-paper-2 border border-line rounded-lg',
        'text-left text-body text-ink-500 cursor-text transition-colors [transition-duration:var(--dur-instant)] hover:bg-surface-hover',
        className,
      )}
    >
      <Icon icon={Plus} size={16} />
      {label}
    </button>
  );
}

// ── Kbd ──────────────────────────────────────────────────────
export function Kbd({ children }: { children: React.ReactNode }) {
  return <DSKbd keys={[typeof children === 'string' || typeof children === 'number' ? String(children) : '']} />;
}

// ── Switch / Toggle ──────────────────────────────────────────
// SwitchTrack is the presentational twin of the DS <Switch> — for use inside a
// clickable row/button where nesting an interactive Radix control is invalid.
// It MUST look identical to <Switch>: same capsule geometry, same recessed off
// fill, same accent on-fill, same white shadowed thumb. Change one, change both.
export function SwitchTrack({ on, size = 'md' }: { on: boolean; size?: 'sm' | 'md' }) {
  const geom = size === 'md'
    ? { track: 'w-9 h-5', thumb: 'size-4', off: 2, on: 18 }
    : { track: 'w-7 h-4', thumb: 'size-3', off: 2, on: 14 };
  return (
    <span
      aria-hidden
      className={cx(
        'relative inline-block shrink-0 rounded-full transition-colors [transition-duration:var(--dur-base)]',
        geom.track,
        on
          ? 'bg-[var(--accent)]'
          : 'bg-[color-mix(in_srgb,var(--color-ink-400)_28%,var(--color-paper-5))]',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 rounded-full bg-white transition-[left] [transition-duration:var(--dur-base)]',
          'shadow-[0_1px_2px_rgb(30_28_26/0.20),0_0_0_0.5px_rgb(30_28_26/0.06)]',
          geom.thumb,
        )}
        style={{ left: on ? geom.on : geom.off }}
      />
    </span>
  );
}

export function Toggle({ on, onChange, disabled, label, size = 'md' }: { on: boolean; onChange: () => void; disabled?: boolean; label?: string; size?: 'sm' | 'md' }) {
  return <Switch size={size} checked={on} onCheckedChange={() => onChange()} disabled={disabled} aria-label={label} />;
}

// ── Checkbox ─────────────────────────────────────────────────
export function Checkbox({ checked, indeterminate, onChange, disabled, label: ariaLabel, className }: {
  checked: boolean; indeterminate?: boolean; onChange?: () => void; disabled?: boolean; label?: string; className?: string;
}) {
  return (
    <DSCheckbox
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={() => onChange?.()}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

// ── IconButton ───────────────────────────────────────────────
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
    icon: IconType; label: string; size?: 'sm' | 'md' | 'lg'; iconSize?: number;
    active?: boolean; tone?: 'default' | 'danger';
  }
>(function IconButton({ icon: Glyph, label, size = 'md', iconSize = 16, active, tone = 'default', className, ...props }, ref) {
  return (
    <DSIconButton
      ref={ref}
      icon={<Icon icon={Glyph} size={iconSize} />}
      label={label}
      size={size}
      variant={tone === 'danger' ? 'dangerGhost' : 'ghost'}
      toggle={active ? true : undefined}
      aria-pressed={active}
      className={className}
      {...props}
    />
  );
});

// ── Divider (DS §5.13) ───────────────────────────────────────
export function Divider({ vertical, className }: { vertical?: boolean; className?: string }) {
  return <DSDivider variant={vertical ? 'vertical' : 'rule'} className={className} />;
}

// ── Spinner ──────────────────────────────────────────────────
// Trivial loading ring; kept local (used inside buttons / standalone).
export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx('inline-block rounded-full border-2 border-current border-t-transparent animate-[spin_0.6s_linear_infinite]', className)}
      style={{ width: size, height: size, opacity: 0.6 }}
    />
  );
}

// ── Avatar (DS §5.4) ─────────────────────────────────────────
const AVATAR_SIZE = (n: number): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' =>
  n <= 18 ? 'xs' : n <= 22 ? 'sm' : n <= 30 ? 'md' : n <= 38 ? 'lg' : n <= 46 ? 'xl' : '2xl';
export function Avatar({ name, src, size = 24, square, className }: {
  name: string; src?: string | null; size?: number; square?: boolean; className?: string;
}) {
  return <DSAvatar name={name} src={src ?? undefined} size={AVATAR_SIZE(size)} shape={square ? 'square' : 'circle'} className={className} />;
}
