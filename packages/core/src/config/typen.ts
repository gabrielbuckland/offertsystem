// Keine Formel; traegt die Parameter von eq:flaeche (alpha), eq:normalisierung (Grenzen,
// Strategie), eq:aufwandindikator (Gewichte) und eq:honorar_mapping (Stuetzstellen, g).
// Die Faktormenge ist eine Abbildung, keine Aufzaehlung im Typsystem (Brief §5.4, I-13).
import type { Gewicht, Rappen } from '../domain/geld.js';
import type { FaktorId } from '../domain/ids.js';

export type FaktorQuelle = 'lagescore' | 'manuell' | 'abgeleitet';

/** Geschlossene Literal-Union ueber die implementierten Strategien (Spec 03 §7.5, S-07). */
export type StrategieBezeichner = 'min-max' | 'z-score';

/** Im Kern vorhandene Kennzahlen fuer die Quelle `abgeleitet` (E-05, E-06). */
export type AbleitungsName = 'einheitenzahl' | 'mittlererQuadratmeterpreis';

export interface Referenzverteilung {
  readonly mittelwert: number;
  readonly standardabweichung: number;
  readonly kappungSigma: number;
}

/**
 * Rein deskriptive Stufenbeschriftung eines ordinal erfassten Faktors (E-24, PE-05).
 * Geht in KEINE Formel ein; dieselbe Stellung wie `bezeichnung`. Die Erfassungsmaske in
 * `apps/web` liest sie, die Berechnungsstufen ignorieren sie.
 */
export interface Faktorskala {
  readonly form: 'ordinal';
  readonly stufen: readonly { readonly wert: number; readonly bezeichnung: string }[];
}

export interface FaktorParameter {
  readonly grenzeMin: number; // x_d_min — vertauschbar zur Umpolung
  readonly grenzeMax: number; // x_d_max
  readonly gewicht: Gewicht; // w_d
  readonly strategie: StrategieBezeichner;
  readonly quelle: FaktorQuelle; // E-05
  readonly quellSchluessel: string; // Schluessel innerhalb der Quelle
  readonly bezeichnung: string;
  readonly referenzverteilung?: Referenzverteilung; // nur bei 'z-score'
  readonly skala?: Faktorskala; // rein deskriptiv (PE-05)
}

export type Faktormenge = ReadonlyMap<FaktorId, FaktorParameter>;

export interface Stuetzstelle {
  readonly v: Rappen; // V_k
  readonly hMin: Rappen; // H_min^(k)
  readonly hMax: Rappen; // H_max^(k)
}

export interface Skalierungsparameter {
  readonly form: 'linear';
  readonly gMin: number; // 0 < gMin <= 1 (I-16)
  readonly gMax: number; // gMax >= 1
}

export interface AnpassungsVorlage {
  readonly id: string;
  readonly bezeichnung: string;
  readonly vorgabefaktor: number;
  readonly begruendungVorschlag: string;
}

export interface KonfigurationsMeta {
  readonly schemaVersion: number;
  readonly konfigVersion: string;
  readonly gueltigAb: string;
  readonly beschreibung: string;
}

export interface PreisanpassungsKonfiguration {
  readonly zMin: number;
  readonly zMax: number;
  readonly begruendungPflicht: true;
  readonly begruendungMinLaenge: number;
}

export interface Konfiguration {
  readonly meta: KonfigurationsMeta;
  readonly flaeche: { readonly alpha: number }; // I-04
  readonly preisanpassung: PreisanpassungsKonfiguration; // I-06, I-07
  readonly anpassungsVorlagen: readonly AnpassungsVorlage[]; // E-25
  readonly faktoren: Faktormenge;
  readonly honorar: {
    readonly stuetzstellen: readonly Stuetzstelle[]; // aufsteigend, lueckenlos (I-20)
    readonly skalierung: Skalierungsparameter;
  };
  /**
   * SHA-256 der kanonisch serialisierten effektiven Konfiguration; in apps/web gebildet
   * (E-26, PE-04). Optional, weil `parseKonfiguration` nicht hasht — der Lader ergaenzt das
   * Feld. Die eingebettete Kopie der Konfiguration heisst projektweit `konfigurationsAbdruck`.
   */
  readonly konfigPruefsumme?: string;
}
