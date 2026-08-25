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
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { OffertKonfiguration } from '@offert/core';
import type { AggregateValues, PriceDerivation } from '@offert/offer/src/model/offer.js';
import type { Projekt } from '../../server/projekt-schema.js';
import type { Faktorformular } from '../../server/faktorformular.js';
import { verwendeProjekt } from './verwende-projekt.js';
import { verwendeBerechnung } from './verwende-berechnung.js';
import { Referenzobjekte } from './Referenzobjekte.js';
import { EinheitenGenerator } from './EinheitenGenerator.js';
import { AnpassungsSpalten } from './AnpassungsSpalten.js';
import { EinheitenTabelle } from './EinheitenTabelle.js';
import { entferneSpaltenwert } from './spaltenwerte-kaskade.js';
import { uebernehmeVorgabewert } from './vorgabewert-uebernahme.js';
import { Aufwandfaktoren } from './Aufwandfaktoren.js';
import { Aggregatleiste } from './Aggregatleiste.js';
import { Brotkrume } from '../shell/Brotkrume.js';
import { Hinweis, type HinweisArt } from '../ui/hinweis.js';
import { StatusZeile } from '../ui/status-zeile.js';
import { rufeApi } from '../rufe-api.js';
import { PipelineAnsicht } from '../pipeline/PipelineAnsicht.js';
import { bauePipelineDaten } from '../pipeline/pipeline-daten.js';

export interface ProjektAnsichtProps {
  readonly projekt: Projekt;
  readonly faktorformular: Faktorformular;
  /** Basis der Pipeline-Stufen im Rechenweg-Block (Task 7) — dieselbe Konfiguration,
   *  gegen die auch die Berechnung serverseitig laeuft. */
  readonly konfigurationBasis: OffertKonfiguration;
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
  { projekt: anfang, faktorformular, konfigurationBasis }: ProjektAnsichtProps,
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
   */
  const { projekt, aendere, speichernLaeuft, speichernFehler } = verwendeProjekt(
    anfang,
    (gespeichert) => { stelleEin(gespeichert); },
  );

  // Einmalig beim Betreten der Seite: Der geladene Stand liegt bereits auf der Platte, es
  // gibt also kein Speichern, an das sich diese erste Berechnung haengen koennte.
  useEffect(() => {
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
      <Brotkrume stufen={[
        { beschriftung: 'Projekte', href: '/projekte' },
        { beschriftung: `${projekt.adresse.strasse} ${projekt.adresse.hausnummer}, `
          + `${projekt.adresse.plz} ${projekt.adresse.ort}` },
      ]} />
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
        <Referenzobjekte
          referenzobjekte={projekt.referenzobjekte}
          einheiten={projekt.einheiten}
          dossierDefaults={konfigurationBasis.dossierDefaults}
          aendere={(referenzobjekte) => aendere({ ...projekt, referenzobjekte: [...referenzobjekte] })}
          rufeAb={() => { if (!abrufLaeuft) void rufeAb(); }}
          abrufLaeuft={abrufLaeuft}
        />
      </section>
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <EinheitenGenerator
          referenzobjekte={projekt.referenzobjekte}
          einheiten={projekt.einheiten}
          spalten={projekt.anpassungsSpalten}
          aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
        />
      </section>
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
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
          referenzobjekte={projekt.referenzobjekte}
          preise={stand.preise}
          aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
        />
      </section>
      {stand.fehler !== undefined && (
        <Hinweis art="fehler" className="mt-4">{stand.fehler}</Hinweis>
      )}
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <Aufwandfaktoren
          formular={faktorformular}
          werte={projekt.aufwandfaktoren}
          aendere={(werte) => aendere({ ...projekt, aufwandfaktoren: { ...werte } })}
        />
      </section>
      {offerteFehler !== undefined && (
        <Hinweis art="fehler" className="mt-4">{offerteFehler}</Hinweis>
      )}
      {rechenwegOffen && (
        <section className="mb-6 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">Rechenweg</h2>
          <PipelineAnsicht modus="projekt"
            stufen={bauePipelineDaten(konfigurationBasis, {
              ...(herleitung === undefined ? {} : { herleitung }),
            })} />
        </section>
      )}
      <Aggregatleiste
        verkaufssumme={verkaufssummeAnzeige}
        honorarMin={stand.honorarMin}
        honorarMax={stand.honorarMax}
        aufwandindikator={aufwandindikatorAnzeige}
        erzeuge={() => { if (!offerteLaeuft) void erzeugeOfferte(); }}
        laeuft={offerteLaeuft}
        speichernLaeuft={speichernLaeuft}
        berechnungLaeuft={stand.laeuft}
        rechenwegOffen={rechenwegOffen}
        schalteRechenweg={() => setRechenwegOffen((offen) => !offen)}
        {...(stand.honorarAbbruch === undefined
          ? {}
          : { honorarAbbruchMeldung: stand.honorarAbbruch.meldung })}
      />
    </main>
  );
}
