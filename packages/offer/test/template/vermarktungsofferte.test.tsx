import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VermarktungsOfferte } from '../../src/template/VermarktungsOfferte.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

function offerteMitDokument() {
  return {
    ...baueBeispielOfferte(),
    dokument: {
      inhalt: {
        type: 'doc' as const,
        content: [
          { type: 'heading' as const, attrs: { level: 1 as const },
            content: [{ type: 'text' as const, text: 'Ausgangslage' }] },
          { type: 'paragraph' as const,
            content: [{ type: 'text' as const, text: 'Neubau in Aarau.',
              marks: [{ type: 'bold' as const }] }] },
          { type: 'preistabelle' as const,
            attrs: { zeilen: [{ einheit: 'A-01', flaeche: '86.0 m²',
              preis: "CHF 500'000.00" }] } },
        ],
      },
      vorlageVersion: '1',
      auftraggeber: 'Muster Immobilien AG',
    },
  };
}

describe('VermarktungsOfferte', () => {
  it('rendert Kopfblock, Inhalt und Preistabelle mit Druck-Bereitschaftssignal', () => {
    const html = renderToStaticMarkup(<VermarktungsOfferte offerte={offerteMitDokument()} />);
    expect(html).toContain('data-druck-bereit="true"');
    expect(html).toContain('Vermarktungsofferte');           // Titel
    expect(html).toContain('Muster Immobilien AG');          // Auftraggeber im Kopf
    expect(html).toContain('<h2');                           // heading level 1 -> h2 (h1 ist der Titel)
    expect(html).toContain('Ausgangslage');
    expect(html).toContain('<strong>Neubau in Aarau.</strong>');
    expect(html).toContain('A-01');
    expect(html).toContain("CHF 500&#x27;000.00");
    // Kein Rechenweg: weder Faktortabelle noch Konfigurationsabdruck.
    expect(html).not.toContain('Aufwandfaktor');
    expect(html).not.toContain('konfigurationsabdruck');
  });

  it('wirft ohne Dokumentblock', () => {
    expect(() => renderToStaticMarkup(
      <VermarktungsOfferte offerte={baueBeispielOfferte()} />,
    )).toThrowError('Offerte ohne Dokument');
  });
});
