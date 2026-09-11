import React, { useId } from 'react';
import { clsx } from 'clsx';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as LabelPrimitive from '@radix-ui/react-label';
import { AlertCircle, CheckCircle2, Check, ChevronDown, Info, TriangleAlert } from 'lucide-react';

// Obana form & UI primitives. One place for field height, focus ring and text size, so every form matches.
// Fields are 48px tall with 16px text (stops iPhones zooming in on focus).

const fieldBase =
  'w-full rounded-xl border bg-white text-base text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition ' +
  'focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

function FieldLabel({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
      {label}
      {required && (
        <span className="ml-0.5 text-rose-600" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

function FieldMessage({ id, error, helperText }: { id: string; error?: string; helperText?: string }) {
  if (error) return <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600">{error}</p>;
  if (helperText) return <p id={`${id}-help`} className="mt-1.5 text-sm text-slate-500">{helperText}</p>;
  return null;
}

const describedBy = (id: string, error?: string, helperText?: string) =>
  error ? `${id}-error` : helperText ? `${id}-help` : undefined;

// ─── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, children, ...props }, ref) => {
    const variants = {
      // Class names must be written out in full so Tailwind generates them.
      primary: 'bg-[#1B3B5F] text-white shadow-sm hover:bg-[#15304d] active:bg-[#10263e]',
      secondary: 'border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50',
      danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
      ghost: 'text-slate-700 hover:bg-slate-100',
    };
    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-11 px-4 text-sm sm:text-[15px]',
      lg: 'h-12 px-6 text-base',
    };
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20 disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ─── Input ───────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Icon shown inside the field on the left. */
  icon?: React.ReactNode;
  /** Button or text inside the field on the right (e.g. show-password). */
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, trailing, id, required, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={inputId} label={label} required={required} />}
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 text-slate-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, helperText)}
            className={clsx(
              fieldBase,
              'h-12 px-4',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15' : 'border-slate-300',
              icon && 'pl-11',
              trailing && 'pr-12',
              className
            )}
            {...props}
          />
          {trailing && <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2">{trailing}</span>}
        </div>
        <FieldMessage id={inputId} error={error} helperText={helperText} />
      </div>
    );
  }
);
Input.displayName = 'Input';

// ─── Textarea ────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, required, rows = 4, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={fieldId} label={label} required={required} />}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, error, helperText)}
          className={clsx(fieldBase, 'resize-y px-4 py-3', error ? 'border-rose-500' : 'border-slate-300', className)}
          {...props}
        />
        <FieldMessage id={fieldId} error={error} helperText={helperText} />
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ─── Select (native — uses the phone's own picker) ───────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder = 'Select an option', id, required, className, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={selectId} label={label} required={required} />}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(selectId, error, helperText)}
            className={clsx(fieldBase, 'h-12 appearance-none pl-4 pr-10', error ? 'border-rose-500' : 'border-slate-300', className)}
            {...props}
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
        </div>
        <FieldMessage id={selectId} error={error} helperText={helperText} />
      </div>
    );
  }
);
Select.displayName = 'Select';

// ─── Checkbox ────────────────────────────────────────────────────────────────
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ label, id, className, ...props }, ref) => {
  const autoId = useId();
  const boxId = id ?? autoId;
  return (
    <label htmlFor={boxId} className={clsx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-700', className)}>
      <input
        ref={ref}
        id={boxId}
        type="checkbox"
        className="h-5 w-5 cursor-pointer rounded-md border-slate-300 accent-[#1B3B5F] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/15"
        {...props}
      />
      {label}
    </label>
  );
});
Checkbox.displayName = 'Checkbox';

// ─── Label (Radix) ───────────────────────────────────────────────────────────
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={clsx('text-sm font-medium leading-none text-slate-800 peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

// ─── Select (Radix) ──────────────────────────────────────────────────────────
export const SelectP = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={clsx(
      'flex h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 shadow-sm',
      'focus:outline-none focus:ring-4 focus:ring-[#1B3B5F]/10 data-[placeholder]:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-5 w-5 text-slate-400" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={clsx(
        'relative z-50 max-h-80 min-w-32 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={clsx('p-1', position === 'popper' && 'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)')}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={clsx(
      'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-9 pr-3 text-[15px] outline-none focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-[#1B3B5F]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

// ─── Card ────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /** Buttons or links shown on the right of the card header. */
  actions?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, title, description, actions, children, ...props }, ref) => (
  <div ref={ref} className={clsx('rounded-2xl border border-slate-200 bg-white shadow-sm', className)} {...props}>
    {title && (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className="p-5 sm:p-6">{children}</div>
  </div>
));
Card.displayName = 'Card';

// ─── Alert ───────────────────────────────────────────────────────────────────
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'success' | 'error' | 'warning' | 'info';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, type = 'info', children, ...props }, ref) => {
  const styles = {
    success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
    error: { box: 'border-rose-200 bg-rose-50 text-rose-800', Icon: AlertCircle },
    warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', Icon: TriangleAlert },
    info: { box: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
  }[type];
  return (
    <div
      ref={ref}
      role={type === 'error' ? 'alert' : 'status'}
      className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', styles.box, className)}
      {...props}
    >
      <styles.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
});
Alert.displayName = 'Alert';

// ─── Badge ───────────────────────────────────────────────────────────────────
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'default', children, ...props }, ref) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
    error: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    default: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  };
  return (
    <span
      ref={ref}
      className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
});
Badge.displayName = 'Badge';

// ─── Loading ─────────────────────────────────────────────────────────────────
interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const Loader = ({ size = 'md', label = 'Loading', className, ...props }: LoaderProps) => {
  const sizes = { sm: 'h-5 w-5 border-2', md: 'h-8 w-8 border-[3px]', lg: 'h-12 w-12 border-4' };
  return (
    <div role="status" className={clsx('flex items-center justify-center', className)} {...props}>
      <span className={clsx('animate-spin rounded-full border-slate-200 border-t-[#1B3B5F]', sizes[size])} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
};

export const Skeleton = ({ className }: { className?: string }) => <div className={clsx('animate-pulse rounded-lg bg-slate-100', className)} aria-hidden />;

// ─── Table ───────────────────────────────────────────────────────────────────
export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table ref={ref} className={clsx('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={clsx('bg-slate-50 [&_tr]:border-b [&_tr]:border-slate-200', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={clsx('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={clsx('border-b border-slate-100 transition-colors hover:bg-slate-50/70 data-[state=selected]:bg-slate-100', className)} {...props} />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th ref={ref} className={clsx('h-11 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-slate-500', className)} {...props} />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={clsx('px-4 py-3 align-middle text-slate-700', className)} {...props} />
));
TableCell.displayName = 'TableCell';

// ─── Dropdown menu ───────────────────────────────────────────────────────────
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={clsx('z-50 min-w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-lg', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={clsx(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;
