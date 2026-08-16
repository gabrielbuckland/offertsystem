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
import type { BerechnungsFehlerCode, ProviderFehler, StufenFehler } from '@offert/core';
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
      + `statt 1. Betroffene Faktoren: ${liste(p, 'faktorliste')}.`,
  }),
  ANPASSUNG_UNZULAESSIG: (p) => ({
    adressat: 'vermarkter',
    feldpfad: `einheiten.${String(p['wohnungsnummer'])}.anpassungen`,
    text: p['grund'] === 'modell'
      ? `Einheit ${String(p['wohnungsnummer'])}: Die Summe der Anpassungen beträgt `
        + `${formatiereProzent(zahl(p, 'z'))}. Sie muss grösser als −1 sein (−100 %), `
        + 'da sonst kein positiver Wohnungspreis entsteht.'
      : `Einheit ${String(p['wohnungsnummer'])}: Die Summe der Anpassungen beträgt `
        + `${formatiereProzent(zahl(p, 'z'))} und liegt ausserhalb des zulässigen `
        + `Bereichs [${formatiereProzent(zahl(p, 'min'))}, `
        + `${formatiereProzent(zahl(p, 'max'))}]. Anpassungen: ${liste(p, 'anpassungsliste')}.`,
  }),
  STUFE_ENTARTET: (p) => ({
    adressat: 'auftraggeber',
    text: `Honorarstufe ${String(p['k'])}: Unter- und Obergrenze der Verkaufssumme sind identisch `
      + `(${formatiereAggregat(zahl(p, 'wert'))}). Jede Stufe muss ein Intervall `
      + 'positiver Breite bilden.',
  }),
  VERKAUFSSUMME_AUSSERHALB: (p) => ({
    adressat: 'auftraggeber',
    text: `Die berechnete Verkaufssumme von ${formatiereAggregat(zahl(p, 'v'))} liegt `
      + 'ausserhalb des konfigurierten Bereichs der Honorarstaffelung '
      + `(${formatiereAggregat(zahl(p, 'vMin'))} bis ${formatiereAggregat(zahl(p, 'vMax'))}). `
      + 'Die Honorarstaffelung ist zu erweitern.',
  }),
};

export function uebersetzeStufenFehler(fehler: StufenFehler): AngezeigterFehler {
  return KERN_VORLAGEN[fehler.code](fehler.parameter);
}

/** Ladezeitcodes ohne Laufzeitzwilling (E-16). */
export const KONFIG_VORLAGEN = {
  CFG_STRATEGY_UNKNOWN: (p: Parameter) =>
    `Aufwandfaktor «${String(p['bezeichnung'])}»: Normalisierungsstrategie `
    + `«${String(p['bezeichner'])}» ist nicht bekannt. Verfügbar: ${liste(p, 'verfuegbare')}.`,
  CFG_TIER_ORDER: (p: Parameter) =>
    'Die konfigurierte Honorarstaffelung ist nicht lückenlos aufsteigend. '
    + `Betroffene Stufen: ${liste(p, 'stufen')}.`,
  CFG_TIER_OPEN: (p: Parameter) =>
    `Die oberste Honorarstufe ${String(p['stufenindex'])} hat oberhalb von `
    + `${formatiereAggregat(zahl(p, 'letzteStuetzstelle'))} keine abschliessende `
    + 'Stützstelle. Die Staffelung ist in der Konfiguration zu vervollständigen.',
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
