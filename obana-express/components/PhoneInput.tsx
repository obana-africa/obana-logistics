import React, { useId } from 'react';
import PhoneInput2 from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Two-letter country the field starts on. */
  defaultCountry?: string;
}

// Europe → Africa is Obana's core lane, so both ends of it are at the top of the list.
const PREFERRED = ['ng', 'gb', 'gh', 'ke', 'za', 'de', 'fr', 'nl', 'it', 'es', 'ie', 'be'];

/**
 * Reconciles what people type with the country already chosen.
 *
 * Everyone says their own number the way it is printed on a card — 0904 887
 * 7098 — and that leading zero is a national trunk prefix, not part of the
 * number. Typed under a +234 country it produced "+090 488 770 98": a plus, a
 * trunk zero, and no country code at all. It is not a number anywhere, and it
 * reached the database in that state.
 *
 * Four shapes arrive here, and all four should end up identical:
 *
 *   2340904887709  dial code with the trunk zero still after it
 *   0904887709     the local form, as printed
 *   2349048877098  already correct
 *   9048877098     national, no trunk zero
 */
const withCountryCode = (raw: string, dial: string) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!dial || !digits) return digits;

  if (digits.startsWith(`${dial}0`)) return dial + digits.slice(dial.length + 1);
  if (digits.startsWith(dial)) return digits;
  if (digits.startsWith('0')) return dial + digits.slice(1);

  /* Bare national number. Guarded on length so a number already carrying
     another country's code is not given a second one. */
  return digits.length <= 10 ? dial + digits : digits;
};

/** International phone field that matches the other form fields (48px, same border and focus ring). */
export default function PhoneInput({
  value,
  onChange,
  label,
  required = false,
  error,
  helperText,
  className,
  placeholder,
  disabled,
  defaultCountry = 'ng',
}: PhoneInputProps) {
  const id = useId();
  return (
    <div className={`w-full ${className || ''}`}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-600" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      <PhoneInput2
        country={defaultCountry}
        preferredCountries={PREFERRED}
        value={value}
        onChange={(raw, country) => onChange(withCountryCode(raw, (country as { dialCode?: string })?.dialCode ?? ''))}
        disabled={disabled}
        placeholder={placeholder}
        enableSearch
        disableSearchIcon
        searchPlaceholder="Search country"
        inputProps={{
          id,
          required,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-error` : helperText ? `${id}-help` : undefined,
        }}
        containerClass="!w-full"
        inputClass={`!w-full !h-12 !rounded-xl !border !text-base !text-slate-900 !pl-[58px] !shadow-sm !transition focus:!border-[#1B3B5F] focus:!ring-4 focus:!ring-[#1B3B5F]/10 ${
          error ? '!border-rose-500' : '!border-slate-300'
        } ${disabled ? '!cursor-not-allowed !bg-slate-50' : '!bg-white'}`}
        buttonClass={`!w-[48px] !rounded-l-xl !border-r-0 !bg-slate-50 hover:!bg-slate-100 ${error ? '!border-rose-500' : '!border-slate-300'}`}
        dropdownClass="!mt-1 !max-h-72 !w-[min(20rem,85vw)] !rounded-xl !shadow-lg"
        searchClass="!w-full !px-3 !py-2"
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600">{error}</p>}
      {helperText && !error && <p id={`${id}-help`} className="mt-1.5 text-sm text-slate-500">{helperText}</p>}
    </div>
  );
}
