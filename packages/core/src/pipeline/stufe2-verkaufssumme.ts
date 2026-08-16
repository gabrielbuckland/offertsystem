// eq:flaeche, eq:qm_preis, eq:wohnungspreis, eq:verkaufssumme.
// Rundungsstelle R2 liegt am Wohnungspreis nach Anwendung der Zu-/Abschlaege; q_t und
// basispreis bleiben ungerundete Zwischenwerte (Brief §5.3, E-09).
// Sonderfaelle: S-04 (A_t_ref = 0), S-06 (z_j <= -1 bzw. ausserhalb der Grenzen).
import { rappen, rundeAufRappen, type Rappen } from '../domain/geld.js';
import type { Wohnungsnummer, WohnungstypId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import type { ZuAbschlag } from '../domain/zuabschlag.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import { gewichteteFlaeche } from '../modell/flaeche.js';
import type { PipelineEingang } from './stufe1-eingabe.js';

export interface WohnungstypAbleitung {
  readonly wohnungstypId: WohnungstypId;
  readonly referenzwert: Rappen; // P_t_ref
  readonly referenzflaeche: number; // A_t_ref, eq:flaeche
  readonly quadratmeterpreis: number; // q_t, UNGERUNDET, Rappen/m^2
}

export interface EinheitPreisPosition {
  readonly wohnungsnummer: Wohnungsnummer;
  readonly wohnungstypId: WohnungstypId;
  readonly gewichteteFlaeche: number; // A_j
  readonly quadratmeterpreis: number; // q_t, UNGERUNDET
  readonly basispreis: number; // q_t * A_j vor Anpassungen, UNGERUNDET
  readonly anpassungssumme: number; // z_j
  readonly anpassungen: readonly ZuAbschlag[]; // Einzelausweis, I-09, A-14
  readonly preis: Rappen; // p_j, gerundet (R2)
}

export interface VerkaufssummeErgebnis {
  readonly typAbleitungen: readonly WohnungstypAbleitung[];
  readonly positionen: readonly EinheitPreisPosition[];
  readonly verkaufssumme: Rappen; // V
  readonly einheitenzahl: number; // m
  readonly alpha: number; // verwendeter Parameter, NFA-07
}

export function berechneVerkaufssumme(
  eingang: PipelineEingang,
): Result<VerkaufssummeErgebnis, StufenFehler> {
  const alpha = eingang.konfiguration.flaeche.alpha;
  const { zMin, zMax } = eingang.konfiguration.preisanpassung;

  const ableitungen = new Map<WohnungstypId, WohnungstypAbleitung>();
  for (const typ of eingang.liegenschaft.wohnungstypen) {
    const bewertung = eingang.bewertungen.get(typ.id);
    if (bewertung === undefined) {
      // Tiefenverteidigung: in Stufe 1 bereits als S-03 abgefangen.
      return fehlschlag(
        stufenFehler(2, 'REFERENZBEWERTUNG_FEHLT',
          { zimmerzahl: typ.zimmerzahl, wohnungstypId: typ.id, wohnungsnummern: [], vollstaendig: 'false' },
          { wohnungstyp: typ.id }),
      );
    }
    // eq:flaeche fuer die repraesentative Parametrisierung, mit demselben alpha.
    const referenzflaeche = gewichteteFlaeche(
      typ.parametrisierung.flaecheInnen, typ.parametrisierung.flaecheAussen, alpha,
    );
    if (referenzflaeche === 0) {
      return fehlschlag(
        stufenFehler(2, 'REFERENZFLAECHE_NULL', {
          zimmerzahl: typ.zimmerzahl,
          wohnungstypId: typ.id,
          flaecheInnen: typ.parametrisierung.flaecheInnen,
          flaecheAussen: typ.parametrisierung.flaecheAussen,
          alpha,
        }, { wohnungstyp: typ.id }),
      );
    }
    // eq:qm_preis — ungerundet; jede Rundung hier bricht I-05 (Spec 03 §5.4).
    ableitungen.set(typ.id, {
      wohnungstypId: typ.id,
      referenzwert: bewertung.marktwert,
      referenzflaeche,
      quadratmeterpreis: bewertung.marktwert / referenzflaeche,
    });
  }

  const positionen: EinheitPreisPosition[] = [];
  const einheiten = [...eingang.liegenschaft.einheiten].sort((a, b) =>
    a.wohnungsnummer < b.wohnungsnummer ? -1 : a.wohnungsnummer > b.wohnungsnummer ? 1 : 0,
  );
  for (const einheit of einheiten) {
    const ableitung = ableitungen.get(einheit.wohnungstypId)!;
    const flaeche = gewichteteFlaeche(einheit.flaecheInnen, einheit.flaecheAussen, alpha);
    // eq:wohnungspreis — z_j = Summe der Einzelbeitraege, additiv (I-08).
    const zSumme = einheit.anpassungen.reduce((s, a) => s + a.faktor, 0);
    if (zSumme <= -1) {
      return fehlschlag(
        stufenFehler(2, 'ANPASSUNG_UNZULAESSIG',
          { wohnungsnummer: einheit.wohnungsnummer, zSumme, art: 'modellgrenze' },
          { einheit: einheit.wohnungsnummer }),
      );
    }
    if (zSumme < zMin || zSumme > zMax) {
      return fehlschlag(
        stufenFehler(2, 'ANPASSUNG_UNZULAESSIG', {
          wohnungsnummer: einheit.wohnungsnummer,
          zSumme,
          min: zMin,
          max: zMax,
          anpassungen: einheit.anpassungen.map((a) => `${a.faktor}|${a.begruendung}`),
          art: 'konfigurationsgrenze',
        }, { einheit: einheit.wohnungsnummer }),
      );
    }
    const basispreis = ableitung.quadratmeterpreis * flaeche;
    positionen.push({
      wohnungsnummer: einheit.wohnungsnummer,
      wohnungstypId: einheit.wohnungstypId,
      gewichteteFlaeche: flaeche,
      quadratmeterpreis: ableitung.quadratmeterpreis,
      basispreis,
      anpassungssumme: zSumme,
      anpassungen: einheit.anpassungen,
      preis: rundeAufRappen(basispreis * (1 + zSumme)), // R2
    });
  }

  // eq:verkaufssumme — exakte Ganzzahlsumme; keine Rundung noetig (Spec 03 §5.3).
  const verkaufssumme = rappen(positionen.reduce((s, p) => s + p.preis, 0));

  return ok({
    typAbleitungen: [...ableitungen.values()].sort((a, b) =>
      a.wohnungstypId < b.wohnungstypId ? -1 : a.wohnungstypId > b.wohnungstypId ? 1 : 0,
    ),
    positionen,
    verkaufssumme,
    einheitenzahl: positionen.length,
    alpha,
  });
}
