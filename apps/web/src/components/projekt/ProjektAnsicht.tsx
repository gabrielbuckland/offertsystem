'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { OffertKonfiguration, UeberschreibungsProtokoll } from '@offert/core';
import type { AggregateValues, PriceDerivation } from '@offert/offer';
import type { Projekt } from '../../server/projekt-schema.js';
import type { Faktorformular } from '../../server/faktorformular.js';
import type { Anpassungsvorlage } from '../../server/anpassungsvorlagen.js';
import { abrufWarnungstext } from './bewertungsabruf-logik.js';
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
  readonly konfigurationBasis: OffertKonfiguration;
  // A-13: Ueberschreibungsprotokoll der EFFEKTIVEN Konfiguration, Beleg fuer die
  // Nachvollziehbarkeit im Rechenweg-Dialog. Fehlt die Liste, meldet der Dialog jede
  // uebersteuerte Groesse faelschlich als "firmenweit".
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

interface AbrufMeldung {
  readonly text: string;
  readonly art: HinweisArt;
}

// OffertKonfiguration['anpassungsVorlagen'] (Zod-Inferenz) und Anpassungsvorlage (Kern-
// Domaentyp) sind strukturell gleich, aber unter exactOptionalPropertyTypes nicht
// zuweisungskompatibel — daher fehlt das Feld statt auf undefined gesetzt zu werden.
function zuAnpassungsvorlagen(
  vorlagen: OffertKonfiguration['anpassungsVorlagen'],
): readonly Anpassungsvorlage[] {
  return vorlagen.map((v) => ({
    id: v.id,
    bezeichnung: v.bezeichnung,
    vorgabefaktor: v.vorgabefaktor,
    erfassungsform: v.erfassungsform,
    begruendungVorschlag: v.begruendungVorschlag,
    ...(v.regel === undefined ? {} : {
      regel: {
        merkmal: v.regel.merkmal,
        bereiche: v.regel.bereiche.map((b) => (
          b.unter === undefined ? { wert: b.wert } : { wert: b.wert, unter: b.unter }
        )),
      },
    }),
  }));
}

export function ProjektAnsicht(
  { projekt: anfang, faktorformular, konfigurationBasis, ueberschreibungen }: ProjektAnsichtProps,
) {
  const router = useRouter();
  const [abrufMeldung, setAbrufMeldung] = useState<AbrufMeldung | undefined>(undefined);
  const [abrufLaufend, setAbrufLaufend] = useState<string | undefined>(undefined);
  const [offerteLaeuft, setOfferteLaeuft] = useState(false);
  const [offerteFehler, setOfferteFehler] = useState<string | undefined>(undefined);
  const [rechenwegOffen, setRechenwegOffen] = useState(false);
  // Honorareingabe VOR dem Erzeugen: die Offerte nennt dem Eigentuemer einen einzigen
  // Betrag, nie die Range.
  const [honorarModalOffen, setHonorarModalOffen] = useState(false);

  async function rufeAb(referenzobjektId: string) {
    setAbrufMeldung(undefined);
    setAbrufLaufend(referenzobjektId);
    const { ok, rumpf } = await rufeApi<BewertungsAntwort>(
      `/api/projekt/${projekt.id}/bewertung`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenzobjektId }),
      },
    );
    setAbrufLaufend(undefined);
    if (!ok || rumpf.projekt === undefined) {
      setAbrufMeldung({
        text: rumpf.fehler?.text ?? 'Die Bewertungen konnten nicht bezogen werden.',
        art: 'fehler',
      });
      return;
    }
    aendere(rumpf.projekt);
    // Ohne diese Meldung haelt der Vermarkter den Teilerfolg faelschlich fuer vollstaendig.
    if (!rumpf.vollstaendig) {
      setAbrufMeldung({
        text: abrufWarnungstext(rumpf.fehlgeschlagenerTyp, rumpf.projekt.referenzobjekte),
        art: 'warnung',
      });
    }
  }

  const { stand, stelleEin } = verwendeBerechnung();

  // Berechnung haengt am Erfolg des Speicherns, nicht an einem eigenen Zeitgeber auf
  // [projekt]: ein paralleler Timer liefe gegen das gleichzeitige PUT und rechnete gegen
  // einen halbfertigen Stand. I-1: nur ein Speichern, das ein rechenrelevantes Feld
  // aendert, loest die Berechnung aus; letzterStand haelt den zuletzt GESPEICHERTEN
  // (nicht berechneten) Stand fest.
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

  // Initialer Abruf beim Mount: kein Speichern-Event, an das sich die erste Berechnung
  // haengen koennte.
  useEffect(() => {
    letzterStand.current = anfang;
    stelleEin(anfang);
  }, [anfang, stelleEin]);

  async function erzeugeOfferte(gewaehltesHonorar: number) {
    setOfferteFehler(undefined);
    setOfferteLaeuft(true);
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

  // stand.herleitung traegt in verwende-berechnung.ts bewusst unknown (keine React-/Node-
  // Importe dort); hier auf die tatsaechlichen Offert-Modelltypen geschaerft.
  const herleitung = stand.herleitung as
    { readonly derivation: PriceDerivation; readonly aggregates: AggregateValues } | undefined;
  const aufwandindikator = herleitung?.aggregates.effortIndicator.value;

  // Abgeleiteter (nicht uebersteuerter) D-Wert = Summe der Faktorbeitraege.
  const aufwandindikatorAbgeleitet = herleitung === undefined
    ? undefined
    : herleitung.aggregates.effortFactors.reduce((s, f) => s + f.beitrag, 0);

  // E-04: bei Honorarabbruch fehlt in stand Verkaufssumme/Herleitung; der Abbruch-Rumpf
  // fuehrt beide Werte separat, deshalb hier als Anzeige-Fallback.
  const verkaufssummeAnzeige = stand.honorarAbbruch?.verkaufssumme ?? stand.verkaufssumme;
  const aufwandindikatorAnzeige = stand.honorarAbbruch?.aufwandindikator ?? aufwandindikator;

  return (
    <main>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {projekt.adresse.strasse} {projekt.adresse.hausnummer}, {projekt.adresse.plz}{' '}
          {projekt.adresse.ort}
        </h1>
        {/* Fester Platzhalter: verhindert Layout-Shift bei jedem Autosave. */}
        <div className="h-5">
          {speichernLaeuft && <StatusZeile text="Speichert…" />}
        </div>
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
            // exactOptionalPropertyTypes: Schluessel soll bei undefined gar nicht existieren.
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
          rufeAb={(referenzobjektId) => {
            if (abrufLaufend === undefined) void rufeAb(referenzobjektId);
          }}
          abrufLaufend={abrufLaufend}
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
          vorlagen={zuAnpassungsvorlagen(konfigurationBasis.anpassungsVorlagen)}
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
      {/* Nur solange die Konfiguration manuelle Faktoren fuehrt; verhindert FAKTOR_FEHLT
          ohne Erfassungsstelle. */}
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
      <RechenwegDialog
        offen={rechenwegOffen}
        schliesse={() => setRechenwegOffen(false)}
        stufen={bauePipelineDaten(konfigurationBasis, {
          ...(herleitung === undefined ? {} : { herleitung }),
          // Ohne diese Liste faerbt bauePipelineDaten jede Zeile "firmenweit" ein — auch
          // die uebersteuerten.
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
