/**
 * Keine Formel. Uebersetzungsschicht Fehlercode -> Anzeigetext (E-03).
 *
 * Der Kern kennt keine Anzeigesprache; er kennt Sachverhalte. Die Texte liegen hier als
 * Vorlagen und duerfen ausschliesslich Platzhalter verwenden, die der Kern auch
 * uebergibt — Spec 03 §8 ist insoweit Vertragsbestandteil. Ein Text im Kern waere in der
 * Berechnungskette nicht austauschbar und ausserdem nicht uebersetzbar.
 *
 * `KERN_VORLAGEN` ist als `Record<BerechnungsFehlerCode, Vorlage>` typisiert: Ein neuer
 * Code bricht die Uebersetzung bei der Uebersetzung, nicht erst zur Laufzeit.
 *
 * Platzhalter sind Daten, keine Strings: Die Formatierung laeuft ueber dieselben
 * Formatierer wie die Offerte, damit Zahlen im Fehlertext und im Dokument gleich aussehen.
 */
import type {
  AggregatFehler, AggregatFehlerCode, BerechnungsFehlerCode, ProviderFehler, StufenFehler,
} from '@offert/core';
// Modulpfad statt Paketindex: Der Index re-exportiert die React-Komponenten (.tsx);
// Node leistet fuer JSX kein Type-Stripping (PE-09). Serverseitige Module, die unter
// Node laufen sollen, binden die Formatierer deshalb ueber ihren Modulpfad ein.
import { formatiereAggregat, formatiereProzent, formatiereScore } from '@offert/offer/src/format/de-ch.js';

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
 * Uebersetzung fuer `erzeugeLiegenschaft`s Aggregatfehler (`liegenschaft.ts`) — strukturelle
 * Maengel im Projektstand (doppelte Wohnungsnummer, Referenzobjekt ohne Einheit etc.), noch
 * vor der eigentlichen Berechnung. Ohne diese Vorlagen zeigte die Oberflaeche den rohen
 * Fehlercode samt JSON-Parametern an (`eingang.ts`s frueheres `zuText`).
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
 * Ladezeitcodes ohne Laufzeitzwilling (E-16).
 *
 * Die drei Saetze wurden neu gefasst, weil sie ueber Sachverhalte sprachen, die der Kern
 * an dieser Stelle gar nicht meldet: eine Stufenliste, die er nie schickt, einen
 * Faktornamen, den die Schemapruefung nicht kennt, eine letzte Stuetzstelle, die es im
 * Fehlerfall nicht gibt. Sie lasen dadurch `undefined`/`NaN` — und
 * `CFG_STRATEGY_UNKNOWN` warf sogar, weil `verfuegbare` ein String ist und `liste`
 * darauf `.join` aufrief. Jede Vorlage nennt jetzt genau die Groessen, die im
 * `KonfigurationsFehler` stehen.
 *
 * Den Feldanker liefert der `pfad` des Befunds, nicht der Text: Welcher Faktor bzw.
 * welche Stuetzstelle gemeint ist, steht dort (z. B.
 * `aufwandfaktoren.lage_gesamt.strategie`). Die Saetze wiederholen ihn nicht.
 */
export const KONFIG_VORLAGEN = {
  // Kern liefert `bezeichner` und `verfuegbare` — letzteres als fertigen String, nicht
  // als Liste (`validieren.ts`: `issue.options.join(', ')`).
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
 * Benannte Ausnahme von E-03: Der ACL uebersetzt Fremdsystemfehler selbst (Spec 04 §6.5),
 * weil sie einem anderen Fehlerraum entstammen — nicht abschliessend bekannt und nach
 * NFA-11 gerade nicht ungefiltert durchzureichen. Diese Schicht bildet sie nicht erneut ab.
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
