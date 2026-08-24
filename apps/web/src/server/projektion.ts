/**
 * Keine eigene Formel. Bildet den Projektstand auf die bestehende `Erfassung` ab.
 *
 * Diese Abbildung ist die einzige neue Fachlogik des Umbaus. Sie existiert, damit Kern,
 * Adapter und Offert-Paket unveraendert bleiben: Die Oberflaeche fuehrt Zu-/Abschlaege in
 * Spalten, das Rechenmodell kennt nur eine flache Liste von Faktoren.
 *
 * Spaltenwerte und manuelle Positionen landen im selben Array. Die Reihenfolge ist
 * bindend: erst die Spalten in ihrer konfigurierten Reihenfolge, dann die manuellen
 * Positionen. Ohne feste Reihenfolge waere die Serialisierung des Eingangs nicht
 * deterministisch, und der Reproduzierbarkeitsnachweis aus US-13 fiele (NFA-06).
 */
import { rechneBetragInFaktor } from './betragsumrechnung.js';
import type { Erfassung } from './erfassung-schema.js';
import type { Projekt } from './projekt-schema.js';

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
 * nachschlagen, umrechnen, Fehler uebersetzen. Spalten- und manuelle Positionen
 * unterscheiden sich nur in Wert, Begruendung und ob eine Vorlage dahintersteht — daher
 * ein gemeinsamer Pfad statt zweier driftender Kopien.
 */
function absolutZuAnpassung(
  betrag: number,
  basispreis: number | undefined,
  begruendung: string,
  wohnungsnummer: string,
  vorlageId?: string,
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
    wert: vorlageId === undefined
      ? { faktor: umgerechnet.wert, erfassungsform: 'absolut', erfassterBetrag: betrag, begruendung }
      : { faktor: umgerechnet.wert, erfassungsform: 'absolut', erfassterBetrag: betrag, begruendung, vorlageId },
  };
}

export function projiziere(
  projekt: Projekt,
  basispreise: BasispreiseNachId,
  optionen: { readonly ohneAnpassungen?: boolean } = {},
): ProjektionsErgebnis {
  const einheiten: Erfassung['einheiten'][number][] = [];

  for (const e of projekt.einheiten) {
    // Der Basislauf (PE-21) braucht die Anpassungen nicht nur nicht — er darf ihre
    // Umrechnung gar nicht erst versuchen: Ohne Basispreise wuerde jede absolute
    // Position mit `fehlenderBasispreis` scheitern, bevor der Lauf die Basispreise
    // ueberhaupt ermitteln konnte. `zuEingangsArgumenten` leert dieselben Anpassungen
    // ohnehin ein zweites Mal fuer den Kern; sie hier zu berechnen waere also nicht
    // nur falsch, sondern auch verlorene Arbeit.
    if (optionen.ohneAnpassungen === true) {
      einheiten.push({
        wohnungsnummer: e.wohnungsnummer,
        wohnungstypId: e.referenzobjektId,
        flaecheInnen: e.flaecheInnen,
        flaecheAussen: e.flaecheAussen,
        stockwerk: e.stockwerk,
        anpassungen: [],
      });
      continue;
    }

    const anpassungen: Anpassung[] = [];

    for (const spalte of projekt.anpassungsSpalten) {
      const wert = e.spaltenwerte[spalte.id];
      // Eine nicht gesetzte oder auf null gesetzte Spalte ist keine Position. Sonst
      // truege jede Einheit so viele Nullpositionen, wie es Spalten gibt, und die
      // Offerte wiese Anpassungen ohne Wirkung aus (A-13).
      if (wert === undefined || wert === 0) continue;

      if (spalte.erfassungsform === 'relativ') {
        anpassungen.push({
          faktor: wert, erfassungsform: 'relativ',
          begruendung: spalte.bezeichnung, vorlageId: spalte.id,
        });
        continue;
      }
      const ergebnis = absolutZuAnpassung(
        wert, basispreise[e.id], spalte.bezeichnung, e.wohnungsnummer, spalte.id);
      if (!ergebnis.ok) return ergebnis;
      anpassungen.push(ergebnis.wert);
    }

    for (const m of e.manuelleAnpassungen) {
      if (m.erfassungsform === 'relativ') {
        anpassungen.push({
          faktor: m.wert, erfassungsform: 'relativ', begruendung: m.begruendung,
        });
        continue;
      }
      const ergebnis = absolutZuAnpassung(m.wert, basispreise[e.id], m.begruendung, e.wohnungsnummer);
      if (!ergebnis.ok) return ergebnis;
      anpassungen.push(ergebnis.wert);
    }

    einheiten.push({
      wohnungsnummer: e.wohnungsnummer,
      wohnungstypId: e.referenzobjektId,
      flaecheInnen: e.flaecheInnen,
      flaecheAussen: e.flaecheAussen,
      stockwerk: e.stockwerk,
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
    } as Erfassung,
  };
}

function fehlenderBasispreis(nummer: string): string {
  return `Für die Einheit ${nummer} liegt noch kein Basispreis vor. Ein in Franken `
    + 'erfasster Zu- oder Abschlag ist erst nach dem Bewertungsabruf umrechenbar.';
}
