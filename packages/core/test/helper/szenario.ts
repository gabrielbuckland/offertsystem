// Szenariotreiber (T2). Bewertungsdaten stammen aus der Mock-Implementierung bzw. aus
// aufgezeichneten Antworten, nie aus einem Live-Abruf: die API kann fuer identische
// Anfragen ueber die Zeit abweichende Werte liefern (Spec 06 §3).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { berechne, type BerechnungsErgebnis } from '../../src/pipeline/berechne.js';
import type { StufenFehler } from '../../src/fehler/stufenfehler.js';
import { ladeReferenz } from './referenz.js';
import { szenarioZuEingangsArgumenten, type SzenarioFixture } from './projekt.js';

export type { SzenarioFixture };

export interface SzenarioErgebnis {
  readonly id: string;
  readonly ergebnis?: BerechnungsErgebnis;
  readonly fehler?: StufenFehler;
  readonly ergebnisAusgegeben: boolean;
  readonly referenz: { verkaufssumme: number; honorarMin: number; honorarMax: number };
  readonly ist: { verkaufssumme: number; honorarMin: number; honorarMax: number };
  readonly abweichung: { verkaufssumme: number; honorarMin: number; honorarMax: number };
  // Herkunft der Lagescores aus dem Fixture. Muss ins Artefakt, weil R-01 verlangt, dass
  // die Szenarientabelle keine empirische Lageabhaengigkeit suggeriert.
  readonly lagedatenHerkunft: string;
  readonly bestanden: boolean;
  readonly stufendiagnose?: Readonly<Record<string, number>>;
}

export function ladeSzenario(id: string): SzenarioFixture {
  const pfad = fileURLToPath(new URL(`../fixtures/scenarios/${id}.json`, import.meta.url));
  return JSON.parse(readFileSync(pfad, 'utf8')) as SzenarioFixture;
}

export function fuehreSzenarioAus(
  id: string,
  optionen: { readonly referenzUeberschreiben?: Partial<SzenarioErgebnis['referenz']> } = {},
): SzenarioErgebnis {
  const fixture = ladeSzenario(id);
  const erwartung = ladeReferenz(`${id}-erwartung`)[0]!;
  const referenz = {
    verkaufssumme: Number(erwartung['V_rappen']),
    honorarMin: Number(erwartung['H_min_g_rappen']),
    honorarMax: Number(erwartung['H_max_g_rappen']),
    ...optionen.referenzUeberschreiben,
  };

  const lauf = berechne(szenarioZuEingangsArgumenten(fixture));
  if (!lauf.ok) {
    return {
      id, fehler: lauf.fehler, ergebnisAusgegeben: false, referenz,
      ist: { verkaufssumme: 0, honorarMin: 0, honorarMax: 0 },
      abweichung: { verkaufssumme: 0, honorarMin: 0, honorarMax: 0 },
      lagedatenHerkunft: fixture.lagedaten_herkunft,
      bestanden: id === 'S5', // S5 erwartet den definierten Abbruch
    };
  }

  const ist = {
    verkaufssumme: lauf.wert.verkaufssumme.verkaufssumme,
    honorarMin: lauf.wert.honorar.honorarMin,
    honorarMax: lauf.wert.honorar.honorarMax,
  };
  const relativ = (i: number, r: number): number => (r === 0 ? (i === 0 ? 0 : 1) : (i - r) / r);
  const abweichung = {
    verkaufssumme: relativ(ist.verkaufssumme, referenz.verkaufssumme),
    honorarMin: relativ(ist.honorarMin, referenz.honorarMin),
    honorarMax: relativ(ist.honorarMax, referenz.honorarMax),
  };
  const bestanden = Object.values(abweichung).every((a) => Math.abs(a) <= 0.001);

  return {
    id, ergebnis: lauf.wert, ergebnisAusgegeben: true, referenz, ist, abweichung, bestanden,
    lagedatenHerkunft: fixture.lagedaten_herkunft,
    // Ursachenanalyse ist Teil des Werkzeugs, nicht Handarbeit im Nachgang (Spec 06 §3).
    ...(bestanden ? {} : { stufendiagnose: stufendiagnose(id, lauf.wert) }),
  };
}

function stufendiagnose(
  id: string, ergebnis: BerechnungsErgebnis,
): Readonly<Record<string, number>> {
  const qm = ladeReferenz('02_qm_preis');
  const preise = ladeReferenz('03_wohnungspreis');
  const summe = ladeReferenz('04_verkaufssumme');
  const ersteAbleitung = ergebnis.verkaufssumme.typAbleitungen[0]!;
  const erstePosition = ergebnis.verkaufssumme.positionen[0]!;
  return {
    '02_qm_preis': ersteAbleitung.quadratmeterpreis - Number(qm[0]!['q_t']),
    '03_wohnungspreis': erstePosition.preis - Number(preise[0]!['p_j_rappen']),
    '04_verkaufssumme': ergebnis.verkaufssumme.verkaufssumme
      - Number(summe.find((z) => z['szenario_id'] === id)?.['V_rappen'] ?? 0),
  };
}

export function schreibeSzenarienArtefakt(ergebnisse: readonly SzenarioErgebnis[]): string {
  const zeitstempel = new Date().toISOString().replace(/[:.]/g, '-');
  const verzeichnis = `artifacts/scenarios/${zeitstempel}`;
  mkdirSync(verzeichnis, { recursive: true });
  writeFileSync(`${verzeichnis}/szenarien.json`, `${JSON.stringify({
    schwelle: 0.001,
    gesamt: ergebnisse.every((e) => e.bestanden) ? 'bestanden' : 'nicht bestanden',
    szenarien: ergebnisse,
  }, null, 2)}\n`);
  // Zeiger fuer P5s Sammler; ohne ihn findet `leseLatest` das Verzeichnis nicht (PE-18).
  writeFileSync('artifacts/scenarios/latest.json',
    `${JSON.stringify({ verzeichnis, zeitstempel }, null, 2)}\n`);
  return `${verzeichnis}/szenarien.json`;
}
