/**
 * Keine Formel. Erzeugt Einheitenzeilen aus Wuenschen der Form «2 mal 3.5 Zimmer».
 *
 * Der Generator bildet die Arbeitsweise des Auftraggebers ab: Zuerst steht die
 * Zusammensetzung des Projekts fest, danach werden die Flaechen eingetragen. Flaechen
 * starten deshalb bei null und nicht bei einem geratenen Wert — ein Vorgabewert wuerde
 * einen erfassten Wert vortaeuschen.
 */
import type { ProjektEinheit, Referenzobjekt } from './projekt-schema.js';

export interface Wunsch {
  readonly referenzobjektId: string;
  readonly anzahl: number;
}

export function erzeugeEinheiten(
  wuensche: readonly Wunsch[],
  referenzobjekte: readonly Referenzobjekt[],
  vorhandene: readonly ProjektEinheit[],
): readonly ProjektEinheit[] {
  const belegt = new Set(vorhandene.map((e) => e.wohnungsnummer));
  const bekannt = new Set(referenzobjekte.map((r) => r.id));
  const neue: ProjektEinheit[] = [];
  let lauf = vorhandene.length;

  for (const wunsch of wuensche) {
    if (!bekannt.has(wunsch.referenzobjektId)) continue;
    for (let i = 0; i < wunsch.anzahl; i += 1) {
      lauf += 1;
      let nummer = `W-${String(lauf).padStart(3, '0')}`;
      while (belegt.has(nummer)) {
        lauf += 1;
        nummer = `W-${String(lauf).padStart(3, '0')}`;
      }
      belegt.add(nummer);
      neue.push({
        id: `E-${nummer}`,
        wohnungsnummer: nummer,
        referenzobjektId: wunsch.referenzobjektId,
        flaecheInnen: 0,
        flaecheAussen: 0,
        stockwerk: 0,
        spaltenwerte: {},
        manuelleAnpassungen: [],
      });
    }
  }
  return neue;
}
