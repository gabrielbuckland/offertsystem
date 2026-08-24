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

/** Basispreis je Einheit-Id, ungerundet, aus einem Lauf ohne Anpassungen (PE-21). */
export type Basispreise = Readonly<Record<string, number>>;

type Anpassung = Erfassung['einheiten'][number]['anpassungen'][number];

export function projiziere(projekt: Projekt, basispreise: Basispreise): ProjektionsErgebnis {
  const einheiten: Erfassung['einheiten'][number][] = [];

  for (const e of projekt.einheiten) {
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
      const basispreis = basispreise[e.id];
      if (basispreis === undefined) {
        return { ok: false, meldung: fehlenderBasispreis(e.wohnungsnummer) };
      }
      const umgerechnet = rechneBetragInFaktor(wert, basispreis);
      if (!umgerechnet.ok) {
        return { ok: false, meldung: `${e.wohnungsnummer}: ${umgerechnet.meldung}` };
      }
      anpassungen.push({
        faktor: umgerechnet.wert, erfassungsform: 'absolut', erfassterBetrag: wert,
        begruendung: spalte.bezeichnung, vorlageId: spalte.id,
      });
    }

    for (const m of e.manuelleAnpassungen) {
      if (m.erfassungsform === 'relativ') {
        anpassungen.push({
          faktor: m.wert, erfassungsform: 'relativ', begruendung: m.begruendung,
        });
        continue;
      }
      const basispreis = basispreise[e.id];
      if (basispreis === undefined) {
        return { ok: false, meldung: fehlenderBasispreis(e.wohnungsnummer) };
      }
      const umgerechnet = rechneBetragInFaktor(m.wert, basispreis);
      if (!umgerechnet.ok) {
        return { ok: false, meldung: `${e.wohnungsnummer}: ${umgerechnet.meldung}` };
      }
      anpassungen.push({
        faktor: umgerechnet.wert, erfassungsform: 'absolut', erfassterBetrag: m.wert,
        begruendung: m.begruendung,
      });
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
      projekt: { referenznummer: projekt.id },
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
