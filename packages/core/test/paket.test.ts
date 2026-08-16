import { describe, expect, it } from 'vitest';
import { PAKET_NAME } from '@offert/core';

describe('Paketaufloesung', () => {
  it('loest @offert/core ueber den Wurzelnamen auf', () => {
    expect(PAKET_NAME).toBe('@offert/core');
  });
});
