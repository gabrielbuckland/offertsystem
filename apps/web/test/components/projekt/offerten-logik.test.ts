import { describe, expect, it } from 'vitest';
import { referenzAus } from '../../../src/components/projekt/offerten-logik.js';

describe('referenzAus', () => {
  it('kuerzt die Offert-Kennung auf die ersten acht Zeichen', () => {
    expect(referenzAus('abc12345-6789-def0-1234-56789abcdef0')).toBe('abc12345');
  });
});
