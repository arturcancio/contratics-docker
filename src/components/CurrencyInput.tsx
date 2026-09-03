/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { parseMonetaryValue, formatCurrency } from '../utils';

export interface CurrencyInputProps {
  id?: string;
  name?: string;
  value: number | undefined | null;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
  showPreview?: boolean;
  compact?: boolean;
  prefix?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = '0,00',
  disabled = false,
  required = false,
  className = '',
  min,
  max,
  autoFocus = false,
  showPreview = false,
  compact = false,
  prefix = 'R$',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [textValue, setTextValue] = useState<string>('');

  // Format number to Brazilian display string without "R$"
  const formatNumberToDisplay = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val)) return '';
    if (val === 0 && !required) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Sync internal display when external value changes and input is not being typed in
  useEffect(() => {
    if (!isFocused) {
      if (value !== undefined && value !== null && !isNaN(value)) {
        setTextValue(formatNumberToDisplay(value));
      } else {
        setTextValue('');
      }
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value !== undefined && value !== null && !isNaN(value) && value !== 0) {
      setTextValue(formatNumberToDisplay(value));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numeric = parseMonetaryValue(textValue);
    
    let finalValue = numeric;
    if (min !== undefined && finalValue < min) finalValue = min;
    if (max !== undefined && finalValue > max) finalValue = max;

    onChange(finalValue);
    setTextValue(formatNumberToDisplay(finalValue));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    
    // Allow digits, commas, dots, and minus
    const sanitized = raw.replace(/[^0-9.,\-]/g, '');
    setTextValue(sanitized);

    const numeric = parseMonetaryValue(sanitized);
    onChange(numeric);
  };

  const numericValue = typeof value === 'number' ? value : parseMonetaryValue(textValue);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {prefix && (
          <span className={`absolute left-2.5 text-xs font-mono font-bold text-on-surface-variant/70 pointer-events-none select-none ${compact ? 'text-[10px] left-1.5' : ''}`}>
            {prefix}
          </span>
        )}
        <input
          type="text"
          id={id}
          name={name}
          inputMode="decimal"
          value={textValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          className={`w-full bg-surface-container-low border border-outline-variant rounded ${
            prefix ? (compact ? 'pl-7 pr-2 py-1 text-xs' : 'pl-9 pr-3 py-1.5 text-xs') : 'px-3 py-1.5 text-xs'
          } text-on-surface focus:outline-none focus:border-primary font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        />
      </div>
      {showPreview && isFocused && numericValue > 0 && (
        <div className="absolute z-20 left-0 -bottom-6 text-[10px] text-primary font-mono font-semibold bg-surface-container-high px-2 py-0.5 rounded shadow-sm border border-outline-variant/40 animate-in fade-in whitespace-nowrap">
          {formatCurrency(numericValue)}
        </div>
      )}
    </div>
  );
};

export default CurrencyInput;
