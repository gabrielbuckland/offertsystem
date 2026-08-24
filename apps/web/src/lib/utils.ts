import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fuehrt Tailwind-Klassen zusammen und loest Konflikte zugunsten der spaeteren auf. */
export function cn(...eingaben: ClassValue[]): string {
  return twMerge(clsx(eingaben));
}
