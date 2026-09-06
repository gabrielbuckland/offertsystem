// Eingefrorener Rechenweg einer abgelegten Offerte (US-12, NFA-07): dieselbe
// Stufenaufbereitung wie in der Projektansicht, aber aus der eingebetteten
// Konfigurationskopie und der Herleitung des Artefakts — nie aus dem aktuellen
// Projektstand. Ohne Editor-Links und ohne firmenweit/projekt-Kennzeichen: am
// abgelegten Stand gibt es nichts zu editieren, und das Ueberschreibungsprotokoll
// ist nicht Teil des Artefakts.
import { deserialisiereKonfiguration } from '@offert/core';
import {
  formatiereDatum,
  formatiereFlaeche,
  formatiereZimmerzahl,
  type Offer,
} from '@offert/offer';
import {
  beschrifteFeld,
  beschrifteObjekt,
  beschrifteWert,
} from '../../lib/dossier-beschriftungen.js';
import {
  bauePipelineDaten,
  type PipelineAbschnitt,
  type PipelineBasis,
  type PipelineStufe,
  type PipelineZeile,
} from '../pipeline/pipeline-daten.js';

export interface OffertGrundlagen {
  readonly erstelltAm: string;
  readonly konfigVersion: string;
  readonly konfigPruefsumme: string;
  readonly bewertungen: readonly {
    readonly typ: string;
    readonly bewertungsdatum: string;
    readonly konfidenzklasse: string;
  }[];
}

export interface OffertRechenwegDaten {
  readonly stufen: readonly PipelineStufe[];
  readonly grundlagen: OffertGrundlagen;
}

// Stufe 1 aus den tatsaechlich verwendeten Dossier-Parametern der Offerte statt aus
// den Konfigurations-Vorgaben — die Kopie im Artefakt fuehrt keine dossierDefaults.
// Nur die im Erfassungsmodell gefuehrten Felder (vgl. neuesReferenzobjekt): Wohnflaeche,
// Baujahr, Zustands-/Qualitaetsbewertungen. Die uebrigen dossierParameters des Schemas
// sind fest verdrahtete Altfelder und erscheinen bewusst nicht.
function bewertungsTabelle(
  derivation: Offer['derivation'],
  gruppe: 'zustandsbewertungen' | 'qualitaetsbewertungen',
): PipelineAbschnitt {
  const felder = Object.keys(derivation.apartmentTypes[0]?.dossierParameters[gruppe] ?? {});
  return {
    titel: beschrifteObjekt(gruppe),
    tabelle: {
      kopf: ['Wohnungstyp', ...felder.map(beschrifteFeld)],
      ausrichtung: ['links', ...felder.map(() => 'links' as const)],
      zeilen: derivation.apartmentTypes.map((typ) => [
        `${formatiereZimmerzahl(typ.roomCount)} Zimmer`,
        ...felder.map((feld) =>
          beschrifteWert(gruppe, typ.dossierParameters[gruppe][feld] ?? '—')),
      ]),
    },
  };
}

function baueStufeEingabeEingefroren(derivation: Offer['derivation']): PipelineStufe {
  return {
    nr: 1,
    titel: 'Eingabe',
    zweck: 'Wohnungstypen und Bewertungsgrundlagen, wie sie der Bewertungsanfrage an '
      + 'PriceHubble für diese Offerte zugrunde lagen.',
    abschnitte: [
      {
        tabelle: {
          kopf: ['Wohnungstyp', 'Wohnfläche', 'Baujahr'],
          ausrichtung: ['links', 'rechts', 'rechts'],
          zeilen: derivation.apartmentTypes.map((typ) => [
            `${formatiereZimmerzahl(typ.roomCount)} Zimmer`,
            formatiereFlaeche(typ.dossierParameters.flaecheInnen),
            String(typ.dossierParameters.baujahr),
          ]),
        },
      },
      bewertungsTabelle(derivation, 'zustandsbewertungen'),
      bewertungsTabelle(derivation, 'qualitaetsbewertungen'),
    ],
  };
}

function ohneHerkunft(zeile: PipelineZeile): PipelineZeile {
  return {
    beschriftung: zeile.beschriftung,
    wert: zeile.wert,
    ...(zeile.ausdruck === undefined ? {} : { ausdruck: zeile.ausdruck }),
    ...(zeile.hervorgehoben === undefined ? {} : { hervorgehoben: zeile.hervorgehoben }),
    ...(zeile.anteil === undefined ? {} : { anteil: zeile.anteil }),
  };
}

function friereEin(stufe: PipelineStufe): PipelineStufe {
  return {
    nr: stufe.nr,
    titel: stufe.titel,
    zweck: stufe.zweck,
    abschnitte: stufe.abschnitte.map((abschnitt) => ({
      ...(abschnitt.titel === undefined ? {} : { titel: abschnitt.titel }),
      ...(abschnitt.formeln === undefined ? {} : { formeln: abschnitt.formeln }),
      ...(abschnitt.zeilen === undefined ? {} : { zeilen: abschnitt.zeilen.map(ohneHerkunft) }),
      ...(abschnitt.tabelle === undefined ? {} : { tabelle: abschnitt.tabelle }),
    })),
  };
}

export function baueOffertRechenweg(offerte: Offer): OffertRechenwegDaten | null {
  const konfiguration = deserialisiereKonfiguration(offerte.metadata.konfigurationsAbdruck);
  if (!konfiguration.ok) return null;

  const basis: PipelineBasis = {
    dossierDefaults: {},                       // ersetzt durch die eingefrorene Stufe 1
    flaeche: konfiguration.wert.flaeche,
    preisanpassung: konfiguration.wert.preisanpassung,
    aufwandfaktoren: {},                       // mit Herleitung nur Fallback, nie gelesen
    honorar: konfiguration.wert.honorar,
  };
  const stufen = bauePipelineDaten(basis, {
    herleitung: { derivation: offerte.derivation, aggregates: offerte.aggregates },
    aufwandindikatorUebersteuert:
      typeof offerte.metadata.berechnungsEingabe['aufwandindikatorUebersteuerung'] === 'number',
  }).map(friereEin);

  const zimmerNachTyp = new Map(offerte.derivation.apartmentTypes.map(
    (typ) => [typ.typeId, `${formatiereZimmerzahl(typ.roomCount)} Zimmer`] as const));

  return {
    stufen: [baueStufeEingabeEingefroren(offerte.derivation), ...stufen.slice(1)],
    grundlagen: {
      erstelltAm: formatiereDatum(offerte.metadata.erstelltAm),
      konfigVersion: offerte.metadata.konfigVersion,
      konfigPruefsumme: offerte.metadata.konfigPruefsumme,
      bewertungen: offerte.metadata.bewertungsversion.map((b) => ({
        typ: zimmerNachTyp.get(b.typeId) ?? b.typeId,
        bewertungsdatum: formatiereDatum(b.bewertungsdatum),
        konfidenzklasse: b.konfidenzklasse,
      })),
    },
  };
}
