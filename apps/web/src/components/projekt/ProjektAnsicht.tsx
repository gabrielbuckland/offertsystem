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
import { entferneSpaltenwert } from './spaltenwerte-kaskade.js';
import { Aufwandfaktoren } from './Aufwandfaktoren.js';
import { Aggregatleiste } from './Aggregatleiste.js';
import { leseRumpf } from './antwort-rumpf.js';

export interface ProjektAnsichtProps {
  readonly projekt: Projekt;
  readonly faktorformular: Faktorformular;
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

export function ProjektAnsicht(
  { projekt: anfang, faktorformular }: ProjektAnsichtProps,
) {
  const router = useRouter();
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
      const rumpf = await leseRumpf<BewertungsAntwort>(antwort);
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
    } catch {
      // Ohne diesen Fang blieb die Schaltflaeche wirkungslos: Wirft die Route einen
      // unbehandelten Fehler, antwortet Next mit HTML, `antwort.json()` scheitert, und die
      // abgelehnte Zusage entkommt aus `void rufeAb()` — sichtbar nur in der Konsole.
      setAbrufMeldung('Die Bewertungen konnten nicht bezogen werden.');
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
          const rumpf = await leseRumpf<BerechnungsAntwort>(antwort);
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

  /**
   * Die Berechnung haengt am ERFOLG des Speicherns, sie laeuft nicht daneben her.
   *
   * `POST /berechnung` liest das Projekt von der Platte (`ladeProjekt`). Ein eigener
   * Zeitgeber auf `[projekt]` startete parallel zum Speicher-Zeitgeber und rechnete
   * deshalb gegen den Stand, den das gleichzeitige PUT gerade erst schrieb oder noch
   * nicht geschrieben hatte. Sichtbar wurde das als Preis, der die letzte Aenderung
   * ueberspringt und erst bei der uebernaechsten nachzieht — und, schwerer, als Offerte,
   * die etwas anderes ausweist als der Bildschirm zeigte. Eine laengere Entprellung
   * haette das Fenster nur verkleinert, nicht geschlossen.
   */
  const { projekt, aendere, speichernLaeuft, speichernFehler } = verwendeProjekt(
    anfang,
    (gespeichert) => { berechnungsWarteschlange.current?.stelleEin(gespeichert); },
  );

  // Einmalig beim Betreten der Seite: Der geladene Stand liegt bereits auf der Platte, es
  // gibt also kein Speichern, an das sich diese erste Berechnung haengen koennte.
  useEffect(() => {
    berechnungsWarteschlange.current?.stelleEin(anfang);
  }, [anfang]);

  async function erzeugeOfferte() {
    setOfferteFehler(undefined);
    setOfferteLaeuft(true);
    try {
      const antwort = await fetch(`/api/projekt/${projekt.id}/offerte`, { method: 'POST' });
      const rumpf = await leseRumpf<OfferteAntwort>(antwort);
      if (!antwort.ok || rumpf.offertId === undefined) {
        setOfferteFehler(rumpf.fehler?.text ?? 'Die Offerte konnte nicht erzeugt werden.');
        return;
      }
      router.push(`/offerte/${rumpf.offertId}` as Route);
    } catch {
      setOfferteFehler('Die Offerte konnte nicht erzeugt werden.');
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
        einheiten={projekt.einheiten}
        aendere={(referenzobjekte) => aendere({ ...projekt, referenzobjekte: [...referenzobjekte] })}
        rufeAb={() => { if (!abrufLaeuft) void rufeAb(); }}
      />
      <EinheitenGenerator
        referenzobjekte={projekt.referenzobjekte}
        einheiten={projekt.einheiten}
        spalten={projekt.anpassungsSpalten}
        aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
      />
      <AnpassungsSpalten
        spalten={projekt.anpassungsSpalten}
        aendere={(spalten) => aendere({ ...projekt, anpassungsSpalten: [...spalten] })}
        entferneSpalte={(id) => aendere({
          ...projekt,
          anpassungsSpalten: projekt.anpassungsSpalten.filter((s) => s.id !== id),
          // Kaskade ausgelagert und direkt getestet (`spaltenwerte-kaskade.test.ts`):
          // eine entfernte Spalte darf ihren Wert nicht in `spaltenwerte` ueberleben,
          // sonst lebte er bei einer spaeter wiederverwendeten Spalten-ID
          // unbeabsichtigt wieder auf (Kommentar in AnpassungsSpalten.tsx).
          einheiten: [...entferneSpaltenwert(projekt.einheiten, id)],
        })}
      />
      <EinheitenTabelle
        einheiten={projekt.einheiten}
        spalten={projekt.anpassungsSpalten}
        referenzobjekte={projekt.referenzobjekte}
        preise={aggregate.preise}
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
