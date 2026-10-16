import * as React from 'react';
import { cn } from '../../lib/utils';

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  className,
  disabled,
}: {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (val: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [val, setVal] = React.useState<number>(value ?? defaultValue ?? min);

  React.useEffect(() => {
    if (value !== undefined) setVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    setVal(num);
    onValueChange?.(num);
  };

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        disabled={disabled}
        onChange={handleChange}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
