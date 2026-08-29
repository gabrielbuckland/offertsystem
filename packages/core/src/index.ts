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
  type Merkmal,
  type PreisanpassungsKonfiguration,
  type Referenzverteilung,
  type Skalierungsparameter,
  type StrategieBezeichner as KernStrategieBezeichner,
  type Stuetzstelle as KernStuetzstelle,
} from './config/typen.js';

// Berechnungskern, angefuegt und nicht ersetzt (PE-15). Die fuenf Stufen sind einzeln
// exportiert und einzeln aufrufbar (NFA-03); `berechne` ist nur Verkettung.
export type { Branded } from './domain/brand.js';
export * from './domain/ids.js';
export * from './domain/geld.js';
export * from './domain/result.js';
export type { Adresse } from './domain/adresse.js';
export type { Regelspur, ZuAbschlag } from './domain/zuabschlag.js';
export type { Einheit } from './domain/einheit.js';
export type { RepraesentativeParametrisierung, Wohnungstyp } from './domain/wohnungstyp.js';
export { erzeugeLiegenschaft } from './domain/liegenschaft.js';
export type {
  AggregatFehler, AggregatFehlerCode, Liegenschaft, LiegenschaftEntwurf,
} from './domain/liegenschaft.js';
export type { BerechnungsFehlerCode } from './fehler/codes.js';
export { stufenFehler } from './fehler/stufenfehler.js';
export type { StufenFehler } from './fehler/stufenfehler.js';
export { validiereLiegenschaftEingabe } from './eingabe/validiere.js';
export type { EingabeFehler, PreisanpassungsGrenzen } from './eingabe/validiere.js';
export * from './ports/valuation-provider.js';
export { alleToleranzen, rangeBreiteToleranz, toleranzFuer } from './config/toleranzen.js';
export type { InvariantenId, Toleranz } from './config/toleranzen.js';
// `normalisiereBereiche` ist oeffentlich, weil sie an JEDER Stelle gebraucht wird, die eine
// Staffel prueft: sie bringt die von Zod inferierte Optionalitaet auf die Domainform, im
// Kern ebenso wie in der Web-Schicht.
export {
  pruefeBereiche, werteBereichsregelAus, normalisiereBereiche,
  type Bereich, type Bereichsregel, type Bereichstreffer,
} from './modell/bereichsregel.js';
export { gewichteteFlaeche } from './modell/flaeche.js';
export { alleStrategien, loeseStrategieAuf } from './normalization/registry.js';
export type { NormalisierterFaktor, Normalisierungsstrategie } from './normalization/strategie.js';
export { skalierung } from './modell/skalierung.js';
export { beschafferFuer } from './pipeline/beschaffer.js';
export type { Beschaffer, BeschaffungsKontext, VermarkterFaktoren } from './pipeline/beschaffer.js';
export { bereiteEingabeAuf } from './pipeline/stufe1-eingabe.js';
export type { EingangsArgumente, PipelineEingang } from './pipeline/stufe1-eingabe.js';
export { berechneVerkaufssumme } from './pipeline/stufe2-verkaufssumme.js';
export type { EinheitPreisPosition, VerkaufssummeErgebnis, WohnungstypAbleitung }
  from './pipeline/stufe2-verkaufssumme.js';
export { ergaenzeAbgeleiteteFaktoren } from './pipeline/stufe2a-abgeleitete.js';
export type { GeschlossenerEingang } from './pipeline/stufe2a-abgeleitete.js';
export { normalisiereFaktoren } from './pipeline/stufe3-normalisierung.js';
export type { NormalisierungErgebnis } from './pipeline/stufe3-normalisierung.js';
export { berechneAufwandindikator } from './pipeline/stufe4-gewichtung.js';
export type { Faktorbeitrag, GewichtungErgebnis } from './pipeline/stufe4-gewichtung.js';
export { bildeHonorarrange } from './pipeline/stufe5-honorar.js';
export type { HonorarErgebnis } from './pipeline/stufe5-honorar.js';
export { berechne } from './pipeline/berechne.js';
export type { BerechnungsErgebnis } from './pipeline/berechne.js';
export { sortiereNachSchluessel } from './util/sortierung.js';

export {
  SERIALISIERUNGS_VERSION,
  deserialisiereEingang,
  deserialisiereKonfiguration,
  serialisiereEingang,
  serialisiereKonfiguration,
} from './pipeline/serialisierung.js';
