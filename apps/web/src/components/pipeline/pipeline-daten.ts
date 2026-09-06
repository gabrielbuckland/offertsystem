// US-09/A-10: keine Faktor-/Konfigurationsschluessel hier verdrahtet (Architekturtest
// prueft das). Nichts wird nachgerechnet, nur ausgewiesen (I-24). Herkunft je Zeile
// (firmenweit/projekt, A-13) kommt ausschliesslich aus dem Ueberschreibungsprotokoll,
// nie aus einer festen Annahme.
import { GESPERRTE_PFADE } from '@offert/core';
import type { UeberschreibungsProtokoll } from '@offert/core';
import {
  type AggregateValues,
  type PriceDerivation,
  formatiereAggregat,
  formatiereBetrag,
  formatiereFlaeche,
  formatiereProzent,
  formatiereScore,
  formatiereZimmerzahl,
} from '@offert/offer';
import { beschrifteFeld, beschrifteObjekt, beschrifteWert } from '../../lib/dossier-beschriftungen.js';

// Strukturelle Teilmenge der OffertKonfiguration, die der Aufbau tatsaechlich liest.
// So dient auch die deserialisierte Konfigurationskopie einer abgelegten Offerte als
// Basis (eingefrorener Rechenweg), ohne eine vollstaendige Konfiguration zu erfinden.
export interface PipelineBasis {
  readonly dossierDefaults: Readonly<Record<string, unknown>>;
  readonly flaeche: { readonly alpha: number };
  readonly preisanpassung: { readonly zMin: number; readonly zMax: number };
  readonly aufwandfaktoren: Readonly<Record<string, {
    readonly bezeichnung: string;
    readonly min: number;
    readonly max: number;
    readonly gewicht: number;
  }>>;
  readonly honorar: {
    readonly stuetzstellen: readonly { readonly v: number }[];
    readonly skalierung: { readonly gMin: number; readonly gMax: number };
  };
}

export interface PipelineZeile {
  readonly beschriftung: string;
  readonly ausdruck?: string;
  readonly wert: string;                       // formatiert; '—' fuer fehlend (I-24)
  readonly herkunft?: 'firmenweit' | 'projekt';
  readonly hervorgehoben?: boolean;
  readonly anteil?: number;
}

export interface PipelineTabelle {
  readonly kopf: readonly string[];
  readonly ausrichtung: readonly ('links' | 'rechts')[];
  readonly zeilen: readonly (readonly string[])[];
}

export interface PipelineAbschnitt {
  readonly titel?: string;
  readonly formeln?: readonly string[];
  readonly zeilen?: readonly PipelineZeile[];
  readonly tabelle?: PipelineTabelle;
}

export interface PipelineStufe {
  readonly nr: 1 | 2 | 3 | 4 | 5;
  readonly titel: string;
  readonly zweck: string;
  readonly abschnitte: readonly PipelineAbschnitt[];
  // Fehlt beim eingefrorenen Rechenweg einer Offerte: dort gibt es nichts zu editieren.
  readonly editorPfad?: '/einstellungen/dossier' | '/einstellungen/preisanpassung'
    | '/einstellungen/faktoren' | '/einstellungen/honorar';
}

interface Herleitung {
  readonly derivation: PriceDerivation;
  readonly aggregates: AggregateValues;
}

interface PipelineExtras {
  readonly herleitung?: Herleitung;
  readonly ueberschreibungen?: readonly UeberschreibungsProtokoll[];
  readonly aufwandindikatorUebersteuert?: boolean;
}

const FEHLT = '—';

// `*` im Bezugspfad steht fuer ein beliebiges Segment. Vergleich in BEIDE Richtungen,
// weil das Protokoll je nach Aenderung feiner (einzelnes Blatt) oder groeber (ganzer
// ersetzter Teilbaum) sein kann als die angezeigte Zeile — es genuegt daher, dass der
// kuerzere Pfad Praefix des laengeren ist.
function pfadeUeberlappen(bezugspfad: string, protokollpfad: string): boolean {
  const bezug = bezugspfad.split('.');
  const eintrag = protokollpfad.split('.');
  const gemeinsam = Math.min(bezug.length, eintrag.length);
  for (let i = 0; i < gemeinsam; i += 1) {
    if (bezug[i] !== '*' && bezug[i] !== eintrag[i]) return false;
  }
  return true;
}

// Wurzeln bewusst aus GESPERRTE_PFADE abgeleitet statt hier erneut aufgezaehlt: eine
// zweite Wahrheit ueber zulaessige Pfade war die Fehlerquelle fuer falsche Herkunft.
function istUebersteuerbar(bezugspfad: string): boolean {
  return !GESPERRTE_PFADE.includes(bezugspfad.split('.')[0] ?? bezugspfad);
}

// A-13: exportiert, damit die Herkunftslogik unabhaengig von der Darstellung pruefbar bleibt.
export function istProjektbezogen(
  bezugspfade: readonly string[],
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): boolean {
  if (ueberschreibungen === undefined) return false;
  return bezugspfade.some((bezug) => istUebersteuerbar(bezug)
    && ueberschreibungen.some((u) => pfadeUeberlappen(bezug, u.pfad)));
}

function herkunft(
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
  ...bezugspfade: readonly string[]
): 'firmenweit' | 'projekt' {
  return istProjektbezogen(bezugspfade, ueberschreibungen) ? 'projekt' : 'firmenweit';
}

// Kein Fehlfall noetig: eine leere/skalare Form haelt schon die Konfigurationspruefung
// auf (DossierDefaultsSchema, strikt), hier kaeme sie nie an.
function baueStufeEingabe(
  basis: PipelineBasis,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): PipelineStufe {
  const defaults = basis.dossierDefaults as unknown as Record<string, Record<string, unknown>>;
  const abschnitte: PipelineAbschnitt[] = Object.entries(defaults).map(
    ([objektschluessel, bewertungen]) => ({
      titel: beschrifteObjekt(objektschluessel),
      zeilen: Object.entries(bewertungen).map(([feld, wert]) => ({
        beschriftung: beschrifteFeld(feld),
        wert: beschrifteWert(objektschluessel, String(wert)),
        // Zwei Wege zu einem projektbezogenen Dossier-Wert: Voreinstellung oder Wohnungstyp.
        herkunft: herkunft(ueberschreibungen,
          `dossierDefaults.${objektschluessel}.${feld}`,
          `dossierParameter.*.${objektschluessel}.${feld}`),
      })),
    }),
  );
  return {
    nr: 1,
    titel: 'Eingabe',
    zweck: 'Dossier-Vorgaben, die je Wohnungstyp in die Bewertungsanfrage an PriceHubble '
      + 'eingehen. Projektbezogene Werte ersetzen die firmenweiten.',
    abschnitte,
    editorPfad: '/einstellungen/dossier',
  };
}

function typName(roomCount: number): string {
  return `${formatiereZimmerzahl(roomCount)} Zimmer`;
}

// I-09: bei Frankenerfassung zusaetzlich den urspruenglich erfassten Betrag ausweisen.
function beschreibeAnpassung(a: {
  readonly factor: number;
  readonly enteredAs: 'factor' | 'amount';
  readonly enteredAmount?: number | undefined;
  readonly justification: string;
}): string {
  const betrag = a.enteredAs === 'amount' && a.enteredAmount !== undefined
    ? ` (erfasst als ${formatiereAggregat(a.enteredAmount)})`
    : '';
  return `${formatiereProzent(a.factor)} ${a.justification}${betrag}`;
}

function baueStufeVerkaufssumme(
  basis: PipelineBasis,
  herleitung: Herleitung | undefined,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): PipelineStufe {
  const alpha = basis.flaeche.alpha;
  const { zMin, zMax } = basis.preisanpassung;
  const abschnitte: PipelineAbschnitt[] = [{
    titel: 'Parameter',
    zeilen: [
      {
        beschriftung: 'Gewicht der Aussenfläche α',
        wert: formatiereScore(alpha),
        herkunft: herkunft(ueberschreibungen, 'flaeche.alpha'),
      },
      {
        beschriftung: 'Zulässige Zu-/Abschlagssumme je Einheit',
        wert: `${formatiereProzent(zMin)} bis ${formatiereProzent(zMax)}`,
        herkunft: herkunft(ueberschreibungen, 'preisanpassung.zMin', 'preisanpassung.zMax'),
      },
    ],
  }];

  if (herleitung === undefined) {
    abschnitte.push({
      zeilen: [{ beschriftung: 'Verkaufssumme V', wert: FEHLT }],
    });
    return stufeVerkaufssumme(abschnitte);
  }

  const { derivation, aggregates } = herleitung;
  abschnitte.push({
    titel: 'Preis je Quadratmeter, je Wohnungstyp',
    formeln: [
      `Referenzfläche = Wohnfläche + ${formatiereScore(alpha)} × Aussenfläche`,
      'Preis je m² = Referenzwert ÷ Referenzfläche',
    ],
    tabelle: {
      kopf: ['Wohnungstyp', 'Referenzwert (PriceHubble)', 'Referenzfläche', 'Preis je m²'],
      ausrichtung: ['links', 'rechts', 'rechts', 'rechts'],
      zeilen: derivation.apartmentTypes.map((typ) => [
        typName(typ.roomCount),
        formatiereAggregat(typ.referenceValuation.value.marktwert),
        `${formatiereFlaeche(typ.dossierParameters.flaecheInnen)} + ${formatiereScore(alpha)} × `
          + `${formatiereFlaeche(typ.dossierParameters.flaecheAussen)} = `
          + formatiereFlaeche(typ.referenceArea.value),
        `${formatiereBetrag(typ.pricePerSqm.value)}/m²`,
      ]),
    },
  });

  const typZuName = new Map(derivation.apartmentTypes.map((t) => [t.typeId, typName(t.roomCount)]));
  abschnitte.push({
    titel: 'Wohnungspreise',
    formeln: [
      `Gewichtete Fläche = Wohnfläche + ${formatiereScore(alpha)} × Aussenfläche`,
      'Basispreis = Preis je m² des Typs × gewichtete Fläche',
      'Preis = Basispreis × (1 + z), auf ganze Franken gerundet',
    ],
    tabelle: {
      kopf: ['Einheit', 'Typ', 'Gewichtete Fläche', 'Basispreis', 'Zu-/Abschläge z', 'Preis'],
      ausrichtung: ['links', 'links', 'rechts', 'rechts', 'links', 'rechts'],
      zeilen: derivation.units.map((einheit) => {
        const anpassungen = einheit.adjustments.map((a) => beschreibeAnpassung(a.value));
        const zSumme = formatiereProzent(einheit.adjustmentSum.value);
        const anpassungsZelle = anpassungen.length === 0
          ? 'keine'
          : anpassungen.length === 1
            ? anpassungen[0]!
            : `${anpassungen.join('\n')}\nz = ${zSumme}`;
        return [
          einheit.unitNumber,
          typZuName.get(einheit.typeId) ?? einheit.typeId,
          `${formatiereFlaeche(einheit.areaInner)} + ${formatiereScore(alpha)} × `
            + `${formatiereFlaeche(einheit.areaOuter)} = ${formatiereFlaeche(einheit.weightedArea.value)}`,
          formatiereBetrag(einheit.basePrice.value),
          anpassungsZelle,
          `× (1 ${einheit.adjustmentSum.value < 0 ? '−' : '+'} `
            + `${formatiereScore(Math.abs(einheit.adjustmentSum.value))}) = `
            + formatiereAggregat(einheit.unitPrice.value),
        ];
      }),
    },
  });

  abschnitte.push({
    zeilen: [{
      beschriftung: 'Verkaufssumme V',
      ausdruck: `Summe der ${String(aggregates.einheitenzahl)} Wohnungspreise`,
      wert: formatiereAggregat(aggregates.totalSalesValue.value),
      hervorgehoben: true,
    }],
  });
  return stufeVerkaufssumme(abschnitte);
}

function stufeVerkaufssumme(abschnitte: readonly PipelineAbschnitt[]): PipelineStufe {
  return {
    nr: 2,
    titel: 'Verkaufssumme',
    zweck: 'Der Referenzwert je Wohnungstyp wird zum Quadratmeterpreis, dieser bepreist '
      + 'jede Einheit über ihre gewichtete Fläche. Danach wirken die Zu-/Abschläge, die '
      + 'Summe aller Wohnungspreise ist die Verkaufssumme.',
    abschnitte,
    editorPfad: '/einstellungen/preisanpassung',
  };
}

function sortierteFaktoren(basis: PipelineBasis) {
  return Object.entries(basis.aufwandfaktoren).sort(([a], [b]) => a.localeCompare(b));
}

// Nur Grenzen/Strategie: ein geaendertes Gewicht faerbt hier nichts ein, sondern die
// Beitragszeile in Stufe 4. Ein neu angelegter Faktor wird ueber das Praefix mitgetroffen.
function skalenpfade(faktorSchluessel: string): readonly string[] {
  return [
    `aufwandfaktoren.${faktorSchluessel}.min`,
    `aufwandfaktoren.${faktorSchluessel}.max`,
    `aufwandfaktoren.${faktorSchluessel}.strategie`,
  ];
}

function baueStufeNormalisierung(
  basis: PipelineBasis,
  herleitung: Herleitung | undefined,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): PipelineStufe {
  const zeilen: PipelineZeile[] = herleitung === undefined
    ? sortierteFaktoren(basis).map(([schluessel, faktor]) => ({
        beschriftung: faktor.bezeichnung,
        ausdruck: `Skala ${formatiereScore(faktor.min)} bis ${formatiereScore(faktor.max)}`,
        wert: FEHLT,
        herkunft: herkunft(ueberschreibungen, ...skalenpfade(schluessel)),
      }))
    : herleitung.aggregates.effortFactors.map((ef) => ({
        beschriftung: ef.bezeichnung,
        // Andere Strategien zeigen nur Rohwert/Skala statt einer unzutreffenden Formel.
        ausdruck: ef.strategie === 'min-max'
          ? `(${formatiereScore(ef.rawValue)} − ${formatiereScore(ef.grenzeMin)}) ÷ `
            + `(${formatiereScore(ef.grenzeMax)} − ${formatiereScore(ef.grenzeMin)})`
          : `Rohwert ${formatiereScore(ef.rawValue)}, Skala `
            + `${formatiereScore(ef.grenzeMin)} bis ${formatiereScore(ef.grenzeMax)} (${ef.strategie})`,
        wert: `${formatiereScore(ef.normalised)}${ef.gekappt ? ' (gekappt)' : ''}`,
        herkunft: herkunft(ueberschreibungen, ...skalenpfade(ef.id)),
      }));
  return {
    nr: 3,
    titel: 'Normalisierung',
    zweck: 'Jeder Aufwandfaktor wird von seiner Rohskala auf die gemeinsame Skala 0 bis 1 '
      + 'gebracht. Vertauschte Grenzen polen den Faktor um, Werte ausserhalb werden gekappt.',
    abschnitte: [{ zeilen }],
    editorPfad: '/einstellungen/faktoren',
  };
}

function baueStufeGewichtung(
  basis: PipelineBasis,
  herleitung: Herleitung | undefined,
  uebersteuert: boolean,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): PipelineStufe {
  const beitragszeilen: PipelineZeile[] = herleitung === undefined
    ? sortierteFaktoren(basis).map(([schluessel, faktor]) => ({
        beschriftung: faktor.bezeichnung,
        ausdruck: `Gewicht ${formatiereProzent(faktor.gewicht)}`,
        wert: FEHLT,
        anteil: faktor.gewicht,
        herkunft: herkunft(ueberschreibungen, `aufwandfaktoren.${schluessel}.gewicht`),
      }))
    : herleitung.aggregates.effortFactors.map((ef) => ({
        beschriftung: ef.bezeichnung,
        ausdruck: `${formatiereScore(ef.weight)} × ${formatiereScore(ef.normalised)}`,
        wert: formatiereScore(ef.beitrag),
        anteil: ef.beitrag,
        herkunft: herkunft(ueberschreibungen, `aufwandfaktoren.${ef.id}.gewicht`),
      }));

  const gewichtssumme = herleitung === undefined
    ? sortierteFaktoren(basis).reduce((summe, [, faktor]) => summe + faktor.gewicht, 0)
    : herleitung.aggregates.gewichtssumme;
  const ergebniszeilen: PipelineZeile[] = [{
    beschriftung: 'Gewichtssumme',
    ausdruck: 'Summe der Gewichte, muss 1 ergeben',
    wert: formatiereScore(gewichtssumme),
  }];

  if (herleitung === undefined) {
    ergebniszeilen.push({ beschriftung: 'Aufwandindikator D', wert: FEHLT });
  } else if (uebersteuert) {
    const abgeleitet = herleitung.aggregates.effortFactors.reduce((s, ef) => s + ef.beitrag, 0);
    ergebniszeilen.push(
      {
        beschriftung: 'D aus den Faktoren abgeleitet',
        ausdruck: 'Summe der Beiträge',
        wert: formatiereScore(abgeleitet),
      },
      {
        beschriftung: 'Aufwandindikator D',
        ausdruck: 'vom Vermarkter übersteuert',
        wert: formatiereScore(herleitung.aggregates.effortIndicator.value),
        hervorgehoben: true,
        anteil: herleitung.aggregates.effortIndicator.value,
      },
    );
  } else {
    ergebniszeilen.push({
      beschriftung: 'Aufwandindikator D',
      ausdruck: 'Summe der Beiträge',
      wert: formatiereScore(herleitung.aggregates.effortIndicator.value),
      hervorgehoben: true,
      anteil: herleitung.aggregates.effortIndicator.value,
    });
  }

  return {
    nr: 4,
    titel: 'Gewichtung',
    zweck: 'Die normalisierten Faktoren werden gewichtet und zum Aufwandindikator D '
      + 'summiert. D liegt zwischen 0 (geringer Vermarktungsaufwand) und 1 (hoher '
      + 'Vermarktungsaufwand).',
    abschnitte: [
      { titel: 'Beiträge', zeilen: beitragszeilen },
      { zeilen: ergebniszeilen },
    ],
    editorPfad: '/einstellungen/faktoren',
  };
}

function baueStufeHonorar(
  basis: PipelineBasis,
  herleitung: Herleitung | undefined,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): PipelineStufe {
  const { gMin, gMax } = basis.honorar.skalierung;
  const stuetzstellen = basis.honorar.stuetzstellen;
  const erste = stuetzstellen[0];
  const letzte = stuetzstellen[stuetzstellen.length - 1];
  const parameterzeilen: PipelineZeile[] = [
    {
      beschriftung: 'Honorarstaffel',
      wert: `${String(stuetzstellen.length)} Stützstellen, `
        + `${erste === undefined ? FEHLT : formatiereAggregat(erste.v)} bis `
        + `${letzte === undefined ? FEHLT : formatiereAggregat(letzte.v)} Verkaufssumme`,
      herkunft: herkunft(ueberschreibungen, 'honorar.stuetzstellen'),
    },
    {
      beschriftung: 'Skalierungsbereich g',
      wert: `${formatiereScore(gMin)} bis ${formatiereScore(gMax)}`,
      herkunft: herkunft(ueberschreibungen,
        'honorar.skalierung.gMin', 'honorar.skalierung.gMax'),
    },
  ];

  if (herleitung === undefined) {
    return stufeHonorar([
      { titel: 'Parameter', zeilen: parameterzeilen },
      { zeilen: [{ beschriftung: 'Honorarrange', wert: FEHLT }] },
    ]);
  }

  const { feeTier, scalingFactor, feeBasis, feeRange, effortIndicator, totalSalesValue }
    = herleitung.aggregates;
  const stufe = feeTier.value;
  const v = formatiereAggregat(totalSalesValue.value);
  const rechenzeilen: PipelineZeile[] = [
    {
      beschriftung: 'Stufenwahl k',
      ausdruck: `${formatiereAggregat(stufe.vMin)} ≤ V < ${formatiereAggregat(stufe.vMax)}`,
      wert: `k = ${String(stufe.k)}`,
    },
    {
      beschriftung: 'Anteil in der Stufe t',
      ausdruck: `(${v} − ${formatiereAggregat(stufe.vMin)}) ÷ `
        + `(${formatiereAggregat(stufe.vMax)} − ${formatiereAggregat(stufe.vMin)})`,
      wert: formatiereScore(stufe.interpolationsAnteil),
    },
    {
      beschriftung: 'Honorarbasis min',
      ausdruck: `${formatiereAggregat(stufe.hMinK)} + ${formatiereScore(stufe.interpolationsAnteil)} × `
        + `(${formatiereAggregat(stufe.hMinK1)} − ${formatiereAggregat(stufe.hMinK)})`,
      wert: formatiereBetrag(feeBasis.value.min),
    },
    {
      beschriftung: 'Honorarbasis max',
      ausdruck: `${formatiereAggregat(stufe.hMaxK)} + ${formatiereScore(stufe.interpolationsAnteil)} × `
        + `(${formatiereAggregat(stufe.hMaxK1)} − ${formatiereAggregat(stufe.hMaxK)})`,
      wert: formatiereBetrag(feeBasis.value.max),
    },
    {
      beschriftung: 'Skalierung g(D)',
      ausdruck: `${formatiereScore(gMin)} + ${formatiereScore(effortIndicator.value)} × `
        + `(${formatiereScore(gMax)} − ${formatiereScore(gMin)})`,
      wert: formatiereScore(scalingFactor.value),
    },
    {
      beschriftung: 'Honorar min',
      ausdruck: `${formatiereBetrag(feeBasis.value.min)} × ${formatiereScore(scalingFactor.value)}, gerundet`,
      wert: formatiereAggregat(feeRange.value.min),
      hervorgehoben: true,
    },
    {
      beschriftung: 'Honorar max',
      ausdruck: `${formatiereBetrag(feeBasis.value.max)} × ${formatiereScore(scalingFactor.value)}, gerundet`,
      wert: formatiereAggregat(feeRange.value.max),
      hervorgehoben: true,
    },
  ];
  return stufeHonorar([
    { titel: 'Parameter', zeilen: parameterzeilen },
    { titel: 'Rechnung', zeilen: rechenzeilen },
  ]);
}

function stufeHonorar(abschnitte: readonly PipelineAbschnitt[]): PipelineStufe {
  return {
    nr: 5,
    titel: 'Honorar',
    zweck: 'Die Verkaufssumme V wählt die Stufe der Honorarstaffel und wird darin linear '
      + 'interpoliert. Der Aufwandindikator D skaliert das Niveau über g(D), gerundet '
      + 'entsteht die Honorarrange.',
    abschnitte,
    editorPfad: '/einstellungen/honorar',
  };
}

export function bauePipelineDaten(
  basis: PipelineBasis,
  extras?: PipelineExtras,
): readonly PipelineStufe[] {
  const herleitung = extras?.herleitung;
  const ueberschreibungen = extras?.ueberschreibungen;
  return [
    baueStufeEingabe(basis, ueberschreibungen),
    baueStufeVerkaufssumme(basis, herleitung, ueberschreibungen),
    baueStufeNormalisierung(basis, herleitung, ueberschreibungen),
    baueStufeGewichtung(
      basis, herleitung, extras?.aufwandindikatorUebersteuert === true, ueberschreibungen),
    baueStufeHonorar(basis, herleitung, ueberschreibungen),
  ];
}
