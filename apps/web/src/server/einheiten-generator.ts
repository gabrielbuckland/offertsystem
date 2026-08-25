/**
 * Keine Formel. Erzeugt Einheitenzeilen aus Wuenschen der Form «2 mal 3.5 Zimmer».
 *
 * Der Generator bildet die Arbeitsweise des Auftraggebers ab: Zuerst steht die
 * Zusammensetzung des Projekts fest, danach werden die Flaechen eingetragen. Flaechen
 * starten deshalb bei null und nicht bei einem geratenen Wert — ein Vorgabewert wuerde
 * einen erfassten Wert vortaeuschen.
 *
 * Die Kennung (`id`) wird UNABHAENGIG von der Wohnungsnummer vergeben. Die Wohnungsnummer
 * ist ein vom Nutzer editierbares Anzeigefeld (Einheitentabelle, Task 11); die Kennung ist
 * hingegen der Schluessel, unter dem Basispreis und Anpassungen gefuehrt werden
 * (projektion.ts, berechnung/route.ts). Waere die Kennung aus der Nummer abgeleitet, wuerde
 * eine Umbenennung, die eine Nummer freigibt, plus eine spaetere Neuvergabe derselben Nummer
 * an eine andere Einheit zwei Einheiten dieselbe Kennung geben — mit stiller
 * Preisverwechslung als Folge, weil `projektSchema` nur auf die Wohnungsnummer prueft. Der
 * Zaehler liest deshalb die hoechste bereits vergebene KENNUNG, nicht die Wohnungsnummer.
 * Kennungen aus der Zeit vor diesem Fix (`E-W-001`) matchen das neue Muster nicht und zaehlen
 * als 0 — der Zaehler beginnt dann bei 1, ohne mit ihnen zu kollidieren.
 */
import type { AnpassungsSpalte, ProjektEinheit, Referenzobjekt } from './projekt-schema.js';

export interface Wunsch {
  readonly referenzobjektId: string;
  readonly anzahl: number;
}

/**
 * Der Vorgabewert einer Spalte ist ihre Antwort auf «was gilt hier ueblicherweise» und
 * wird beim Anlegen einer Einheit uebernommen — sonst waere er ein Bedienelement ohne
 * Wirkung. Er traegt dieselbe Groesse wie `spaltenwerte` selbst (Faktor bei 'relativ',
 * Rappen bei 'absolut'), die Uebernahme ist deshalb eine Kopie und keine Umrechnung.
 *
 * Ein Vorgabewert von 0 wird NICHT eingetragen: `projiziere` ueberspringt ihn ohnehin,
 * und eine Null im Artefakt sieht aus wie eine erfasste Entscheidung, ist aber keine.
 *
 * Eine Spalte mit `regel` hat KEINEN Vorgabewert (schliessen sich im Schema aus,
 * `projekt-schema.ts`) — fuer sie wird nichts vorbelegt.
 */
function vorbelegteSpaltenwerte(
  spalten: readonly AnpassungsSpalte[],
): Record<string, number> {
  const werte: Record<string, number> = {};
  for (const s of spalten) {
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
