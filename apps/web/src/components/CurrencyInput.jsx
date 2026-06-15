
import React from 'react';
import { Input } from '@/components/ui/input';
import { formatCurrencyInput, parseCurrencyInput } from '@/utils/currencyFormat.js';

const CurrencyInput = ({ value, onChange, placeholder = '0', required = false, className = '' }) => {
  const handleChange = (e) => {
    const valStr = e.target.value;
    const parsed = parseCurrencyInput(valStr);
    onChange(parsed);
  };

  return (
    <Input
      type="text"
      value={formatCurrencyInput(value)}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={`font-semibold tabular-nums ${className}`}
    />
  );
};

export default CurrencyInput;
