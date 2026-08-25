'use client';

/**
 * Zustand eines Einstellungs-Editors (Spec §6, US-08).
 *
 * BEWUSST ohne Autosave — anders als die Projektseite (`verwendeProjekt`, die jede
 * Aenderung entprellt automatisch per PUT schreibt): Ein Schreibvorgang hier trifft
 * NICHT nur das gerade offene Projekt, sondern die firmenweite Konfiguration und damit
 * ALLE Projekte. Ein automatisches Speichern liesse den Auftraggeber eine firmenweite
 * Wirkung ausloesen, ohne dass er das je bewusst entschieden haette; ein Tippfehler in
 * einem Zahlenfeld wuerde sofort auf jede kuenftige Offerte durchschlagen. Eine
 * Projektaenderung ist dagegen jederzeit billig rueckgaengig zu machen (Feld erneut
 * bearbeiten). Diese Asymmetrie in der Wirkung rechtfertigt die Asymmetrie im
 * Speicherverhalten: Aenderungen sammeln sich hier nur im Entwurf, bis ein expliziter
 * Klick auf «Speichern» sie freigibt.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { rufeApi } from '../rufe-api.js';

export interface EinstellungsBefund {
  readonly pfad: string;
  readonly text: string;
}

/** Props, die jeder konkrete Bereichs-Editor (HonorarEditor, FaktorenEditor, ...;
 *  Tasks 15/16) entgegennimmt. */
export interface BereichsEditorProps {
  readonly einstellungen: VerwendeEinstellungenErgebnis;
}

/**
 * Signatur eines konkreten Bereichs-Editors. `EinstellungsEditor` (der Rahmen) nimmt
 * eine Komponente MIT dieser Signatur als `Editor`-Prop entgegen und ruft sie selbst mit
 * dem lebenden Zustand auf (`<Editor einstellungen={zustand} />`) — der Vertrag steht
 * damit an EINER Stelle, typgeprueft, statt implizit ueber eine in Kinder injizierte
 * Prop.
 */
export type BereichsEditor = (props: BereichsEditorProps) => ReactElement;

interface SpeicherAntwort {
  readonly pruefsumme?: string;
  readonly befunde?: readonly EinstellungsBefund[];
}

export interface VerwendeEinstellungenErgebnis {
  readonly entwurf: Readonly<Record<string, unknown>>;
  readonly geaendert: boolean;
  readonly speichert: boolean;
  /** Nur nach erfolgreichem Speichern gesetzt; ein neuer Entwurfsschritt loescht sie
   *  wieder (sie bezoege sich sonst auf einen ueberholten Stand). */
  readonly pruefsumme: string | undefined;
  readonly befunde: readonly EinstellungsBefund[];
  readonly aendere: (naechster: Readonly<Record<string, unknown>>) => void;
  readonly speichere: () => void;
  readonly verwerfe: () => void;
}

/** Einziger Netzwerkkontakt dieses Hooks. */
async function schreibeEinstellungen(
  entwurf: Readonly<Record<string, unknown>>,
): Promise<{ readonly ok: true; readonly pruefsumme: string | undefined }
  | { readonly ok: false; readonly befunde: readonly EinstellungsBefund[] }> {
  const antwort = await rufeApi<SpeicherAntwort>('/api/einstellungen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entwurf),
  });
  if (antwort.ok) return { ok: true, pruefsumme: antwort.rumpf.pruefsumme };
  if (antwort.status === 422 && antwort.rumpf.befunde !== undefined) {
    return { ok: false, befunde: antwort.rumpf.befunde };
  }
  // Netzausfall (rufeApi wirft nie, liefert dann status 0) und Serverfehler (500, dessen
  // Rumpf keine `befunde`-Form traegt — Route antwortet dort mit `{ fehler: { text } }`)
  // landen gemeinsam hier: Es gibt keinen Feldanker, dem sich «der Server ist nicht
  // erreichbar» sinnvoll zuordnen liesse (I-24), also genau EIN unanhaengiger Befund.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' }],
  };
}

export function verwendeEinstellungen(
  anfang: Readonly<Record<string, unknown>>,
): VerwendeEinstellungenErgebnis {
  const [entwurf, setzeEntwurf] = useState(anfang);
  const [speichert, setzeSpeichert] = useState(false);
  const [pruefsumme, setzePruefsumme] = useState<string | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly EinstellungsBefund[]>([]);

  // Referenzvergleich zum Anfang statt tiefer Objektvergleich: `aendere` erhaelt vom
  // Aufrufer stets den VOLLEN, neu zusammengesetzten Baum (gleiches Vorgehen wie
  // `verwendeProjekt`); jede Aenderung liefert damit zwangslaeufig eine neue Referenz.
  const geaendert = entwurf !== anfang;

  const aendere = useCallback((naechster: Readonly<Record<string, unknown>>) => {
    setzeEntwurf(naechster);
    // Ein neuer Bearbeitungsschritt entwertet die letzte Rueckmeldung (Erfolg oder
    // Befunde) — sie galt einem Entwurf, der jetzt ueberholt ist.
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, []);

  const speichere = useCallback(() => {
    setzeSpeichert(true);
    void schreibeEinstellungen(entwurf)
      .then((ergebnis) => {
        if (ergebnis.ok) {
          setzeBefunde([]);
          setzePruefsumme(ergebnis.pruefsumme);
        } else {
          setzeBefunde(ergebnis.befunde);
          setzePruefsumme(undefined);
        }
      })
      .finally(() => setzeSpeichert(false));
  }, [entwurf]);

  const verwerfe = useCallback(() => {
    setzeEntwurf(anfang);
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, [anfang]);

  return { entwurf, geaendert, speichert, pruefsumme, befunde, aendere, speichere, verwerfe };
}

/**
 * Reine Filterfunktion (testbar ohne React): Ein Befund gehoert zu `praefix`, wenn sein
 * Pfad exakt dem Praefix entspricht oder darunter liegt (Punkt- oder Klammerzugriff).
 *
 * Ein LEERER Pfad ist der Netz-/500-Fallback aus `schreibeEinstellungen` — ein Befund
 * ganz ohne Feldanker. Er gehoert zu KEINEM Teilbaum genauer als zu jedem anderen und
 * muss deshalb bei jedem Bereich sichtbar werden, dessen `speichere()` ihn ausgeloest
 * hat — sonst verschwaende ein gescheiterter Speicherversuch spurlos.
 */
export function befundeFuerPfad(
  befunde: readonly EinstellungsBefund[], praefix: string,
): readonly EinstellungsBefund[] {
  return befunde.filter((befund) => befund.pfad === ''
    || befund.pfad === praefix
    || befund.pfad.startsWith(`${praefix}.`)
    || befund.pfad.startsWith(`${praefix}[`));
}
