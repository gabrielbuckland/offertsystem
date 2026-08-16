/**
 * Keine Formel. Prozessweite Serialisierung je `dossierId` (Spec 04 §3.2).
 *
 * Das Dossier ist eine zustandsbehaftete, gemeinsam genutzte Ressource unter einer
 * festen Kennung; E3 und E4 bilden ein Read-Modify-Compute-Paar auf genau diesem
 * Zustand. Zwei nebenlaeufige Typen-Durchlaeufe ueberschrieben einander (Lost Update),
 * und die Antwort von E4 waere nicht mehr dem Typ zuordenbar, der den vorangehenden
 * PATCH gesendet hat. Die API bietet dagegen kein Mittel: kein If-Match/ETag, kein
 * Idempotenzschluessel, keine requestgebundene Parametrisierung bei E4 (leerer Body).
 * Die einzige verlaessliche Serialisierung ist die Sequenz auf Aufruferseite.
 */
export class Warteschlange {
  private readonly schwaenze = new Map<string, Promise<unknown>>();

  public async reiheEin<T>(dossierId: string, arbeit: () => Promise<T>): Promise<T> {
    const vorgaenger = this.schwaenze.get(dossierId) ?? Promise.resolve();
    const lauf = vorgaenger.then(arbeit, arbeit);
    // Fehlschlaege duerfen die Schlange nicht blockieren und nicht unbehandelt bleiben.
    this.schwaenze.set(
      dossierId,
      lauf.catch(() => undefined),
    );
    return lauf;
  }
}
