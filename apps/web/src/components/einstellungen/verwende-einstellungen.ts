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
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { rufeApi } from '../rufe-api.js';

export interface EinstellungsBefund {
  readonly pfad: string;
  readonly text: string;
}

/**
 * Bearbeitungsebene des Editors. Sie steuert AUSSCHLIESSLICH Aktionen, die das
 * Delta-Modell der Projektebene nicht ausdruecken kann.
 *
 * Konkret das ENTFERNEN eines Firmenschluessels aus einem Woerterbuch
 * (`aufwandfaktoren.<id>`, `dossierDefaults.*bewertungen.<schluessel>`): `bildeDelta`
 * iteriert ueber die Schluessel des Entwurfs, ein dort fehlender Schluessel erzeugt
 * deshalb keinen Delta-Eintrag — dieselbe Grenze wie im Kern-Merge, der Werte nur
 * ueberlagert und keine Form fuer «dieser Schluessel soll hier fehlen» kennt. Firmenweit
 * wird dagegen die vollstaendige Konfiguration geschrieben; dort ist das Entfernen
 * ausdrueckbar und bleibt erlaubt.
 *
 * Der Knopf wird deshalb auf der Projektebene GESPERRT, nicht stillschweigend wirkungslos
 * gelassen: Knopf da, Wirkung weg ist die schlechteste der drei Varianten.
 */
export type Bearbeitungsebene = 'firma' | 'projekt';

/** Props, die jeder konkrete Bereichs-Editor (HonorarEditor, FaktorenEditor, ...;
 *  Tasks 15/16) entgegennimmt. */
export interface BereichsEditorProps {
  readonly einstellungen: VerwendeEinstellungenErgebnis;
  /** Fehlt auf der firmenweiten Seite; dort gilt `'firma'` als Vorgabe. */
  readonly ebene?: Bearbeitungsebene | undefined;
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

export type SpeicherErgebnis =
  | { readonly ok: true; readonly pruefsumme: string | undefined }
  | { readonly ok: false; readonly befunde: readonly EinstellungsBefund[] };

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
  // Netzausfall (rufeApi wirft nie, liefert dann status 0) und Serverfehler (500, dessen
  // Rumpf keine `befunde`-Form traegt — Route antwortet dort mit `{ fehler: { text } }`)
  // landen gemeinsam hier: Es gibt keinen Feldanker, dem sich «der Server ist nicht
  // erreichbar» sinnvoll zuordnen liesse (I-24), also genau EIN unanhaengiger Befund.
  return {
    ok: false,
    befunde: [{ pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' }],
  };
}

interface SpeicherBeobachter {
  readonly aufSpeichertWechsel: (speichert: boolean) => void;
  readonly aufErgebnis: (ergebnis: SpeicherErgebnis) => void;
}

/**
 * Reine Zustandsmaschine ohne React (testbar ohne Hook-Testbibliothek — gleiches
 * Vorgehen wie `baueSpeicherwarteschlange` in `verwende-projekt.ts`), die Speicher-
 * versuche gegen ueberholte Antworten absichert.
 *
 * `vermerkeAenderung` (Bearbeitung ODER Verwerfen) und `starte` (ein Speicherversuch)
 * zaehlen eine gemeinsame Generation hoch. Trifft eine Antwort ein, deren Generation
 * nicht mehr die aktuelle ist, wurde inzwischen weiterbearbeitet oder erneut
 * gespeichert — sie wird verworfen, statt einen neueren, noch gar nicht gesendeten
 * Entwurf mit einem Erfolg zu ueberschreiben, der ihm nicht zusteht.
 *
 * `speichert` wird NUR von der jeweils zuletzt GESENDETEN Anfrage zurueckgesetzt
 * (`laufendeGeneration`, getrennt von der allgemeinen Generation): Ein blosses
 * `vermerkeAenderung()` nach dem Absenden darf `speichert` weiterhin auf false ziehen
 * (nichts ist mehr unterwegs), ein ZWEITER `starte()`-Aufruf davor jedoch nicht — sonst
 * risse die spaet eintreffende erste Antwort den Ladezustand herunter, waehrend die
 * zweite Anfrage noch laeuft.
 */
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

/**
 * Strukturvergleich statt Referenzvergleich (Abweichung vom urspruenglichen Plan,
 * Ruecksprache Auftraggeber): `aendere` liefert bei jedem Ruecksetzen auf den
 * Ausgangswert eine NEUE Referenz, obwohl der Baum inhaltlich unveraendert ist. `entwurf`
 * ist exakt die JSON-Form, die auch an `POST /api/einstellungen` geht — ein
 * `JSON.stringify`-Vergleich ist deshalb sowohl ausreichend als auch ehrlich, und die
 * Firmenweite-Wirkung-Schranke («Speichern» nur bei echter Aenderung aktiv) bleibt damit
 * belastbar statt nur kosmetisch erfuellt.
 */
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

  // Entsteht genau einmal und schliesst damit ueber den ERSTEN Rendervorgang (gleicher
  // Ref-Umweg wie `verwendeProjekt`).
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
    // Ein neuer Bearbeitungsschritt entwertet die letzte Rueckmeldung (Erfolg oder
    // Befunde) — sie galt einem Entwurf, der jetzt ueberholt ist.
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
