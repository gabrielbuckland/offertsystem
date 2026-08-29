import type { WohnungstypId } from '@offert/core';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { anfrage, baueAdapter } from './adapter-hilfen.js';
import { TEST_DOSSIER_ID, ladeFixture } from './fixtures.js';
import { BASIS } from './msw/handlers.js';
import { mswServer } from './msw/server.js';

const VALUATION = `${BASIS}/api/v1/dossiers/${TEST_DOSSIER_ID}/valuation`;

describe('Abbruch mitten im Typen-Durchlauf (Spec 04 §3.3, US-15, NFA-10)', () => {
  it('bricht sofort ab und versucht die folgenden Typen nicht (AK-11)', async () => {
    let bewertungsaufrufe = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        bewertungsaufrufe += 1;
        return bewertungsaufrufe === 1
          ? HttpResponse.json(ladeFixture('synthetic/dossier/valuation.success.json'))
          : HttpResponse.json(ladeFixture('synthetic/dossier/valuation.missing-value.json'));
      }),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2), anfrage(3)]);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.vollstaendig).toBe(false);
    expect(ergebnis.wert.bewertungen.size).toBe(1);
    expect(ergebnis.wert.fehlgeschlagenerTyp).toBe('t-2' as WohnungstypId);
    expect(ergebnis.wert.fehler?.art).toBe('antwort_ungueltig');
    // Typ 3 wurde nicht mehr versucht: hoechstens zwei Bewertungsaufrufe.
    expect(bewertungsaufrufe).toBe(2);
  });

  it('bewahrt die bereits bezogenen Referenzbewertungen', async () => {
    let aufrufe = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        aufrufe += 1;
        return aufrufe === 1
          ? HttpResponse.json(ladeFixture('synthetic/dossier/valuation.success.json'))
          : new HttpResponse(null, { status: 400 });
      }),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    if (!ergebnis.ok) throw new Error('unerwartet');
    expect(ergebnis.wert.bewertungen.get('t-1' as WohnungstypId)?.marktwert).toBe(97_100_000);
    expect(ergebnis.wert.fehler?.art).toBe('anfrage_abgelehnt');
  });

  it('wiederholt E4 bei isValuationStale genau einmal und meldet dann (AK-12)', async () => {
    let aufrufe = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        aufrufe += 1;
        return HttpResponse.json(ladeFixture('synthetic/dossier/valuation.stale.json'));
      }),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    if (!ergebnis.ok) throw new Error('unerwartet');
    expect(aufrufe).toBe(2);
    expect(ergebnis.wert.vollstaendig).toBe(false);
    expect(ergebnis.wert.fehler?.art).toBe('antwort_ungueltig');
  });

  it('uebernimmt einen nach der Wiederholung gueltigen Wert', async () => {
    let aufrufe = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        aufrufe += 1;
        return aufrufe === 1
          ? HttpResponse.json(ladeFixture('synthetic/dossier/valuation.stale.json'))
          : HttpResponse.json(ladeFixture('synthetic/dossier/valuation.success.json'));
      }),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    if (!ergebnis.ok) throw new Error('unerwartet');
    expect(ergebnis.wert.vollstaendig).toBe(true);
  });

  it('bricht bei fehlgeschlagener PATCH-Verifikation ab', async () => {
    mswServer.use(
      http.patch(`${BASIS}/api/v1/dossiers/${TEST_DOSSIER_ID}`, () =>
        HttpResponse.json({ property: { livingArea: 1 } }),
      ),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    if (!ergebnis.ok) throw new Error('unerwartet');
    expect(ergebnis.wert.vollstaendig).toBe(false);
    expect(ergebnis.wert.bewertungen.size).toBe(0);
    expect(ergebnis.wert.fehler?.art).toBe('antwort_ungueltig');
  });

  it('protokolliert den Abbruch mit vollstaendig: false und der Zahl bezogener Typen', async () => {
    let aufrufe = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        aufrufe += 1;
        return aufrufe === 1
          ? HttpResponse.json(ladeFixture('synthetic/dossier/valuation.success.json'))
          : new HttpResponse(null, { status: 400 });
      }),
    );
    const { adapter, protokoll } = baueAdapter();
    await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    expect(protokoll.ereignisse.at(-1)).toMatchObject({
      art: 'abbruch',
      vollstaendig: false,
      bezogeneTypen: 1,
    });
  });

  it('versucht kein Rollback am Fremdsystem', async () => {
    let patches = 0;
    mswServer.use(
      http.patch(`${BASIS}/api/v1/dossiers/${TEST_DOSSIER_ID}`, async ({ request }) => {
        patches += 1;
        const gesendet = (await request.json()) as { property: Record<string, unknown> };
        const basis = ladeFixture<{ property: Record<string, unknown> }>(
          'synthetic/dossier/update-dossier.success.json',
        );
        return HttpResponse.json({
          ...basis,
          property: { ...basis.property, ...gesendet.property },
        });
      }),
      http.post(VALUATION, () => new HttpResponse(null, { status: 400 })),
    );
    const { adapter } = baueAdapter();
    await adapter.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    // Genau ein PATCH: fuer Typ 1. Kein Rueckschreibversuch auf einer Ressource in
    // unbestimmtem Zustand (Spec 04 §3.3 Punkt 2).
    expect(patches).toBe(1);
  });
});
