// eq:normalisierung, Variante Z-Score — ausschliesslich mit nachgelagerter Kappung
// zulaessig (Brief §5.5):
//   z = (x - mu) / sigma ;  x_dach = min(1, max(0, (z + c) / (2c))).
// Ohne die Kappung verliesse z das Zielintervall unbeschraenkt und braeche I-22.
// Nachweisartefakt fuer den Sonderfall der Messlatte aus 6.3; heute von keinem Faktor
// verwendet (offener Punkt O-03: Herkunft von mu und sigma).
import { score } from '../domain/geld.js';
import { ok } from '../domain/result.js';
import { grenzenIdentisch, type Normalisierungsstrategie } from './strategie.js';

export const zScore: Normalisierungsstrategie = {
  bezeichner: 'z-score',
  normalisiere(rohwert, parameter, faktorId) {
    const v = parameter.referenzverteilung;
    if (v === undefined) {
      throw new Error(`Faktor ${faktorId} nutzt z-score ohne Referenzverteilung — Defekt`);
    }
    if (v.standardabweichung === 0 || v.kappungSigma === 0) {
      return grenzenIdentisch(faktorId, parameter, v.standardabweichung);
    }
    const z = (rohwert - v.mittelwert) / v.standardabweichung;
    const roh = (z + v.kappungSigma) / (2 * v.kappungSigma);
    const gekappt = roh < 0 || roh > 1;
    return ok({
      faktorId, rohwert, grenzeMin: parameter.grenzeMin, grenzeMax: parameter.grenzeMax,
      strategie: 'z-score', gekappt, normiert: score(Math.min(1, Math.max(0, roh))),
    });
  },
};
