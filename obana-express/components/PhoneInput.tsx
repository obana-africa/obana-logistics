import React from 'react';
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
}

export default function PhoneInput({
  value,
  onChange,
  label,
  required = false,
  error,
  helperText,
  className,
  placeholder,
  disabled
}: PhoneInputProps) {
  return (
    <div className={`w-full ${className || ''}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <PhoneInput2
          country={'ng'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          inputClass={`!w-full !h-[42px] !text-base !pl-[48px] !border-gray-300 !rounded-lg focus:!ring-2 focus:!ring-blue-500 focus:!border-transparent !transition-colors ${
            error ? '!border-red-500' : ''
          } ${disabled ? '!bg-gray-100 !cursor-not-allowed' : ''}`}
          buttonClass={`!border-gray-300 !rounded-l-lg !bg-gray-50 hover:!bg-gray-100 ${
            error ? '!border-red-500' : ''
          }`}
          dropdownClass="!shadow-lg !rounded-lg"
          containerClass="!w-full"
          enableSearch
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  );
}
