'use client';

/**
 * Client-Klammer der Detailseite (Design-Spec §4): Kopf mit Adresse, darunter die
 * Bloecke Referenzobjekte, Einheiten anlegen, Zu-/Abschlaege, Einheitentabelle und
 * darunter Verkaufssumme/Aufwandfaktoren/Honorarrange mit der Offert-Schaltflaeche.
 *
 * Der Projektstand lebt genau einmal (`verwendeProjekt`) — jeder Block aendert nur
 * seinen Ausschnitt und ruft dafuer `aendere` mit dem VOLLEN Projekt auf, damit die
 * Persistenz an einer einzigen Stelle (PUT) bleibt.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { Projekt } from '../../server/projekt-schema.js';
import type { Faktorformular } from '../../server/faktorformular.js';
import { baueSpeicherwarteschlange, verwendeProjekt, type Speicherwarteschlange } from './verwende-projekt.js';
import { Referenzobjekte } from './Referenzobjekte.js';
import { EinheitenGenerator } from './EinheitenGenerator.js';
import { AnpassungsSpalten } from './AnpassungsSpalten.js';
import { EinheitenTabelle, type Preis } from './EinheitenTabelle.js';
import { Aufwandfaktoren } from './Aufwandfaktoren.js';
import { Aggregatleiste } from './Aggregatleiste.js';

export interface ProjektAnsichtProps {
  readonly projekt: Projekt;
  readonly faktorformular: Faktorformular;
  readonly begruendungMinLaenge: number;
}

interface BewertungsAntwort {
  readonly projekt?: Projekt;
  readonly vollstaendig?: boolean;
  readonly fehlgeschlagenerTyp?: string;
  readonly fehler?: { readonly text: string };
}

interface BerechnungsAntwort {
  readonly einheiten?: readonly {
    readonly id: string; readonly basispreis: number; readonly preis: number;
  }[];
  readonly verkaufssumme?: number;
  readonly honorarMin?: number;
  readonly honorarMax?: number;
  readonly unvollstaendig?: boolean;
  readonly fehler?: { readonly text: string };
}

interface OfferteAntwort {
  readonly offertId?: string;
  readonly fehler?: { readonly text: string };
}

interface Aggregate {
  readonly preise: Readonly<Record<string, Preis>>;
  readonly verkaufssumme: number | undefined;
  readonly honorarMin: number | undefined;
  readonly honorarMax: number | undefined;
}

const OHNE_AGGREGATE: Aggregate = {
  preise: {}, verkaufssumme: undefined, honorarMin: undefined, honorarMax: undefined,
};

const BERECHNUNGS_ENTPRELLUNG_MS = 400;

export function ProjektAnsicht(
  { projekt: anfang, faktorformular, begruendungMinLaenge }: ProjektAnsichtProps,
) {
  const router = useRouter();
  const { projekt, aendere, speichernLaeuft, speichernFehler } = verwendeProjekt(anfang);
  const [abrufMeldung, setAbrufMeldung] = useState<string | undefined>(undefined);
  const [abrufLaeuft, setAbrufLaeuft] = useState(false);
  const [aggregate, setAggregate] = useState<Aggregate>(OHNE_AGGREGATE);
  const [berechnungsFehler, setBerechnungsFehler] = useState<string | undefined>(undefined);
  const [offerteLaeuft, setOfferteLaeuft] = useState(false);
  const [offerteFehler, setOfferteFehler] = useState<string | undefined>(undefined);

  async function rufeAb() {
    setAbrufMeldung(undefined);
    setAbrufLaeuft(true);
    try {
      const antwort = await fetch(`/api/projekt/${projekt.id}/bewertung`, { method: 'POST' });
      const rumpf = await antwort.json() as BewertungsAntwort;
      if (!antwort.ok || rumpf.projekt === undefined) {
        setAbrufMeldung(rumpf.fehler?.text ?? 'Die Bewertungen konnten nicht bezogen werden.');
        return;
      }
      aendere(rumpf.projekt);
      // `vollstaendig`/`fehlgeschlagenerTyp` unterscheiden einen Teilerfolg vom
      // vollstaendigen Abruf (Task 6) — ohne diese Meldung saehe der Vermarkter nur
      // aktualisierte Zeilen und hielte den Abruf faelschlich fuer vollstaendig.
      if (!rumpf.vollstaendig) {
        setAbrufMeldung(
          `Für den Referenzobjekttyp ${rumpf.fehlgeschlagenerTyp ?? '—'} liegt keine `
            + 'Bewertung vor. Die übrigen Bewertungen wurden übernommen.',
        );
      }
    } finally {
      setAbrufLaeuft(false);
    }
  }

  /**
   * Eigene Warteschlange statt der Speicher-Warteschlange aus `verwendeProjekt`:
   * dieselbe Ueberschneidungs-Gefahr besteht hier ein zweites Mal — eine langsame
   * aeltere Berechnungsantwort darf eine schnellere neuere nicht ueberschreiben. Die
   * Loesung ist identisch (`baueSpeicherwarteschlange`), aber ein eigener Zustand:
   * Speichern und Berechnen sind unabhaengige Netzwerkvorgaenge mit unabhaengigem
   * Erfolg/Fehlschlag.
   */
  const berechnungsWarteschlange = useRef<Speicherwarteschlange | undefined>(undefined);
  if (berechnungsWarteschlange.current === undefined) {
    berechnungsWarteschlange.current = baueSpeicherwarteschlange(
      async (p: Projekt) => {
        try {
          const antwort = await fetch(`/api/projekt/${p.id}/berechnung`, { method: 'POST' });
          const rumpf = await antwort.json() as BerechnungsAntwort;
          if (!antwort.ok) {
            setBerechnungsFehler(rumpf.fehler?.text ?? 'Die Berechnung ist fehlgeschlagen.');
            setAggregate(OHNE_AGGREGATE);
            return false;
          }
          setBerechnungsFehler(undefined);
          if (rumpf.unvollstaendig === true) {
            // Kein Fehler (I-24): dem Projekt fehlen noch Referenzobjekte oder Einheiten.
            setAggregate(OHNE_AGGREGATE);
            return true;
          }
          const preise: Record<string, Preis> = {};
          for (const e of rumpf.einheiten ?? []) {
            preise[e.id] = { basispreis: e.basispreis, preis: e.preis };
          }
          setAggregate({
            preise,
            verkaufssumme: rumpf.verkaufssumme,
            honorarMin: rumpf.honorarMin,
            honorarMax: rumpf.honorarMax,
          });
          return true;
        } catch {
          setBerechnungsFehler('Die Berechnung konnte nicht abgerufen werden.');
          setAggregate(OHNE_AGGREGATE);
          return false;
        }
      },
      { aufStatusWechsel: () => undefined, aufFehler: () => undefined },
    );
  }

  const berechnungsZeitgeber = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (berechnungsZeitgeber.current !== undefined) clearTimeout(berechnungsZeitgeber.current);
    berechnungsZeitgeber.current = setTimeout(() => {
      berechnungsWarteschlange.current?.stelleEin(projekt);
    }, BERECHNUNGS_ENTPRELLUNG_MS);
    return () => {
      if (berechnungsZeitgeber.current !== undefined) clearTimeout(berechnungsZeitgeber.current);
    };
  }, [projekt]);

  async function erzeugeOfferte() {
    setOfferteFehler(undefined);
    setOfferteLaeuft(true);
    try {
      const antwort = await fetch(`/api/projekt/${projekt.id}/offerte`, { method: 'POST' });
      const rumpf = await antwort.json() as OfferteAntwort;
      if (!antwort.ok || rumpf.offertId === undefined) {
        setOfferteFehler(rumpf.fehler?.text ?? 'Die Offerte konnte nicht erzeugt werden.');
        return;
      }
      router.push(`/offerte/${rumpf.offertId}` as Route);
    } finally {
      setOfferteLaeuft(false);
    }
  }

  return (
    <main className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {projekt.adresse.strasse} {projekt.adresse.hausnummer}, {projekt.adresse.plz}{' '}
          {projekt.adresse.ort}
        </h1>
        {speichernLaeuft && <p className="text-sm text-muted-foreground">Speichert…</p>}
        {speichernFehler !== undefined && (
          <p className="text-sm text-red-600" role="alert">{speichernFehler}</p>
        )}
      </header>
      {abrufMeldung !== undefined && (
        <p className="mb-4 text-sm text-red-600">{abrufMeldung}</p>
      )}
      <Referenzobjekte
        referenzobjekte={projekt.referenzobjekte}
        aendere={(referenzobjekte) => aendere({ ...projekt, referenzobjekte: [...referenzobjekte] })}
        rufeAb={() => { if (!abrufLaeuft) void rufeAb(); }}
      />
      <EinheitenGenerator
        referenzobjekte={projekt.referenzobjekte}
        einheiten={projekt.einheiten}
        aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
      />
      <AnpassungsSpalten
        spalten={projekt.anpassungsSpalten}
        aendere={(spalten) => aendere({ ...projekt, anpassungsSpalten: [...spalten] })}
        entferneSpalte={(id) => aendere({
          ...projekt,
          anpassungsSpalten: projekt.anpassungsSpalten.filter((s) => s.id !== id),
          // Kaskade (Kommentar in AnpassungsSpalten.tsx): eine entfernte Spalte darf
          // ihren Wert nicht in `spaltenwerte` ueberleben, sonst lebte er bei einer
          // spaeter wiederverwendeten Spalten-ID unbeabsichtigt wieder auf.
          einheiten: projekt.einheiten.map((einheit) => {
            if (!(id in einheit.spaltenwerte)) return einheit;
            const { [id]: _entfernt, ...rest } = einheit.spaltenwerte;
            return { ...einheit, spaltenwerte: rest };
          }),
        })}
      />
      <EinheitenTabelle
        einheiten={projekt.einheiten}
        spalten={projekt.anpassungsSpalten}
        referenzobjekte={projekt.referenzobjekte}
        preise={aggregate.preise}
        begruendungMinLaenge={begruendungMinLaenge}
        aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
      />
      {berechnungsFehler !== undefined && (
        <p className="mt-4 text-sm text-red-600" role="alert">{berechnungsFehler}</p>
      )}
      <Aufwandfaktoren
        formular={faktorformular}
        werte={projekt.aufwandfaktoren}
        aendere={(werte) => aendere({ ...projekt, aufwandfaktoren: { ...werte } })}
      />
      {offerteFehler !== undefined && (
        <p className="mt-4 text-sm text-red-600" role="alert">{offerteFehler}</p>
      )}
      <Aggregatleiste
        verkaufssumme={aggregate.verkaufssumme}
        honorarMin={aggregate.honorarMin}
        honorarMax={aggregate.honorarMax}
        erzeuge={() => { if (!offerteLaeuft) void erzeugeOfferte(); }}
        laeuft={offerteLaeuft}
      />
    </main>
  );
}
