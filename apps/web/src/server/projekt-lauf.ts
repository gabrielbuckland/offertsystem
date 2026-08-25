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
  type EingangsArgumente,
  type EinheitPreisPosition,
  type GewichtungErgebnis,
  type StufenFehler,
  type VerkaufssummeErgebnis,
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
  | { readonly art: 'fehler'; readonly status: 404 | 422 | 500 | 502;
      readonly fehler: LaufFehler };

/**
 * Genau die Konfigurationsluecke aus E-04: Die Verkaufssumme liegt ober- ODER unterhalb
 * der konfigurierten Staffel (der Kern unterscheidet beides ueber `richtung`).
 *
 * Der Code wird mitgeprueft, nicht nur die Stufe: Stufe 5 meldet zusaetzlich
 * `STUFE_ENTARTET` (zwei Stuetzstellen mit gleichem V). Das ist ein Konfigurationsdefekt
 * ohne gueltige Staffel, kein Teilergebnis — er gehoert in den regulaeren 422-Zweig.
 */
function istHonorarLuecke(fehler: StufenFehler): boolean {
  return fehler.stufe === 5 && fehler.code === 'VERKAUFSSUMME_AUSSERHALB';
}

type Zwischenstufen = {
  readonly verkaufssumme: VerkaufssummeErgebnis;
  readonly gewichtung: GewichtungErgebnis;
};

type NachfahrErgebnis =
  | { readonly ok: true; readonly wert: Zwischenstufen }
  /** `stufe` benennt den gescheiterten Schritt — sonst bliebe der Defekt unauffindbar. */
  | { readonly ok: false; readonly stufe: string; readonly fehler: StufenFehler };

/**
 * Faehrt die Stufen 1–4 einzeln nach (NFA-03 exportiert sie genau dafuer), um an die
 * Zwischenergebnisse eines Laufs zu kommen, den `berechne` erst in Stufe 5 abgebrochen hat.
 *
 * Zur Zulaessigkeit: Aufgerufen wird das NUR nach einem Fehlschlag in Stufe 5. `berechne`
 * bricht bei der ersten fehlgeschlagenen Stufe ab — hat es Stufe 5 erreicht, sind die
 * Stufen 1–4 mit genau diesem Eingang nachweislich schon einmal erfolgreich gelaufen. Ein
 * Fehlschlag hier ist deshalb kein Konfigurations- oder Eingabefehler, sondern ein Defekt
 * (verborgener Zustand im Kern, abweichende Argumente); er wird benannt zurueckgegeben und
 * NICHT stillschweigend in den generischen Fehlerzweig durchgereicht.
 */
function fahreStufen1bis4Nach(eingang: EingangsArgumente): NachfahrErgebnis {
  const s1 = bereiteEingabeAuf(eingang);
  if (!s1.ok) return { ok: false, stufe: '1 (Eingabe)', fehler: s1.fehler };

  const s2 = berechneVerkaufssumme(s1.wert);
  if (!s2.ok) return { ok: false, stufe: '2 (Verkaufssumme)', fehler: s2.fehler };

  const geschlossen = ergaenzeAbgeleiteteFaktoren(s1.wert, s2.wert);
  if (!geschlossen.ok) {
    return { ok: false, stufe: '2a (abgeleitete Faktoren)', fehler: geschlossen.fehler };
  }

  const s3 = normalisiereFaktoren(geschlossen.wert);
  if (!s3.ok) return { ok: false, stufe: '3 (Normalisierung)', fehler: s3.fehler };

  const s4 = berechneAufwandindikator(s3.wert, eingang.konfiguration);
  if (!s4.ok) return { ok: false, stufe: '4 (Gewichtung)', fehler: s4.fehler };

  return { ok: true, wert: { verkaufssumme: s2.wert, gewichtung: s4.wert } };
}

/** Defekt statt Fehlbedienung: 500, und die gescheiterte Stufe steht im Text. */
function alsDefekt(gescheitert: NachfahrErgebnis & { readonly ok: false }): ProjektLaufErgebnis {
  return {
    art: 'fehler',
    status: 500,
    fehler: {
      text: `Interner Fehler: Stufe ${gescheitert.stufe} liess sich nicht nachfahren `
        + `(${gescheitert.fehler.code}).`,
    },
  };
}

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

  // Vom Basislauf wird ausschliesslich `verkaufssumme.positionen[].basispreis` gebraucht;
  // seine Honorarrange wird nie gelesen. Ein Abbruch in Stufe 5 darf ihn deshalb nicht
  // scheitern lassen: Genau das brach E-04 (Honorarabbruch). Die Staffelluecke traf schon
  // hier zu, der Lauf endete mit einem generischen 422 — mit dem RICHTIGEN Meldungstext,
  // was den Defekt lange als Problem der Erkennung weiter unten erscheinen liess — und die
  // Teilergebnis-Behandlung beim zweiten Lauf wurde nie erreicht.
  const basisLauf = berechne(basisEingang.wert);
  let basisPositionen: readonly EinheitPreisPosition[];
  if (basisLauf.ok) {
    basisPositionen = basisLauf.wert.verkaufssumme.positionen;
  } else if (istHonorarLuecke(basisLauf.fehler)) {
    const nachgefahren = fahreStufen1bis4Nach(basisEingang.wert);
    if (!nachgefahren.ok) return alsDefekt(nachgefahren);
    basisPositionen = nachgefahren.wert.verkaufssumme.positionen;
  } else {
    return { art: 'fehler', status: 422, fehler: uebersetzeStufenFehler(basisLauf.fehler) };
  }

  const basispreise: Record<string, number> = {};
  for (const position of basisPositionen) {
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
    if (istHonorarLuecke(ergebnis.fehler)) {
      // E-04: Ausserhalb des konfigurierten Staffelbereichs gibt es keine Honorarzahl,
      // aber ein Teilergebnis. `berechne` bleibt die einzige Kettendefinition; die Stufen
      // 1–4 werden fuer das Teilergebnis nachgefahren.
      //
      // Kein stilles Durchfallen mehr: Scheitert das Nachfahren, ist das ein Defekt
      // (siehe `fahreStufen1bis4Nach`) und wird als solcher gemeldet — nicht als
      // Staffelluecke, denn Preise und D koennte man dann gerade NICHT ausweisen.
      const nachgefahren = fahreStufen1bis4Nach(eingang.wert);
      if (!nachgefahren.ok) return alsDefekt(nachgefahren);
      const { verkaufssumme, gewichtung } = nachgefahren.wert;
      return {
        art: 'honorarAbbruch',
        fehler: ergebnis.fehler,
        teilergebnis: {
          verkaufssumme: verkaufssumme.verkaufssumme,
          aufwandindikator: gewichtung.aufwandindikator,
          positionen: verkaufssumme.positionen.map((p) => ({
            wohnungsnummer: p.wohnungsnummer, preis: p.preis,
          })),
        },
      };
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
