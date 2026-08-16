/**
 * Keine Formel. Namensbildung der PDF-Auslieferung.
 *
 * ABWEICHUNG VOM PLAN, erzwungen: Der Plan exportiert `dateiname` aus dem Route Handler.
 * Next.js laesst in einer `route.ts` ausschliesslich die Handler-Exporte und einige
 * benannte Konfigurationswerte zu und bricht den Build bei jedem weiteren Export ab. Die
 * Funktion steht deshalb hier — die Absicht des Plans bleibt gewahrt: Sie ist ohne
 * laufenden Server pruefbar, und der Handler bleibt der duenne Adapter (Brief §5.1).
 */
export function dateiname(
  metadaten: { readonly referenznummer: string; readonly erstelltAm: string },
): string {
  return `${metadaten.referenznummer}_${metadaten.erstelltAm.slice(0, 10)}.pdf`;
}
