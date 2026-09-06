// Ausgelagert aus dem Route Handler: Next.js laesst in `route.ts` nur Handler-Exporte und
// einige benannte Konfigurationswerte zu und bricht den Build bei jedem weiteren Export ab.
export function dateiname(
  metadaten: { readonly offertId: string; readonly erstelltAm: string },
): string {
  return `${metadaten.offertId.slice(0, 8)}_${metadaten.erstelltAm.slice(0, 10)}.pdf`;
}
