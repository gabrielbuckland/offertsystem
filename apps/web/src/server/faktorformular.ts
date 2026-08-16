/**
 * Keine Formel. Formularbeschreibung aus der Faktorkonfiguration (E-24, AK-3.7).
 *
 * Das Formular wird ERZEUGT, nicht geschrieben. Es existiert keine Komponente, kein
 * Feldname und kein Textbaustein, der einen einzelnen Faktorbezeichner nennt — eine
 * solche Stelle waere genau die Codedatei, die die Null-Dateien-Messung aus 6.3
 * ausschliessen soll.
 *
 * Gelesen wird der KERNTYP `Konfiguration.faktoren`, nicht die Rohkonfiguration: Die
 * Abbildung Rohform -> Kerntyp hat genau einen Ort (PE-01).
 */
import type { Konfiguration } from '@offert/core';
import type { Feldmeldung } from './feldmeldungen.js';

export interface Feldbeschreibung {
  readonly faktorId: string;
  readonly beschriftung: string;
  readonly untergrenze: number;
  readonly obergrenze: number;
  readonly eingabeform: 'zahl' | 'ordinal';
  readonly stufen?: readonly { readonly wert: number; readonly bezeichnung: string }[];
  readonly pflicht: true;
  readonly validierungsmeldung: string;
}

export interface AnzeigeFaktor {
  readonly faktorId: string;
  readonly beschriftung: string;
  readonly quelle: 'lagescore' | 'abgeleitet';
  readonly quellSchluessel: string;
}

export interface Faktorformular {
  readonly felder: readonly Feldbeschreibung[];
  readonly anzeigeFaktoren: readonly AnzeigeFaktor[];
}

export function baueFaktorformular(k: Konfiguration): Faktorformular {
  const eintraege = [...k.faktoren.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); // stabile Reihenfolge
  const felder: Feldbeschreibung[] = [];
  const anzeigeFaktoren: AnzeigeFaktor[] = [];
  for (const [id, p] of eintraege) {
    if (p.quelle !== 'manuell') {
      anzeigeFaktoren.push({
        faktorId: id, beschriftung: p.bezeichnung,
        quelle: p.quelle, quellSchluessel: p.quellSchluessel,
      });
      continue;
    }
    // Die Umpolung geschieht ausschliesslich in der Normalisierungsstufe ueber
    // vertauschte Grenzen; das Eingabefeld braucht ein aufsteigendes Intervall. Die
    // Konfiguration wird dafuer gelesen, nicht veraendert.
    const untergrenze = Math.min(p.grenzeMin, p.grenzeMax);
    const obergrenze = Math.max(p.grenzeMin, p.grenzeMax);
    felder.push({
      faktorId: id,
      beschriftung: p.bezeichnung,
      untergrenze,
      obergrenze,
      eingabeform: p.skala?.form === 'ordinal' ? 'ordinal' : 'zahl',
      ...(p.skala === undefined ? {} : { stufen: p.skala.stufen }),
      pflicht: true,
      validierungsmeldung: `Wert muss zwischen ${untergrenze} und ${obergrenze} liegen.`,
    });
  }
  return { felder, anzeigeFaktoren };
}

/**
 * Ein fehlender Wert wird hier abgefangen und erreicht den Kern nicht — dort waere er
 * `FAKTOR_FEHLT` und damit ein Abbruch statt einer Feldmeldung.
 */
export function pruefeFaktorwerte(
  formular: Faktorformular,
  werte: Readonly<Record<string, number | undefined>>,
): readonly Feldmeldung[] {
  const meldungen: Feldmeldung[] = [];
  for (const feld of formular.felder) {
    const wert = werte[feld.faktorId];
    const feldpfad = `aufwandfaktoren.${feld.faktorId}`;
    if (wert === undefined || Number.isNaN(wert)) {
      meldungen.push({
        feldpfad,
        text: `${feld.beschriftung} ist ein Pflichtfeld. ${feld.validierungsmeldung}`,
      });
      continue;
    }
    if (wert < feld.untergrenze || wert > feld.obergrenze) {
      meldungen.push({
        feldpfad,
        text: `${feld.beschriftung}: ${feld.validierungsmeldung} (erfasst: ${wert}).`,
      });
    }
  }
  return meldungen;
}
