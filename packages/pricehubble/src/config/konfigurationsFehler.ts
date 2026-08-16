/**
 * Adapterinterner Fehlertyp Nr. 10 (Spec 04 §6.5.3, E-02).
 *
 * Er ist ausdruecklich KEINE ProviderFehler-Variante: Er tritt bei der
 * Initialisierung auf, nicht bei einem Abruf, und liegt damit auf demselben Pfad
 * wie die Konfigurationsvalidierung (I-21) — Zurueckweisung, bevor gerechnet wird.
 */
export class KonfigurationsFehler extends Error {
  public override readonly name = 'KonfigurationsFehler';

  public readonly schluessel: string;

  // Feldzuweisung statt Parametereigenschaft: `node --experimental-strip-types`
  // (PE-09) uebersetzt nicht, es entfernt nur Typen — Parametereigenschaften
  // haetten eine Codeerzeugung verlangt und sind dort nicht zulaessig.
  public constructor(schluessel: string, grund: string) {
    super(`Die Verbindung zu PriceHubble ist nicht eingerichtet: ${schluessel} — ${grund}`);
    this.schluessel = schluessel;
  }
}
