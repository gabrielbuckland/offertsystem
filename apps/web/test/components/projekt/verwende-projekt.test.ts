import { describe, expect, it, vi } from 'vitest';
import { baueSpeicherwarteschlange } from '../../../src/components/projekt/verwende-projekt.js';

/** Steuerbares Promise, um Ankunftsreihenfolge unabhaengig von der Sendereihenfolge
 *  zu erzwingen — genau das Szenario, das die Warteschlange abfangen muss. */
function steuerbar<T>() {
  let aufloesen!: (wert: T) => void;
  const versprechen = new Promise<T>((r) => { aufloesen = r; });
  return { versprechen, aufloesen };
}

/** Laesst alle bereits angestossenen Promise-Ketten (then/catch/finally) abarbeiten. */
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

    // Erste Aenderung loest sofort einen Versuch aus.
    warteschlange.stelleEin({ id: 'p1', markierung: 'alt' } as never);
    expect(sende).toHaveBeenCalledTimes(1);

    // Zweite, neuere Aenderung trifft ein, WAEHREND der erste Versuch noch unterwegs
    // ist — sie darf keinen zweiten, ueberlappenden Versuch ausloesen.
    warteschlange.stelleEin({ id: 'p1', markierung: 'neu' } as never);
    expect(sende).toHaveBeenCalledTimes(1);

    // Der aeltere Versuch trifft (spaeter) ein: erst danach darf der neuere gesendet
    // werden, und zwar mit dem NEUESTEN Stand, nicht mit einem dazwischenliegenden.
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
