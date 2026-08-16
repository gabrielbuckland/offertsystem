/**
 * Keine Modellformel. Erweiterungsszenario Risikoindex (Spec 02 §7.1).
 *
 * Die Renormalisierung ist BEWUSST NICHT automatisiert: Eine automatische Normierung
 * wuerde die Summenbedingung trivial erfuellen und damit die dritte Pruefebene ihres
 * Zwecks berauben — der Bediener soll die veraenderte Gewichtung sehen und verantworten.
 * Das Werkzeug rechnet die Werte VOR und schreibt sie in eine eigene Datei; es veraendert
 * `config/company-defaults.json` nicht.
 */
import { sortiereNachSchluessel } from '../shared/artefakt.ts';
import { klone } from '../shared/konfig.ts';

export const RISIKOINDEX_GEWICHT = 0.10;

export const RISIKOINDEX = {
  bezeichnung: 'Risikoindex (Marktvolatilitaet der Region)',
  quelle: 'manuell',
  quellSchluessel: 'risikoindex',
  strategie: 'minmax',
  min: 1,
  max: 6,
  gewicht: RISIKOINDEX_GEWICHT,
} as const;

interface RohFaktoren {
  aufwandfaktoren: Record<string, { gewicht: number }>;
  meta: { konfigVersion: string; beschreibung: string };
}

export function erweitereUmRisikoindex(basisRoh: unknown): unknown {
  const roh = klone(basisRoh) as RohFaktoren;
  const skala = 1 - RISIKOINDEX_GEWICHT;
  for (const [id] of sortiereNachSchluessel(roh.aufwandfaktoren)) {
    const faktor = roh.aufwandfaktoren[id];
    if (faktor !== undefined) faktor.gewicht *= skala;
  }
  roh.aufwandfaktoren['risikoindex'] = { ...RISIKOINDEX };
  roh.meta = {
    ...roh.meta,
    konfigVersion: `${roh.meta.konfigVersion}+risikoindex`,
    beschreibung:
      'Erweiterungsszenario 6.3: Aufwandfaktor Risikoindex, Gewichte renormalisiert.',
  };
  return roh;
}

/** Gegenprobe: Aufnahme OHNE Renormalisierung, Sigma w = 1.10 (Spec 02 §7.3). */
export function verletzendeVariante(basisRoh: unknown): unknown {
  const roh = klone(basisRoh) as RohFaktoren;
  roh.aufwandfaktoren['risikoindex'] = { ...RISIKOINDEX };
  roh.meta = {
    ...roh.meta,
    konfigVersion: `${roh.meta.konfigVersion}+risikoindex-ohne-renorm`,
    beschreibung:
      'Gezielt verletzende Variante: Sigma w = 1.10, muss zurueckgewiesen werden (I-12).',
  };
  return roh;
}
