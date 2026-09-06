import { describe, expect, it } from 'vitest';
import { leseRumpf } from '../../../src/components/projekt/antwort-rumpf.js';

describe('leseRumpf', () => {
  it('liefert den JSON-Rumpf, wenn die Antwort JSON ist', async () => {
    const antwort = Response.json({ fehler: { text: 'zu wenig Daten' } }, { status: 422 });
    expect(await leseRumpf<{ fehler?: { text: string } }>(antwort)).toEqual(
      { fehler: { text: 'zu wenig Daten' } });
  });

  it('zerbricht nicht an einer HTML-Fehlerseite, sondern liefert einen leeren Rumpf', async () => {
    // Next-Fehlerantwort: antwort.json() würde ablehnen, Button bliebe wirkungslos.
    const antwort = new Response('<!DOCTYPE html><html><body>500</body></html>', {
      status: 500, headers: { 'content-type': 'text/html' },
    });
    await expect(leseRumpf(antwort)).resolves.toEqual({});
  });

  it('zerbricht nicht an einem leeren Rumpf', async () => {
    await expect(leseRumpf(new Response(null, { status: 204 }))).resolves.toEqual({});
  });
});
