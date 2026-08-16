/**
 * Keine Modellformel; Variantenbildung fuer den OAT-Lauf (Spec 06 §7.1).
 *
 * Sechs Dimensionen, je vier Stufen (-20/-10/+10/+20 Prozent). Varianten entstehen auf der
 * ROHFORM, weil nur sie Eingabe der Validierung ist (PE-01); jede Variante wird als letzter
 * Schritt durch dieselbe dreistufige Pruefung geschickt wie der Ladepfad (I-21). Keine
 * Variante erreicht das Hauptprogramm, ohne den Ladepfad passiert zu haben.
 *
 * Zu D4 — warum die SPANNE und nicht beide Grenzen einzeln: Ein gemeinsames Skalieren
 * beider Grenzen verschoebe bei `min != 0` zugleich Lage und Breite des
 * Saettigungsbereichs; die gemessene Wirkung waere nicht mehr einer Groesse zuzuordnen.
 * Skaliert wird deshalb die Spanne um den Mittelpunkt. Die Umpolung (`min > max`) bleibt
 * erhalten, weil die Vorzeichen der Abstaende unberuehrt bleiben — genau die Eigenschaft,
 * die I-13 verlangt.
 *
 * Zu D5 — `gMin` bleibt fest: Bei negativem delta waere I-16 (`gMin <= 1 <= gMax`) sonst
 * sofort verletzt und die Dimension nicht messbar.
 *
 * Zu D6 — die Stuetzstelle k = 0 bleibt unberuehrt. `V_0 = 0` ist die Untergrenze des
 * Definitionsbereichs; ein skaliertes `V_0 > 0` erzeugte einen undefinierten Bereich
 * unterhalb der ersten Stufe. `H^(0)` bleibt aus demselben Grund fest — es ist das
 * Grundhonorar, das die Degression traegt, und seine Mitskalierung vermengte D6 mit D5.
 */
import { sortiereNachSchluessel } from '../shared/artefakt.ts';
import { klone, validiere } from '../shared/konfig.ts';
import type { Szenario } from '../shared/szenario.ts';
import { renormalisiere } from './renormalisierung.ts';
import { projiziereAufKorridor } from './z-projektion.ts';

export const STUFEN_PROZENT = [-20, -10, 10, 20] as const;

/** Schreibbarer Ausschnitt der Rohkonfiguration; nur die variierten Bloecke. */
interface RohFaktor {
  gewicht: number;
  min: number;
  max: number;
}
interface RohStuetzstelle {
  v: number;
  hMin: number;
  hMax: number;
}
interface RohSchreibbar {
  flaeche: { alpha: number };
  preisanpassung: { zMin: number; zMax: number };
  aufwandfaktoren: Record<string, RohFaktor>;
  honorar: {
    stuetzstellen: RohStuetzstelle[];
    skalierung: { gMin: number; gMax: number };
  };
}

export type Dimension = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';

export interface SzenarioUmbau {
  readonly szenario: Szenario;
  readonly projiziert: number;
}

export interface Variante {
  readonly dimension: Dimension;
  readonly parameter_id: string;
  readonly variation_prozent: number;
  readonly konfigRoh: unknown;
  readonly gewichte_vor: Readonly<Record<string, number>> | null;
  readonly gewichte_nach: Readonly<Record<string, number>> | null;
  readonly szenarioUmbau: null | ((s: Szenario) => SzenarioUmbau);
  readonly status: 'offen' | 'unzulaessig';
  readonly grund: string | null;
}

function alsRoh(wert: unknown): RohSchreibbar {
  return wert as RohSchreibbar;
}

function gewichteAus(roh: unknown): Record<string, number> {
  const g: Record<string, number> = {};
  for (const [id, p] of sortiereNachSchluessel(alsRoh(roh).aufwandfaktoren)) {
    g[id] = p.gewicht;
  }
  return g;
}

export function baueVarianten(basisRoh: unknown): readonly Variante[] {
  const varianten: Variante[] = [];
  const gewichteBasis = gewichteAus(basisRoh);

  // D1 — Gewichte einzeln, mit proportionaler Renormalisierung
  for (const faktorId of Object.keys(gewichteBasis).sort()) {
    for (const p of STUFEN_PROZENT) {
      const r = renormalisiere(gewichteBasis, faktorId, p / 100);
      const roh = alsRoh(klone(basisRoh));
      if (r.gewichte !== null) {
        for (const [id, w] of Object.entries(r.gewichte)) {
          const faktor = roh.aufwandfaktoren[id];
          if (faktor !== undefined) faktor.gewicht = w;
        }
      }
      varianten.push({
        dimension: 'D1',
        parameter_id: `w:${faktorId}`,
        variation_prozent: p,
        konfigRoh: roh,
        gewichte_vor: r.gewichte_vor,
        gewichte_nach: r.gewichte ?? r.gewichte_vor,
        szenarioUmbau: null,
        status: r.status === 'ok' ? 'offen' : 'unzulaessig',
        grund: r.grund,
      });
    }
  }

  // D2 — alpha
  for (const p of STUFEN_PROZENT) {
    const roh = alsRoh(klone(basisRoh));
    const neu = roh.flaeche.alpha * (1 + p / 100);
    const zulaessig = neu >= 0 && neu <= 1;
    roh.flaeche.alpha = neu;
    varianten.push({
      dimension: 'D2', parameter_id: 'flaeche.alpha', variation_prozent: p, konfigRoh: roh,
      gewichte_vor: gewichteBasis, gewichte_nach: gewichteBasis, szenarioUmbau: null,
      status: zulaessig ? 'offen' : 'unzulaessig',
      grund: zulaessig ? null : 'alpha ausserhalb [0,1] (I-04)',
    });
  }

  // D3 — Korridor der Zu-/Abschlaege; die Szenariodaten werden mitprojiziert
  for (const p of STUFEN_PROZENT) {
    const roh = alsRoh(klone(basisRoh));
    const zMin = roh.preisanpassung.zMin * (1 + p / 100);
    const zMax = roh.preisanpassung.zMax * (1 + p / 100);
    const zulaessig = zMin > -1 && zMin <= 0 && zMax >= 0;
    roh.preisanpassung.zMin = zMin;
    roh.preisanpassung.zMax = zMax;
    varianten.push({
      dimension: 'D3', parameter_id: 'preisanpassung.korridor', variation_prozent: p,
      konfigRoh: roh, gewichte_vor: gewichteBasis, gewichte_nach: gewichteBasis,
      szenarioUmbau: (s) => {
        const e = projiziereAufKorridor(s.einheiten, zMin, zMax);
        return { szenario: { ...s, einheiten: e.einheiten }, projiziert: e.projiziert };
      },
      status: zulaessig ? 'offen' : 'unzulaessig',
      grund: zulaessig ? null : 'z-Grenzen verletzen I-06/I-07',
    });
  }

  // D4 — Normalisierungsgrenzen je Faktor: Spanne um den Mittelpunkt skaliert
  for (const [faktorId] of sortiereNachSchluessel(alsRoh(basisRoh).aufwandfaktoren)) {
    for (const p of STUFEN_PROZENT) {
      const roh = alsRoh(klone(basisRoh));
      const f = roh.aufwandfaktoren[faktorId]!;
      const mitte = (f.min + f.max) / 2;
      f.min = mitte - (mitte - f.min) * (1 + p / 100);
      f.max = mitte + (f.max - mitte) * (1 + p / 100);
      const entartet = f.min === f.max;
      varianten.push({
        dimension: 'D4', parameter_id: `n:${faktorId}`, variation_prozent: p, konfigRoh: roh,
        gewichte_vor: gewichteBasis, gewichte_nach: gewichteBasis, szenarioUmbau: null,
        status: entartet ? 'unzulaessig' : 'offen',
        grund: entartet ? 'CFG_NORM_BOUNDS: min = max' : null,
      });
    }
  }

  // D5 — Bildbereich von g: Spanne skaliert, gMin fest
  for (const p of STUFEN_PROZENT) {
    const roh = alsRoh(klone(basisRoh));
    const gMin = roh.honorar.skalierung.gMin;
    const spanne = roh.honorar.skalierung.gMax - gMin;
    roh.honorar.skalierung.gMax = gMin + spanne * (1 + p / 100);
    varianten.push({
      dimension: 'D5', parameter_id: 'honorar.skalierung.spanne', variation_prozent: p,
      konfigRoh: roh, gewichte_vor: gewichteBasis, gewichte_nach: gewichteBasis,
      szenarioUmbau: null, status: 'offen', grund: null,
    });
  }

  // D6 — Stuetzstellen: Intervallgrenzen und Honorarbasen getrennt
  for (const p of STUFEN_PROZENT) {
    const rohV = alsRoh(klone(basisRoh));
    rohV.honorar.stuetzstellen = rohV.honorar.stuetzstellen.map(
      (s, i) => (i === 0 ? s : { ...s, v: Math.round(s.v * (1 + p / 100)) }),
    );
    varianten.push({
      dimension: 'D6', parameter_id: 'honorar.stuetzstellen.v', variation_prozent: p,
      konfigRoh: rohV, gewichte_vor: gewichteBasis, gewichte_nach: gewichteBasis,
      szenarioUmbau: null, status: 'offen', grund: null,
    });

    const rohH = alsRoh(klone(basisRoh));
    rohH.honorar.stuetzstellen = rohH.honorar.stuetzstellen.map(
      (s, i) => (i === 0 ? s : {
        ...s,
        hMin: Math.round(s.hMin * (1 + p / 100)),
        hMax: Math.round(s.hMax * (1 + p / 100)),
      }),
    );
    varianten.push({
      dimension: 'D6', parameter_id: 'honorar.stuetzstellen.h', variation_prozent: p,
      konfigRoh: rohH, gewichte_vor: gewichteBasis, gewichte_nach: gewichteBasis,
      szenarioUmbau: null, status: 'offen', grund: null,
    });
  }

  // Letzter Schritt: derselbe Ladepfad wie im Betrieb (I-21).
  return varianten.map((v) => {
    if (v.status === 'unzulaessig') return v;
    const geprueft = validiere(v.konfigRoh);
    return geprueft.ok
      ? v
      : { ...v, status: 'unzulaessig' as const, grund: geprueft.fehler.map((f) => f.code).join(',') };
  });
}
