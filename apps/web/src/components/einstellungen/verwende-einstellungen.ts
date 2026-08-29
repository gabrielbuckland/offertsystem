'use client';

// Spec §6, US-08. BEWUSST ohne Autosave (anders als `verwendeProjekt`): ein Schreibvorgang
// hier trifft nicht nur das offene Projekt, sondern die firmenweite Konfiguration und damit
// alle Projekte. Aenderungen sammeln sich deshalb nur im Entwurf, bis ein expliziter Klick
// auf «Speichern» sie freigibt.
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { rufeApi } from '../rufe-api.js';

export interface EinstellungsBefund {
  readonly pfad: string;
  readonly text: string;
}

export interface BereichsEditorProps {
  readonly einstellungen: VerwendeEinstellungenErgebnis;
}

// Signatur eines Bereichs-Editors; `EinstellungsEditor` ruft ihn mit dem lebenden Zustand
// auf (`<Editor einstellungen={zustand} />`).
export type BereichsEditor = (props: BereichsEditorProps) => ReactElement;

interface SpeicherAntwort {
  readonly pruefsumme?: string;
  readonly befunde?: readonly EinstellungsBefund[];
}

export type SpeicherErgebnis =
  | { readonly ok: true; readonly pruefsumme: string | undefined }
  | { readonly ok: false; readonly befunde: readonly EinstellungsBefund[] };

export interface VerwendeEinstellungenErgebnis {
  readonly entwurf: Readonly<Record<string, unknown>>;
  readonly geaendert: boolean;
  readonly speichert: boolean;
  // Nur nach erfolgreichem Speichern gesetzt; ein neuer Entwurfsschritt loescht sie wieder.
  readonly pruefsumme: string | undefined;
  readonly befunde: readonly EinstellungsBefund[];
  readonly aendere: (naechster: Readonly<Record<string, unknown>>) => void;
  readonly speichere: () => void;
  readonly verwerfe: () => void;
}

async function schreibeEinstellungen(
  entwurf: Readonly<Record<string, unknown>>,
): Promise<SpeicherErgebnis> {
  const antwort = await rufeApi<SpeicherAntwort>('/api/einstellungen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entwurf),
  });
  if (antwort.ok) return { ok: true, pruefsumme: antwort.rumpf.pruefsumme };
  if (antwort.status === 422 && antwort.rumpf.befunde !== undefined) {
    return { ok: false, befunde: antwort.rumpf.befunde };
  }
  // I-24: Netzausfall und Serverfehler ohne `befunde`-Form landen hier gemeinsam als ein
  // unanhaengiger Befund ohne Feldanker.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' }],
  };
}

interface SpeicherBeobachter {
  readonly aufSpeichertWechsel: (speichert: boolean) => void;
  readonly aufErgebnis: (ergebnis: SpeicherErgebnis) => void;
}

// `vermerkeAenderung` und `starte` zaehlen eine gemeinsame Generation hoch; trifft eine
// Antwort mit veralteter Generation ein, wird sie verworfen statt einen neueren Entwurf zu
// ueberschreiben. `speichert` wird nur von der zuletzt GESENDETEN Anfrage zurueckgesetzt
// (`laufendeGeneration`), sonst risse eine spaet eintreffende erste Antwort den Ladezustand
// herunter, waehrend eine zweite Anfrage noch laeuft.
export function baueSpeicherSteuerung(
  sende: (entwurf: Readonly<Record<string, unknown>>) => Promise<SpeicherErgebnis>,
  beobachter: SpeicherBeobachter,
) {
  let generation = 0;
  let laufendeGeneration: number | undefined;

  return {
    vermerkeAenderung(): void {
      generation += 1;
    },
    starte(entwurf: Readonly<Record<string, unknown>>): void {
      generation += 1;
      const meineGeneration = generation;
      laufendeGeneration = meineGeneration;
      beobachter.aufSpeichertWechsel(true);
      void sende(entwurf)
        .then((ergebnis) => {
          if (generation === meineGeneration) beobachter.aufErgebnis(ergebnis);
        })
        .finally(() => {
          if (laufendeGeneration === meineGeneration) beobachter.aufSpeichertWechsel(false);
        });
    },
  };
}

// Strukturvergleich statt Referenzvergleich: `aendere` liefert bei Ruecksetzen auf den
// Ausgangswert eine neue Referenz, obwohl der Baum inhaltlich unveraendert ist.
export function entwurfGeaendert(
  entwurf: Readonly<Record<string, unknown>>, anfang: Readonly<Record<string, unknown>>,
): boolean {
  return JSON.stringify(entwurf) !== JSON.stringify(anfang);
}

export function verwendeEinstellungen(
  anfang: Readonly<Record<string, unknown>>,
): VerwendeEinstellungenErgebnis {
  const [entwurf, setzeEntwurf] = useState(anfang);
  const [speichert, setzeSpeichert] = useState(false);
  const [pruefsumme, setzePruefsumme] = useState<string | undefined>(undefined);
  const [befunde, setzeBefunde] = useState<readonly EinstellungsBefund[]>([]);

  const steuerung = useRef<ReturnType<typeof baueSpeicherSteuerung> | undefined>(undefined);
  if (steuerung.current === undefined) {
    steuerung.current = baueSpeicherSteuerung(schreibeEinstellungen, {
      aufSpeichertWechsel: setzeSpeichert,
      aufErgebnis: (ergebnis) => {
        if (ergebnis.ok) {
          setzeBefunde([]);
          setzePruefsumme(ergebnis.pruefsumme);
        } else {
          setzeBefunde(ergebnis.befunde);
          setzePruefsumme(undefined);
        }
      },
    });
  }

  const geaendert = entwurfGeaendert(entwurf, anfang);

  const aendere = useCallback((naechster: Readonly<Record<string, unknown>>) => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(naechster);
    // Ein neuer Bearbeitungsschritt entwertet die letzte Rueckmeldung.
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, []);

  const speichere = useCallback(() => {
    steuerung.current?.starte(entwurf);
  }, [entwurf]);

  const verwerfe = useCallback(() => {
    steuerung.current?.vermerkeAenderung();
    setzeEntwurf(anfang);
    setzePruefsumme(undefined);
    setzeBefunde([]);
  }, [anfang]);

  return { entwurf, geaendert, speichert, pruefsumme, befunde, aendere, speichere, verwerfe };
}

// Ein leerer Pfad ist der Netz-/500-Fallback aus `schreibeEinstellungen` (ein Befund ohne
// Feldanker) und muss deshalb bei jedem Bereich sichtbar werden, dessen `speichere()` ihn
// ausgeloest hat.
export function befundeFuerPfad(
  befunde: readonly EinstellungsBefund[], praefix: string,
): readonly EinstellungsBefund[] {
  return befunde.filter((befund) => befund.pfad === ''
    || befund.pfad === praefix
    || befund.pfad.startsWith(`${praefix}.`)
    || befund.pfad.startsWith(`${praefix}[`));
}
