import * as React from 'react';

import { cn } from '../../lib/utils.js';

function Slider({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="range"
      data-slot="slider"
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary '
          + 'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Slider };
