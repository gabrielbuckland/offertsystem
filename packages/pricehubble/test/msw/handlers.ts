import { HttpResponse, http } from 'msw';
import { TEST_DOSSIER_ID, ladeFixture } from '../fixtures.js';

export const BASIS = 'https://api.pricehubble.com';
const DOSSIER = `${BASIS}/api/v1/dossiers/${TEST_DOSSIER_ID}`;

const STANDARD_KOPFZEILEN = { 'x-ph-request-id': 'test-request-id' };

/** Normalbetrieb — Szenario 1 auf HTTP-Ebene (Spec 06 §6.1). */
export const standardHandler = [
  http.post(`${BASIS}/auth/login/credentials`, () =>
    HttpResponse.json(ladeFixture('synthetic/auth/login.success.json'), {
      headers: STANDARD_KOPFZEILEN,
    }),
  ),
  http.get(DOSSIER, () =>
    HttpResponse.json(ladeFixture('synthetic/dossier/get-dossier.success.json'), {
      headers: STANDARD_KOPFZEILEN,
    }),
  ),
  http.patch(DOSSIER, async ({ request }) => {
    const gesendet = (await request.json()) as { property: Record<string, unknown> };
    const antwort = ladeFixture<{ property: Record<string, unknown> }>(
      'synthetic/dossier/update-dossier.success.json',
    );
    // Merge-Semantik der API nachbilden: gesendete Felder erscheinen in der Antwort.
    return HttpResponse.json(
      { ...antwort, property: { ...antwort.property, ...gesendet.property } },
      { headers: STANDARD_KOPFZEILEN },
    );
  }),
  http.post(`${DOSSIER}/valuation`, () =>
    HttpResponse.json(ladeFixture('synthetic/dossier/valuation.success.json'), {
      headers: STANDARD_KOPFZEILEN,
    }),
  ),
  http.post(`${BASIS}/api/v1/location/scores`, () =>
    HttpResponse.json(ladeFixture('synthetic/location/location-scores.success.json'), {
      headers: STANDARD_KOPFZEILEN,
    }),
  ),
];
