import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { druckeOfferte } from '../../src/pdf/drucke-offerte.js';

const WURZEL = fileURLToPath(new URL('../../../..', import.meta.url));

function fabrikAttrappe() {
  const seite = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    emulateMedia: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(seite),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { starte: vi.fn().mockResolvedValue(browser), browser, seite };
}

describe('druckeOfferte', () => {
  it('oeffnet die Druckansicht derselben Route', async () => {
    const f = fabrikAttrappe();
    await druckeOfferte({ basisUrl: 'http://localhost:3000', offertId: 'A-2026-014' }, f.starte);
    expect(f.seite.goto).toHaveBeenCalledWith(
      'http://localhost:3000/offerte/A-2026-014/druck', { waitUntil: 'load' });
  });

  it('wartet auf ein deterministisches Bereitschaftssignal statt auf ein Zeitlimit', async () => {
    const f = fabrikAttrappe();
    await druckeOfferte({ basisUrl: 'http://x', offertId: 'a' }, f.starte);
    expect(f.seite.waitForSelector).toHaveBeenCalledWith('[data-druck-bereit="true"]',
                                                         { state: 'attached' });
    expect(f.seite.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4' }));
  });

  it('schliesst den Browser auch im Fehlerfall', async () => {
    const f = fabrikAttrappe();
    f.seite.pdf.mockRejectedValueOnce(new Error('bruch'));
    await expect(druckeOfferte({ basisUrl: 'http://x', offertId: 'a' }, f.starte))
      .rejects.toThrow();
    expect(f.browser.close).toHaveBeenCalled();
  });

  it('escaped eine Adresse mit HTML-Sonderzeichen in der Fusszeile statt sie als Markup zu uebernehmen', async () => {
    const f = fabrikAttrappe();
    await druckeOfferte({
      basisUrl: 'http://x',
      offertId: 'a',
      adresse: 'Rue <script>&"Fluss\'strasse</script>',
      erstelltAm: '2026-08-16T14:32:00.000Z',
    }, f.starte);
    const optionen = f.seite.pdf.mock.calls[0]![0] as { footerTemplate: string };
    expect(optionen.footerTemplate).not.toContain('<script>');
    expect(optionen.footerTemplate).toContain(
      'Rue &lt;script&gt;&amp;&quot;Fluss&#39;strasse&lt;/script&gt;');
  });
});

describe('Ein Renderpfad (AK-2.1)', () => {
  it('nutzt keine PDF-Bibliothek und keine zweite Darstellungsimplementierung', () => {
    const pkg = JSON.parse(
      readFileSync(`${WURZEL}packages/offer/package.json`, 'utf8'),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const abhaengig = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const verboten of ['pdfmake', 'pdfkit', '@react-pdf/renderer', 'puppeteer', 'jspdf']) {
      expect(abhaengig[verboten]).toBeUndefined();
    }
    const treffer = execSync(
      "grep -rl 'OfferteDokument' packages/offer/src apps/web/src || true",
      { encoding: 'utf8', cwd: WURZEL },
    ).trim().split('\n').filter(Boolean);
    // Genau eine Definition; die uebrigen Treffer sind Verwendungen derselben Komponente.
    expect(treffer.filter((d) => d.endsWith('OfferteDokument.tsx'))).toHaveLength(1);
  });
});
