import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfferteDokument, formatiereAggregat } from '@offert/offer';
import { NichtGefunden } from '../../src/components/NichtGefunden.js';
import { OffertenListe } from '../../src/components/OffertenListe.js';
import { ladeOfferte, legeOfferteAb, type ListenEintrag }
  from '../../src/server/offerten-ablage.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

const BEISPIEL_EINTRAG: ListenEintrag = {
  offertId: 'A-2026-014',
  referenznummer: 'A-2026-014',
  kunde: 'Muster Immobilien AG',
  liegenschaft: 'Musterstrasse 1, 6000 Luzern',
  erstelltAm: '2026-08-16T14:32:00.000Z',
  verkaufssumme: 279_854_545,
  honorarMin: 5_378_186,
  honorarMax: 8_067_279,
  fehlerhaft: false,
  datei: '2026-08-16T1432_A-2026-014_muster.json',
};

describe('OffertenListe (A-12, US-13)', () => {
  it('zeigt die geforderten Spalten und die Orientierungshilfen', () => {
    const html = renderToStaticMarkup(<OffertenListe eintraege={[BEISPIEL_EINTRAG]} />);
    expect(html).toContain('Muster Immobilien AG');
    expect(html).toContain('Musterstrasse 1, 6000 Luzern');
    expect(html).toContain('16.08.2026');
    expect(html).toContain('A-2026-014');
    expect(html).toContain(formatiereAggregat(BEISPIEL_EINTRAG.verkaufssumme!));
  });

  it('stellt ein schemawidriges Artefakt nicht teilweise dar', () => {
    const html = renderToStaticMarkup(
      <OffertenListe eintraege={[{ ...BEISPIEL_EINTRAG, fehlerhaft: true,
                                   verkaufssumme: undefined }]} />);
    expect(html).toContain('entspricht nicht dem Offert-Schema');
    expect(html).not.toContain('CHF');
  });

  it('meldet eine leere Ablage, statt eine leere Tabelle zu zeigen', () => {
    expect(renderToStaticMarkup(<OffertenListe eintraege={[]} />))
      .toContain('noch keine Offerten');
  });
});

describe('Nichtfund und Wiederoeffnen', () => {
  it('meldet eine nicht vorhandene Offerte verstaendlich', () => {
    const html = renderToStaticMarkup(<NichtGefunden id="weg" />);
    expect(html).toContain('Die angeforderte Offerte ist nicht vorhanden');
    expect(html).toContain('role="alert"');
  });

  it('rendert eine wiedergeoeffnete Offerte identisch zur Ersterzeugung', async () => {
    const verzeichnis = await mkdtemp(join(tmpdir(), 'offerten-'));
    const o = baueBeispielOfferte();
    await legeOfferteAb(o, verzeichnis);
    const geladen = await ladeOfferte(o.metadata.offertId, verzeichnis);
    expect(renderToStaticMarkup(<OfferteDokument offerte={geladen} />))
      .toBe(renderToStaticMarkup(<OfferteDokument offerte={o} />));
  });
});
