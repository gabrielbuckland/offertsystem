'use client';

/**
 * Client-Klammer der Detailseite: Kopf, Basisinformationen, Referenzobjekte,
 * Zu-/Abschlaege, Einheitentabelle, Offerttext, Aufwandfaktoren, Aggregatleiste.
 * Der Projektstand lebt einmal (`verwendeProjekt`); jeder Block ruft `aendere` mit
 * dem vollen Projekt auf, damit die Persistenz (PUT) an einer Stelle bleibt.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { OffertKonfiguration, UeberschreibungsProtokoll } from '@offert/core';
import type { AggregateValues, PriceDerivation } from '@offert/offer';
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
import { HonorarEingabeDialog } from '../ui/honorar-eingabe-dialog.js';
import { StatusZeile } from '../ui/status-zeile.js';
import { rufeApi } from '../rufe-api.js';
import { RechenwegDialog } from '../pipeline/RechenwegDialog.js';
import { bauePipelineDaten } from '../pipeline/pipeline-daten.js';

export interface ProjektAnsichtProps {
  readonly projekt: Projekt;
  readonly faktorformular: Faktorformular;
  /** Basis der Pipeline-Stufen im Rechenweg-Dialog — dieselbe Konfiguration, gegen die
   *  auch die Berechnung serverseitig laeuft. */
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

/** Teilerfolg (Bewertung fehlt fuer einen Typ) ist eine Warnung, kein Fehler. */
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
  // Honorareingabe VOR dem Erzeugen (Spec 2026-08-29): Die Offerte nennt dem Eigentuemer
  // einen einzigen Betrag, nie die Range — der Klick auf «Offerte generieren» oeffnet
  // deshalb erst dieses Modal, statt sofort zu erzeugen.
  const [honorarModalOffen, setHonorarModalOffen] = useState(false);

  async function rufeAb() {
    setAbrufMeldung(undefined);
    setAbrufLaeuft(true);
    // Fehlerbehandlung fuer Netz-/Antwortfehler liegt in `rufeApi`.
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
    // Ohne diese Meldung saehe der Vermarkter nur aktualisierte Zeilen und hielte
    // den Teilerfolg (ein Typ ohne Bewertung) faelschlich fuer vollstaendig.
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
   * Berechnung haengt am Erfolg des Speicherns, nicht an einem eigenen Zeitgeber auf
   * `[projekt]`: ein paralleler Timer liefe gegen das gleichzeitige PUT und rechnete
   * gegen einen halbfertigen Stand (sichtbar als uebersprungener Preis bzw. Offerte,
   * die etwas anderes ausweist als der Bildschirm zeigte).
   *
   * I-1: Nur ein Speichern, das ein rechenrelevantes Feld aendert
   * (`nurRechenirrelevanteFelderGeaendert`), loest die Berechnung aus. `letzterStand`
   * haelt den zuletzt GESPEICHERTEN (nicht berechneten) Stand fest.
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

  // Initialer Abruf beim Mount: kein Speichern-Event, an das sich die erste
  // Berechnung haengen koennte.
  useEffect(() => {
    letzterStand.current = anfang;
    stelleEin(anfang);
  }, [anfang, stelleEin]);

  async function erzeugeOfferte(gewaehltesHonorar: number) {
    setOfferteFehler(undefined);
    setOfferteLaeuft(true);
    // Fehlerbehandlung fuer Netz-/Antwortfehler liegt in `rufeApi`.
    const { ok, rumpf } = await rufeApi<OfferteAntwort>(
      `/api/projekt/${projekt.id}/offerte`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gewaehltesHonorar }),
      },
    );
    setOfferteLaeuft(false);
    if (!ok || rumpf.offertId === undefined) {
      setOfferteFehler(rumpf.fehler?.text ?? 'Die Offerte konnte nicht erzeugt werden.');
      return;
    }
    router.push(`/offerte/${rumpf.offertId}` as Route);
  }

  // `stand.herleitung` traegt in verwende-berechnung.ts bewusst `unknown` (keine
  // React-/Node-Importe dort); hier auf die tatsaechlichen Offert-Modelltypen geschaerft.
  const herleitung = stand.herleitung as
    { readonly derivation: PriceDerivation; readonly aggregates: AggregateValues } | undefined;
  const aufwandindikator = herleitung?.aggregates.effortIndicator.value;

  // Abgeleiteter (nicht uebersteuerter) D-Wert = Summe der Faktorbeitraege. Bei
  // Uebersteuerung traegt `effortIndicator` den gesetzten Wert, die Beitraege bleiben
  // die Ableitung.
  const aufwandindikatorAbgeleitet = herleitung === undefined
    ? undefined
    : herleitung.aggregates.effortFactors.reduce((s, f) => s + f.beitrag, 0);

  // E-04: Bei Honorarabbruch fehlt in `stand` Verkaufssumme/Herleitung
  // (OHNE_AGGREGATE); der Abbruch-Rumpf fuehrt beide Werte separat, deshalb hier
  // als Anzeige-Fallback.
  const verkaufssummeAnzeige = stand.honorarAbbruch?.verkaufssumme ?? stand.verkaufssumme;
  const aufwandindikatorAnzeige = stand.honorarAbbruch?.aufwandindikator ?? aufwandindikator;

  return (
    <main>
      {/* Brotkrume liegt auf Seitenebene (page.tsx), nicht hier. */}
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
            // Bedingter Spread statt `undefined`-Zuweisung: exactOptionalPropertyTypes,
            // Schluessel soll bei undefined gar nicht existieren (Anwesenheit entscheidet).
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
            // Entfernte Spalte darf ihren Wert nicht in spaltenwerte ueberleben, sonst
            // lebte er bei einer wiederverwendeten Spalten-ID unbeabsichtigt wieder auf.
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
        {/* Nacherfassen weiterer Wohnungen eines bestehenden Typs. */}
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
      {/* Nur solange die Konfiguration manuelle Faktoren fuehrt; verhindert
          FAKTOR_FEHLT ohne Erfassungsstelle. */}
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
      {/* Eigener Dialog statt eingebetteter Block: die fuenf Stufen brauchen die volle Hoehe. */}
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
        erzeuge={() => { if (!offerteLaeuft) setHonorarModalOffen(true); }}
        laeuft={offerteLaeuft}
        speichernLaeuft={speichernLaeuft}
        berechnungLaeuft={stand.laeuft}
        zeigeRechenweg={() => setRechenwegOffen(true)}
        {...(stand.honorarAbbruch === undefined
          ? {}
          : { honorarAbbruchMeldung: stand.honorarAbbruch.meldung })}
      />
      {/* Nur montiert, wenn Min/Max vorliegen: `Aggregatleiste` sperrt den auslösenden
          Knopf ohne vollstaendiges Ergebnis (`gesperrtWeil`), das Modal setzt das voraus. */}
      {stand.honorarMin !== undefined && stand.honorarMax !== undefined && (
        <HonorarEingabeDialog
          offen={honorarModalOffen}
          honorarMin={stand.honorarMin}
          honorarMax={stand.honorarMax}
          verkaufssumme={verkaufssummeAnzeige}
          schliesse={() => setHonorarModalOffen(false)}
          bestaetige={(gewaehltesHonorar) => {
            setHonorarModalOffen(false);
            void erzeugeOfferte(gewaehltesHonorar);
          }}
        />
      )}
    </main>
  );
}
