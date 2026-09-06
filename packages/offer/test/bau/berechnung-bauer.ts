/**
 * Erzeugt ein ECHTES `BerechnungsErgebnis`, indem `berechne()` aus @offert/core mit
 * einer konstruierten Liegenschaft aufgerufen wird.
 *
 * Bewusst kein handgeschriebenes Ergebnisobjekt: Der Zusammenbau in `packages/offer`
 * soll gegen das pruefen, was der Kern tatsaechlich liefert. Ein von Hand gebautes
 * Ergebnis liefe beim naechsten Kernschritt auseinander, ohne dass ein Test das saehe —
 * und genau die Aussage «die Rechenwerte stammen ausschliesslich aus dem Kern» (E-19)
 * waere dann nicht mehr belegt.
 *
 * Die Konfiguration ist die firmenweite `config/company-defaults.json`, ueber
 * `parseKonfiguration` eingelesen. Auch hier keine Kopie: Ein zweiter
 * Konfigurationsstand im Testbaum liefe beim Nachziehen auseinander.
 *
 * Zeitstempel und Bezeichner sind literal fixiert (E-29, I-14).
 */
import { readFileSync } from 'node:fs';
import {
  berechne,
  erzeugeLiegenschaft,
  parseKonfiguration,
  rappen,
  score,
  type BerechnungsErgebnis,
  type Einheit,
  type EinheitId,
  type FaktorId,
  type Konfiguration,
  type LagescoreName,
  type Lagescores,
  type Liegenschaft,
  type LiegenschaftId,
  type Quadratmeter,
  type Referenzbewertung,
  type RepraesentativeParametrisierung,
  type WohnungstypId,
  type ZuAbschlag,
} from '@offert/core';

// Lokal statt aus einem fremden Testbaum importiert (weder apps/web/test noch
// packages/core/test): Testhelfer bleiben je Paket eigenstaendig, ein Import in den
// Testbaum eines anderen Pakets koppelte die Suiten aneinander.
const BEWERTUNGEN_STANDARD = {
  zustandsbewertungen: {
    bathrooms: 'well_maintained', kitchen: 'well_maintained',
    flooring: 'well_maintained', windows: 'well_maintained',
  },
  qualitaetsbewertungen: {
    bathrooms: 'normal', kitchen: 'normal', flooring: 'normal', windows: 'normal',
  },
} as const;

export const ZEITSTEMPEL = '2026-08-16T14:32:00.000Z';

const KONFIGURATIONSPFAD = new URL('../../../../config/company-defaults.json', import.meta.url);

export function standardKonfiguration(): Konfiguration {
  const roh: unknown = JSON.parse(readFileSync(KONFIGURATIONSPFAD, 'utf8'));
  const geparst = parseKonfiguration(roh);
  if (!geparst.ok) {
    throw new Error(`Standardkonfiguration ist ungueltig: ${geparst.fehler[0]?.code ?? '?'}`);
  }
  return geparst.wert.kern;
}

function parametrisierung(
  flaecheInnen: number,
  flaecheAussen: number,
  stockwerk: number,
): RepraesentativeParametrisierung {
  return {
    flaecheInnen: flaecheInnen as Quadratmeter,
    flaecheAussen: flaecheAussen as Quadratmeter,
    stockwerk,
    energielabel: 'minergie_a' as const,
    ...BEWERTUNGEN_STANDARD,
    anzahlBadezimmer: 1,
    lift: true,
    baujahr: 2027,
    heizungsart: 'heat_pump_air' as const,
  };
}

function einheit(
  nummer: string,
  typ: string,
  flaecheInnen: number,
  flaecheAussen: number,
  anpassungen: readonly ZuAbschlag[],
): Einheit {
  return {
    id: `E-${nummer}` as EinheitId,
    wohnungsnummer: nummer as Einheit['wohnungsnummer'],
    wohnungstypId: typ as WohnungstypId,
    flaecheInnen: flaecheInnen as Quadratmeter,
    flaecheAussen: flaecheAussen as Quadratmeter,
    anpassungen,
  };
}

export interface BauOptionen {
  /**
   * Vorlagenkennung der ersten Anpassung der ersten Einheit. `undefined` steht fuer
   * eine frei erfasste Anpassung — dann traegt sie keine Kennung (PE-07).
   */
  readonly anpassungMitVorlage?: string | undefined;
  /** Haengt der ersten Anpassung der ersten Einheit eine Regelspur samt Uebersteuerung
   *  an (A-13) — fuer den Nachweis, dass baueOfferte sie durchreicht. */
  readonly anpassungMitRegelspur?: boolean;
}

export function baueLiegenschaft(optionen: BauOptionen = {}): Liegenschaft {
  const ersteAnpassung: ZuAbschlag = {
    faktor: -0.03,
    begruendung: 'Nordlage, eingeschraenkte Besonnung',
    erfassungsform: 'relativ',
    ...(optionen.anpassungMitVorlage === undefined
      ? {}
      : { vorlageId: optionen.anpassungMitVorlage }),
    ...(optionen.anpassungMitRegelspur === true
      ? {
        regel: { merkmal: 'stockwerk', merkmalswert: 2, bereich: 2, regelwert: -0.03 },
        uebersteuert: true as const,
      }
      : {}),
  };
  const entwurf = {
    id: 'L-2026-014' as LiegenschaftId,
    adresse: { strasse: 'Musterstrasse', hausnummer: '1', plz: '6000', ort: 'Luzern' },
    wohnungstypen: [
      { id: 'T-3.5' as WohnungstypId, zimmerzahl: 3.5, parametrisierung: parametrisierung(82, 12, 2) },
      { id: 'T-4.5' as WohnungstypId, zimmerzahl: 4.5, parametrisierung: parametrisierung(104, 18, 3) },
    ],
    einheiten: [
      einheit('A1.01', 'T-3.5', 82, 12, [ersteAnpassung]),
      einheit('A2.01', 'T-3.5', 82, 14, [{
        faktor: 0.04,
        begruendung: 'Seesicht ab dem zweiten Obergeschoss',
        erfassungsform: 'absolut',
        erfassterBetrag: rappen(3_438_636),
      }]),
      einheit('A3.01', 'T-4.5', 104, 18, []),
      einheit('A4.01', 'T-4.5', 104, 18, []),
    ],
  };
  const erzeugt = erzeugeLiegenschaft(entwurf);
  if (!erzeugt.ok) {
    throw new Error(`Liegenschaft ungueltig: ${erzeugt.fehler.map((f) => f.code).join(', ')}`);
  }
  return erzeugt.wert;
}

function bewertung(typ: string, marktwert: number, klasse: 'poor' | 'medium' | 'good'): Referenzbewertung {
  return {
    wohnungstypId: typ as WohnungstypId,
    marktwert: rappen(marktwert),
    bewertungsdatum: '2026-08-16',
    anbieter: 'PriceHubble',
    parametrisierungsAbdruck: parametrisierung(82, 12, 2),
    anzeige: {
      konfidenzbereich: { von: rappen(Math.round(marktwert * 0.94)), bis: rappen(Math.round(marktwert * 1.06)) },
      konfidenzklasse: klasse,
      ...(klasse === 'good' ? { konfidenzwert: 0.86 } : {}),
    },
  };
}

function lagescores(): Lagescores {
  return {
    werte: new Map([['location' as LagescoreName, score(0.72)]]),
    meta: new Map(),
    abrufdatum: '2026-08-16',
    anbieter: 'PriceHubble',
  };
}

export function baueBerechnungsErgebnis(optionen: BauOptionen = {}): BerechnungsErgebnis {
  const ergebnis = berechne({
    liegenschaft: baueLiegenschaft(optionen),
    bewertungen: [
      bewertung('T-3.5', 85_000_000, 'good'),
      bewertung('T-4.5', 108_000_000, 'medium'),
    ],
    bewertungsbuendelVollstaendig: true,
    lagescores: lagescores(),
    vermarkterFaktoren: { werte: new Map([['innenausbau_qualitaet' as FaktorId, 4]]) },
    konfiguration: standardKonfiguration(),
    zeitstempel: ZEITSTEMPEL,
  });
  if (!ergebnis.ok) {
    throw new Error(`Berechnung fehlgeschlagen: ${ergebnis.fehler.code}`);
  }
  return ergebnis.wert;
}

export const BEISPIEL_PROJEKT = {
  projektId: '11111111-1111-4111-8111-111111111111',
} as const;

export const BEISPIEL_META = {
  offertId: 'A-2026-014',
  erstelltAm: ZEITSTEMPEL,
  konfigVersion: '1.0.0',
  konfigPruefsumme: 'a'.repeat(64),
  berechnungsEingabe: { schemaVersion: 1 },
} as const;
