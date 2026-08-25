/**
 * Reine Entscheidungslogik des Anlegen-Dialogs (`Referenzobjekte.tsx`), getrennt von der
 * Komponente, damit sie ohne DOM/React testbar ist (gleiches Muster wie `zellen-logik.ts`
 * und `faktoren-logik.ts`). `renderToStaticMarkup` haengt keine echten State-Updates
 * aneinander — ein mehrstufiger Formularablauf (Zimmerzahl waehlen, Wohnflaeche eintippen,
 * bestaetigen) liesse sich ueber einen reinen Renderdurchlauf nicht zuverlaessig pruefen.
 */
import type { Referenzobjekt } from '../../server/projekt-schema.js';

// Zimmerzahlen in Halbschritten 1..6 (uebliche Schweizer Wohnungstypologie) — bewusst eine
// FESTE, kleine Menge statt eines freien Zahlenfelds: Der Anlegen-Dialog bietet nur noch
// Werte an, die es tatsaechlich gibt, statt eine willkuerliche naechste ganze Zahl
// vorzuschlagen (frueheres Verhalten, siehe Git-Historie).
export const ZIMMERZAHL_HALBSCHRITTE = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const;

/**
 * Zimmerzahlen aus `ZIMMERZAHL_HALBSCHRITTE`, die noch kein Referenzobjekt traegt.
 *
 * `liegenschaft.ts` weist ein zweites Referenzobjekt mit derselben Zimmerzahl als
 * ZIMMERZAHL_MEHRFACH zurueck — der Dialog bietet deshalb von vornherein nur eine noch
 * unterscheidbare Zimmerzahl an, statt den Fehler erst beim Speichern zu zeigen. Eine
 * leere Liste (alle elf Werte vergeben) ist der einzige Grund, aus dem die Schaltflaeche
 * «Referenzobjekt hinzufügen» gesperrt bleibt.
 */
export function verfuegbareZimmerzahlen(vorhandene: readonly Referenzobjekt[]): readonly number[] {
  const belegt = new Set(vorhandene.map((r) => r.zimmerzahl));
  return ZIMMERZAHL_HALBSCHRITTE.filter((z) => !belegt.has(z));
}

// Fortlaufend statt zufaellig (wie `T${n}` in ablauf-zustand.ts): Eine UUID entstuende
// ausserhalb von `apps/web/src/server` und verletzte damit E-29/NFA-06.
export function naechsteId(vorhandene: readonly Referenzobjekt[]): string {
  const hoechste = vorhandene.reduce((max, r) => {
    const treffer = /^R(\d+)$/.exec(r.id);
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
  return `R${hoechste + 1}`;
}

/**
 * Stockwerk ist bei einem Referenzobjekt IMMER 0: Die Referenzbewertung bezieht sich auf
 * den Wohnungstyp als solchen, nicht auf eine konkrete, im Gebaeude verortete Einheit —
 * anders als bei `ProjektEinheit`, wo das Stockwerk eine echte, unterscheidende Angabe
 * ist. Ein fest verdrahteter Wert statt eines Eingabefelds, das ohnehin immer denselben
 * Wert traegt (Rueckmeldung Auftraggeber).
 *
 * `baujahr` kommt vom Projekt (`Projekt.baujahr`, `ProjektBasisinformationen.tsx`), nicht
 * aus einem eigenen Dialogfeld: Bei einem Neubauprojekt hat jede Wohnung — unabhaengig
 * vom Typ — dasselbe Baujahr. `zustandsbewertungen`/`qualitaetsbewertungen` kommen aus
 * den firmenweiten Dossier-Voreinstellungen (Konfigurationsdatei, `config/README.md`), aus
 * demselben Grund: Bei Neubauprojekten gelten Zustand und Qualitaet firmenweit als
 * feststehend (Rueckmeldung Auftraggeber, `config/README.md`) — ein eigenes Erfassungsfeld
 * je Referenzobjekt entfaellt damit ebenso. Energielabel, Anzahl Badezimmer, Lift und
 * Heizungsart bleiben dagegen bei ihren bisherigen Platzhaltern (leer/0/nein): PriceHubble
 * fuehrt sie nicht als Pflichtfelder (Rueckmeldung Auftraggeber, dort direkt geprueft).
 */
export function neuesReferenzobjekt(
  zimmerzahl: number,
  wohnflaeche: number,
  id: string,
  baujahr: number,
  zustandsbewertungen: Readonly<Record<string, string>>,
  qualitaetsbewertungen: Readonly<Record<string, string>>,
): Referenzobjekt {
  return {
    id,
    zimmerzahl,
    parametrisierung: {
      flaecheInnen: wohnflaeche, flaecheAussen: 0, stockwerk: 0, energielabel: '',
      zustandsbewertungen: { ...zustandsbewertungen },
      qualitaetsbewertungen: { ...qualitaetsbewertungen },
      anzahlBadezimmer: 0, lift: false, baujahr, heizungsart: '',
    },
  };
}

/**
 * Anzahl Wohnungen im Anlegen-Dialog: ANDERS als `entscheideZellenwert` (das ein
 * geleertes Feld verwirft), weil ein geleertes Feld hier gerade NICHT "unveraendert
 * lassen" heisst, sondern "keine Wohnungen dieses Typs jetzt schon anlegen" — eine
 * gueltige, bewusste Angabe. Ein geleertes, negatives oder gebrochenes Feld liefert
 * deshalb 0 (keine Wohnung), statt den Dialog zu sperren; die Wohnflaeche bleibt das
 * einzige Feld, das «Hinzufügen» blockieren kann.
 */
export function anzahlWohnungenAusEntwurf(entwurf: string): number {
  if (entwurf.trim().length === 0) return 0;
  const zahl = Number(entwurf);
  return Number.isFinite(zahl) && zahl > 0 ? Math.floor(zahl) : 0;
}
