// Keine Formel (E-32). Stufe 1 rechnet nicht; sie stellt her, was die Stufen 2-5 als
// gegeben annehmen duerfen (I-02). Sonderfaelle: S-02 (phase 'quelle'), S-03.
import type { FaktorId, WohnungstypId } from '../domain/ids.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import type { Liegenschaft } from '../domain/liegenschaft.js';
import { stufenFehler, type StufenFehler } from '../fehler/stufenfehler.js';
import type { Konfiguration } from '../config/typen.js';
import type { Lagescores, Referenzbewertung } from '../ports/valuation-provider.js';
import { sortiereNachSchluessel } from '../util/sortierung.js';
import { beschafferFuer, type BeschaffungsKontext, type VermarkterFaktoren } from './beschaffer.js';

export interface EingangsArgumente {
  readonly liegenschaft: Liegenschaft;
  readonly bewertungen: readonly Referenzbewertung[];
  readonly bewertungsbuendelVollstaendig: boolean; // aus BewertungsBuendel (US-15)
  readonly lagescores: Lagescores;
  readonly vermarkterFaktoren: VermarkterFaktoren;
  readonly konfiguration: Konfiguration;
  readonly zeitstempel: string; // hereingereicht (E-29)
}

export interface PipelineEingang {
  readonly liegenschaft: Liegenschaft;
  readonly bewertungen: ReadonlyMap<WohnungstypId, Referenzbewertung>;
  readonly rohfaktoren: ReadonlyMap<FaktorId, number>;
  readonly offeneFaktoren: readonly FaktorId[];
  readonly verworfeneRohwerte: readonly string[];
  readonly konfiguration: Konfiguration;
  readonly zeitstempel: string;
}

export function bereiteEingabeAuf(
  eingang: EingangsArgumente,
): Result<PipelineEingang, StufenFehler> {
  const bewertungen = new Map(eingang.bewertungen.map((b) => [b.wohnungstypId, b]));

  // Vollstaendigkeitspruefung (S-03, US-05, I-24): jeder von einer Einheit referenzierte
  // Wohnungstyp braucht eine Referenzbewertung. Kein Ueberspringen, kein Ersatzwert.
  for (const typ of eingang.liegenschaft.wohnungstypen) {
    if (bewertungen.has(typ.id)) continue;
    const betroffen = eingang.liegenschaft.einheiten
      .filter((e) => e.wohnungstypId === typ.id)
      .map((e) => e.wohnungsnummer as string)
      .sort();
    return fehlschlag(
      stufenFehler(
        1,
        'REFERENZBEWERTUNG_FEHLT',
        {
          zimmerzahl: typ.zimmerzahl,
          wohnungstypId: typ.id,
          wohnungsnummern: betroffen,
          vollstaendig: String(eingang.bewertungsbuendelVollstaendig),
        },
        { wohnungstyp: typ.id },
      ),
    );
  }

  const kontext: BeschaffungsKontext = {
    lagescores: eingang.lagescores,
    vermarkterFaktoren: eingang.vermarkterFaktoren,
  };

  const rohfaktoren = new Map<FaktorId, number>();
  const offeneFaktoren: FaktorId[] = [];
  for (const [id, parameter] of sortiereNachSchluessel(eingang.konfiguration.faktoren)) {
    const beschaffer = beschafferFuer(parameter.quelle);
    const wert = beschaffer.beschaffe(parameter.quellSchluessel, kontext, parameter, id, 1);
    if (!wert.ok) return fehlschlag(wert.fehler);
    if (wert.wert === 'spaeter') offeneFaktoren.push(id);
    else rohfaktoren.set(id, wert.wert);
  }

  // Gegenrichtung zu S-02: ein gelieferter Rohwert ohne Konfigurationseintrag ist kein
  // Fehler. Er wird verworfen und protokolliert (die API liefert bis zu neun Lagescores).
  const genutzteLagescores = new Set(
    [...eingang.konfiguration.faktoren.values()]
      .filter((p) => p.quelle === 'lagescore')
      .map((p) => p.quellSchluessel),
  );
  const genutzteManuelle = new Set(
    [...eingang.konfiguration.faktoren.values()]
      .filter((p) => p.quelle === 'manuell')
      .map((p) => p.quellSchluessel),
  );
  const verworfeneRohwerte = [
    ...[...eingang.lagescores.werte.keys()]
      .filter((n) => !genutzteLagescores.has(n))
      .map((n) => `lagescore:${n}`),
    ...[...eingang.vermarkterFaktoren.werte.keys()]
      .filter((n) => !genutzteManuelle.has(n))
      .map((n) => `manuell:${n}`),
  ].sort();

  return ok({
    liegenschaft: eingang.liegenschaft,
    bewertungen,
    rohfaktoren,
    offeneFaktoren,
    verworfeneRohwerte,
    konfiguration: eingang.konfiguration,
    zeitstempel: eingang.zeitstempel,
  });
}
