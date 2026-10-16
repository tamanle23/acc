import * as React from 'react';
import { cn } from '../../lib/utils';

export function Progress({
  value = 0,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: number }) {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-200/80', className)}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-indigo-600 transition-all duration-150"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
}
