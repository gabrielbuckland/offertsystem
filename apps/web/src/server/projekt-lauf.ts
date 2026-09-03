/**
 * Der EINE zweistufige Rechenweg vom Projekt zur Offerte (PE-21). Baut die Offerte,
 * persistiert sie aber nicht.
 *
 * Zweistufig, weil in Franken erfasste Zu-/Abschlaege den ungerundeten Basispreis
 * brauchen (PE-21) und dieser erst aus einem Lauf OHNE Anpassungen hervorgeht (E-09).
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
import { baueOfferte, type Offer } from '@offert/offer';
import { beschaffe, zuEingangsArgumenten } from './eingang.js';
import { uebersetzeStufenFehler, type AngezeigterFehler } from './fehlertexte.js';
import { erzeugeLaufmetadaten } from './laufmetadaten.js';
import type { Laufzeit } from './laufzeit.js';
import { ladeProjekt } from './projekt-ablage.js';
import { projiziere } from './projektion.js';

/**
 * Zwei Auspraegungen, weil es zwei Fehlerquellen gibt: Stufenfehler des Kerns kommen aus
 * `uebersetzeStufenFehler` als vollstaendiger `AngezeigterFehler` — `adressat`
 * unterscheidet Vermarkter- von Auftraggeberfehlern und steuert die Wortwahl. Lade-,
 * Projektions- und Beschaffungsfehler fuehren dagegen nur einen Text.
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
  /** Eigene Variante statt fertigem Text: Wortwahl je Route unterschiedlich (I-24). */
  | { readonly art: 'bewertungLuecke' }
  | { readonly art: 'honorarAbbruch';
      readonly teilergebnis: HonorarTeilergebnis;
      readonly fehler: StufenFehler }
  | { readonly art: 'fehler'; readonly status: 404 | 422 | 500 | 502;
      readonly fehler: LaufFehler };

/**
 * Konfigurationsluecke aus E-04: Verkaufssumme liegt ausserhalb der Staffel.
 * Code wird mitgeprueft, da Stufe 5 auch `STUFE_ENTARTET` meldet (Konfigurationsdefekt,
 * kein Teilergebnis, gehoert in den regulaeren 422-Zweig).
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
 * Faehrt die Stufen 1–4 einzeln nach (NFA-03 exportiert sie dafuer), um an die
 * Zwischenergebnisse eines Laufs zu kommen, den `berechne` erst in Stufe 5 abgebrochen hat.
 * Nur nach Fehlschlag in Stufe 5 aufrufen: dann sind 1–4 mit demselben Eingang bereits
 * erfolgreich gelaufen, ein Fehlschlag hier ist also ein Defekt, kein Eingabefehler.
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

  const s4 = berechneAufwandindikator(
    s3.wert, eingang.konfiguration, eingang.aufwandindikatorUebersteuerung);
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

  // Erster Lauf ohne Anpassungen liefert die Basispreise. Option noetig: sonst versuchte
  // `projiziere` Franken-Positionen ueber die noch leeren Basispreise umzurechnen.
  const ohne = projiziere(projekt, {}, { ohneAnpassungen: true });
  if (!ohne.ok) return { art: 'fehler', status: 422, fehler: { text: ohne.meldung } };

  const beschafft = await beschaffe(ohne.wert, provider);
  if (!beschafft.ok) return { art: 'fehler', status: 502, fehler: { text: beschafft.meldung } };
  if (!beschafft.wert.buendel.vollstaendig) return { art: 'bewertungLuecke' };

  // PE-04, E-29: Bewusste Nebenwirkung — auch eine reine Berechnung verbraucht eine
  // Referenznummer aus `A-<Jahr>-<NNN>`, abgelegte Offerten haben also Luecken.
  const meta = erzeugeLaufmetadaten(fingerabdruck);
  const basisEingang = zuEingangsArgumenten(
    ohne.wert, beschafft.wert, konfiguration, meta.erstelltAm, { ohneAnpassungen: true });
  if (!basisEingang.ok) {
    return { art: 'fehler', status: 422, fehler: { text: basisEingang.meldung } };
  }

  // Vom Basislauf wird nur `verkaufssumme.positionen[].basispreis` gebraucht, seine
  // Honorarrange nie gelesen — ein Abbruch in Stufe 5 (E-04) darf ihn deshalb nicht
  // scheitern lassen.
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
      // E-04: keine Honorarzahl ausserhalb der Staffel, aber ein Teilergebnis via
      // nachgefahrener Stufen 1–4. Scheitert das Nachfahren, ist das ein Defekt
      // (siehe `fahreStufen1bis4Nach`), nicht die Staffelluecke.
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
