/**
 * Deterministisches Offert-Objekt fuer die Tests von `apps/web`.
 *
 * BEWUSSTE DOPPELUNG zu `packages/offer/test/bau/`: Die Boundary-Regel verbietet
 * relative Importe ueber Paketgrenzen, und Testcode wird nicht ueber `src/`
 * veroeffentlicht — ein gemeinsames Fixture haette also entweder die Regel gebrochen
 * oder Testdaten in den Produktivcode gelegt.
 *
 * Die Doppelung ist deshalb bewusst KEINE Kopie eines Literals: Beide Fassungen bauen
 * das Objekt ueber die oeffentlichen Wege (`berechne` aus @offert/core, `baueOfferte`
 * aus @offert/offer) und werden von `offerSchema` geprueft. Sie koennen im Aufbau
 * nicht auseinanderlaufen, ohne dass ein Test bricht.
 */
import { readFileSync } from 'node:fs';
import {
  berechne,
  erzeugeLiegenschaft,
  parseKonfiguration,
  rappen,
  score,
  serialisiereEingang,
  type BerechnungsErgebnis,
  type EingangsArgumente,
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
import { baueOfferte, type Offer } from '@offert/offer';
import { BEWERTUNGEN_STANDARD } from './bewertungen.js';

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
}

export function baueLiegenschaft(optionen: BauOptionen = {}): Liegenschaft {
  const ersteAnpassung: ZuAbschlag = {
    faktor: -0.03,
    begruendung: 'Nordlage, eingeschraenkte Besonnung',
    erfassungsform: 'relativ',
    ...(optionen.anpassungMitVorlage === undefined
      ? {}
      : { vorlageId: optionen.anpassungMitVorlage }),
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

export function baueEingangsArgumente(optionen: BauOptionen = {}): EingangsArgumente {
  return {
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
  };
}

export function baueBerechnungsErgebnis(optionen: BauOptionen = {}): BerechnungsErgebnis {
  const ergebnis = berechne(baueEingangsArgumente(optionen));
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
  // Aus der Konfiguration gelesen, nicht literal gesetzt: Sonst behauptete das Fixture
  // eine Version, die der eingebettete Abdruck nicht traegt.
  konfigVersion: standardKonfiguration().meta.konfigVersion,
  konfigPruefsumme: 'a'.repeat(64),
  berechnungsEingabe: { schemaVersion: 1 },
} as const;

export function baueBeispielOfferte(optionen: BauOptionen = {}): Offer {
  const eingang = baueEingangsArgumente(optionen);
  return baueOfferte({
    ergebnis: baueBerechnungsErgebnis(optionen),
    liegenschaft: eingang.liegenschaft,
    projekt: BEISPIEL_PROJEKT,
    meta: {
      ...BEISPIEL_META,
      // PE-08: der serialisierte EINGANG, nicht die Formulardaten. Nur so ist das
      // Fixture derselbe Reproduktionsanker wie ein echt erzeugtes Artefakt.
      berechnungsEingabe: serialisiereEingang(eingang) as Record<string, unknown>,
    },
  });
}
