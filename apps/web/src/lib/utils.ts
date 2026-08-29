import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Loest Tailwind-Klassenkonflikte zugunsten der spaeteren auf.
export function cn(...eingaben: ClassValue[]): string {
  return twMerge(clsx(eingaben));
}
