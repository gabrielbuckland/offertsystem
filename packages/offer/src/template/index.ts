/**
 * React-Komponenten der HTML-Vorlage (`@offert/offer/template`).
 *
 * Eigener Einstiegspunkt, getrennt vom Paketindex (`../index.ts`): Ein Re-Export dieser
 * `.tsx`-Komponenten ueber den Index zoege React/JSX in JEDEN Aufrufer, auch reine
 * Server-/Logikdateien, die nur Modell- oder Formatfunktionen brauchen. Der jsx-freie
 * Nachweislauf `tsc -p tools/tsconfig.json` (PE-20) scheitert an genau solchen Dateien,
 * sobald sie ueber den Index eine `.tsx`-Datei erreichen.
 */
export { HerkunftsBlock, HerkunftsWert } from './HerkunftsWert.js';
export { OfferteDokument } from './OfferteDokument.js';
export { VermarktungsOfferte } from './VermarktungsOfferte.js';
