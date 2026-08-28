import { fileURLToPath } from 'node:url';
import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anfrage, adresse, baueAdapter } from './adapterHilfen.js';
import { TEST_DOSSIER_ID, ladeFixture } from './fixtures.js';
import { BASIS } from './msw/handlers.js';
import { mswServer } from './msw/server.js';
import { schreibeNachweisArtefakt, type KategorieZeile } from './nachweis/schreibeArtefakt.js';

const DOSSIER = `${BASIS}/api/v1/dossiers/${TEST_DOSSIER_ID}`;
const VALUATION = `${DOSSIER}/valuation`;
const SCORES = `${BASIS}/api/v1/location/scores`;

const laufBeginn = Date.now();
let szenarienGruen = 0;
const kategorien: KategorieZeile[] = [];

/**
 * Jeder Szenariotest ruft am Ende `vermerke(...)` auf. Damit steht im Artefakt nicht nur
 * pass/fail, sondern das, was Kapitel 6 tabelliert: je gefahrener Fehlerkategorie der
 * erwartete und der tatsaechlich beobachtete Fehlerstatus sowie der Zustand der
 * Berechnungspipeline. Der beobachtete Status stammt aus dem Ergebnisobjekt des Laufs,
 * nicht aus der Erwartung — die Tabelle zeigt damit Messwerte, keine Sollwerte.
 */
function vermerke(zeile: KategorieZeile): void {
  szenarienGruen += 1;
  kategorien.push(zeile);
}

/** Beobachteter Fehlerstatus eines Laufs: ProviderFehler-Art oder 'keiner'. */
function beobachtet(ergebnis: { readonly ok: boolean }): string {
  const e = ergebnis as {
    readonly ok: boolean;
    readonly wert?: { readonly fehler?: { readonly art?: string } };
    readonly fehler?: { readonly art?: string };
  };
  if (!e.ok) return e.fehler?.art ?? 'unbekannt';
  return e.wert?.fehler?.art ?? 'keiner';
}

describe('Szenario 1 — Normalbetrieb (HTTP-Ebene)', () => {
  it('bildet eine realistische Antwort vollstaendig in Kerntypen ab', async () => {
    const { adapter } = baueAdapter();
    const bewertungen = await adapter.bewerteWohnungstypen([anfrage(1)]);
    const scores = await adapter.holeLagescores(adresse);
    expect(bewertungen.ok && bewertungen.wert.vollstaendig).toBe(true);
    expect(scores.ok && scores.wert.werte.size).toBe(9);
    vermerke({
      szenario: 'S1 Normalbetrieb', kategorie: 'keine (Erfolgsfall)',
      erwarteterStatus: 'keiner', beobachteterStatus: beobachtet(bewertungen),
      pipelineZustand: 'abgeschlossen',
    });
  });
});

describe('Szenario 2 — Nichtverfuegbarkeit und Timeout (nur HTTP-Ebene moeglich)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Kategorie Netzwerkfehler: meldet nicht_erreichbar nach erschoepften Versuchen', async () => {
    let versuche = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        versuche += 1;
        return HttpResponse.error();
      }),
    );
    const { adapter } = baueAdapter();
    const lauf = adapter.bewerteWohnungstypen([anfrage(1)]);
    await vi.advanceTimersByTimeAsync(30_000);
    const ergebnis = await lauf;
    expect(versuche).toBe(3);
    expect(ergebnis.ok && ergebnis.wert.fehler?.art).toBe('nicht_erreichbar');
    expect(ergebnis.ok && ergebnis.wert.fehler?.diagnose.versuche).toBe(3);
    expect(ergebnis.ok && ergebnis.wert.vollstaendig).toBe(false);
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'Netzwerkfehler',
      erwarteterStatus: 'nicht_erreichbar', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('Kategorie Timeout: meldet zeitueberschreitung, ohne real zu warten', async () => {
    mswServer.use(
      http.post(VALUATION, async () => {
        await new Promise((r) => setTimeout(r, 120_000));
        return HttpResponse.json({});
      }),
    );
    const { adapter } = baueAdapter();
    const lauf = adapter.bewerteWohnungstypen([anfrage(1)]);
    await vi.advanceTimersByTimeAsync(120_000);
    const ergebnis = await lauf;
    expect(ergebnis.ok && ergebnis.wert.fehler?.art).toBe('zeitueberschreitung');
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'Timeout',
      erwarteterStatus: 'zeitueberschreitung', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('Kategorie HTTP-Statusfehler 5xx: wiederholt und meldet dienst_gestoert', async () => {
    let versuche = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        versuche += 1;
        return HttpResponse.json(ladeFixture('synthetic/errors/error-5xx.json'), {
          status: 503,
        });
      }),
    );
    const { adapter } = baueAdapter();
    const lauf = adapter.bewerteWohnungstypen([anfrage(1)]);
    await vi.advanceTimersByTimeAsync(30_000);
    const ergebnis = await lauf;
    expect(versuche).toBe(3);
    expect(ergebnis.ok && ergebnis.wert.fehler?.art).toBe('dienst_gestoert');
    expect(ergebnis.ok && ergebnis.wert.vollstaendig).toBe(false);
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'HTTP-Statusfehler 5xx',
      erwarteterStatus: 'dienst_gestoert', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('Kategorie HTTP-Statusfehler 4xx: wiederholt NICHT und meldet anfrage_abgelehnt', async () => {
    let versuche = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        versuche += 1;
        return HttpResponse.json(
          ladeFixture('synthetic/errors/error-4xx-invalid-property.json'),
          { status: 400 },
        );
      }),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    expect(versuche).toBe(1);
    expect(ergebnis.ok && ergebnis.wert.fehler?.art).toBe('anfrage_abgelehnt');
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'HTTP-Statusfehler 4xx',
      erwarteterStatus: 'anfrage_abgelehnt', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('Kategorie Rate-Limiting: wartet die Retry-After-Dauer ab', async () => {
    let versuche = 0;
    mswServer.use(
      http.post(VALUATION, () => {
        versuche += 1;
        return versuche === 1
          ? HttpResponse.json(ladeFixture('synthetic/errors/error-429-retry-after.json'), {
              status: 429,
              headers: { 'Retry-After': '5' },
            })
          : HttpResponse.json(ladeFixture('synthetic/dossier/valuation.success.json'));
      }),
    );
    const { adapter } = baueAdapter();
    const lauf = adapter.bewerteWohnungstypen([anfrage(1)]);
    await vi.advanceTimersByTimeAsync(5_000);
    const ergebnis = await lauf;
    expect(versuche).toBe(2);
    expect(ergebnis.ok && ergebnis.wert.vollstaendig).toBe(true);
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'Rate-Limiting (Retry-After eingehalten)',
      erwarteterStatus: 'keiner', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'abgeschlossen',
    });
  });

  it('Kategorie Rate-Limiting: bricht oberhalb der Schwelle mit kontingent ab', async () => {
    mswServer.use(
      http.post(VALUATION, () =>
        HttpResponse.json(ladeFixture('synthetic/errors/error-429-retry-after.json'), {
          status: 429,
          headers: { 'Retry-After': '600' },
        }),
      ),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    expect(ergebnis.ok && ergebnis.wert.fehler?.art).toBe('kontingent');
    expect(
      ergebnis.ok &&
        ergebnis.wert.fehler?.art === 'kontingent' &&
        ergebnis.wert.fehler.wiederholbarNach,
    ).toBe(600);
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'Rate-Limiting (Schwelle ueberschritten)',
      erwarteterStatus: 'kontingent', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('Kategorie Fallback: erzeugt in KEINEM Fehlerfall eine Ersatzbewertung (I-24)', async () => {
    mswServer.use(http.post(VALUATION, () => new HttpResponse(null, { status: 500 })));
    const { adapter } = baueAdapter();
    const lauf = adapter.bewerteWohnungstypen([anfrage(1), anfrage(2)]);
    await vi.advanceTimersByTimeAsync(30_000);
    const ergebnis = await lauf;
    expect(ergebnis.ok && ergebnis.wert.bewertungen.size).toBe(0);
    expect(ergebnis.ok && ergebnis.wert.vollstaendig).toBe(false);
    vermerke({
      szenario: 'S2 Nichtverfuegbarkeit', kategorie: 'Fallback-Verbot (I-24)',
      erwarteterStatus: 'dienst_gestoert', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });
});

describe('Szenario 3 — Statuscode 200 mit abweichender Feldstruktur (nur HTTP-Ebene)', () => {
  it.each([
    ['fehlendes Pflichtfeld', 'synthetic/dossier/valuation.missing-value.json'],
    ['Typabweichung', 'synthetic/dossier/valuation.type-mismatch.json'],
    ['invertierte Spanne', 'synthetic/dossier/valuation.range-inverted.json'],
  ])('lehnt %s bei HTTP 200 ab und rechnet nicht', async (name, pfad) => {
    mswServer.use(http.post(VALUATION, () => HttpResponse.json(ladeFixture(pfad))));
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    expect(ergebnis.ok && ergebnis.wert.fehler?.art).toBe('antwort_ungueltig');
    expect(ergebnis.ok && ergebnis.wert.bewertungen.size).toBe(0);
    vermerke({
      szenario: 'S3 Strukturabweichung', kategorie: `Vertragsbruch: ${name}`,
      erwarteterStatus: 'antwort_ungueltig', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('lehnt eine Scores-Antwort mit nur acht Schluesseln ab (E-22)', async () => {
    mswServer.use(
      http.post(SCORES, () =>
        HttpResponse.json(ladeFixture('synthetic/location/location-scores.missing-score.json')),
      ),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.holeLagescores(adresse);
    expect(ergebnis.ok).toBe(false);
    expect(!ergebnis.ok && ergebnis.fehler.art).toBe('antwort_ungueltig');
    vermerke({
      szenario: 'S3 Strukturabweichung', kategorie: 'Vertragsbruch: unvollstaendige Lagescores',
      erwarteterStatus: 'antwort_ungueltig', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });

  it('laeuft bei einem unbekannten Zusatzfeld gruen durch (AK-5)', async () => {
    mswServer.use(
      http.post(VALUATION, () =>
        HttpResponse.json(ladeFixture('synthetic/dossier/valuation.unknown-extra-field.json')),
      ),
    );
    const { adapter } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    expect(ergebnis.ok && ergebnis.wert.vollstaendig).toBe(true);
    vermerke({
      szenario: 'S3 Strukturabweichung', kategorie: 'unbekanntes Zusatzfeld (AK-5, toleriert)',
      erwarteterStatus: 'keiner', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'abgeschlossen',
    });
  });

  it('protokolliert den Zod-Pfad, aber keinen beobachteten Wert', async () => {
    mswServer.use(
      http.post(VALUATION, () =>
        HttpResponse.json(ladeFixture('synthetic/dossier/valuation.type-mismatch.json')),
      ),
    );
    const { adapter, protokoll } = baueAdapter();
    const ergebnis = await adapter.bewerteWohnungstypen([anfrage(1)]);
    const bruch = protokoll.ereignisse.find((e) => e['art'] === 'vertragsbruch');
    expect(bruch?.['pfad']).toContain('valuationSale.value');
    expect(JSON.stringify(protokoll.ereignisse)).not.toContain('"971000"');
    vermerke({
      szenario: 'S3 Strukturabweichung', kategorie: 'Diagnoseprotokoll ohne Antwortwerte',
      erwarteterStatus: 'antwort_ungueltig', beobachteterStatus: beobachtet(ergebnis),
      pipelineZustand: 'nicht gestartet',
    });
  });
});

afterAll(() => {
  schreibeNachweisArtefakt(
    // fileURLToPath statt .pathname: Der Repositorypfad enthaelt Leerzeichen.
    fileURLToPath(new URL('../../../artifacts/', import.meta.url)),
    'integration',
    {
      systemverhalten:
        'Drei FF2-Szenarien und vier Fehlerkategorien ueber MSW auf HTTP-Ebene gefahren',
      ergebnis: szenarienGruen === 14 ? 'pass' : 'fail',
      anzahlTests: 14,
      laufzeitMs: Date.now() - laufBeginn,
      kategorien,
    },
  );
});
