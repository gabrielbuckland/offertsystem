/**
 * Keine Formel. Prozessweite Serialisierung je `dossierId`.
 *
 * Das Dossier ist eine zustandsbehaftete, gemeinsam genutzte Ressource; E3 und E4
 * bilden ein Read-Modify-Compute-Paar darauf. Zwei nebenlaeufige Typen-Durchlaeufe
 * ueberschrieben einander (Lost Update), und die API bietet dagegen kein Mittel
 * (kein ETag, kein Idempotenzschluessel, leerer Body bei E4). Die einzige
 * verlaessliche Serialisierung ist die Sequenz auf Aufruferseite.
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
