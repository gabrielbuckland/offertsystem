'use client';

/**
 * Client-Klammer der Detailseite (Design-Spec §4): Kopf mit Adresse, darunter die
 * Bloecke Basisinformationen, Referenzobjekte, Zu-/Abschlaege, Einheitentabelle (mit dem
 * Nacherfassen-Block direkt darunter) und darunter Verkaufssumme/Aufwandfaktoren/
 * Honorarrange mit der Offert-Schaltflaeche.
 *
 * `EinheitenGenerator` stand frueher als eigener, vorgelagerter Block VOR den
 * Zu-/Abschlaegen (die einzige Art, Einheiten anzulegen). Seit der Anlegen-Dialog in
 * `Referenzobjekte.tsx` die Anzahl Wohnungen eines NEUEN Typs gleich mit abfragt,
 * braucht es diesen ersten Schritt nicht mehr separat — `EinheitenGenerator` bleibt nur
 * noch fuer das Nacherfassen weiterer Wohnungen eines BESTEHENDEN Typs und sitzt deshalb
 * jetzt direkt unter der Einheitentabelle, deren Bestand er ergaenzt (Rueckmeldung
 * Auftraggeber).
 *
 * `ProjektBasisinformationen` haelt das Baujahr EINMAL fuers ganze Projekt (Rueckmeldung
 * Auftraggeber: bei einem Neubauprojekt hat jede Wohnung dasselbe Baujahr) — eine
 * Aenderung dort schreibt den Wert hier in JEDES Referenzobjekt
 * (`parametrisierung.baujahr`), statt dass ihn jemand zehnmal einzeln eintraegt.
 *
 * Der Projektstand lebt genau einmal (`verwendeProjekt`) — jeder Block aendert nur
 * seinen Ausschnitt und ruft dafuer `aendere` mit dem VOLLEN Projekt auf, damit die
 * Persistenz an einer einzigen Stelle (PUT) bleibt.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { OffertKonfiguration, UeberschreibungsProtokoll } from '@offert/core';
import type { AggregateValues, PriceDerivation } from '@offert/offer/src/model/offer.js';
import type { Projekt } from '../../server/projekt-schema.js';
import type { Faktorformular } from '../../server/faktorformular.js';
import { verwendeProjekt } from './verwende-projekt.js';
import { verwendeBerechnung } from './verwende-berechnung.js';
import { nurRechenirrelevanteFelderGeaendert } from './projekt-rechenrelevanz.js';
import { ProjektBasisinformationen } from './ProjektBasisinformationen.js';
import { Referenzobjekte } from './Referenzobjekte.js';
import { EinheitenGenerator } from './EinheitenGenerator.js';
import { AnpassungsSpalten } from './AnpassungsSpalten.js';
import { EinheitenTabelle } from './EinheitenTabelle.js';
import { OffertTextSchritt } from './OffertTextSchritt.js';
import { entferneSpaltenwert } from './spaltenwerte-kaskade.js';
import { uebernehmeVorgabewert } from './vorgabewert-uebernahme.js';
import { Aufwandfaktoren } from './Aufwandfaktoren.js';
import { Aggregatleiste } from './Aggregatleiste.js';
import { Hinweis, type HinweisArt } from '../ui/hinweis.js';
import { StatusZeile } from '../ui/status-zeile.js';
import { rufeApi } from '../rufe-api.js';
import { RechenwegDialog } from '../pipeline/RechenwegDialog.js';
import { bauePipelineDaten } from '../pipeline/pipeline-daten.js';

export interface ProjektAnsichtProps {
  readonly projekt: Projekt;
  readonly faktorformular: Faktorformular;
  /** Basis der Pipeline-Stufen im Rechenweg-Dialog (Task 7) — dieselbe Konfiguration,
   *  gegen die auch die Berechnung serverseitig laeuft. */
  readonly konfigurationBasis: OffertKonfiguration;
  /**
   * Das Ueberschreibungsprotokoll der EFFEKTIVEN Konfiguration. Der Rechenweg weist
   * daraus je Zeile aus, ob der Wert firmenweit gilt oder projektbezogen uebersteuert
   * ist — der Beleg fuer die Nachvollziehbarkeitsforderung A-13. Fehlt die Liste, meldet
   * der Dialog jede uebersteuerte Groesse als «firmenweit» und sagt bei aktivem Delta
   * systematisch die Unwahrheit; optional bleibt sie nur fuer den Fall ohne Delta.
   */
  readonly ueberschreibungen?: readonly UeberschreibungsProtokoll[] | undefined;
}

interface BewertungsAntwort {
  readonly projekt?: Projekt;
  readonly vollstaendig?: boolean;
  readonly fehlgeschlagenerTyp?: string;
  readonly fehler?: { readonly text: string };
}

interface OfferteAntwort {
  readonly offertId?: string;
  readonly fehler?: { readonly text: string };
}

/** Unterscheidet den Teilerfolg («Bewertung fehlt fuer einen Typ», Task 6) von einem
 *  echten Fehlschlag des Abrufs — nur Ersteres ist eine Warnung, kein Fehler. */
interface AbrufMeldung {
  readonly text: string;
  readonly art: HinweisArt;
}

export function ProjektAnsicht(
  { projekt: anfang, faktorformular, konfigurationBasis, ueberschreibungen }: ProjektAnsichtProps,
) {
  const router = useRouter();
  const [abrufMeldung, setAbrufMeldung] = useState<AbrufMeldung | undefined>(undefined);
  const [abrufLaeuft, setAbrufLaeuft] = useState(false);
  const [offerteLaeuft, setOfferteLaeuft] = useState(false);
  const [offerteFehler, setOfferteFehler] = useState<string | undefined>(undefined);
  const [rechenwegOffen, setRechenwegOffen] = useState(false);

  async function rufeAb() {
    setAbrufMeldung(undefined);
    setAbrufLaeuft(true);
    // Das Fangnetz fuer Netz-/Antwortfehler liegt jetzt in `rufeApi` (rufe-api.ts).
    const { ok, rumpf } = await rufeApi<BewertungsAntwort>(
      `/api/projekt/${projekt.id}/bewertung`, { method: 'POST' });
    setAbrufLaeuft(false);
    if (!ok || rumpf.projekt === undefined) {
      setAbrufMeldung({
        text: rumpf.fehler?.text ?? 'Die Bewertungen konnten nicht bezogen werden.',
        art: 'fehler',
      });
      return;
    }
    aendere(rumpf.projekt);
    // `vollstaendig`/`fehlgeschlagenerTyp` unterscheiden einen Teilerfolg vom
    // vollstaendigen Abruf (Task 6) — ohne diese Meldung saehe der Vermarkter nur
    // aktualisierte Zeilen und hielte den Abruf faelschlich fuer vollstaendig.
    if (!rumpf.vollstaendig) {
      setAbrufMeldung({
        text: `Für den Referenzobjekttyp ${rumpf.fehlgeschlagenerTyp ?? '—'} liegt keine `
          + 'Bewertung vor. Die übrigen Bewertungen wurden übernommen.',
        art: 'warnung',
      });
    }
  }

  const { stand, stelleEin } = verwendeBerechnung();

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
   *
   * I-1: Nicht JEDER erfolgreiche Speichervorgang loest die Berechnung aus — nur einer,
   * der mindestens ein rechenrelevantes Feld aendert (`nurRechenirrelevanteFelderGeaendert`,
   * projekt-rechenrelevanz.ts). `letzterStand` haelt dafuer den zuletzt GESPEICHERTEN
   * Stand fest (nicht den zuletzt BERECHNETEN) — reine Text-/Auftraggeber-Aenderungen im
   * Offerttext-Editor speichern weiterhin, loesen aber keinen Bewertungsabruf mehr aus.
   */
  const letzterStand = useRef<Projekt>(anfang);
  const { projekt, aendere, speichernLaeuft, speichernFehler } = verwendeProjekt(
    anfang,
    (gespeichert) => {
      const nurTextGeaendert = nurRechenirrelevanteFelderGeaendert(letzterStand.current, gespeichert);
      letzterStand.current = gespeichert;
      if (nurTextGeaendert) return;
      stelleEin(gespeichert);
    },
  );

  // Einmalig beim Betreten der Seite: Der geladene Stand liegt bereits auf der Platte, es
  // gibt also kein Speichern, an das sich diese erste Berechnung haengen koennte.
  useEffect(() => {
    letzterStand.current = anfang;
    stelleEin(anfang);
  }, [anfang, stelleEin]);

  async function erzeugeOfferte() {
    setOfferteFehler(undefined);
    setOfferteLaeuft(true);
    // Das Fangnetz fuer Netz-/Antwortfehler liegt jetzt in `rufeApi` (rufe-api.ts).
    const { ok, rumpf } = await rufeApi<OfferteAntwort>(
      `/api/projekt/${projekt.id}/offerte`, { method: 'POST' });
    setOfferteLaeuft(false);
    if (!ok || rumpf.offertId === undefined) {
      setOfferteFehler(rumpf.fehler?.text ?? 'Die Offerte konnte nicht erzeugt werden.');
      return;
    }
    router.push(`/offerte/${rumpf.offertId}` as Route);
  }

  // `stand.herleitung` traegt in `verwende-berechnung.ts` bewusst `unknown` (keine
  // React-/Node-Importe dort noetig) — hier, wo sie tatsaechlich verwendet wird, auf die
  // Offert-Modelltypen geschaerft (type-only Import, keine Laufzeitabhaengigkeit).
  const herleitung = stand.herleitung as
    { readonly derivation: PriceDerivation; readonly aggregates: AggregateValues } | undefined;
  const aufwandindikator = herleitung?.aggregates.effortIndicator.value;

  // Der abgeleitete (nicht uebersteuerte) D-Wert ist die Summe der Faktorbeitraege —
  // dieselben Spuren, die auch der Rechenweg zeigt. Ohne Uebersteuerung ist er mit
  // `effortIndicator` identisch; mit Uebersteuerung traegt `effortIndicator` den
  // gesetzten Wert, waehrend die Beitraege die Ableitung ausweisen (stufe4-gewichtung.ts).
  const aufwandindikatorAbgeleitet = herleitung === undefined
    ? undefined
    : herleitung.aggregates.effortFactors.reduce((s, f) => s + f.beitrag, 0);

  // E-04: Bei einem Honorarabbruch traegt `stand` selbst weder Verkaufssumme noch
  // Herleitung (verwende-berechnung.ts, OHNE_AGGREGATE) — nur die Honorarrange fehlt,
  // Wohnungspreise und Aufwandindikator D bleiben gueltig und muessen sichtbar bleiben.
  // Der Abbruch-Rumpf fuehrt beide Werte eigens mit, deshalb hier als Anzeige-Fallback.
  // Rein darstellend: `honorarMin`/`honorarMax` bleiben undefiniert, `vollstaendig` in
  // der Aggregatleiste haengt daran und sperrt die Offert-Schaltflaeche unveraendert.
  const verkaufssummeAnzeige = stand.honorarAbbruch?.verkaufssumme ?? stand.verkaufssumme;
  const aufwandindikatorAnzeige = stand.honorarAbbruch?.aufwandindikator ?? aufwandindikator;

  return (
    <main>
      {/* Die Brotkrume liegt seit Task 8 (Fix-Runde 1) auf Seitenebene
          (`projekte/[id]/page.tsx`), nicht hier: Sie ist Navigationskontext und gehoert
          zur Route, die diese Client-Komponente einbettet, nicht zum Inhalt selbst. */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {projekt.adresse.strasse} {projekt.adresse.hausnummer}, {projekt.adresse.plz}{' '}
          {projekt.adresse.ort}
        </h1>
        {speichernLaeuft && <StatusZeile text="Speichert…" />}
        {speichernFehler !== undefined && (
          <Hinweis art="fehler" className="mt-1">{speichernFehler}</Hinweis>
        )}
      </header>
      {abrufMeldung !== undefined && (
        <Hinweis art={abrufMeldung.art} className="mb-4">{abrufMeldung.text}</Hinweis>
      )}
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <ProjektBasisinformationen
          baujahr={projekt.baujahr}
          aendere={(baujahr) => aendere({
            ...projekt,
            baujahr,
            referenzobjekte: projekt.referenzobjekte.map((r) => ({
              ...r, parametrisierung: { ...r.parametrisierung, baujahr },
            })),
          })}
          auftraggeber={projekt.auftraggeber}
          aendereAuftraggeber={(w) => aendere({ ...projekt, auftraggeber: w })}
          aufwandindikator={projekt.aufwandindikatorUebersteuerung}
          aufwandindikatorVorschlag={aufwandindikatorAbgeleitet}
          aendereAufwandindikator={(w) => {
            // Bedingter Spread statt `undefined`-Zuweisung: `exactOptionalPropertyTypes`,
            // und das Schema soll den Schluessel gar nicht erst tragen (Anwesenheit
            // entscheidet, projekt-schema.ts).
            const { aufwandindikatorUebersteuerung: _entfernt, ...rest } = projekt;
            aendere(w === undefined ? rest : { ...rest, aufwandindikatorUebersteuerung: w });
          }}
        />
      </section>
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <Referenzobjekte
          referenzobjekte={projekt.referenzobjekte}
          einheiten={projekt.einheiten}
          spalten={projekt.anpassungsSpalten}
          dossierDefaults={konfigurationBasis.dossierDefaults}
          baujahr={projekt.baujahr}
          aendere={(referenzobjekte, einheiten) => aendere({
            ...projekt, referenzobjekte: [...referenzobjekte], einheiten: [...einheiten],
          })}
          rufeAb={() => { if (!abrufLaeuft) void rufeAb(); }}
          abrufLaeuft={abrufLaeuft}
        />
      </section>
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <AnpassungsSpalten
          spalten={projekt.anpassungsSpalten}
          merkmale={projekt.merkmale}
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
          uebernehmeAufEinheiten={(spalteId) => {
            const spalte = projekt.anpassungsSpalten.find((s) => s.id === spalteId);
            if (spalte === undefined) return;
            aendere({
              ...projekt,
              einheiten: [...uebernehmeVorgabewert(projekt.einheiten, spalte)],
            });
          }}
        />
      </section>
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <EinheitenTabelle
          einheiten={projekt.einheiten}
          spalten={projekt.anpassungsSpalten}
          merkmale={projekt.merkmale}
          referenzobjekte={projekt.referenzobjekte}
          preise={stand.preise}
          aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
        />
        {/* Direkt unter der Tabelle, deren Bestand er ergaenzt — Schaltflaeche mit
            Dialog statt eines eigenen Blocks (Rueckmeldung Auftraggeber). */}
        <EinheitenGenerator
          referenzobjekte={projekt.referenzobjekte}
          einheiten={projekt.einheiten}
          spalten={projekt.anpassungsSpalten}
          aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
        />
      </section>
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <OffertTextSchritt
          projekt={projekt}
          aendere={aendere}
        />
      </section>
      {stand.fehler !== undefined && (
        <Hinweis art="fehler" className="mt-4">{stand.fehler}</Hinweis>
      )}
      {/* Nur solange die Konfiguration MANUELLE Faktoren fuehrt — mit den aktuellen
          Firmen-Defaults (nur Lagescore + abgeleitete Groessen) entfaellt der Block;
          D steht dafuer in den Basisinformationen (Rueckmeldung Auftraggeber
          2026-08-28). Der bedingte Block bleibt, damit eine Konfiguration mit
          manuellen Faktoren nicht in FAKTOR_FEHLT laufen kann, ohne dass es eine
          Erfassungsstelle gaebe. */}
      {faktorformular.felder.length > 0 && (
        <section className="mb-6 rounded-lg border border-border bg-card p-6">
          <Aufwandfaktoren
            formular={faktorformular}
            werte={projekt.aufwandfaktoren}
            aendere={(werte) => aendere({ ...projekt, aufwandfaktoren: { ...werte } })}
          />
        </section>
      )}
      {offerteFehler !== undefined && (
        <Hinweis art="fehler" className="mt-4">{offerteFehler}</Hinweis>
      )}
      {/* Seitenfuellender Dialog statt eines eingebetteten Blocks: Die fuenf Stufen mit
          Formeln brauchen die volle Hoehe (RechenwegDialog.tsx). */}
      <RechenwegDialog
        offen={rechenwegOffen}
        schliesse={() => setRechenwegOffen(false)}
        stufen={bauePipelineDaten(konfigurationBasis, {
          ...(herleitung === undefined ? {} : { herleitung }),
          // Ohne diese Liste faerbt `bauePipelineDaten` jede Zeile «firmenweit» ein
          // (pipeline-daten.ts, `istProjektbezogen`) — auch die uebersteuerten.
          ...(ueberschreibungen === undefined ? {} : { ueberschreibungen }),
          aufwandindikatorUebersteuert: projekt.aufwandindikatorUebersteuerung !== undefined,
        })}
      />
      <Aggregatleiste
        verkaufssumme={verkaufssummeAnzeige}
        honorarMin={stand.honorarMin}
        honorarMax={stand.honorarMax}
        aufwandindikator={aufwandindikatorAnzeige}
        aufwandindikatorUebersteuert={projekt.aufwandindikatorUebersteuerung !== undefined}
        erzeuge={() => { if (!offerteLaeuft) void erzeugeOfferte(); }}
        laeuft={offerteLaeuft}
        speichernLaeuft={speichernLaeuft}
        berechnungLaeuft={stand.laeuft}
        zeigeRechenweg={() => setRechenwegOffen(true)}
        {...(stand.honorarAbbruch === undefined
          ? {}
          : { honorarAbbruchMeldung: stand.honorarAbbruch.meldung })}
      />
    </main>
  );
}
