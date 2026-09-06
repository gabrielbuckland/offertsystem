import { describe, expect, it, vi } from 'vitest';
import { baueSpeicherwarteschlange } from '../../../src/components/projekt/verwende-projekt.js';

// Steuerbares Promise: Ankunftsreihenfolge unabhängig von Sendereihenfolge erzwingen.
function steuerbar<T>() {
  let aufloesen!: (wert: T) => void;
  const versprechen = new Promise<T>((r) => { aufloesen = r; });
  return { versprechen, aufloesen };
}

// Hilfsfunktion: alle angestoßenen Promise-Ketten abarbeiten lassen.
async function leeren(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('baueSpeicherwarteschlange', () => {
  it('meldet einen Fehlschlag ueber aufFehler', async () => {
    const sende = vi.fn().mockResolvedValue(false);
    const aufFehler = vi.fn();
    const aufStatusWechsel = vi.fn();
    const warteschlange = baueSpeicherwarteschlange(sende, { aufStatusWechsel, aufFehler });

    warteschlange.stelleEin({ id: 'p1' } as never);
    await leeren();

    expect(aufFehler).toHaveBeenCalledWith(true);
    expect(aufStatusWechsel).toHaveBeenLastCalledWith(false);
  });

  it('loescht den Fehler wieder bei einem darauffolgenden Erfolg', async () => {
    const sende = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const aufFehler = vi.fn();
    const warteschlange = baueSpeicherwarteschlange(
      sende, { aufStatusWechsel: vi.fn(), aufFehler });

    warteschlange.stelleEin({ id: 'p1' } as never);
    await leeren();

    warteschlange.stelleEin({ id: 'p1' } as never);
    await leeren();

    expect(aufFehler).toHaveBeenNthCalledWith(1, true);
    expect(aufFehler).toHaveBeenNthCalledWith(2, false);
  });

  it('haelt nur einen Versuch gleichzeitig unterwegs und sendet danach den neuesten Stand', async () => {
    const erster = steuerbar<boolean>();
    const sende = vi.fn()
      .mockReturnValueOnce(erster.versprechen)
      .mockResolvedValueOnce(true);
    const warteschlange = baueSpeicherwarteschlange(
      sende, { aufStatusWechsel: vi.fn(), aufFehler: vi.fn() });

    warteschlange.stelleEin({ id: 'p1', markierung: 'alt' } as never);
    expect(sende).toHaveBeenCalledTimes(1);

    // Zweite Änderung während Versuch unterwegs: kein überlappender Versuch.
    warteschlange.stelleEin({ id: 'p1', markierung: 'neu' } as never);
    expect(sende).toHaveBeenCalledTimes(1);

    // Älterer Versuch trifft ein: danach neuerer mit NEUESTEM Stand.
    erster.aufloesen(true);
    await leeren();

    expect(sende).toHaveBeenCalledTimes(2);
    expect(sende).toHaveBeenNthCalledWith(2, { id: 'p1', markierung: 'neu' });
  });

  it('sendet nur den letzten Stand, wenn waehrend eines Versuchs mehrfach geaendert wird', async () => {
    const erster = steuerbar<boolean>();
    const sende = vi.fn()
      .mockReturnValueOnce(erster.versprechen)
      .mockResolvedValueOnce(true);
    const warteschlange = baueSpeicherwarteschlange(
      sende, { aufStatusWechsel: vi.fn(), aufFehler: vi.fn() });

    warteschlange.stelleEin({ id: 'p1', markierung: 1 } as never);
    warteschlange.stelleEin({ id: 'p1', markierung: 2 } as never);
    warteschlange.stelleEin({ id: 'p1', markierung: 3 } as never);

    erster.aufloesen(true);
    await leeren();

    expect(sende).toHaveBeenCalledTimes(2);
    expect(sende).toHaveBeenNthCalledWith(2, { id: 'p1', markierung: 3 });
  });
});

// POST /berechnung liest Platte: Berechnung muss an Speichern gekettet sein, nicht parallel.
describe('Berechnung ist an das Speichern gekettet, nicht daneben gestartet', () => {
  function verdrahtet() {
    const put = steuerbar<boolean>();
    const gesendet: unknown[] = [];
    const berechnet: unknown[] = [];
    const speichern = baueSpeicherwarteschlange(
      (p) => { gesendet.push(p); return put.versprechen; },
      {
        aufStatusWechsel: vi.fn(),
        aufFehler: vi.fn(),
        aufErfolg: (gespeichert) => { berechnet.push(gespeichert); },
      },
    );
    return { put, gesendet, berechnet, speichern };
  }

  it('rechnet nicht, solange das PUT desselben Standes noch unterwegs ist', async () => {
    const { put, gesendet, berechnet, speichern } = verdrahtet();

    speichern.stelleEin({ id: 'p1', markierung: 'alt' } as never);
    await leeren();
    expect(gesendet).toHaveLength(1);
    expect(berechnet).toEqual([]);

    // Berechnung erst nach PUT-Antwort.
    put.aufloesen(true);
    await leeren();
    expect(berechnet).toEqual([{ id: 'p1', markierung: 'alt' }]);
  });

  it('rechnet gegen den NEUEREN Stand, wenn waehrend des PUT weiter geaendert wurde', async () => {
    const zweites = steuerbar<boolean>();
    const put = steuerbar<boolean>();
    const berechnet: unknown[] = [];
    const sende = vi.fn()
      .mockReturnValueOnce(put.versprechen)
      .mockReturnValueOnce(zweites.versprechen);
    const speichern = baueSpeicherwarteschlange(sende, {
      aufStatusWechsel: vi.fn(),
      aufFehler: vi.fn(),
      aufErfolg: (gespeichert) => { berechnet.push(gespeichert); },
    });

    speichern.stelleEin({ id: 'p1', markierung: 'alt' } as never);
    speichern.stelleEin({ id: 'p1', markierung: 'neu' } as never);

    put.aufloesen(true);
    await leeren();
    zweites.aufloesen(true);
    await leeren();

    // Entscheidend: letzter Lauf gehört neuesten Stand, lief erst nach PUT-Antwort.
    expect(berechnet.at(-1)).toEqual({ id: 'p1', markierung: 'neu' });
    expect(berechnet).toHaveLength(2);
  });

  it('rechnet gar nicht, wenn das Speichern fehlschlaegt', async () => {
    // Sonst UI-Zahlen zu ungespeichertem Stand.
    const berechnet: unknown[] = [];
    const speichern = baueSpeicherwarteschlange(vi.fn().mockResolvedValue(false), {
      aufStatusWechsel: vi.fn(),
      aufFehler: vi.fn(),
      aufErfolg: (gespeichert) => { berechnet.push(gespeichert); },
    });

    speichern.stelleEin({ id: 'p1' } as never);
    await leeren();

    expect(berechnet).toEqual([]);
  });

  it('rechnet gar nicht, wenn das Speichern wirft', async () => {
    const berechnet: unknown[] = [];
    const speichern = baueSpeicherwarteschlange(vi.fn().mockRejectedValue(new Error('Netz')), {
      aufStatusWechsel: vi.fn(),
      aufFehler: vi.fn(),
      aufErfolg: (gespeichert) => { berechnet.push(gespeichert); },
    });

    speichern.stelleEin({ id: 'p1' } as never);
    await leeren();

    expect(berechnet).toEqual([]);
  });
});
