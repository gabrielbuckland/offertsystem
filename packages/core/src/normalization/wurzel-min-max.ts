// eq:normalisierung, Variante mit varianzstabilisierender Wurzeltransformation:
//   x_dach = min(1, max(0, (w(x) - w(x_min)) / (w(x_max) - w(x_min)))),
//   w(x) = sign(x) * sqrt(|x|).
// Fachlich fuer rechtsschiefe, nichtnegative Rohgroessen (Preis- und Flaechengroessen
// wie der mittlere Quadratmeterpreis, E-07): Die Wurzel staucht den oberen Randbereich,
// gleiche absolute Preisunterschiede schlagen im unteren Segment staerker auf x_dach
// durch als im oberen — die lineare min-max-Abbildung behandelte beide gleich.
// Auf dem vorgesehenen Wertebereich (Rohwert und Grenzen >= 0) ist w(x) = sqrt(x);
// die vorzeichenerhaltende Fortsetzung haelt w auf ganz R streng monoton, damit der
// Registervertrag (I-22, Property ueber ALLE registrierten Strategien) ohne
// Sonderdomaene gilt: Das Ergebnis liegt fuer jeden endlichen Rohwert in [0, 1].
// Ein negativer Rohwert liegt unter jeder nichtnegativen Untergrenze und gilt damit
// als gekappt (I-11). Umpolung wie bei min-max allein ueber vertauschte Grenzen (I-13);
// identische Grenzen sind S-01 (bestehender StufenFehler NORM_GRENZEN_IDENTISCH).
import { score } from '../domain/geld.js';
import { ok } from '../domain/result.js';
import { grenzenIdentisch, type Normalisierungsstrategie } from './strategie.js';

/** Vorzeichenerhaltende Wurzel; streng monoton auf ganz R, w(x) = sqrt(x) fuer x >= 0. */
const wurzel = (x: number): number => Math.sign(x) * Math.sqrt(Math.abs(x));

export const wurzelMinMax: Normalisierungsstrategie = {
  bezeichner: 'wurzel-min-max',
  normalisiere(rohwert, parameter, faktorId) {
    const { grenzeMin, grenzeMax } = parameter;
    if (grenzeMin === grenzeMax) return grenzenIdentisch(faktorId, parameter, grenzeMin);
    const roh = (wurzel(rohwert) - wurzel(grenzeMin)) / (wurzel(grenzeMax) - wurzel(grenzeMin));
    const gekappt = roh < 0 || roh > 1;
    return ok({
      faktorId, rohwert, grenzeMin, grenzeMax, strategie: 'wurzel-min-max', gekappt,
      normiert: score(Math.min(1, Math.max(0, roh))),
    });
  },
};
