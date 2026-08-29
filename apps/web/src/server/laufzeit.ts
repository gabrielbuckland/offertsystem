/**
 * Keine Formel. Die einzige Stelle, an der Umgebung, Konfigurationslader, Adapter und
 * Ablageort zusammenkommen (PE-24).
 *
 * Zwei Aufrufstellen bedeuteten zwei Konfigurationsstaende innerhalb eines Laufs; die
 * Pruefsumme in den Metadaten belegte dann nicht mehr, womit gerechnet wurde (E-26).
 *
 * Der `api`-Block stammt aus dem Ladeergebnis und wird dem Adapter uebergeben (PE-17):
 * Der Kern kennt ihn nicht, und der Adapter laedt ihn nicht selbst. Route Handler und
 * Seiten rufen ausschliesslich diese Funktion auf.
 */
import { resolve } from 'node:path';
import type { Konfiguration } from '@offert/core';
import {
  createValuationProvider,
  type ApiKonfiguration,
} from '@offert/pricehubble';
import type { ValuationProvider } from '@offert/core';
import {
  ladeKonfiguration,
  type KonfigurationsFingerabdruck,
} from './konfigurations-lader.js';
import { leseUmgebung, type Umgebung } from './umgebung.js';

export interface Laufzeit {
  readonly umgebung: Umgebung;
  /** Kerntyp aus parseKonfiguration (PE-01) — Eingabe jeder Berechnung. */
  readonly konfiguration: Konfiguration;
  /** Rohkonfiguration; Quelle des eingebetteten konfigurationsAbdrucks (PE-04). */
  readonly rohKonfiguration: Readonly<Record<string, unknown>>;
  readonly fingerabdruck: KonfigurationsFingerabdruck;
  readonly provider: ValuationProvider;
  readonly offertenVerzeichnis: string;
  readonly projekteVerzeichnis: string;
}

export type LaufzeitFehler = { readonly ok: false; readonly meldungen: readonly string[] };

export type LaufzeitErgebnis =
  | { readonly ok: true; readonly wert: Laufzeit }
  | LaufzeitFehler;

export function holeLaufzeit(
  quelle: Readonly<Record<string, string | undefined>> = process.env,
  ueberschreibungen: Readonly<Record<string, unknown>> = {},
): LaufzeitErgebnis {
  const umgebung = leseUmgebung(quelle);
  if (!umgebung.ok) return { ok: false, meldungen: umgebung.meldungen };

  const geladen = ladeKonfiguration({
    pfad: umgebung.wert.companyDefaultsPfad,
    ueberschreibungen,
  });
  if (!geladen.ok) {
    // Der Fehlertyp ist textlos (E-03); die Anzeigefassung entsteht in Aufgabe 12.
    // Hier reicht die maschinenlesbare Form aus Code, Pfad und Parametern — sie
    // benennt die Stelle, ohne eine zweite Textquelle aufzumachen.
    return {
      ok: false,
      meldungen: geladen.fehler.map(
        (f) => `${f.code} bei ${f.pfad}: ${JSON.stringify(f.parameter)}`,
      ),
    };
  }

  const provider = createValuationProvider(
    {
      VALUATION_PROVIDER: umgebung.wert.valuationProvider,
      ...(umgebung.wert.phBaseUrl === undefined ? {} : { PH_BASE_URL: umgebung.wert.phBaseUrl }),
      ...(umgebung.wert.phUsername === undefined ? {} : { PH_USERNAME: umgebung.wert.phUsername }),
      ...(umgebung.wert.phPassword === undefined ? {} : { PH_PASSWORD: umgebung.wert.phPassword }),
      ...(umgebung.wert.phDossierId === undefined ? {} : { PH_DOSSIER_ID: umgebung.wert.phDossierId }),
    },
    // PE-17: Rohblock aus dem Ladeergebnis. Die Strukturgleichheit mit
    // `ApiKonfiguration` prueft `pruefeApiKonfiguration` innerhalb der Fabrik.
    geladen.api as ApiKonfiguration,
  );

  return {
    ok: true,
    wert: {
      umgebung: umgebung.wert,
      konfiguration: geladen.kern,
      rohKonfiguration: geladen.konfiguration.basis as unknown as Readonly<Record<string, unknown>>,
      fingerabdruck: geladen.fingerabdruck,
      provider,
      offertenVerzeichnis: resolve(umgebung.wert.offertenVerzeichnis),
      projekteVerzeichnis: resolve(umgebung.wert.projekteVerzeichnis),
    },
  };
}

/**
 * Bequemlichkeit fuer Seiten und Route Handler, die nur den Ablageort brauchen.
 * Wirft bewusst: Eine Seite ohne gueltige Umgebung darf nicht mit einem Vorgabepfad
 * weiterlaufen — sie wuerde sonst in einem anderen Verzeichnis lesen als geschrieben
 * wurde (E-14, I-24).
 */
export function verzeichnisAusLaufzeit(): string {
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) throw new Error(laufzeit.meldungen.join(' '));
  return laufzeit.wert.offertenVerzeichnis;
}

/**
 * Projektbewusste Laufzeit: dieselbe Form wie `holeLaufzeit`, aber mit dem
 * Einstellungs-Delta des Projekts zusammengefuehrt (Ebene 2 des Zwei-Ebenen-Modells).
 *
 * BEWUSST EIN ZWEITER EINSTIEG STATT EINES OPTIONALEN PARAMETERS AN `holeLaufzeit`:
 * Ein Parameter haette jede der zwoelf bestehenden Aufrufstellen zur
 * Entscheidungsstelle gemacht, ob sie projektbezogen rechnen muss — und ein
 * vergessener Parameter haette still mit Firmenwerten gerechnet, ohne dass es jemand
 * saehe. Getrennte Namen machen die Wahl an der Aufrufstelle sichtbar. PE-24 bleibt
 * gewahrt, weil diese Funktion `holeLaufzeit` aufruft und nur den Merge ergaenzt.
 */
export function holeProjektLaufzeit(
  projekt: { readonly einstellungen?: Readonly<Record<string, unknown>> | undefined },
  quelle: Readonly<Record<string, string | undefined>> = process.env,
): LaufzeitErgebnis {
  return holeLaufzeit(quelle, projekt.einstellungen ?? {});
}
