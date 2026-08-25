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
import type { Projekt } from '../../server/projekt-schema.js';
import type { Faktorformular } from '../../server/faktorformular.js';
import { verwendeProjekt } from './verwende-projekt.js';
import { verwendeBerechnung } from './verwende-berechnung.js';
import { Referenzobjekte } from './Referenzobjekte.js';
import { EinheitenGenerator } from './EinheitenGenerator.js';
import { AnpassungsSpalten } from './AnpassungsSpalten.js';
import { EinheitenTabelle } from './EinheitenTabelle.js';
import { entferneSpaltenwert } from './spaltenwerte-kaskade.js';
import { Aufwandfaktoren } from './Aufwandfaktoren.js';
import { Aggregatleiste } from './Aggregatleiste.js';
import { Brotkrume } from '../shell/Brotkrume.js';
import { Hinweis, type HinweisArt } from '../ui/hinweis.js';
import { StatusZeile } from '../ui/status-zeile.js';
import { rufeApi } from '../rufe-api.js';

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
  { projekt: anfang, faktorformular }: ProjektAnsichtProps,
) {
  const router = useRouter();
  const [abrufMeldung, setAbrufMeldung] = useState<AbrufMeldung | undefined>(undefined);
  const [abrufLaeuft, setAbrufLaeuft] = useState(false);
  const [offerteLaeuft, setOfferteLaeuft] = useState(false);
  const [offerteFehler, setOfferteFehler] = useState<string | undefined>(undefined);

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
        preise={stand.preise}
        aendere={(einheiten) => aendere({ ...projekt, einheiten: [...einheiten] })}
      />
      {stand.fehler !== undefined && (
        <Hinweis art="fehler" className="mt-4">{stand.fehler}</Hinweis>
      )}
      <Aufwandfaktoren
        formular={faktorformular}
        werte={projekt.aufwandfaktoren}
        aendere={(werte) => aendere({ ...projekt, aufwandfaktoren: { ...werte } })}
      />
      {offerteFehler !== undefined && (
        <Hinweis art="fehler" className="mt-4">{offerteFehler}</Hinweis>
      )}
      <Aggregatleiste
        verkaufssumme={stand.verkaufssumme}
        honorarMin={stand.honorarMin}
        honorarMax={stand.honorarMax}
        erzeuge={() => { if (!offerteLaeuft) void erzeugeOfferte(); }}
        laeuft={offerteLaeuft}
      />
    </main>
  );
}
