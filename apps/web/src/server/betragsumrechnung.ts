// Keine Formel; Umkehrung von eq:wohnungspreis nach dem Faktor.
// PE-21: Umrechnung erfolgt bei der Erfassung, nicht im Kern (E-09, I-06). Bezugsgroesse
// ist der ungerundete Basispreis aus Stufe 2, nicht der gerundete Wohnungspreis.
import { bereiteEingabeAuf, berechneVerkaufssumme, type Konfiguration } from '@offert/core';
// PE-09: Modulpfad statt Paketindex — der Index re-exportiert .tsx, fuer die Node kein
// Type-Stripping leistet.
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

// NFA-03/I-23: Stufe 2 wird mit LEEREN Anpassungen aufgerufen, weil der Basispreis die
// Groesse VOR den Anpassungen ist; eine eigene Multiplikation waere eine zweite Fassung
// von eq:qm_preis/eq:flaeche.
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
