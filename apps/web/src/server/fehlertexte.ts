// E-03: Uebersetzungsschicht Fehlercode -> Anzeigetext. Der Kern kennt keine
// Anzeigesprache, nur Sachverhalte; Texte duerfen nur Platzhalter verwenden, die der Kern
// auch uebergibt. `KERN_VORLAGEN` ist als `Record<BerechnungsFehlerCode, Vorlage>`
// typisiert, damit ein neuer Code beim Kompilieren bricht statt erst zur Laufzeit.
import type {
  AggregatFehler, AggregatFehlerCode, BerechnungsFehlerCode, ProviderFehler, StufenFehler,
} from '@offert/core';
// PE-09: Modulpfad statt Paketindex — der Index re-exportiert .tsx, fuer die Node kein
// Type-Stripping leistet.
import { formatiereAggregat, formatiereProzent, formatiereScore } from '@offert/offer';

export interface AngezeigterFehler {
  readonly text: string;
  /** Feldpfad, an dem die Meldung verankert wird; leer bei Konfigurationsfehlern. */
  readonly feldpfad?: string;
  readonly adressat: 'vermarkter' | 'auftraggeber';
}

type Parameter = StufenFehler['parameter'];
type Vorlage = (p: Parameter) => AngezeigterFehler;

const zahl = (p: Parameter, k: string): number => Number(p[k]);
const liste = (p: Parameter, k: string): string =>
  ((p[k] as readonly string[] | undefined) ?? []).join(', ');

/** Sekunden je Minute; Einheitenumrechnung, kein Verhaltensparameter. */
const SEKUNDEN_JE_MINUTE = 60;

export const KERN_VORLAGEN: Record<BerechnungsFehlerCode, Vorlage> = {
  NORM_GRENZEN_IDENTISCH: (p) => ({
    adressat: 'auftraggeber',
    text: `Aufwandfaktor «${String(p['bezeichnung'])}»: Normalisierungsgrenzen sind identisch `
      + `(${formatiereScore(zahl(p, 'wert'))}). Ober- und Untergrenze müssen sich unterscheiden.`,
  }),
  FAKTOR_FEHLT: (p) => ({
    adressat: 'vermarkter',
    feldpfad: `aufwandfaktoren.${String(p['faktorId'])}`,
    text: `Für den konfigurierten Aufwandfaktor «${String(p['bezeichnung'])}» liegt kein Wert vor. `
      + 'Der Faktor ist zu erfassen oder in der Konfiguration zu deaktivieren.',
  }),
  REFERENZBEWERTUNG_FEHLT: (p) => ({
    adressat: 'vermarkter',
    text: `Für Wohnungstyp «${String(p['zimmerzahl'])} Zimmer» liegt keine Referenzbewertung vor. `
      + `Betroffen sind die Einheiten ${liste(p, 'wohnungsnummern')}. `
      + 'Die Berechnung wurde nicht ausgeführt.',
  }),
  REFERENZFLAECHE_NULL: (p) => ({
    adressat: 'vermarkter',
    feldpfad: `wohnungstypen.${String(p['wohnungstypId'])}.parametrisierung.flaecheInnen`,
    text: `Wohnungstyp «${String(p['zimmerzahl'])} Zimmer»: Die gewichtete Referenzfläche ist null. `
      + 'Wohnfläche und Aussenfläche der repräsentativen Parametrisierung sind zu prüfen '
      + `(verwendetes α = ${formatiereScore(zahl(p, 'alpha'))}).`,
  }),
  GEWICHTSSUMME_UNGUELTIG: (p) => ({
    adressat: 'auftraggeber',
    text: `Die Summe der Faktorgewichte beträgt ${formatiereScore(zahl(p, 'summe'))} `
      + `statt 1. Betroffene Faktoren: ${liste(p, 'faktoren')}.`,
  }),
  ANPASSUNG_UNZULAESSIG: (p) => ({
    adressat: 'vermarkter',
    feldpfad: `einheiten.${String(p['wohnungsnummer'])}.anpassungen`,
    text: p['art'] === 'modellgrenze'
      ? `Einheit ${String(p['wohnungsnummer'])}: Die Summe der Anpassungen beträgt `
        + `${formatiereProzent(zahl(p, 'zSumme'))}. Sie muss grösser als −1 sein (−100 %), `
        + 'da sonst kein positiver Wohnungspreis entsteht.'
      : `Einheit ${String(p['wohnungsnummer'])}: Die Summe der Anpassungen beträgt `
        + `${formatiereProzent(zahl(p, 'zSumme'))} und liegt ausserhalb des zulässigen `
        + `Bereichs [${formatiereProzent(zahl(p, 'min'))}, `
        + `${formatiereProzent(zahl(p, 'max'))}]. Anpassungen: ${liste(p, 'anpassungen')}.`,
  }),
  STUFE_ENTARTET: (p) => ({
    adressat: 'auftraggeber',
    text: `Honorarstufe ${String(p['stufenindex'])}: Unter- und Obergrenze der Verkaufssumme `
      + `sind identisch (${formatiereAggregat(zahl(p, 'wert'))}). Jede Stufe muss ein Intervall `
      + 'positiver Breite bilden.',
  }),
  VERKAUFSSUMME_AUSSERHALB: (p) => ({
    adressat: 'auftraggeber',
    text: `Die berechnete Verkaufssumme von ${formatiereAggregat(zahl(p, 'verkaufssumme'))} liegt `
      + 'ausserhalb des konfigurierten Bereichs der Honorarstaffelung '
      + `(${formatiereAggregat(zahl(p, 'bereichVon'))} bis `
      + `${formatiereAggregat(zahl(p, 'bereichBis'))}). `
      + 'Die Honorarstaffelung ist zu erweitern.',
  }),
};

export function uebersetzeStufenFehler(fehler: StufenFehler): AngezeigterFehler {
  return KERN_VORLAGEN[fehler.code](fehler.parameter);
}

type AggregatParameter = AggregatFehler['parameter'];
const aggregatListe = (p: AggregatParameter, k: string): string =>
  ((p[k] as readonly string[] | undefined) ?? []).join(', ');

/**
 * Uebersetzung fuer `erzeugeLiegenschaft`s Aggregatfehler — strukturelle Maengel im
 * Projektstand (doppelte Wohnungsnummer, Referenzobjekt ohne Einheit etc.), noch vor der
 * eigentlichen Berechnung.
 */
export const AGGREGAT_VORLAGEN: Record<AggregatFehlerCode, (p: AggregatParameter) => string> = {
  KEINE_EINHEIT: () => 'Für die Liegenschaft ist noch keine Einheit erfasst.',
  WOHNUNGSNUMMER_DOPPELT: (p) => {
    const nummern = (p['wohnungsnummern'] as readonly string[] | undefined) ?? [];
    const mehrzahl = nummern.length > 1;
    return `Die Wohnungsnummer${mehrzahl ? 'n' : ''} ${nummern.join(', ')} `
      + `${mehrzahl ? 'sind' : 'ist'} mehrfach vergeben. Wohnungsnummern müssen eindeutig sein.`;
  },
  WOHNUNGSTYP_UNBEKANNT: (p) =>
    `Folgende Einheiten verweisen auf ein nicht mehr vorhandenes Referenzobjekt: `
    + `${aggregatListe(p, 'einheiten')}.`,
  ZIMMERZAHL_MEHRFACH: (p) =>
    'Mehrere Referenzobjekte führen dieselbe Zimmerzahl '
    + `(${aggregatListe(p, 'zimmerzahlen')}). Jede Zimmerzahl darf nur einem Referenzobjekt `
    + 'zugeordnet sein.',
  WOHNUNGSTYP_OHNE_EINHEIT: (p) => {
    const typen = (p['wohnungstypen'] as readonly string[] | undefined) ?? [];
    const mehrzahl = typen.length > 1;
    return `Für ${mehrzahl ? 'folgende Referenzobjekte ist' : 'folgendes Referenzobjekt ist'} `
      + `noch keine Einheit erfasst: ${typen.join(', ')}. Entweder Einheiten dafür anlegen `
      + `oder ${mehrzahl ? 'die Referenzobjekte' : 'das Referenzobjekt'} entfernen.`;
  },
};

export function uebersetzeAggregatFehler(fehler: readonly AggregatFehler[]): string {
  return fehler.map((f) => AGGREGAT_VORLAGEN[f.code](f.parameter)).join(' ');
}

/**
 * Ladezeitcodes ohne Laufzeitzwilling (E-16). Jede Vorlage nennt nur Groessen, die im
 * `KonfigurationsFehler` tatsaechlich stehen (Trap: `verfuegbare` ist ein fertiger String,
 * kein Array — `.join` darauf wirft).
 *
 * Den Feldanker liefert der `pfad` des Befunds, nicht der Text; die Saetze wiederholen ihn
 * nicht.
 */
export const KONFIG_VORLAGEN = {
  // Kern liefert `bezeichner` und `verfuegbare` — letzteres als fertigen String, nicht
  // als Liste.
  CFG_STRATEGY_UNKNOWN: (p: Parameter) =>
    `Normalisierungsstrategie «${String(p['bezeichner'])}» ist nicht bekannt. `
    + `Verfügbar: ${String(p['verfuegbare'])}.`,
  // Kern liefert das konkrete Paar (`stufe`, `vorher`, `nachher`), nicht eine Liste
  // betroffener Stufen. Der Zusatz zur Stufenbreite gibt die Bedingung des Kerns wieder.
  CFG_TIER_ORDER: (p: Parameter) =>
    `Die Honorarstaffelung ist nicht streng aufsteigend: Stufe ${String(p['stufe'])} `
    + `beginnt bei ${formatiereAggregat(zahl(p, 'vorher'))}, die folgende Stützstelle `
    + `liegt bei ${formatiereAggregat(zahl(p, 'nachher'))}. Jede Stützstelle muss grösser `
    + 'sein als die vorangehende, sonst hat die Stufe die Breite null.',
  // Kern liefert nur `anzahl` (< 2). Von einer «obersten Stufe» kann der Text hier nicht
  // sprechen — es gibt noch keine.
  CFG_TIER_OPEN: (p: Parameter) => {
    const anzahl = zahl(p, 'anzahl');
    return `Die Honorarstaffelung enthält nur ${String(anzahl)} `
      + `${anzahl === 1 ? 'Stützstelle' : 'Stützstellen'}. Für eine abschliessende `
      + 'oberste Stufe sind mindestens zwei nötig. Die Staffelung ist in der '
      + 'Konfiguration zu vervollständigen.';
  },
} as const;

export function uebersetzeKonfigFehler(
  code: keyof typeof KONFIG_VORLAGEN, parameter: Parameter,
): AngezeigterFehler {
  return { text: KONFIG_VORLAGEN[code](parameter), adressat: 'auftraggeber' };
}

/**
 * Benannte Ausnahme von E-03: Der ACL uebersetzt Fremdsystemfehler selbst, weil sie einem
 * anderen Fehlerraum entstammen — nicht abschliessend bekannt und nach NFA-11 gerade
 * nicht ungefiltert durchzureichen. Diese Schicht bildet sie nicht erneut ab.
 */
export function uebersetzeProviderFehler(fehler: ProviderFehler): AngezeigterFehler {
  if (fehler.art === 'kontingent') {
    const minuten = Math.ceil((fehler.wiederholbarNach ?? SEKUNDEN_JE_MINUTE) / SEKUNDEN_JE_MINUTE);
    return {
      adressat: 'vermarkter',
      text: `Abfragelimit erreicht. Bitte in ${minuten} Minuten erneut versuchen.`,
    };
  }
  return { adressat: 'vermarkter', text: fehler.detail };
}
