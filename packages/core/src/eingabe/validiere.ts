// Keine Formel; prueft die Vorbedingungen von eq:wohnungspreis (z_j > -1, I-06)
// und die konfigurierten Grenzen (I-07). Uebergang Eingabeschicht -> Domaene.
import { quadratmeter, quadratmeterAbNull, rappen } from '../domain/geld.js';
import { einheitId, liegenschaftId, wohnungsnummer, wohnungstypId } from '../domain/ids.js';
import { erzeugeLiegenschaft, type Liegenschaft } from '../domain/liegenschaft.js';
import { fehlschlag, ok, type Result } from '../domain/result.js';
import { liegenschaftEingabeSchema } from './schema.js';

export interface EingabeFehler {
  readonly feld: string;
  readonly code: string;
  readonly parameter: Readonly<Record<string, string | number>>;
}

export interface PreisanpassungsGrenzen {
  readonly zMin: number;
  readonly zMax: number;
  readonly begruendungMinLaenge: number;
}

export function validiereLiegenschaftEingabe(
  roh: unknown,
  grenzen: PreisanpassungsGrenzen,
): Result<Liegenschaft, readonly EingabeFehler[]> {
  const geparst = liegenschaftEingabeSchema.safeParse(roh);
  if (!geparst.success) {
    return fehlschlag(
      geparst.error.issues.map((i) => ({
        feld: i.path.join('.'),
        code: 'SCHEMA_VERLETZT',
        parameter: { hinweis: i.code },
      })),
    );
  }
  const daten = geparst.data;
  const fehler: EingabeFehler[] = [];

  daten.einheiten.forEach((e, index) => {
    const feld = `einheiten[${index}].anpassungen`;
    e.anpassungen.forEach((a, ai) => {
      if (a.begruendung.trim().length === 0) {
        fehler.push({ feld: `${feld}[${ai}].begruendung`, code: 'BEGRUENDUNG_FEHLT',
          parameter: { wohnungsnummer: e.wohnungsnummer } });
      } else if (a.begruendung.trim().length < grenzen.begruendungMinLaenge) {
        fehler.push({ feld: `${feld}[${ai}].begruendung`, code: 'BEGRUENDUNG_ZU_KURZ',
          parameter: { wohnungsnummer: e.wohnungsnummer, laenge: a.begruendung.trim().length,
            minLaenge: grenzen.begruendungMinLaenge } });
      }
      if (a.erfassungsform === 'absolut' && a.erfassterBetrag === undefined) {
        fehler.push({ feld: `${feld}[${ai}].erfassterBetrag`, code: 'ERFASSTER_BETRAG_FEHLT',
          parameter: { wohnungsnummer: e.wohnungsnummer } });
      }
    });

    // eq:wohnungspreis — geprueft wird die Summe, nicht der Einzelposten (I-08).
    const zSumme = e.anpassungen.reduce((s, a) => s + a.faktor, 0);
    if (zSumme <= -1) {
      fehler.push({ feld, code: 'Z_MODELLGRENZE',
        parameter: { wohnungsnummer: e.wohnungsnummer, zSumme, art: 'modellgrenze' } });
    } else if (zSumme < grenzen.zMin || zSumme > grenzen.zMax) {
      fehler.push({ feld, code: 'Z_KONFIGURATIONSGRENZE',
        parameter: { wohnungsnummer: e.wohnungsnummer, zSumme,
          min: grenzen.zMin, max: grenzen.zMax, art: 'konfigurationsgrenze' } });
    }
  });

  if (fehler.length > 0) return fehlschlag(fehler);

  const aggregat = erzeugeLiegenschaft({
    id: liegenschaftId(daten.id),
    adresse: daten.adresse,
    wohnungstypen: daten.wohnungstypen.map((t) => ({
      id: wohnungstypId(t.id),
      zimmerzahl: t.zimmerzahl,
      parametrisierung: {
        ...t.parametrisierung,
        flaecheInnen: quadratmeter(t.parametrisierung.flaecheInnen),
        flaecheAussen: quadratmeterAbNull(t.parametrisierung.flaecheAussen),
      },
    })),
    einheiten: daten.einheiten.map((e) => ({
      id: einheitId(e.id),
      wohnungsnummer: wohnungsnummer(e.wohnungsnummer),
      wohnungstypId: wohnungstypId(e.wohnungstypId),
      flaecheInnen: quadratmeter(e.flaecheInnen),
      flaecheAussen: quadratmeterAbNull(e.flaecheAussen),
      anpassungen: e.anpassungen.map((a) =>
        a.erfassterBetrag === undefined
          ? { faktor: a.faktor, begruendung: a.begruendung, erfassungsform: a.erfassungsform }
          : { faktor: a.faktor, begruendung: a.begruendung, erfassungsform: a.erfassungsform,
              erfassterBetrag: rappen(a.erfassterBetrag) },
      ),
    })),
  });

  if (!aggregat.ok) {
    return fehlschlag(
      aggregat.fehler.map((f) => ({
        feld: 'liegenschaft',
        code: f.code,
        parameter: Object.fromEntries(
          Object.entries(f.parameter).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v as string | number)]),
        ),
      })),
    );
  }
  return ok(aggregat.wert);
}
