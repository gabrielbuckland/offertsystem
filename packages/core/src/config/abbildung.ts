// Keine Formel. Einzige Uebersetzungsstelle zwischen der Rohkonfiguration (Spec 02,
// JSON-Schreibweise) und dem Kerntyp `Konfiguration` (Spec 03, I-23) — PE-01, PE-02.
// Die Funktion ist total: Sie wirft nie, sondern liefert entweder die Abbildung oder die
// Fehlerliste der drei Pruefebenen.
import { fehler, type KonfigurationsFehler } from './fehlercodes.js';
import type { RohFaktor, RohKonfiguration, StrategieBezeichner as RohStrategie } from './schema.js';
import { validiereKonfiguration } from './validieren.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { gewicht, rappen } from '../domain/geld.js';
import { faktorId, type FaktorId } from '../domain/ids.js';
import { normalisiereBereiche } from '../modell/bereichsregel.js';
import type {
  AnpassungsVorlage, FaktorParameter, Faktormenge, Konfiguration, StrategieBezeichner, Stuetzstelle,
} from './typen.js';

export interface KonfigurationsAbbildung {
  /** Der Typ, auf dem die fuenf Stufen rechnen. */
  readonly kern: Konfiguration;
  /**
   * Die geprueften Rohdaten. P1s Lader braucht sie fuer Merge und Pruefsumme; die
   * Zugriffsschicht entnimmt ihnen den `api`-Block fuer den Adapter (PE-17).
   */
  readonly roh: RohKonfiguration;
}

/**
 * Vollstaendige Abbildung der beiden Schreibweisen. Als Record geschrieben, nicht als
 * switch mit default: Kommt eine Strategie hinzu, bricht die Uebersetzung zur
 * Uebersetzungszeit, nicht zur Laufzeit (Totalitaet, PE-01).
 */
const STRATEGIE: Readonly<Record<RohStrategie, StrategieBezeichner>> = {
  minmax: 'min-max',
  zscore: 'z-score',
};

function bildeFaktorAb(
  bezeichner: string,
  roh: RohFaktor,
): Result<readonly [FaktorId, FaktorParameter], readonly KonfigurationsFehler[]> {
  const pfad = `aufwandfaktoren.${bezeichner}`;
  // Netz gegen den Defekt, nicht gegen erwartbare Eingaben: Ebene 2 haelt das Gewicht
  // bereits in [0, 1]. Ohne die Pruefung wuerde `gewicht()` werfen und die Totalitaet brechen.
  if (!Number.isFinite(roh.gewicht) || roh.gewicht < 0 || roh.gewicht > 1) {
    return fehlschlag([fehler('CFG_WEIGHT_RANGE', `${pfad}.gewicht`, { wert: roh.gewicht })]);
  }
  const parameter: FaktorParameter = {
    grenzeMin: roh.min,
    grenzeMax: roh.max,
    gewicht: gewicht(roh.gewicht),
    strategie: STRATEGIE[roh.strategie],
    quelle: roh.quelle,
    quellSchluessel: roh.quellSchluessel,
    bezeichnung: roh.bezeichnung,
    // exactOptionalPropertyTypes: undefined darf nicht zugewiesen werden.
    ...(roh.referenzverteilung === undefined
      ? {} : { referenzverteilung: roh.referenzverteilung }),
    ...(roh.skala === undefined ? {} : { skala: roh.skala }),
  };
  return ok([faktorId(bezeichner), parameter] as const);
}

/**
 * Uebersetzt eine Rohvorlage in den Kerntyp. Die optionale `regel` darf im Kerntyp nicht
 * als explizites `undefined` auftreten, nur als fehlender Schluessel (exactOptionalPropertyTypes);
 * `normalisiereBereiche` traegt dieselbe Umformung fuer die Bereiche selbst.
 */
function bildeAnpassungsVorlageAb(
  roh: RohKonfiguration['anpassungsVorlagen'][number],
): AnpassungsVorlage {
  const { regel, ...rest } = roh;
  if (regel === undefined) return rest;
  return {
    ...rest,
    regel: { merkmal: regel.merkmal, bereiche: normalisiereBereiche(regel.bereiche) },
  };
}

function bildeStuetzstelleAb(
  roh: RohKonfiguration['honorar']['stuetzstellen'][number],
  i: number,
): Result<Stuetzstelle, readonly KonfigurationsFehler[]> {
  const pfad = `honorar.stuetzstellen[${i}]`;
  for (const [feld, wert] of [['v', roh.v], ['hMin', roh.hMin], ['hMax', roh.hMax]] as const) {
    if (!Number.isInteger(wert)) {
      return fehlschlag([fehler('CFG_TIER_VALUE_RANGE', `${pfad}.${feld}`, { wert })]);
    }
  }
  return ok({ v: rappen(roh.v), hMin: rappen(roh.hMin), hMax: rappen(roh.hMax) });
}

export function parseKonfiguration(
  eingabe: unknown,
): Result<KonfigurationsAbbildung, readonly KonfigurationsFehler[]> {
  const geprueft = validiereKonfiguration(eingabe);
  if (!geprueft.ok) return fehlschlag(geprueft.fehler);
  const roh = geprueft.wert;

  const faktoren = new Map<FaktorId, FaktorParameter>();
  // Aufsteigende Codepoint-Ordnung: Die Einfuegereihenfolge der Map darf nicht von der
  // Schluesselreihenfolge des JSON abhaengen (Spec 03 §9.3, I-14).
  for (const bezeichner of Object.keys(roh.aufwandfaktoren).sort()) {
    const abgebildet = bildeFaktorAb(bezeichner, roh.aufwandfaktoren[bezeichner]!);
    if (!abgebildet.ok) return fehlschlag(abgebildet.fehler);
    faktoren.set(abgebildet.wert[0], abgebildet.wert[1]);
  }

  const stuetzstellen: Stuetzstelle[] = [];
  for (const [i, s] of roh.honorar.stuetzstellen.entries()) {
    const abgebildet = bildeStuetzstelleAb(s, i);
    if (!abgebildet.ok) return fehlschlag(abgebildet.fehler);
    stuetzstellen.push(abgebildet.wert);
  }

  const kern: Konfiguration = {
    meta: roh.meta,
    flaeche: roh.flaeche,
    preisanpassung: roh.preisanpassung,
    anpassungsVorlagen: roh.anpassungsVorlagen.map(bildeAnpassungsVorlageAb),
    merkmale: roh.merkmale,
    faktoren: faktoren as Faktormenge,
    honorar: { stuetzstellen, skalierung: roh.honorar.skalierung },
    // `api` und `dossierDefaults` bleiben bewusst aussen vor: Keine Stufe liest sie.
    // `konfigPruefsumme` ergaenzt der Lader in apps/web (E-26, PE-04).
  };

  return ok({ kern, roh });
}
