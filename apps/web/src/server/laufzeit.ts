/**
 * Die einzige Stelle, an der Umgebung, Konfigurationslader, Adapter und Ablageort
 * zusammenkommen (PE-24) — zwei Aufrufstellen bedeuteten zwei Konfigurationsstaende
 * innerhalb eines Laufs, die Pruefsumme belegte dann nicht mehr, womit gerechnet wurde
 * (E-26). Route Handler und Seiten rufen ausschliesslich diese Funktion auf.
 */
import { resolve } from 'node:path';
import type { Konfiguration, KonfigurationsFehler } from '@offert/core';
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

export type LaufzeitFehler = {
  readonly ok: false;
  readonly meldungen: readonly string[];
  /**
   * Die UNUEBERSETZTEN Konfigurationsbefunde, sofern der Fehlschlag aus dem Ladepfad
   * stammt. `meldungen` bleibt die Maschinenform fuer Protokoll und Seitenkopf; wer dem
   * Benutzer eine am Feld verankerte Meldung zeigen will, braucht dagegen Code, Pfad und
   * Parameter im Original — sonst muesste er sie aus dem Meldungstext zurueckparsen, und
   * genau das waere die zweite Uebersetzungsquelle, die `zuBefunden`/`textFuer`
   * (`einstellungen-ablage.ts`) vermeiden sollen.
   *
   * Fehlt bei einem Umgebungsfehler (`leseUmgebung`): Dort gibt es keinen
   * Konfigurationspfad, an dem sich etwas verankern liesse.
   */
  readonly fehler?: readonly KonfigurationsFehler[];
};

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
    // Fehlertyp ist textlos (E-03); maschinenlesbare Form aus Code, Pfad und Parametern.
    return {
      ok: false,
      meldungen: geladen.fehler.map(
        (f) => `${f.code} bei ${f.pfad}: ${JSON.stringify(f.parameter)}`,
      ),
      fehler: geladen.fehler,
    };
  }

  const provider = createValuationProvider(
    {
      VALUATION_PROVIDER: umgebung.wert.valuationProvider,
      ...(umgebung.wert.phBaseUrl === undefined ? {} : { PH_BASE_URL: umgebung.wert.phBaseUrl }),
      ...(umgebung.wert.phUsername === undefined ? {} : { PH_USERNAME: umgebung.wert.phUsername }),
      ...(umgebung.wert.phPassword === undefined ? {} : { PH_PASSWORD: umgebung.wert.phPassword }),
      ...(umgebung.wert.phAccessToken === undefined
        ? {}
        : { PH_ACCESS_TOKEN: umgebung.wert.phAccessToken }),
      ...(umgebung.wert.phDossierId === undefined ? {} : { PH_DOSSIER_ID: umgebung.wert.phDossierId }),
    },
    // PE-17: Strukturgleichheit mit `ApiKonfiguration` prueft `pruefeApiKonfiguration`
    // innerhalb der Fabrik.
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
 * Bewusst ein zweiter Einstieg statt eines optionalen Parameters an `holeLaufzeit`: ein
 * vergessener Parameter haette sonst still mit Firmenwerten gerechnet; getrennte Namen
 * machen die Wahl an der Aufrufstelle sichtbar.
 */
export function holeProjektLaufzeit(
  projekt: { readonly einstellungen?: Readonly<Record<string, unknown>> | undefined },
  quelle: Readonly<Record<string, string | undefined>> = process.env,
): LaufzeitErgebnis {
  return holeLaufzeit(quelle, projekt.einstellungen ?? {});
}
