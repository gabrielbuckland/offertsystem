/**
 * Reine Datenaufbereitung fuer die Pipeline-Ansicht (US-09/A-10): fuenf feste Stufen,
 * deren Zeilen- und Balkeninhalte ausschliesslich durch Iteration ueber die Konfiguration
 * bzw. eine optionale Herleitung entstehen. Kein Faktor-, Vorlagen- oder Konfigurationsschluessel
 * ist hier woertlich verdrahtet — ein Architekturtest (Task 17) prueft das ueber diesen
 * Ordner. Keine React-/Node-Importe: die Funktion laeuft unveraendert im Browser.
 */
import type { OffertKonfiguration, UeberschreibungsProtokoll } from '@offert/core';
import type { AggregateValues, PriceDerivation } from '@offert/offer/src/model/offer.js';
import {
  formatiereAggregat,
  formatiereProzent,
  formatiereScore,
} from '@offert/offer/src/format/de-ch.js';

export interface PipelineZeile {
  readonly beschriftung: string;
  readonly wert: string;                       // formatiert; '—' fuer fehlend (I-24)
  readonly herkunft?: 'firmenweit' | 'projekt';
}
export interface PipelineBalken {
  readonly beschriftung: string;
  readonly anteil: number;                     // 0..1, Breite des CSS-Balkens
  readonly wert: string;
}
export interface PipelineStufe {
  readonly nr: 1 | 2 | 3 | 4 | 5;
  readonly titel: string;
  readonly zeilen: readonly PipelineZeile[];
  readonly balken?: readonly PipelineBalken[];
  readonly editorPfad: '/einstellungen/dossier' | '/einstellungen/preisanpassung'
    | '/einstellungen/faktoren' | '/einstellungen/honorar';
}

interface Herleitung {
  readonly derivation: PriceDerivation;
  readonly aggregates: AggregateValues;
}

interface PipelineExtras {
  readonly herleitung?: Herleitung;
  readonly ueberschreibungen?: readonly UeberschreibungsProtokoll[];
}

/**
 * Rohwerte aus `dossierDefaults` sind entweder `null`, ein Primitivwert oder ein leeres/
 * gefuelltes Record (`zustandsbewertungen`, `qualitaetsbewertungen`). Es gibt keine
 * Rechenstufe dahinter — nur `null` gilt als fehlend (I-24), ein leeres Record ebenso,
 * weil es inhaltlich nichts traegt.
 */
function formatiereRohwert(wert: unknown): string {
  if (wert === null || wert === undefined) return '—';
  if (typeof wert === 'object') {
    const eintraege = Object.entries(wert as Record<string, unknown>);
    return eintraege.length === 0 ? '—' : eintraege.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
  }
  return String(wert);
}

/** Prueft, ob ein Dossier-Feld ueber `dossierParameter.<Wohnungstyp>.<Feld>` ueberschrieben wurde. */
function istProjektbezogen(
  feldname: string,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): boolean {
  if (ueberschreibungen === undefined) return false;
  return ueberschreibungen.some(
    (u) => u.pfad.startsWith('dossierParameter.') && u.pfad.endsWith(`.${feldname}`),
  );
}

function baueStufeEingabe(
  basis: OffertKonfiguration,
  ueberschreibungen: readonly UeberschreibungsProtokoll[] | undefined,
): PipelineStufe {
  const defaults = basis.dossierDefaults as unknown as Record<string, unknown>;
  const zeilen: PipelineZeile[] = Object.entries(defaults).map(([feldname, wert]) => ({
    beschriftung: feldname,
    wert: formatiereRohwert(wert),
    herkunft: istProjektbezogen(feldname, ueberschreibungen) ? 'projekt' : 'firmenweit',
  }));
  return { nr: 1, titel: 'Eingabe', zeilen, editorPfad: '/einstellungen/dossier' };
}

function baueStufeVerkaufssumme(basis: OffertKonfiguration, herleitung: Herleitung | undefined): PipelineStufe {
  const zeilen: PipelineZeile[] = [
    { beschriftung: 'α', wert: formatiereScore(basis.flaeche.alpha) },
    { beschriftung: 'zMin', wert: formatiereProzent(basis.preisanpassung.zMin) },
    { beschriftung: 'zMax', wert: formatiereProzent(basis.preisanpassung.zMax) },
    {
      beschriftung: 'Anzahl Vorlagen',
      wert: `${basis.anpassungsVorlagen.length} Vorlagen`,
    },
  ];
  if (herleitung !== undefined) {
    for (const typ of herleitung.derivation.apartmentTypes) {
      zeilen.push({
        beschriftung: `Referenzwert ${typ.roomCount} Zimmer`,
        wert: formatiereAggregat(typ.referenceValuation.value.marktwert),
      });
    }
  }
  zeilen.push({
    beschriftung: 'Verkaufssumme',
    wert: herleitung === undefined ? '—' : formatiereAggregat(herleitung.aggregates.totalSalesValue.value),
  });
  return { nr: 2, titel: 'Verkaufssumme', zeilen, editorPfad: '/einstellungen/preisanpassung' };
}

/** Sortiert die konfigurierten Faktoren nach Schluessel — stabile, datengetriebene Reihenfolge. */
function sortierteFaktoren(basis: OffertKonfiguration) {
  return Object.entries(basis.aufwandfaktoren).sort(([a], [b]) => a.localeCompare(b));
}

function baueStufeNormalisierung(basis: OffertKonfiguration, herleitung: Herleitung | undefined): PipelineStufe {
  const zeilen: PipelineZeile[] = herleitung === undefined
    ? sortierteFaktoren(basis).map(([, faktor]) => ({
        beschriftung: faktor.bezeichnung,
        wert: `[${faktor.min}, ${faktor.max}]`,
      }))
    : herleitung.aggregates.effortFactors.map((ef) => ({
        beschriftung: ef.bezeichnung,
        wert: `${formatiereScore(ef.rawValue)} → ${formatiereScore(ef.normalised)}${ef.gekappt ? ' (gekappt)' : ''}`,
      }));
  return { nr: 3, titel: 'Normalisierung', zeilen, editorPfad: '/einstellungen/faktoren' };
}

function baueStufeGewichtung(basis: OffertKonfiguration, herleitung: Herleitung | undefined): PipelineStufe {
  const faktoren = sortierteFaktoren(basis);
  const balken: PipelineBalken[] = herleitung === undefined
    ? faktoren.map(([, faktor]) => ({
        beschriftung: faktor.bezeichnung,
        anteil: faktor.gewicht,
        wert: formatiereProzent(faktor.gewicht),
      }))
    : herleitung.aggregates.effortFactors.map((ef) => ({
        beschriftung: ef.bezeichnung,
        anteil: ef.beitrag,
        wert: formatiereScore(ef.beitrag),
      }));
  const gewichtssumme = herleitung === undefined
    ? faktoren.reduce((summe, [, faktor]) => summe + faktor.gewicht, 0)
    : herleitung.aggregates.gewichtssumme;
  const zeilen: PipelineZeile[] = [
    { beschriftung: 'Gewichtssumme', wert: formatiereScore(gewichtssumme) },
    {
      beschriftung: 'Aufwandindikator D',
      wert: herleitung === undefined ? '—' : formatiereScore(herleitung.aggregates.effortIndicator.value),
    },
  ];
  return { nr: 4, titel: 'Gewichtung', zeilen, balken, editorPfad: '/einstellungen/faktoren' };
}

function baueStufeHonorar(basis: OffertKonfiguration, herleitung: Herleitung | undefined): PipelineStufe {
  const { gMin, gMax } = basis.honorar.skalierung;
  const zeilen: PipelineZeile[] = [
    {
      beschriftung: 'Stützstellen',
      wert: `${basis.honorar.stuetzstellen.length} Stützstellen`,
    },
    {
      beschriftung: 'g',
      wert: `linear [${formatiereScore(gMin)}, ${formatiereScore(gMax)}]`,
    },
  ];
  if (herleitung === undefined) {
    zeilen.push({ beschriftung: 'Honorarrange', wert: '—' });
  } else {
    const { feeTier, scalingFactor, feeRange } = herleitung.aggregates;
    zeilen.push(
      { beschriftung: 'Stufe k', wert: String(feeTier.value.k) },
      { beschriftung: 'Interpolationsanteil', wert: formatiereScore(feeTier.value.interpolationsAnteil) },
      { beschriftung: 'g(D)', wert: formatiereScore(scalingFactor.value) },
      {
        beschriftung: 'Honorarrange',
        wert: `${formatiereAggregat(feeRange.value.min)} – ${formatiereAggregat(feeRange.value.max)}`,
      },
    );
  }
  return { nr: 5, titel: 'Honorar', zeilen, editorPfad: '/einstellungen/honorar' };
}

export function bauePipelineDaten(
  basis: OffertKonfiguration,
  extras?: PipelineExtras,
): readonly PipelineStufe[] {
  const herleitung = extras?.herleitung;
  return [
    baueStufeEingabe(basis, extras?.ueberschreibungen),
    baueStufeVerkaufssumme(basis, herleitung),
    baueStufeNormalisierung(basis, herleitung),
    baueStufeGewichtung(basis, herleitung),
    baueStufeHonorar(basis, herleitung),
  ];
}
