import * as React from 'react';

import { cn } from '../../lib/utils.js';

/**
 * Bewusst ein natives <select>: keiner der geplanten Aufrufer braucht ein eigenes
 * Dropdown-Menu, und ein natives Element bleibt ohne Radix-Abhaengigkeit tastatur- und
 * screenreaderfaehig.
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm '
          + 'shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 '
          + 'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
