// eq:normalisierung — x_dach = min(1, max(0, (x - x_min) / (x_max - x_min))).
// Die aeussere Kappung ist Teil der Formel, keine Nachbehandlung (I-11). Die Umpolung
// liegt in den Daten (vertauschte Grenzen), nicht im Code (I-13).
import { score } from '../domain/geld.js';
import { ok } from '../domain/result.js';
import { grenzenIdentisch, type Normalisierungsstrategie } from './strategie.js';

export const minMax: Normalisierungsstrategie = {
  bezeichner: 'min-max',
  normalisiere(rohwert, parameter, faktorId) {
    const { grenzeMin, grenzeMax } = parameter;
    if (grenzeMin === grenzeMax) return grenzenIdentisch(faktorId, parameter, grenzeMin);
    const roh = (rohwert - grenzeMin) / (grenzeMax - grenzeMin);
    const gekappt = roh < 0 || roh > 1;
    return ok({
      faktorId, rohwert, grenzeMin, grenzeMax, strategie: 'min-max', gekappt,
      normiert: score(Math.min(1, Math.max(0, roh))),
    });
  },
};
