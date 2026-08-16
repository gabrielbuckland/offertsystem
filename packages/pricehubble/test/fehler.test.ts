import { describe, expect, it } from 'vitest';
import { ADAPTER_FEHLERARTEN, erzeugeAdapterFehler } from '../src/client/fehler.js';
import { KonfigurationsFehler } from '../src/config/konfigurationsFehler.js';
import { maskiereKopfzeilen, sammelndesProtokoll } from '../src/client/protokoll.js';

describe('adapterinterne Fehlertypen (Spec 04 §6.5.1, §6.5.3)', () => {
  it('fuehrt genau neun Abruf-Fehlerarten; ConfigurationError ist der zehnte, getrennte Typ', () => {
    expect([...ADAPTER_FEHLERARTEN]).toEqual([
      'AuthError',
      'NetworkError',
      'TimeoutError',
      'RateLimitError',
      'ClientError',
      'NotFoundError',
      'ServerError',
      'ContractViolation',
      'StaleValuationError',
    ]);
    expect(new KonfigurationsFehler('PH_DOSSIER_ID', 'fehlt')).toBeInstanceOf(Error);
  });

  it('traegt die Diagnosefelder jedes Abruffehlers', () => {
    const fehler = erzeugeAdapterFehler({
      art: 'ServerError',
      endpunkt: 'dossierValuation',
      httpStatus: 503,
      phRequestId: 'b72a0b9e',
      versuche: 3,
      dauerMs: 1234,
      detail: 'Service Unavailable',
    });
    expect(fehler).toMatchObject({
      art: 'ServerError',
      endpunkt: 'dossierValuation',
      httpStatus: 503,
      phRequestId: 'b72a0b9e',
      versuche: 3,
      dauerMs: 1234,
    });
  });
});

describe('Protokollierung (Spec 04 §6.7, AK-18)', () => {
  it('maskiert den Authorization-Header', () => {
    const maskiert = maskiereKopfzeilen({
      Authorization: 'Bearer geheimes.token.material',
      'Content-Type': 'application/json',
    });
    expect(maskiert['Authorization']).toBe('***');
    expect(maskiert['Content-Type']).toBe('application/json');
  });

  it('schreibt je Versuch ein strukturiertes Ereignis ohne Geheimnismaterial', () => {
    const protokoll = sammelndesProtokoll();
    protokoll.versuch({
      ts: '2026-08-16T10:00:00.000Z',
      endpoint: 'login',
      method: 'POST',
      attempt: 1,
      httpStatus: 200,
      elapsedMs: 74,
      phRequestId: 'b72a0b9e',
      outcome: 'ok',
    });
    const ausgabe = JSON.stringify(protokoll.ereignisse);
    expect(protokoll.ereignisse).toHaveLength(1);
    expect(ausgabe).not.toMatch(/Bearer|password|token/i);
  });

  it('protokolliert bei ContractViolation den Zod-Pfad, aber nicht den beobachteten Wert', () => {
    const protokoll = sammelndesProtokoll();
    protokoll.vertragsbruch({
      ts: '2026-08-16T10:00:01.000Z',
      endpoint: 'dossierValuation',
      pfad: 'valuationSale.value',
      erwarteterTyp: 'number',
    });
    expect(protokoll.ereignisse[0]).toMatchObject({
      art: 'vertragsbruch',
      pfad: 'valuationSale.value',
      erwarteterTyp: 'number',
    });
    expect(JSON.stringify(protokoll.ereignisse)).not.toContain('beobachtet');
  });

  it('schliesst einen Abbruch mit vollstaendig: false ab', () => {
    const protokoll = sammelndesProtokoll();
    protokoll.abbruch({
      ts: '2026-08-16T10:00:02.000Z',
      vollstaendig: false,
      bezogeneTypen: 2,
      fehlerart: 'TimeoutError',
    });
    expect(protokoll.ereignisse[0]).toMatchObject({ vollstaendig: false, bezogeneTypen: 2 });
  });
});
