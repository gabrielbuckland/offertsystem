'use client';

import { useCallback, useRef, useState } from 'react';
import type { Projekt } from '../../server/projekt-schema.js';
import { rufeApi, type ApiErgebnis } from '../rufe-api.js';
import { baueSpeicherwarteschlange, type Speicherwarteschlange } from './verwende-projekt.js';
import type { Preis } from './EinheitenTabelle.js';

// I-24: unvollstaendig, E-04: honorarAbbruch — beide kommen mit Status 200, kein Fehler.
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

// exactOptionalPropertyTypes: „nicht vorhanden“ heisst Schluessel weglassen, nicht undefined zuweisen.
const OHNE_AGGREGATE: Omit<BerechnungsStand, 'laeuft'> = {
  preise: {},
  verkaufssumme: undefined,
  honorarMin: undefined,
  honorarMax: undefined,
  fehler: undefined,
};

// einheiten liefert die Zuordnung Wohnungsnummer -> Kennung, die das E-04-Teilergebnis
// selbst nicht mitbringt.
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
    // I-24: kein Fehler, dem Projekt fehlen noch Referenzobjekte oder Einheiten.
    return { ok: true, stand: OHNE_AGGREGATE };
  }

  if (rumpf.honorarAbbruch !== undefined) {
    // E-04: Route fuehrt Positionen nach Wohnungsnummer (Offert-Schema kennt nur die
    // Nummer); basispreis bleibt weg, da das Teilergebnis keinen fuehrt (Spalte zeigt «—»).
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
      ...(rumpf.herleitung !== undefined ? { herleitung: rumpf.herleitung } : {}),
    },
  };
}

// Eigene Speicherwarteschlange: hoechstens ein Versuch gleichzeitig, eine langsame
// aeltere Antwort darf eine schnellere neuere nicht ueberschreiben.
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
