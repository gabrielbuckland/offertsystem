import { describe, expect, it } from 'vitest';
import { Warteschlange } from '../src/client/warteschlange.js';

describe('Warteschlange je dossierId (Spec 04 §3.2)', () => {
  it('verschraenkt zwei Durchlaeufe auf derselben dossierId nicht', async () => {
    const schlange = new Warteschlange();
    const spur: string[] = [];
    const arbeit = (name: string) => async () => {
      spur.push(`${name}-start`);
      await Promise.resolve();
      await Promise.resolve();
      spur.push(`${name}-ende`);
    };
    await Promise.all([
      schlange.reiheEin('d-1', arbeit('a')),
      schlange.reiheEin('d-1', arbeit('b')),
    ]);
    expect(spur).toEqual(['a-start', 'a-ende', 'b-start', 'b-ende']);
  });

  it('laesst verschiedene dossierIds unabhaengig laufen', async () => {
    const schlange = new Warteschlange();
    const spur: string[] = [];
    await Promise.all([
      schlange.reiheEin('d-1', async () => {
        spur.push('d1');
      }),
      schlange.reiheEin('d-2', async () => {
        spur.push('d2');
      }),
    ]);
    expect(spur.sort()).toEqual(['d1', 'd2']);
  });

  it('blockiert die Schlange nach einem Fehlschlag nicht', async () => {
    const schlange = new Warteschlange();
    await expect(
      schlange.reiheEin('d-1', async () => {
        throw new Error('Defekt');
      }),
    ).rejects.toThrow('Defekt');
    await expect(schlange.reiheEin('d-1', async () => 42)).resolves.toBe(42);
  });
});
