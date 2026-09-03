/**
 * Bei einem Honorarabbruch (E-04) darf nur die Honorarrange fehlen — Verkaufssumme und
 * Aufwandindikator D bleiben gueltig und MUESSEN in der Aggregatleiste sichtbar bleiben,
 * waehrend die Offert-Schaltflaeche gesperrt bleibt (kein Artefakt, Route antwortet 422,
 * I-24).
 *
 * `ProjektAnsicht.tsx` selbst laesst sich mangels jsdom/Hook-Testbibliothek nicht rendern.
 * Dieser Test geht stattdessen ueber den ECHTEN Produktionspfad: `verarbeiteBerechnungsAntwort`
 * liefert den Stand aus einer echten Honorarabbruch-Antwort, die zwei Anzeige-Fallback-
 * Zeilen werden hier woertlich nachvollzogen und erst DANN an die echte `Aggregatleiste`-
 * Komponente gereicht — nicht nur mit direkt hineingereichten Props isoliert getestet.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatiereAggregat, formatiereScore } from '@offert/offer';
import {
  verarbeiteBerechnungsAntwort, type BerechnungsAntwort,
} from '../../../src/components/projekt/verwende-berechnung.js';
import { Aggregatleiste } from '../../../src/components/projekt/Aggregatleiste.js';
import type { ApiErgebnis } from '../../../src/components/rufe-api.js';

const EINHEITEN = [{ id: 'e1', wohnungsnummer: 'A1' }];

describe('Aggregatleiste bei Honorarabbruch — ueber den echten Verarbeitungspfad', () => {
  it('zeigt Verkaufssumme und Aufwandindikator D trotz Honorarabbruch, sperrt aber die '
    + 'Offert-Schaltflaeche (kein Artefakt bei 422, I-24)', () => {
    const antwort: ApiErgebnis<BerechnungsAntwort> = {
      ok: true,
      status: 200,
      rumpf: {
        honorarAbbruch: {
          verkaufssumme: 5_000_000,
          aufwandindikator: 2.5,
          positionen: [{ wohnungsnummer: 'A1', preis: 520_000 }],
          meldung: 'Die Verkaufssumme liegt ausserhalb der konfigurierten Staffel.',
        },
      },
    };

    // Echter Produktionscode, keine Handkonstruktion des Stands.
    const { stand } = verarbeiteBerechnungsAntwort(antwort, EINHEITEN);
    expect(stand.honorarMin).toBeUndefined();
    expect(stand.honorarMax).toBeUndefined();

    // Woertliche Nachbildung der beiden Fallback-Zeilen aus ProjektAnsicht.tsx —
    // `herleitung`/`aufwandindikator` bleiben hier `undefined`, weil ein Honorarabbruch
    // keine Herleitung mitfuehrt.
    const aufwandindikator: number | undefined = undefined;
    const verkaufssummeAnzeige = stand.honorarAbbruch?.verkaufssumme ?? stand.verkaufssumme;
    const aufwandindikatorAnzeige = stand.honorarAbbruch?.aufwandindikator ?? aufwandindikator;

    const html = renderToStaticMarkup(
      <Aggregatleiste
        verkaufssumme={verkaufssummeAnzeige}
        honorarMin={stand.honorarMin}
        honorarMax={stand.honorarMax}
        aufwandindikator={aufwandindikatorAnzeige}
        {...(stand.honorarAbbruch === undefined
          ? {}
          : { honorarAbbruchMeldung: stand.honorarAbbruch.meldung })}
        erzeuge={() => undefined}
        laeuft={false}
        speichernLaeuft={false}
        berechnungLaeuft={false}
        zeigeRechenweg={() => undefined}
      />);

    expect(html).toContain(formatiereAggregat(5_000_000));
    expect(html).toContain(formatiereScore(2.5));
    expect(html).toContain('disabled');
    expect(html).toContain('Es liegt noch kein vollständiges Ergebnis vor.');
  });
});
