import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/client/http-client.js';
import { TokenVerwaltung } from '../src/client/token-verwaltung.js';
import { sammelndesProtokoll } from '../src/client/protokoll.js';
import { systemUhr } from '../src/client/uhr.js';
import { erzeugeZufallsquelle } from '../src/client/zufall.js';
import { BASIS } from './msw/handlers.js';
import { mswServer } from './msw/server.js';
import { testKonfiguration } from './test-konfiguration.js';

function verwaltungMit(konfiguration = testKonfiguration()) {
  const protokoll = sammelndesProtokoll();
  const client = new HttpClient({
    konfiguration,
    uhr: systemUhr,
    zufall: erzeugeZufallsquelle(4242),
    protokoll,
    fetchImpl: globalThis.fetch,
  });
  return {
    protokoll,
    verwaltung: new TokenVerwaltung({
      client,
      konfiguration,
      uhr: systemUhr,
      zugangsdaten: { benutzername: 'u', passwort: 'geheim' },
    }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Token-Haltung (Spec 04 §2)', () => {
  it('loggt einmal ein und haelt den Token im Prozessspeicher', async () => {
    let logins = 0;
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => {
        logins += 1;
        return HttpResponse.json({ access_token: 't-1' });
      }),
    );
    const { verwaltung } = verwaltungMit();
    expect(await verwaltung.holeToken()).toMatchObject({ ok: true, wert: 't-1' });
    expect(await verwaltung.holeToken()).toMatchObject({ ok: true, wert: 't-1' });
    expect(logins).toBe(1);
  });

  it('loggt nach Ablauf der Gueltigkeit abzueglich Sicherheitsmarge neu ein', async () => {
    let logins = 0;
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => {
        logins += 1;
        return HttpResponse.json({ access_token: `t-${logins}` });
      }),
    );
    const { verwaltung } = verwaltungMit();
    await verwaltung.holeToken();
    vi.setSystemTime(Date.now() + (720 - 30) * 60_000 + 1000);
    expect(await verwaltung.holeToken()).toMatchObject({ ok: true, wert: 't-2' });
    expect(logins).toBe(2);
  });

  it('dedupliziert gleichzeitige Login-Anforderungen', async () => {
    let logins = 0;
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => {
        logins += 1;
        return HttpResponse.json({ access_token: 't-1' });
      }),
    );
    const { verwaltung } = verwaltungMit();
    const lauf = Promise.all([
      verwaltung.holeToken(), verwaltung.holeToken(), verwaltung.holeToken(),
    ]);
    await vi.advanceTimersByTimeAsync(10);
    await lauf;
    expect(logins).toBe(1);
  });

  it('lehnt einen Login mit ungueltigen Zugangsdaten als AuthError ab', async () => {
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => new HttpResponse(null, { status: 401 })),
    );
    expect(await verwaltungMit().verwaltung.holeToken()).toMatchObject({
      ok: false,
      fehler: { art: 'AuthError' },
    });
  });

  it('lehnt eine Login-Antwort ohne access_token als ContractViolation ab', async () => {
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => HttpResponse.json({ token: 'x' })),
    );
    expect(await verwaltungMit().verwaltung.holeToken()).toMatchObject({
      ok: false,
      fehler: { art: 'ContractViolation' },
    });
  });

  it('loggt bei 401 genau einmal neu ein und wiederholt den Request genau einmal (AK-10)', async () => {
    let logins = 0;
    let abrufe = 0;
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => {
        logins += 1;
        return HttpResponse.json({ access_token: `t-${logins}` });
      }),
      http.get(`${BASIS}/probe`, ({ request }) => {
        abrufe += 1;
        return request.headers.get('Authorization') === 'Bearer t-2'
          ? HttpResponse.json({ a: 1 })
          : new HttpResponse(null, { status: 401 });
      }),
    );
    const { verwaltung } = verwaltungMit();
    const ergebnis = await verwaltung.mitToken((token) => ({
      endpunkt: 'dossierGet' as const,
      methode: 'GET' as const,
      url: `${BASIS}/probe`,
      timeoutMs: testKonfiguration().timeoutMs,
      token,
    }));
    expect(ergebnis).toMatchObject({ ok: true });
    expect(logins).toBe(2);
    expect(abrufe).toBe(2);
  });

  it('gibt nach der einen Wiederholung endgueltig auf (AuthError)', async () => {
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => HttpResponse.json({ access_token: 't' })),
      http.get(`${BASIS}/probe`, () => new HttpResponse(null, { status: 401 })),
    );
    const { verwaltung } = verwaltungMit();
    const ergebnis = await verwaltung.mitToken((token) => ({
      endpunkt: 'dossierGet' as const,
      methode: 'GET' as const,
      url: `${BASIS}/probe`,
      timeoutMs: testKonfiguration().timeoutMs,
      token,
    }));
    expect(ergebnis).toMatchObject({ ok: false, fehler: { art: 'AuthError' } });
  });

  it('protokolliert niemals Passwort oder Token (AK-18)', async () => {
    mswServer.use(
      http.post(`${BASIS}/auth/login/credentials`, () => HttpResponse.json({ access_token: 't-1' })),
    );
    const { verwaltung, protokoll } = verwaltungMit();
    await verwaltung.holeToken();
    const ausgabe = JSON.stringify(protokoll.ereignisse);
    expect(ausgabe).not.toContain('geheim');
    expect(ausgabe).not.toContain('t-1');
  });
});
