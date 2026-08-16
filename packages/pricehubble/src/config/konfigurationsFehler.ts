/**
 * Adapterinterner Fehlertyp Nr. 10 (Spec 04 §6.5.3, E-02).
 *
 * Er ist ausdruecklich KEINE ProviderFehler-Variante: Er tritt bei der
 * Initialisierung auf, nicht bei einem Abruf, und liegt damit auf demselben Pfad
 * wie die Konfigurationsvalidierung (I-21) — Zurueckweisung, bevor gerechnet wird.
 */
export class KonfigurationsFehler extends Error {
  public override readonly name = 'KonfigurationsFehler';

  public constructor(
    public readonly schluessel: string,
    grund: string,
  ) {
    super(`Die Verbindung zu PriceHubble ist nicht eingerichtet: ${schluessel} — ${grund}`);
  }
}
