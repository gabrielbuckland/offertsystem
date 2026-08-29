// Keine eigene Formel mehr an dieser Stelle: eq:normalisierung liegt seit der
// Strategy-Pattern-Ausgliederung unter src/normalization/ (Brief §5.5, I-22) — eine
// kuenftige Strategie beruehrt ausschliesslich Dateien dort (E-15, Messlatte 6.3).
// Dieser duenne Re-Export haelt die bestehenden Importpfade der Aufrufer stabil.
export { alleStrategien, loeseStrategieAuf } from '../normalization/registry.js';
export type { NormalisierterFaktor, Normalisierungsstrategie } from '../normalization/strategie.js';
