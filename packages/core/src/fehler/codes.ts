// Keine Formel. Laufzeit-Fehlercodes der Stufen (Spec 03 §8). Die Ladezeitvariante
// desselben Sachverhalts traegt einen CFG_*-Code aus Spec 02 (E-16).
export type BerechnungsFehlerCode =
  | 'NORM_GRENZEN_IDENTISCH' // S-01, Laufzeit-Vorbedingung
  | 'FAKTOR_FEHLT' // S-02
  | 'REFERENZBEWERTUNG_FEHLT' // S-03
  | 'REFERENZFLAECHE_NULL' // S-04
  | 'GEWICHTSSUMME_UNGUELTIG' // S-05, Laufzeit-Vorbedingung
  | 'ANPASSUNG_UNZULAESSIG' // S-06
  | 'STUFE_ENTARTET' // S-08, Laufzeit-Vorbedingung
  | 'VERKAUFSSUMME_AUSSERHALB'; // S-09/S-10
