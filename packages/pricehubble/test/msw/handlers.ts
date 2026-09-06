import { HttpResponse, http } from 'msw';
import { TEST_DOSSIER_ID, ladeFixture } from '../fixtures.js';

export const BASIS = 'https://api.pricehubble.com';
const DOSSIER = `${BASIS}/api/v1/dossiers/${TEST_DOSSIER_ID}`;

const STANDARD_KOPFZEILEN = { 'x-ph-request-id': 'test-request-id' };

/** Zuletzt per PATCH gesetzte Felder; der GET spiegelt sie zurueck. */
let zuletztGepatcht: Record<string, unknown> = {};

export const standardHandler = [
  http.post(`${BASIS}/auth/login/credentials`, () =>
    HttpResponse.json(ladeFixture('synthetic/auth/login.success.json'), {
      headers: STANDARD_KOPFZEILEN,
    }),
  ),
  http.get(DOSSIER, () => {
    const basis = ladeFixture<{ property: Record<string, unknown> }>(
      'synthetic/dossier/get-dossier.success.json',
    );
    // Der Dossierstand traegt, was zuletzt gepatcht wurde — daraus liest der
    // Rueckvergleich zurueck.
    return HttpResponse.json(
      { ...basis, property: { ...basis.property, ...zuletztGepatcht } },
      { headers: STANDARD_KOPFZEILEN },
    );
  }),
  http.patch(DOSSIER, async ({ request }) => {
    const gesendet = (await request.json()) as { property: Record<string, unknown> };
    zuletztGepatcht = gesendet.property;
    // Die echte API antwortet auf E3 mit LEEREM Rumpf `{}` (live belegt 2026-09-01)
    // und echot die gesetzten Felder nicht. Ein echoendes Fixture liess die
    // Verifikation frueher gruen erscheinen, obwohl sie real nie greifen konnte.
    return HttpResponse.json({}, { headers: STANDARD_KOPFZEILEN });
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
