/**
 * Keine eigene Formel; Umkehrung von eq:wohnungspreis nach dem Faktor.
 *
 * Spec 03 §1.4 und PE-21: Absolut erfasste Zu-/Abschlaege werden BEI DER ERFASSUNG in
 * Faktoren umgerechnet, nicht im Kern. Der Kern bleibt bei genau einer Darstellungsform
 * (Faktor); `erfassterBetrag` und `erfassungsform` bleiben rein dokumentarisch und gehen
 * in keine Formel ein. Zwei Darstellungsformen im Kern haetten eine zweite Rundungsstelle
 * und eine zweite Grenzpruefung nach sich gezogen (E-09, I-06).
 *
 * Bezugsgroesse ist der UNGERUNDETE Basispreis aus Stufe 2 — nicht der gerundete
 * Wohnungspreis, der die Anpassungen bereits enthaelt.
 */
import { bereiteEingabeAuf, berechneVerkaufssumme, type Konfiguration } from '@offert/core';
import { formatiereAggregat } from '@offert/offer';
import { zuEingangsArgumenten, type Beschafft } from './eingang.js';
import type { Erfassung } from './erfassung-schema.js';
import { uebersetzeStufenFehler } from './fehlertexte.js';

export type Umrechnung =
  | { readonly ok: true; readonly wert: number }
  | { readonly ok: false; readonly meldung: string };

export function rechneBetragInFaktor(betrag: number, basispreis: number): Umrechnung {
  if (!Number.isFinite(basispreis) || basispreis <= 0) {
    return {
      ok: false,
      meldung: 'Der Basispreis der Einheit liegt noch nicht vor. Der Bewertungsabruf ist '
        + 'zuerst durchzufuehren; erst danach ist ein absoluter Betrag umrechenbar.',
    };
  }
  const faktor = betrag / basispreis;
  if (faktor <= -1) {
    return {
      ok: false,
      meldung: 'Der Abschlag erreicht oder uebersteigt den Basispreis der Einheit '
        + `(${formatiereAggregat(basispreis)}). Zulaessig sind Abschlaege echt kleiner als `
        + 'der Basispreis.',
    };
  }
  return { ok: true, wert: faktor };
}

export type Basispreise =
  | { readonly ok: true; readonly wert: ReadonlyMap<string, number> }
  | { readonly ok: false; readonly meldung: string };

/**
 * Der Basispreis entsteht in Stufe 2 des Kerns. Die Erfassungsschicht ruft die Stufe
 * einzeln auf (NFA-03: jede Stufe ist einzeln exportiert) — mit LEEREN Anpassungen, weil
 * der Basispreis gerade die Groesse VOR den Anpassungen ist. Eine eigene Multiplikation
 * in apps/web waere eine zweite Fassung von eq:qm_preis und eq:flaeche und damit genau
 * die Doppelfuehrung, die I-23 ausschliesst.
 */
export function basispreiseFuerErfassung(
  erfassung: Erfassung,
  beschafft: Beschafft,
  konfiguration: Konfiguration,
  zeitstempel: string,
): Basispreise {
  const eingang = zuEingangsArgumenten(
    erfassung, beschafft, konfiguration, zeitstempel, { ohneAnpassungen: true });
  if (!eingang.ok) return { ok: false, meldung: eingang.meldung };
  const stufe1 = bereiteEingabeAuf(eingang.wert);
  if (!stufe1.ok) return { ok: false, meldung: uebersetzeStufenFehler(stufe1.fehler).text };
  const stufe2 = berechneVerkaufssumme(stufe1.wert);
  if (!stufe2.ok) return { ok: false, meldung: uebersetzeStufenFehler(stufe2.fehler).text };
  return {
    ok: true,
    wert: new Map(stufe2.wert.positionen.map((p) => [p.wohnungsnummer as string, p.basispreis])),
  };
}
