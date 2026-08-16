// Keine Formel. Postalische Angabe der Liegenschaft; geht in die Bewertungsanfrage ein.
export interface Adresse {
  readonly strasse: string;
  readonly hausnummer: string;
  readonly plz: string;
  readonly ort: string;
}
