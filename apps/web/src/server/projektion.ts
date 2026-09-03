/**
 * Keine eigene Formel. Bildet den Projektstand auf die bestehende `Erfassung` ab: Die
 * Oberflaeche fuehrt Zu-/Abschlaege in Spalten, das Rechenmodell kennt nur eine flache
 * Liste von Faktoren.
 *
 * Die Spalten landen in ihrer konfigurierten Reihenfolge im Anpassungsarray. Ohne feste
 * Reihenfolge waere die Serialisierung des Eingangs nicht deterministisch, und der
 * Reproduzierbarkeitsnachweis aus US-13 fiele (NFA-06).
 */
import { rechneBetragInFaktor } from './betragsumrechnung.js';
import type { Erfassung } from './erfassung-schema.js';
import type { Projekt } from './projekt-schema.js';
import { ermittleWirksamenWert, type Regelspur } from './wirksamer-wert.js';

export type ProjektionsErgebnis =
  | { readonly ok: true; readonly wert: Erfassung }
  | { readonly ok: false; readonly meldung: string };

/**
 * Basispreis je Einheit-Id, ungerundet, aus einem Lauf ohne Anpassungen (PE-21).
 *
 * Der Name traegt den Schluessel bewusst: `betragsumrechnung.ts` fuehrt einen gleichnamigen
 * Typ, dort aber je Wohnungsnummer geschluesselt. TypeScript unterscheidet strukturell
 * gleiche `Record<string, number>` nicht, ein falsch geschluesseltes Argument wuerde also
 * unbemerkt durchgehen und jede Suche stumm ins Leere laufen lassen.
 */
export type BasispreiseNachId = Readonly<Record<string, number>>;

type Anpassung = Erfassung['einheiten'][number]['anpassungen'][number];

/**
 * Ein in Franken erfasster Zu-/Abschlag durchlaeuft immer denselben Weg: Basispreis
 * nachschlagen, umrechnen, Fehler uebersetzen.
 */
function absolutZuAnpassung(
  betrag: number,
  basispreis: number | undefined,
  begruendung: string,
  wohnungsnummer: string,
  vorlageId: string,
  nachweis: { readonly regel?: Regelspur; readonly uebersteuert?: true },
): { readonly ok: true; readonly wert: Anpassung } | { readonly ok: false; readonly meldung: string } {
  if (basispreis === undefined) {
    return { ok: false, meldung: fehlenderBasispreis(wohnungsnummer) };
  }
  const umgerechnet = rechneBetragInFaktor(betrag, basispreis);
  if (!umgerechnet.ok) {
    return { ok: false, meldung: `${wohnungsnummer}: ${umgerechnet.meldung}` };
  }
  return {
    ok: true,
    wert: {
      faktor: umgerechnet.wert, erfassungsform: 'absolut', erfassterBetrag: betrag, begruendung, vorlageId,
      ...nachweis,
    },
  };
}

export function projiziere(
  projekt: Projekt,
  basispreise: BasispreiseNachId,
  optionen: { readonly ohneAnpassungen?: boolean } = {},
): ProjektionsErgebnis {
  const einheiten: Erfassung['einheiten'][number][] = [];

  for (const e of projekt.einheiten) {
    // Basislauf (PE-21) darf die Anpassungen gar nicht erst umrechnen: ohne Basispreise
    // wuerde jede absolute Position mit `fehlenderBasispreis` scheitern, bevor der Lauf
    // die Basispreise ueberhaupt ermitteln konnte.
    if (optionen.ohneAnpassungen === true) {
      einheiten.push({
        wohnungsnummer: e.wohnungsnummer,
        wohnungstypId: e.referenzobjektId,
        flaecheInnen: e.flaecheInnen,
        flaecheAussen: e.flaecheAussen,
        anpassungen: [],
      });
      continue;
    }

    const anpassungen: Anpassung[] = [];

    for (const spalte of projekt.anpassungsSpalten) {
      const wirksam = ermittleWirksamenWert(spalte, e);
      // Wirksamer Wert 0 ist kein Zu-/Abschlag — sonst truege die Einheit so viele
      // Nullpositionen wie es Spalten gibt (A-13).
      if (wirksam === undefined || wirksam.wert === 0) continue;

      const nachweis = {
        ...(wirksam.regel === undefined ? {} : { regel: wirksam.regel }),
        ...(wirksam.uebersteuert === true ? { uebersteuert: true as const } : {}),
      };

      if (spalte.erfassungsform === 'relativ') {
        anpassungen.push({
          faktor: wirksam.wert, erfassungsform: 'relativ',
          begruendung: spalte.bezeichnung, vorlageId: spalte.id, ...nachweis,
        });
        continue;
      }
      const ergebnis = absolutZuAnpassung(
        wirksam.wert, basispreise[e.id], spalte.bezeichnung, e.wohnungsnummer, spalte.id, nachweis);
      if (!ergebnis.ok) return ergebnis;
      anpassungen.push(ergebnis.wert);
    }

    einheiten.push({
      wohnungsnummer: e.wohnungsnummer,
      wohnungstypId: e.referenzobjektId,
      flaecheInnen: e.flaecheInnen,
      flaecheAussen: e.flaecheAussen,
      anpassungen,
    });
  }

  return {
    ok: true,
    wert: {
      projekt: { projektId: projekt.id },
      liegenschaft: { adresse: projekt.adresse },
      wohnungstypen: projekt.referenzobjekte.map((r) => ({
        id: r.id, zimmerzahl: r.zimmerzahl, parametrisierung: r.parametrisierung,
      })),
      einheiten,
      aufwandfaktoren: projekt.aufwandfaktoren,
      ...(projekt.aufwandindikatorUebersteuerung === undefined
        ? {}
        : { aufwandindikatorUebersteuerung: projekt.aufwandindikatorUebersteuerung }),
    } as Erfassung,
  };
}

function fehlenderBasispreis(nummer: string): string {
  return `Für die Einheit ${nummer} liegt noch kein Basispreis vor. Ein in Franken `
    + 'erfasster Zu- oder Abschlag ist erst nach dem Bewertungsabruf umrechenbar.';
}
