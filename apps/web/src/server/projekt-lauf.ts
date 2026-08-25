/**
 * Der EINE zweistufige Rechenweg vom Projekt zur Offerte (PE-21): bisher stand er
 * woertlich in zwei Routen. Er baut die Offerte IMMER — persistiert wird sie nur von
 * der Offert-Route. Damit traegt die Berechnungsantwort dieselbe Herleitung wie das
 * Artefakt (`derivation`/`aggregates`), statt eines zweiten, eigens aufbereiteten
 * Datenbilds (Spec §4, Begruendung wie Ergebnisseite §5.4.3 im Bericht).
 *
 * Zweistufig, weil in Franken erfasste Zu-/Abschlaege den ungerundeten Basispreis
 * brauchen (PE-21) und dieser erst aus einem Lauf OHNE Anpassungen hervorgeht. Ein
 * einstufiger Weg setzte zwei Darstellungsformen im Kern voraus — das schliesst E-09 aus.
 *
 * `erzeugeLaufmetadaten` laeuft auch fuer reine Berechnungen: Eine ungenutzte
 * Offert-Kennung ist billig; ein zweiter, metadatenloser Bauweg der Offerte waere die
 * teurere Abweichungsquelle.
 */
import {
  berechne,
  berechneAufwandindikator,
  berechneVerkaufssumme,
  bereiteEingabeAuf,
  ergaenzeAbgeleiteteFaktoren,
  normalisiereFaktoren,
  serialisiereEingang,
  type StufenFehler,
} from '@offert/core';
// Modulpfad statt Paketindex: Der Index re-exportiert auch die React-Komponenten
// (.tsx). Node leistet fuer JSX kein Type-Stripping (PE-09), und dieser Pfad wird
// von `tools/beispiel-offerte.ts` unter Node ausgefuehrt. Es bleibt ein Paketimport.
import { baueOfferte } from '@offert/offer/src/model/baue-offerte.js';
import type { Offer } from '@offert/offer/src/model/offer.js';
import { beschaffe, zuEingangsArgumenten } from './eingang.js';
import { uebersetzeStufenFehler, type AngezeigterFehler } from './fehlertexte.js';
import { erzeugeLaufmetadaten } from './laufmetadaten.js';
import type { Laufzeit } from './laufzeit.js';
import { ladeProjekt } from './projekt-ablage.js';
import { projiziere } from './projektion.js';

/**
 * Anzeigefertiger Fehler, in genau der Form, in der ihn die Routen schon immer
 * ausgegeben haben. Zwei Auspraegungen, weil es zwei Quellen gibt: Stufenfehler des
 * Kerns kommen aus `uebersetzeStufenFehler` als vollstaendiger `AngezeigterFehler` —
 * `adressat` unterscheidet Vermarkter- von Auftraggeberfehlern und traegt
 * `HonorarAbbruch.tsx`s `data-adressat`, `feldpfad` verankert die Meldung am Feld.
 * Lade-, Projektions- und Beschaffungsfehler fuehren dagegen seit jeher nur einen Text.
 * Ein erzwungener `adressat` fuer diese haette der Antwort ein Feld hinzugefuegt, das sie
 * nie hatte; die Union gibt beide Formen unveraendert weiter.
 */
export type LaufFehler = AngezeigterFehler | { readonly text: string };

/** Teilergebnis nach E-04: Wohnungspreise und D bleiben gueltig, nur das Honorar fehlt. */
export interface HonorarTeilergebnis {
  readonly verkaufssumme: number;
  readonly aufwandindikator: number;
  readonly positionen: readonly { readonly wohnungsnummer: string; readonly preis: number }[];
}

export type ProjektLaufErgebnis =
  | { readonly art: 'offerte'; readonly offerte: Offer;
      /** Wohnungsnummer -> Einheitenkennung; das Offert-Schema fuehrt nur die Nummer. */
      readonly einheitenIds: ReadonlyMap<string, string> }
  | { readonly art: 'unvollstaendig' }
  /**
   * Eigene Variante statt eines `fehler` mit fertigem Text: Die Folge einer fehlenden
   * Referenzbewertung ist je Route eine andere («keine Preise» / «keine Offerte»), und
   * diese Wortwahl gehoert zur Antwort der Route, nicht zum Rechenweg (I-24).
   */
  | { readonly art: 'bewertungLuecke' }
  | { readonly art: 'honorarAbbruch';
      readonly teilergebnis: HonorarTeilergebnis;
      readonly fehler: StufenFehler }
  | { readonly art: 'fehler'; readonly status: 404 | 422 | 502;
      readonly fehler: LaufFehler };

export async function fuehreProjektlauf(
  id: string, laufzeit: Laufzeit,
): Promise<ProjektLaufErgebnis> {
  const { konfiguration, fingerabdruck, provider, projekteVerzeichnis } = laufzeit;

  const projekt = await ladeProjekt(id, projekteVerzeichnis).catch(() => null);
  if (projekt === null) {
    return { art: 'fehler', status: 404, fehler: { text: `Projekt ${id} nicht gefunden.` } };
  }
  if (projekt.referenzobjekte.length === 0 || projekt.einheiten.length === 0) {
    return { art: 'unvollstaendig' };
  }

  // Erster Lauf ohne Anpassungen: liefert die Basispreise fuer die Umrechnung. Die
  // Option ist noetig, nicht nur beabsichtigt — ohne sie versuchte `projiziere` schon
  // hier, in Franken erfasste Positionen ueber die (noch leeren) Basispreise
  // umzurechnen, und schluege fehl, bevor der Lauf sie ermitteln konnte.
  const ohne = projiziere(projekt, {}, { ohneAnpassungen: true });
  if (!ohne.ok) return { art: 'fehler', status: 422, fehler: { text: ohne.meldung } };

  const beschafft = await beschaffe(ohne.wert, provider);
  if (!beschafft.ok) return { art: 'fehler', status: 502, fehler: { text: beschafft.meldung } };
  if (!beschafft.wert.buendel.vollstaendig) return { art: 'bewertungLuecke' };

  // PE-04, E-29: Zeit entsteht hier. Nebenwirkung, bewusst in Kauf genommen: Auch eine
  // reine Berechnung verbraucht eine Referenznummer aus der prozessweiten Folge
  // `A-<Jahr>-<NNN>` (`laufmetadaten.ts`), die Nummern der abgelegten Offerten haben also
  // Luecken. Heute liest die Nummer niemand; wird sie einmal als lueckenlos erwartet
  // (OFFEN-05-1 ist beim Auftraggeber offen), muss sie erst beim Ablegen gezogen werden.
  const meta = erzeugeLaufmetadaten(fingerabdruck);
  const basisEingang = zuEingangsArgumenten(
    ohne.wert, beschafft.wert, konfiguration, meta.erstelltAm, { ohneAnpassungen: true });
  if (!basisEingang.ok) {
    return { art: 'fehler', status: 422, fehler: { text: basisEingang.meldung } };
  }

  const basisLauf = berechne(basisEingang.wert);
  if (!basisLauf.ok) {
    return { art: 'fehler', status: 422, fehler: uebersetzeStufenFehler(basisLauf.fehler) };
  }

  const basispreise: Record<string, number> = {};
  for (const position of basisLauf.wert.verkaufssumme.positionen) {
    const einheit = projekt.einheiten.find((e) => e.wohnungsnummer === position.wohnungsnummer);
    if (einheit !== undefined) basispreise[einheit.id] = position.basispreis;
  }

  // Zweiter Lauf, jetzt mit umgerechneten Anpassungen.
  const voll = projiziere(projekt, basispreise);
  if (!voll.ok) return { art: 'fehler', status: 422, fehler: { text: voll.meldung } };

  const eingang = zuEingangsArgumenten(voll.wert, beschafft.wert, konfiguration, meta.erstelltAm);
  if (!eingang.ok) return { art: 'fehler', status: 422, fehler: { text: eingang.meldung } };

  const ergebnis = berechne(eingang.wert);
  if (!ergebnis.ok) {
    if (ergebnis.fehler.stufe === 5 && ergebnis.fehler.code === 'VERKAUFSSUMME_AUSSERHALB') {
      // E-04: Ausserhalb des konfigurierten Staffelbereichs — ober- ODER unterhalb, der
      // Kern unterscheidet beides ueber `richtung` — gibt es keine Honorarzahl, aber ein
      // Teilergebnis.
      //
      // Der Code wird mitgeprueft, nicht nur die Stufe: Stufe 5 meldet zusaetzlich
      // `STUFE_ENTARTET` (zwei Stuetzstellen mit gleichem V). Das ist ein
      // Konfigurationsdefekt ohne gueltige Staffel, kein Teilergebnis — er gehoert in
      // den regulaeren 422-Zweig, so wie vor der Zusammenlegung.
      //
      // `berechne` bleibt die einzige Kettendefinition; fuer das Teilergebnis werden
      // die Stufen 1–4 einzeln nachgefahren (NFA-03 exportiert sie genau dafuer) —
      // deterministisch, also dasselbe Zwischenergebnis.
      const s1 = bereiteEingabeAuf(eingang.wert);
      if (s1.ok) {
        const s2 = berechneVerkaufssumme(s1.wert);
        if (s2.ok) {
          const geschlossen = ergaenzeAbgeleiteteFaktoren(s1.wert, s2.wert);
          if (geschlossen.ok) {
            const s3 = normalisiereFaktoren(geschlossen.wert);
            if (s3.ok) {
              const s4 = berechneAufwandindikator(s3.wert, eingang.wert.konfiguration);
              if (s4.ok) {
                return {
                  art: 'honorarAbbruch',
                  fehler: ergebnis.fehler,
                  teilergebnis: {
                    verkaufssumme: s2.wert.verkaufssumme,
                    aufwandindikator: s4.wert.aufwandindikator,
                    positionen: s2.wert.positionen.map((p) => ({
                      wohnungsnummer: p.wohnungsnummer, preis: p.preis,
                    })),
                  },
                };
              }
            }
          }
        }
      }
    }
    return { art: 'fehler', status: 422, fehler: uebersetzeStufenFehler(ergebnis.fehler) };
  }

  const offerte = baueOfferte({
    ergebnis: ergebnis.wert,
    liegenschaft: eingang.wert.liegenschaft,
    projekt: voll.wert.projekt,
    meta: {
      offertId: meta.offertId,
      erstelltAm: meta.erstelltAm,
      konfigVersion: meta.konfigVersion,
      konfigPruefsumme: meta.konfigPruefsumme,
      // PE-08: der serialisierte EINGANG, nicht die Formulardaten
      berechnungsEingabe: serialisiereEingang(eingang.wert) as Record<string, unknown>,
    },
  });
  return {
    art: 'offerte',
    offerte,
    einheitenIds: new Map(projekt.einheiten.map((e) => [e.wohnungsnummer, e.id])),
  };
}
