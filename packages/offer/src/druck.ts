/**
 * Server-only Einstiegspunkt fuer den PDF-Export (`@offert/offer/druck`).
 *
 * Getrennt von `index.ts`, weil `druckeOfferte` `playwright` in den Abhaengigkeitsgraphen
 * zieht. Ueber den Paketindex landete es im Browser-Bundle der Erfassungsmaske und der
 * Next-Build scheiterte. Import ausschliesslich aus Node-/Server-Kontexten.
 */
export { druckeOfferte } from './pdf/drucke-offerte.js';
