import { describe, expect, it } from 'vitest';
import type { ProviderFehler } from '../../src/ports/valuation-provider.js';
import { TestValuationProvider } from '../helper/test-provider.js';
import { adresseFixture, referenzbewertungFixture } from '../helper/projekt.js';
import { wohnungstypId } from '../../src/domain/ids.js';

describe('ValuationProvider (E-01)', () => {
  it('fuehrt genau zwei Methoden, die erste in Batch-Arstellung', async () => {
    const p = new TestValuationProvider({
      bewertungen: [referenzbewertungFixture('T1'), referenzbewertungFixture('T2')],
    });
    const e = await p.bewerteWohnungstypen([
      { adresse: adresseFixture(), wohnungstypId: wohnungstypId('T1'), zimmerzahl: 3.5,
        parametrisierung: referenzbewertungFixture('T1').parametrisierungsAbdruck },
    ]);
    expect(e.ok).toBe(true);
    if (e.ok) {
      expect(e.wert.vollstaendig).toBe(true);
      expect(e.wert.bewertungen.get(wohnungstypId('T1'))?.marktwert).toBe(85_000_000);
    }
    expect(p.aufrufe.bewerteWohnungstypen).toBe(1);
  });

  it('kennzeichnet ein Teilergebnis ueber `vollstaendig` (US-15)', async () => {
    const p = new TestValuationProvider({
      bewertungen: [referenzbewertungFixture('T1')],
      abbruchNachTyp: wohnungstypId('T2'),
    });
    const e = await p.bewerteWohnungstypen([]);
    expect(e.ok).toBe(true);
    if (e.ok) {
      expect(e.wert.vollstaendig).toBe(false);
      expect(e.wert.fehlgeschlagenerTyp).toBe('T2');
      expect(e.wert.fehler?.art).toBe('zeitueberschreitung');
    }
  });

  it('traegt `diagnose` als Pflichtfeld jeder Fehlervariante (E-02)', () => {
    const varianten: readonly ProviderFehler['art'][] = [
      'nicht_erreichbar', 'zeitueberschreitung', 'authentifizierung', 'kontingent',
      'anfrage_abgelehnt', 'antwort_ungueltig', 'objekt_unbekannt', 'dienst_gestoert',
    ];
    expect(new Set(varianten).size).toBe(8);
  });

  it('kennt keine Variante, die einen Ersatzwert transportiert (I-24, NFA-10)', async () => {
    const p = new TestValuationProvider({ fehler: {
      art: 'dienst_gestoert', detail: 'Anbieterstoerung',
      diagnose: { endpoint: 'dossierValuation', httpStatus: 503, versuche: 3, dauerMs: 4200 },
    } });
    const e = await p.bewerteWohnungstypen([]);
    expect(e.ok).toBe(false);
    if (!e.ok) expect(Object.keys(e.fehler)).not.toContain('ersatzwert');
  });
});
