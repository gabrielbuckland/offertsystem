// Reine Entscheidungslogik des Anlegen-Dialogs (`Referenzobjekte.tsx`), getrennt von der
// Komponente, damit sie ohne DOM/React testbar ist (gleiches Muster wie `zellen-logik.ts`
// und `faktoren-logik.ts`).
import { BADEZIMMER_MIN } from '@offert/core';
import type { Qualitaetsbewertungen, Zustandsbewertungen } from '@offert/core';
import type { Referenzobjekt } from '../../server/projekt-schema.js';

// Zimmerzahlen in Halbschritten 1..6 (uebliche Schweizer Wohnungstypologie): eine feste,
// kleine Menge statt eines freien Zahlenfelds.
export const ZIMMERZAHL_HALBSCHRITTE = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const;

// `liegenschaft.ts` weist ein zweites Referenzobjekt mit derselben Zimmerzahl als
// ZIMMERZAHL_MEHRFACH zurueck — der Dialog bietet deshalb nur unterscheidbare Zimmerzahlen
// an, statt den Fehler erst beim Speichern zu zeigen.
export function verfuegbareZimmerzahlen(vorhandene: readonly Referenzobjekt[]): readonly number[] {
  const belegt = new Set(vorhandene.map((r) => r.zimmerzahl));
  return ZIMMERZAHL_HALBSCHRITTE.filter((z) => !belegt.has(z));
}

// Fortlaufend statt zufaellig: eine UUID entstuende ausserhalb von `apps/web/src/server`
// und verletzte damit E-29/NFA-06.
export function naechsteId(vorhandene: readonly Referenzobjekt[]): string {
  const hoechste = vorhandene.reduce((max, r) => {
    const treffer = /^R(\d+)$/.exec(r.id);
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
  return `R${hoechste + 1}`;
}

// Stockwerk ist bei einem Referenzobjekt IMMER 0: Die Referenzbewertung bezieht sich auf den
// Wohnungstyp als solchen, nicht auf eine konkrete, im Gebaeude verortete Einheit (anders als
// `ProjektEinheit`). `baujahr` kommt vom Projekt, nicht aus einem eigenen Dialogfeld: bei
// einem Neubauprojekt hat jede Wohnung dasselbe Baujahr. `zustandsbewertungen`/
// `qualitaetsbewertungen` kommen aus den firmenweiten Dossier-Voreinstellungen, aus
// demselben Grund (Rueckmeldung Auftraggeber). Energielabel, Badezimmer, Lift, Heizungsart
// bleiben bei ihren Platzhaltern: PriceHubble fuehrt sie nicht als Pflichtfelder.
export function neuesReferenzobjekt(
  zimmerzahl: number,
  wohnflaeche: number,
  id: string,
  baujahr: number,
  zustandsbewertungen: Zustandsbewertungen,
  qualitaetsbewertungen: Qualitaetsbewertungen,
): Referenzobjekt {
  return {
    id,
    zimmerzahl,
    parametrisierung: {
      flaecheInnen: wohnflaeche, flaecheAussen: 0, stockwerk: 0, energielabel: '',
      zustandsbewertungen: { ...zustandsbewertungen },
      qualitaetsbewertungen: { ...qualitaetsbewertungen },
      anzahlBadezimmer: BADEZIMMER_MIN, lift: false, baujahr, heizungsart: '',
    },
  };
}

// Anders als `entscheideZellenwert`: ein geleertes Feld heisst hier nicht "unveraendert
// lassen", sondern "keine Wohnungen dieses Typs jetzt schon anlegen" — ein geleertes,
// negatives oder gebrochenes Feld liefert deshalb 0 statt den Dialog zu sperren.
export function anzahlWohnungenAusEntwurf(entwurf: string): number {
  if (entwurf.trim().length === 0) return 0;
  const zahl = Number(entwurf);
  return Number.isFinite(zahl) && zahl > 0 ? Math.floor(zahl) : 0;
}
