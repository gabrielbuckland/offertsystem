/**
 * Generatoren und Baukasten der Property-Tests.
 *
 * Kein Generator liest eine Uhr, die Umgebung oder das Dateisystem — jede
 * Zufaelligkeit kommt aus fast-check und damit aus dem Seed (I-14).
 */
import fc from 'fast-check';
import { gewicht, quadratmeter, quadratmeterAbNull, rappen, score } from '../../src/domain/geld.js';
import {
  einheitId, faktorId, liegenschaftId, wohnungsnummer, wohnungstypId,
  type FaktorId,
} from '../../src/domain/ids.js';
import { erzeugeLiegenschaft, type Liegenschaft } from '../../src/domain/liegenschaft.js';
import type { ZuAbschlag } from '../../src/domain/zuabschlag.js';
import type { FaktorParameter, Konfiguration } from '../../src/config/typen.js';
import type { NormalisierungErgebnis } from '../../src/pipeline/stufe3-normalisierung.js';
import type { EingangsArgumente, PipelineEingang } from '../../src/pipeline/stufe1-eingabe.js';
import { sortiereNachSchluessel } from '../../src/util/sortierung.js';
import {
  adresseFixture, eingangsArgumente, lagescoresFixture, parametrisierungFixture,
  referenzbewertungFixture, standardKonfiguration,
} from '../helper/projekt.js';

export interface EinTypOptionen {
  readonly innen?: number;
  readonly aussen?: number;
  readonly pRef?: number;
  readonly alpha?: number;
  readonly anpassungen?: readonly ZuAbschlag[];
  /** Einheitenzahl; die Anpassungen treffen stets nur die erste Einheit. */
  readonly anzahl?: number;
}

/**
 * Ein Wohnungstyp, EINE Einheit — der kleinste Eingang, an dem sich die Preisableitung
 * pruefen laesst.
 *
 * Der `PipelineEingang` wird hier unmittelbar gebaut und nicht ueber Stufe 1 erzeugt:
 * Stufe 1 beschafft Faktorrohwerte, die fuer die Stufe-2-Eigenschaften ohne Belang sind.
 * Ein Umweg darueber machte ein Gegenbeispiel zu I-05 oder I-08 nicht aussagekraeftiger,
 * koennte aber an der Faktorbeschaffung scheitern und damit die Eigenschaft verdecken.
 */
export function einTypEinheitenEingang(optionen: EinTypOptionen = {}): PipelineEingang {
  const innen = optionen.innen ?? 92.5;
  const aussen = optionen.aussen ?? 0;
  const pRef = optionen.pRef ?? 85_000_000;
  const alpha = optionen.alpha ?? 0.5;

  const typ = {
    id: wohnungstypId('T1'),
    zimmerzahl: 3.5,
    parametrisierung: {
      ...parametrisierungFixture(),
      flaecheInnen: quadratmeterAbNull(innen),
      flaecheAussen: quadratmeterAbNull(aussen),
    },
  };
  const erzeugt = erzeugeLiegenschaft({
    id: liegenschaftId('L-1'),
    adresse: adresseFixture(),
    wohnungstypen: [typ],
    einheiten: Array.from({ length: optionen.anzahl ?? 1 }, (_wert, index) => ({
      id: einheitId(`E-${index + 1}`),
      wohnungsnummer: wohnungsnummer(`A-${String(index + 1).padStart(3, '0')}`),
      wohnungstypId: typ.id,
      flaecheInnen: quadratmeterAbNull(innen),
      flaecheAussen: quadratmeterAbNull(aussen),
      anpassungen: index === 0 ? optionen.anpassungen ?? [] : [],
    })),
  });
  if (!erzeugt.ok) throw new Error('Generator erzeugte ein ungueltiges Aggregat');

  const bewertung = { ...referenzbewertungFixture('T1'), marktwert: rappen(pRef) };
  const basis = standardKonfiguration();
  return {
    liegenschaft: erzeugt.wert,
    bewertungen: new Map([[typ.id, bewertung]]),
    rohfaktoren: new Map(),
    offeneFaktoren: [],
    verworfeneRohwerte: [],
    konfiguration: { ...basis, flaeche: { alpha } },
    zeitstempel: '2026-08-16T10:00:00.000Z',
  };
}

/**
 * Faktormenge aus beliebigen positiven Rohgewichten, auf die Summe eins gebracht.
 *
 * Die Renormalisierung geschieht HIER im Generator, nicht in der Berechnungsstufe: Stufe 4
 * normiert bewusst nicht (S-05), weil das einen Konfigurationsfehler unsichtbar machte. Der
 * Generator liefert deshalb bereits eine gueltige Konfiguration.
 */
export function faktormengeMitGewichtssummeEins(rohGewichte: readonly number[]): Konfiguration {
  const summe = rohGewichte.reduce((s, g) => s + g, 0);
  const faktoren = new Map<FaktorId, FaktorParameter>();
  let rest = 1;
  rohGewichte.forEach((g, i) => {
    // Der letzte Faktor erhaelt den Rest, damit die Summe exakt eins ergibt und nicht
    // durch akkumulierte Rundungsreste die Toleranz aus invariants.json ausschoepft.
    const w = i === rohGewichte.length - 1 ? rest : g / summe;
    rest -= w;
    faktoren.set(faktorId(`f${String(i).padStart(2, '0')}`), {
      grenzeMin: 0,
      grenzeMax: 1,
      gewicht: gewicht(Math.min(1, Math.max(0, w))),
      strategie: 'min-max',
      quelle: 'manuell',
      quellSchluessel: `f${String(i).padStart(2, '0')}`,
      bezeichnung: `Testfaktor ${i}`,
    });
  });
  return { ...standardKonfiguration(), faktoren };
}

/** Normalisierungsergebnis passend zu einer Faktormenge; Werte werden zyklisch zugeteilt. */
export function normalisierungZu(
  konfiguration: Konfiguration,
  normierte: readonly number[],
): NormalisierungErgebnis {
  const eintraege = sortiereNachSchluessel(konfiguration.faktoren);
  return {
    faktoren: eintraege.map(([id, p], i) => ({
      faktorId: id,
      rohwert: normierte[i % normierte.length]!,
      grenzeMin: p.grenzeMin,
      grenzeMax: p.grenzeMax,
      strategie: p.strategie,
      gekappt: false,
      normiert: score(normierte[i % normierte.length]!),
    })),
  };
}

/** Liegenschaft mit `anzahl` Einheiten eines Typs; alle mit den Referenzflaechen. */
function liegenschaftMitEinheiten(anzahl: number): Liegenschaft {
  const typ = {
    id: wohnungstypId('T1'),
    zimmerzahl: 3.5,
    parametrisierung: parametrisierungFixture(),
  };
  const einheiten = Array.from({ length: anzahl }, (_wert, index) => ({
    id: einheitId(`E-${index + 1}`),
    wohnungsnummer: wohnungsnummer(`A-${String(index + 1).padStart(3, '0')}`),
    wohnungstypId: typ.id,
    flaecheInnen: quadratmeter(92.5),
    flaecheAussen: quadratmeterAbNull(0),
    anpassungen: [] as readonly ZuAbschlag[],
  }));
  const erzeugt = erzeugeLiegenschaft({
    id: liegenschaftId('L-1'),
    adresse: adresseFixture(),
    wohnungstypen: [typ],
    einheiten,
  });
  if (!erzeugt.ok) throw new Error('Generator erzeugte ein ungueltiges Aggregat');
  return erzeugt.wert;
}

/**
 * Vollstaendige Berechnungseingabe mit variabler Einheitenzahl, Referenzwert und
 * Vermarkterbewertung. Alle uebrigen Groessen bleiben fest — variiert wird genau das,
 * was die Eigenschaften beruehren.
 */
export function projektGenerator(): fc.Arbitrary<EingangsArgumente> {
  return fc.record({
    einheiten: fc.integer({ min: 1, max: 30 }),
    pRef: fc.integer({ min: 20_000_000, max: 400_000_000 }),
    lage: fc.double({ min: 0, max: 1, noNaN: true }),
    ausbau: fc.integer({ min: 1, max: 6 }),
  }).map(({ einheiten, pRef, lage, ausbau }) => ({
    ...eingangsArgumente({
      liegenschaft: liegenschaftMitEinheiten(einheiten),
      bewertungen: [{ ...referenzbewertungFixture('T1'), marktwert: rappen(pRef) }],
      lagescores: lagescoresFixture(new Map([[
        // `lagescoreName` waere hier ein zweiter Import ohne Gewinn: die Fixture nimmt
        // den Markentyp, und der Schluessel ist derselbe Bezeichner.
        'location' as never, score(lage),
      ]])),
      vermarkterFaktoren: { werte: new Map([[faktorId('innenausbau_qualitaet'), ausbau]]) },
    }),
  }));
}

/**
 * Zwei Projekte mit identischem Einheitenpreis und unterschiedlicher Einheitenzahl.
 *
 * Genau diese Konstruktion prueft I-18: Der relative Honorarsatz darf mit steigender
 * Einheitenzahl nicht steigen. Waeren auch die Einheitenpreise verschieden, mischte der
 * Vergleich zwei Ursachen und die Eigenschaft waere nicht mehr zuordenbar.
 */
export function projektpaarGleicherEinheitenpreis(
  klein: number,
  gross: number,
): { readonly klein: EingangsArgumente; readonly gross: EingangsArgumente } {
  const bau = (anzahl: number): EingangsArgumente => eingangsArgumente({
    liegenschaft: liegenschaftMitEinheiten(anzahl),
    bewertungen: [referenzbewertungFixture('T1')],
  });
  return { klein: bau(klein), gross: bau(gross) };
}
