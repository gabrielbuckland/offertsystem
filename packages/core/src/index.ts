/**
 * Oeffentlicher Einstiegspunkt des Berechnungskerns.
 * Nur was hier exportiert wird, ist von aussen sichtbar — erst dadurch ist die
 * Aussage «der Kern wurde nicht angefasst» ueberpruefbar (Spec 01 §2.3).
 *
 * Diese Datei wird ausschliesslich ADDITIV erweitert (PE-15). PAKET_NAME bleibt
 * bestehen, weil die Paketaufloesung darueber geprueft wird; die
 * Konfigurationsexporte bleiben, weil Tests und Werkzeuge auf ihnen beruhen.
 */
export const PAKET_NAME = '@offert/core';

export {
  CFG_CODES,
  CFG_EBENE,
  fehler,
  istKonfigurationsFehler,
  type CfgFehlerCode,
  type Fehlerparameter,
  type KonfigurationsFehler,
  type Pruefebene,
} from './config/fehlercodes.js';

export {
  ABLEITUNGS_NAMEN,
  BEZEICHNER_MUSTER,
  LAGESCORE_NAMEN,
  RohKonfigurationSchema,
  type AnpassungsVorlage,
  type DossierDefaults,
  type FaktorQuelle,
  type RohApiKonfiguration,
  type RohFaktor,
  type RohKonfiguration,
  type RohStuetzstelle,
  type Skala,
  type StrategieBezeichner,
} from './config/schema.js';

export { pruefeEbene2 } from './config/ebene2.js';
export { GEWICHTSSUMME_TOLERANZ, pruefeEbene3 } from './config/ebene3.js';

export {
  berechneNettoDegression,
  interpoliereHonorarbasis,
  pruefeNettoDegression,
  pruefeStufenDegression,
  type NettoDegressionsBefund,
  type Randkurve,
} from './config/degression.js';

export {
  KonfigurationSchema,
  validiereKonfiguration,
  type Aufwandfaktor,
  type KonfigurationsErgebnis,
  type OffertKonfiguration,
  type Stuetzstelle,
} from './config/validieren.js';

export {
  GESPERRTE_PFADE,
  mergeKonfiguration,
  type DossierParameter,
  type EffektiveKonfiguration,
  type MergeErgebnis,
  type Preisanpassung,
  type UeberschreibungsProtokoll,
} from './config/merge.js';

export {
  parseKonfiguration,
  type KonfigurationsAbbildung,
} from './config/abbildung.js';

export {
  type AbleitungsName,
  type AnpassungsVorlage as KernAnpassungsVorlage,
  type FaktorParameter,
  type Faktormenge,
  type Faktorskala,
  type FaktorQuelle as KernFaktorQuelle,
  type Konfiguration,
  type KonfigurationsMeta,
  type PreisanpassungsKonfiguration,
  type Referenzverteilung,
  type Skalierungsparameter,
  type StrategieBezeichner as KernStrategieBezeichner,
  type Stuetzstelle as KernStuetzstelle,
} from './config/typen.js';
