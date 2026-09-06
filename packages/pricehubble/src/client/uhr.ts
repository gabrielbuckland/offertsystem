/**
 * Keine Formel. Zeitgeber-Port.
 *
 * Er existiert, damit Backoff-Tests mit dem manipulierbaren Zeitgeber von Vitest
 * laufen und die Testlaufzeit nicht an der Backoff-Dauer haengt.
 */
export interface Uhr {
  jetztMs(): number;
  warte(ms: number): Promise<void>;
  /** Plant einen Rueckruf und liefert die Abbestellung. Traegt das Zeitlimit je Versuch. */
  plane(ms: number, rueckruf: () => void): () => void;
}

export const systemUhr: Uhr = {
  jetztMs: () => Date.now(),
  warte: (ms) =>
    new Promise<void>((aufloesen) => {
      setTimeout(aufloesen, ms);
    }),
  plane: (ms, rueckruf) => {
    const kennung = setTimeout(rueckruf, ms);
    return () => clearTimeout(kennung);
  },
};
