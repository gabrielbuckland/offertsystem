/**
 * Keine Modellformel. Messfilter der Erweiterbarkeitsmessung (E-15, Spec 06 §7.3).
 *
 * ALLEINIGE ZUSTAENDIGKEIT (PE-16): genau eine Implementierung der Messfilter, genau ein
 * Ort fuer die Null-Dateien-Messlatte.
 *
 * Gemessen wird getrennt nach vier Kategorien. Ohne diese Trennung waere das Ergebnis
 * definitionsgemaess groesser als null, weil das Erweiterungsszenario eine geaenderte
 * Konfiguration und eine zusaetzliche verletzende Variante mitbringt — die
 * Null-Dateien-Messlatte bezieht sich allein auf `code`.
 *
 * Testhilfen liegen nach E-14 ausdruecklich NICHT unter `src/**;/__fixtures__/`; ein
 * solcher Pfad fiele sonst in die Kategorie `code` und entwertete die Messung. Der
 * Klassifizierer meldet ihn deshalb als eigenen Befund.
 */
export type Kategorie = 'code' | 'konfiguration' | 'test' | 'sonstiges';

export interface Klassifikation {
  readonly pfad: string;
  readonly kategorie: Kategorie;
  readonly befund: string | null;
}

const CODE = /^(packages|apps)\/[^/]+\/src\//;
const TEST = /^(packages\/[^/]+\/test\/|apps\/[^/]+\/test\/|fixtures\/)/;
const KONFIG = /^(config\/|[^/]*\.config\.json$)/;
const TESTHILFE_IN_SRC = /^(packages|apps)\/[^/]+\/src\/.*__fixtures__\//;

export function klassifiziere(pfad: string): Klassifikation {
  if (TEST.test(pfad)) return { pfad, kategorie: 'test', befund: null };
  if (KONFIG.test(pfad)) return { pfad, kategorie: 'konfiguration', befund: null };
  if (CODE.test(pfad)) {
    return {
      pfad, kategorie: 'code',
      befund: TESTHILFE_IN_SRC.test(pfad)
        ? 'Testhilfe unter src verletzt E-14 und verfaelscht den Messfilter'
        : null,
    };
  }
  return { pfad, kategorie: 'sonstiges', befund: null };
}

export interface DiffEintrag {
  readonly pfad: string;
  readonly hinzugefuegt: number;
  readonly entfernt: number;
  readonly neu: boolean;
}

export interface KategorieZahlen {
  readonly dateien_geaendert: number;
  readonly dateien_neu: number;
  readonly zeilen_hinzugefuegt: number;
  readonly zeilen_entfernt: number;
  readonly dateiliste: readonly string[];
}

export function fasseZusammen(
  eintraege: readonly DiffEintrag[],
): Readonly<Record<Kategorie, KategorieZahlen>> {
  const leer = (): KategorieZahlen => ({
    dateien_geaendert: 0, dateien_neu: 0,
    zeilen_hinzugefuegt: 0, zeilen_entfernt: 0, dateiliste: [],
  });
  const zahlen: Record<Kategorie, KategorieZahlen> = {
    code: leer(), konfiguration: leer(), test: leer(), sonstiges: leer(),
  };
  for (const e of [...eintraege].sort((a, b) => a.pfad.localeCompare(b.pfad))) {
    const k = klassifiziere(e.pfad).kategorie;
    const v = zahlen[k];
    zahlen[k] = {
      dateien_geaendert: v.dateien_geaendert + (e.neu ? 0 : 1),
      dateien_neu: v.dateien_neu + (e.neu ? 1 : 0),
      zeilen_hinzugefuegt: v.zeilen_hinzugefuegt + e.hinzugefuegt,
      zeilen_entfernt: v.zeilen_entfernt + e.entfernt,
      dateiliste: [...v.dateiliste, e.pfad],
    };
  }
  return zahlen;
}
