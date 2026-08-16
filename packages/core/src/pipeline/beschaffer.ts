// Keine Formel. Generischer Aufloeser `quelle -> Rohwertbeschaffung` (E-05). Er loest die
// Privilegierung des Faktors `projektumfang` auf: kein Faktorbezeichner steht im Kern,
// auch nicht implizit — damit ist I-13 vollstaendig erfuellt.
import type { FaktorId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import type { AbleitungsName, FaktorParameter, FaktorQuelle } from '../config/typen.js';
import type { Lagescores } from '../ports/valuation-provider.js';
import { lagescoreName } from '../domain/ids.js';

export interface VermarkterFaktoren {
  readonly werte: ReadonlyMap<FaktorId, number>; // Rohwerte, unnormalisiert
}

export interface BeschaffungsKontext {
  readonly lagescores: Lagescores;
  readonly vermarkterFaktoren: VermarkterFaktoren;
  /** In Stufe 1 nicht gesetzt; wird im Zwischenschritt 4.2a nachgereicht (E-06). */
  readonly ableitungen?: ReadonlyMap<AbleitungsName, number>;
}

export interface Beschaffer {
  readonly quelle: FaktorQuelle;
  beschaffe(
    quellSchluessel: string,
    kontext: BeschaffungsKontext,
    parameter: FaktorParameter,
    faktor: FaktorId,
    stufe: 1 | 3,
  ): Result<number | 'spaeter', StufenFehler>;
}

function fehlend(
  stufe: 1 | 3,
  faktor: FaktorId,
  parameter: FaktorParameter,
  phase: 'quelle' | 'rohwert',
): Result<never, StufenFehler> {
  return fehlschlag(
    stufenFehler(
      stufe,
      'FAKTOR_FEHLT',
      {
        faktorId: faktor,
        bezeichnung: parameter.bezeichnung,
        quelle: parameter.quelle,
        quellSchluessel: parameter.quellSchluessel,
        phase,
      },
      { faktor },
    ),
  );
}

const lagescoreBeschaffer: Beschaffer = {
  quelle: 'lagescore',
  beschaffe(quellSchluessel, kontext, parameter, faktor, stufe) {
    const wert = kontext.lagescores.werte.get(lagescoreName(quellSchluessel));
    if (wert === undefined) return fehlend(stufe, faktor, parameter, 'quelle');
    return ok(wert as number);
  },
};

const manuellBeschaffer: Beschaffer = {
  quelle: 'manuell',
  beschaffe(quellSchluessel, kontext, parameter, faktor, stufe) {
    const wert = kontext.vermarkterFaktoren.werte.get(quellSchluessel as FaktorId);
    if (wert === undefined) return fehlend(stufe, faktor, parameter, 'quelle');
    return ok(wert);
  },
};

const abgeleiteterBeschaffer: Beschaffer = {
  quelle: 'abgeleitet',
  beschaffe(quellSchluessel, kontext, parameter, faktor, stufe) {
    // Stufe 1 prueft nur die Aufloesbarkeit der Quelle; der Rohwert entsteht erst nach
    // Stufe 2 (E-06). Deshalb hier kein Fehler, sondern die Vertagung.
    if (kontext.ableitungen === undefined) return ok('spaeter');
    const wert = kontext.ableitungen.get(quellSchluessel as AbleitungsName);
    if (wert === undefined) return fehlend(stufe, faktor, parameter, 'rohwert');
    return ok(wert);
  },
};

const registry: Readonly<Record<FaktorQuelle, Beschaffer>> = Object.freeze({
  lagescore: lagescoreBeschaffer,
  manuell: manuellBeschaffer,
  abgeleitet: abgeleiteterBeschaffer,
});

/** Total ueber der geschlossenen Menge der Quellen; kein dynamisches Register. */
export function beschafferFuer(quelle: FaktorQuelle): Beschaffer {
  return registry[quelle];
}
