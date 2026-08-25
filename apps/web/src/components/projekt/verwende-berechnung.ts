'use client';

/**
 * Berechnungsablauf der Detailseite, aus `ProjektAnsicht.tsx` herausgezogen (Spec §3):
 * Der Zustand ist damit an einer Stelle nachvollziehbar, statt ueber drei Absaetze in der
 * Klammerkomponente verstreut.
 *
 * `verarbeiteBerechnungsAntwort` ist bewusst als reine Funktion von `verwendeBerechnung`
 * getrennt: Das Repo fuehrt kein jsdom und keine Hook-Testbibliothek (`environment: 'node'`
 * in vitest.workspace.ts), die Entscheidungslogik laesst sich so ohne DOM mit Literalen
 * pruefen — analog zu `antwort-rumpf.ts`/`zellen-logik.ts`.
 */
import { useCallback, useRef, useState } from 'react';
import type { Projekt } from '../../server/projekt-schema.js';
import { rufeApi, type ApiErgebnis } from '../rufe-api.js';
import { baueSpeicherwarteschlange, type Speicherwarteschlange } from './verwende-projekt.js';
import type { Preis } from './EinheitenTabelle.js';

/**
 * Antwortform von `POST /api/projekt/[id]/berechnung` (Task 5, `server/projekt-lauf.ts`).
 * `herleitung` traegt dieselbe Herleitung wie das Offert-Artefakt (`derivation`/
 * `aggregates`) durch — die Oberflaeche baut daraus kein zweites, eigenes Datenbild.
 * `unvollstaendig` und `honorarAbbruch` kommen beide mit Status 200: Ersteres bedeutet
 * fehlende Referenzobjekte/Einheiten (I-24, kein Fehler), Letzteres eine Verkaufssumme
 * ausserhalb der konfigurierten Staffel (E-04) — Wohnungspreise und Aufwandindikator
 * bleiben dabei gueltig, nur die Honorarrange fehlt.
 */
export interface BerechnungsAntwort {
  readonly einheiten?: readonly {
    readonly id: string;
    readonly wohnungsnummer: string;
    readonly basispreis: number;
    readonly preis: number;
  }[];
  readonly verkaufssumme?: number;
  readonly honorarMin?: number;
  readonly honorarMax?: number;
  readonly herleitung?: { readonly derivation: unknown; readonly aggregates: unknown };
  readonly unvollstaendig?: boolean;
  readonly honorarAbbruch?: {
    readonly verkaufssumme: number;
    readonly aufwandindikator: number;
    readonly positionen: readonly { readonly wohnungsnummer: string; readonly preis: number }[];
    readonly meldung: string;
  };
  /** Fehlerform variiert je Ursache in der Route (Stufenfehler vs. blosser Text); fuer
   *  die Anzeige zaehlt ausschliesslich `text` (siehe `LaufFehler` in `projekt-lauf.ts`). */
  readonly fehler?: { readonly text: string };
}

export interface BerechnungsStand {
  readonly preise: Readonly<Record<string, Preis>>;
  readonly verkaufssumme: number | undefined;
  readonly honorarMin: number | undefined;
  readonly honorarMax: number | undefined;
  readonly herleitung?: { readonly derivation: unknown; readonly aggregates: unknown };
  readonly honorarAbbruch?: BerechnungsAntwort['honorarAbbruch'];
  readonly laeuft: boolean;
  readonly fehler: string | undefined;
}

// `herleitung`/`honorarAbbruch` sind optionale Felder (`exactOptionalPropertyTypes`):
// „nicht vorhanden“ heisst hier, den Schluessel wegzulassen, nicht `undefined`
// zuzuweisen.
const OHNE_AGGREGATE: Omit<BerechnungsStand, 'laeuft'> = {
  preise: {},
  verkaufssumme: undefined,
  honorarMin: undefined,
  honorarMax: undefined,
  fehler: undefined,
};

/**
 * Reine Verarbeitung des Antwortrumpfs, ohne Netzwerk und ohne React-Zustand. Vier
 * Faelle: Erfolg (Preise/Aggregate/Herleitung), `unvollstaendig` (I-24, kein Fehler),
 * `honorarAbbruch` (E-04, kein Fehler) und eine fehlgeschlagene Antwort.
 *
 * `einheiten` ist der Projektstand, gegen den die Antwort gelesen wird: Der Erfolgsfall
 * bringt die Einheitenkennung selbst mit, das E-04-Teilergebnis nur die Wohnungsnummer —
 * die Zuordnung Nummer -> Kennung kann deshalb allein der Client leisten.
 */
export function verarbeiteBerechnungsAntwort(
  antwort: ApiErgebnis<BerechnungsAntwort>,
  einheiten: readonly { readonly id: string; readonly wohnungsnummer: string }[],
): { readonly stand: Omit<BerechnungsStand, 'laeuft'>; readonly ok: boolean } {
  const { ok, rumpf } = antwort;

  if (!ok) {
    return {
      ok: false,
      stand: {
        ...OHNE_AGGREGATE,
        fehler: rumpf.fehler?.text ?? 'Die Berechnung ist fehlgeschlagen.',
      },
    };
  }

  if (rumpf.unvollstaendig === true) {
    // Kein Fehler (I-24): dem Projekt fehlen noch Referenzobjekte oder Einheiten.
    return { ok: true, stand: OHNE_AGGREGATE };
  }

  if (rumpf.honorarAbbruch !== undefined) {
    // E-04: Kein Eingabefehler. Wohnungspreise und D bleiben gueltig, nur die Honorarrange
    // fehlt — die Preise MUESSEN deshalb sichtbar bleiben (Spec §5). Die Route fuehrt sie
    // in `honorarAbbruch.positionen`, dort aber nach Wohnungsnummer statt nach
    // Einheitenkennung (das Offert-Schema kennt nur die Nummer). Den Bezug zur Kennung,
    // auf die die Tabelle zugreift, stellt allein der Client her — er haelt die Einheiten.
    // `basispreis` bleibt weg: Das Teilergebnis fuehrt keinen, und ein erfundener waere
    // eine Zahl ohne Herleitung; diese eine Spalte zeigt «—».
    const nachNummer = new Map(einheiten.map((e) => [e.wohnungsnummer, e.id]));
    const teilpreise: Record<string, Preis> = {};
    for (const position of rumpf.honorarAbbruch.positionen) {
      const id = nachNummer.get(position.wohnungsnummer);
      if (id !== undefined) teilpreise[id] = { preis: position.preis };
    }
    return {
      ok: true,
      stand: { ...OHNE_AGGREGATE, preise: teilpreise, honorarAbbruch: rumpf.honorarAbbruch },
    };
  }

  const preise: Record<string, Preis> = {};
  for (const e of rumpf.einheiten ?? []) {
    preise[e.id] = { basispreis: e.basispreis, preis: e.preis };
  }
  return {
    ok: true,
    stand: {
      preise,
      verkaufssumme: rumpf.verkaufssumme,
      honorarMin: rumpf.honorarMin,
      honorarMax: rumpf.honorarMax,
      fehler: undefined,
      // Nur gesetzt, wenn vorhanden — sonst wuerde `exactOptionalPropertyTypes` eine
      // explizite `undefined`-Zuweisung auf dem optionalen Feld verlangen.
      ...(rumpf.herleitung !== undefined ? { herleitung: rumpf.herleitung } : {}),
    },
  };
}

/**
 * Haelt den Berechnungsstand und stellt ihn ueber dieselbe Speicherwarteschlange wie in
 * `verwende-projekt.ts` sicher: hoechstens ein Versuch gleichzeitig unterwegs, waehrend
 * eines Versuchs eintreffende Stände werden zusammengefasst und nur der NEUESTE gesendet.
 *
 * Eigene Warteschlange statt der Speicher-Warteschlange aus `verwendeProjekt`: dieselbe
 * Ueberschneidungs-Gefahr besteht hier ein zweites Mal — eine langsame aeltere
 * Berechnungsantwort darf eine schnellere neuere nicht ueberschreiben. Die Loesung ist
 * identisch (`baueSpeicherwarteschlange`), aber ein eigener Zustand: Speichern und
 * Berechnen sind unabhaengige Netzwerkvorgaenge mit unabhaengigem Erfolg/Fehlschlag.
 */
export function verwendeBerechnung(): {
  readonly stand: BerechnungsStand;
  readonly stelleEin: (projekt: Projekt) => void;
} {
  const [stand, setStand] = useState<BerechnungsStand>({ ...OHNE_AGGREGATE, laeuft: false });

  const warteschlange = useRef<Speicherwarteschlange | undefined>(undefined);
  if (warteschlange.current === undefined) {
    warteschlange.current = baueSpeicherwarteschlange(
      async (p: Projekt) => {
        const antwort = await rufeApi<BerechnungsAntwort>(
          `/api/projekt/${p.id}/berechnung`, { method: 'POST' });
        const { stand: neu, ok } = verarbeiteBerechnungsAntwort(antwort, p.einheiten);
        setStand((vorher) => ({ ...neu, laeuft: vorher.laeuft }));
        return ok;
      },
      {
        // `laeuft` haengt Task 9 an die Offert-Schaltflaeche (waehrend einer laufenden
        // Berechnung darf keine Offerte auf einem noch nicht aktuellen Stand entstehen).
        aufStatusWechsel: (laeuft) => setStand((vorher) => ({ ...vorher, laeuft })),
        aufFehler: () => undefined,
      },
    );
  }

  const stelleEin = useCallback((projekt: Projekt) => {
    warteschlange.current?.stelleEin(projekt);
  }, []);

  return { stand, stelleEin };
}
