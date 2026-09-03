/**
 * Erzeugt Einheitenzeilen aus Wuenschen der Form «2 mal 3.5 Zimmer». Flaechen starten bei
 * null, nicht bei einem geratenen Wert — ein Vorgabewert wuerde einen erfassten Wert
 * vortaeuschen.
 *
 * Die Kennung (`id`) wird UNABHAENGIG von der Wohnungsnummer vergeben: Die Wohnungsnummer
 * ist ein editierbares Anzeigefeld, die Kennung dagegen der Schluessel, unter dem
 * Basispreis und Anpassungen gefuehrt werden. Waere die Kennung aus der Nummer
 * abgeleitet, koennten zwei Einheiten nach Umbenennung/
 * Neuvergabe derselben Nummer dieselbe Kennung erhalten — mit stiller Preisverwechslung,
 * weil `projektSchema` nur auf die Wohnungsnummer prueft. Der Zaehler liest deshalb die
 * hoechste bereits vergebene KENNUNG, nicht die Wohnungsnummer.
 */
import type { AnpassungsSpalte, ProjektEinheit, Referenzobjekt } from './projekt-schema.js';

export interface Wunsch {
  readonly referenzobjektId: string;
  readonly anzahl: number;
}

/**
 * Der Vorgabewert einer Spalte wird beim Anlegen einer Einheit uebernommen (Kopie, keine
 * Umrechnung — dieselbe Groesse wie `spaltenwerte`: Faktor bei 'relativ', Rappen bei
 * 'absolut'). Ein Vorgabewert von 0 wird NICHT eingetragen: `projiziere` ueberspringt ihn
 * ohnehin, und eine Null im Artefakt saehe aus wie eine erfasste Entscheidung.
 */
function vorbelegteSpaltenwerte(
  spalten: readonly AnpassungsSpalte[],
): Record<string, number> {
  const werte: Record<string, number> = {};
  for (const s of spalten) {
    // Eine Spalte mit Regel wird NICHT vorbelegt: Der Spaltenwert ist ab jetzt die
    // Uebersteuerung der Regel, und eine vorbelegte Uebersteuerung stellte sie still,
    // bevor sie je greift.
    if (s.regel !== undefined) continue;
    if (s.vorgabewert !== undefined && s.vorgabewert !== 0) werte[s.id] = s.vorgabewert;
  }
  return werte;
}

function hoechsteId(vorhandene: readonly ProjektEinheit[]): number {
  return vorhandene.reduce((max, e) => {
    const treffer = /^E-(\d+)$/.exec(e.id);
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
}

export function erzeugeEinheiten(
  wuensche: readonly Wunsch[],
  referenzobjekte: readonly Referenzobjekt[],
  vorhandene: readonly ProjektEinheit[],
  spalten: readonly AnpassungsSpalte[],
): readonly ProjektEinheit[] {
  const belegteNummern = new Set(vorhandene.map((e) => e.wohnungsnummer));
  const belegteIds = new Set(vorhandene.map((e) => e.id));
  const bekannt = new Set(referenzobjekte.map((r) => r.id));
  const neue: ProjektEinheit[] = [];
  let laufNummer = vorhandene.length;
  let laufId = hoechsteId(vorhandene);

  for (const wunsch of wuensche) {
    if (!bekannt.has(wunsch.referenzobjektId)) continue;
    for (let i = 0; i < wunsch.anzahl; i += 1) {
      laufNummer += 1;
      let nummer = `W-${String(laufNummer).padStart(3, '0')}`;
      while (belegteNummern.has(nummer)) {
        laufNummer += 1;
        nummer = `W-${String(laufNummer).padStart(3, '0')}`;
      }
      belegteNummern.add(nummer);

      laufId += 1;
      let id = `E-${laufId}`;
      while (belegteIds.has(id)) {
        laufId += 1;
        id = `E-${laufId}`;
      }
      belegteIds.add(id);

      neue.push({
        id,
        wohnungsnummer: nummer,
        referenzobjektId: wunsch.referenzobjektId,
        flaecheInnen: 0,
        flaecheAussen: 0,
        spaltenwerte: vorbelegteSpaltenwerte(spalten),
        merkmalswerte: {},
      });
    }
  }
  return neue;
}
