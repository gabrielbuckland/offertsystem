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
    expect(html).toContain('Vermarktungsofferte');
    expect(html).toContain('Muster Immobilien AG');
    expect(html).toContain('<h2'); // heading level 1 -> h2, h1 ist der Titel
    expect(html).toContain('Ausgangslage');
    expect(html).toContain('<strong>Neubau in Aarau.</strong>');
    expect(html).toContain('A-01');
    expect(html).toContain("CHF 500&#x27;000.00");
    expect(html).not.toContain('Aufwandfaktor');
    expect(html).not.toContain('konfigurationsabdruck');
  });

  it('wirft ohne Dokumentblock', () => {
    expect(() => renderToStaticMarkup(
      <VermarktungsOfferte offerte={baueBeispielOfferte()} />,
    )).toThrowError('Offerte ohne Dokument');
  });

  it('haelt mehrere Absaetze eines Listenpunkts als eigene <p> auseinander (M-8)', () => {
    const offerte = {
      ...baueBeispielOfferte(),
      dokument: {
        inhalt: {
          type: 'doc' as const,
          content: [{
            type: 'bulletList' as const,
            content: [{
              type: 'listItem' as const,
              content: [
                { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Erster Absatz' }] },
                { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Zweiter Absatz' }] },
              ],
            }],
          }],
        },
        vorlageVersion: '1',
      },
    };
    const html = renderToStaticMarkup(<VermarktungsOfferte offerte={offerte} />);
    expect(html).toContain('<li><p>Erster Absatz</p><p>Zweiter Absatz</p></li>');
  });

  it('rendert eine orderedList analog zur bulletList', () => {
    const offerte = {
      ...baueBeispielOfferte(),
      dokument: {
        inhalt: {
          type: 'doc' as const,
          content: [{
            type: 'orderedList' as const,
            content: [{
              type: 'listItem' as const,
              content: [
                { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Erster Schritt' }] },
              ],
            }],
          }],
        },
        vorlageVersion: '1',
      },
    };
    const html = renderToStaticMarkup(<VermarktungsOfferte offerte={offerte} />);
    expect(html).toContain('<ol><li><p>Erster Schritt</p></li></ol>');
  });

  it('bildet die Ueberschriftenebenen 2 und 3 auf h3 und h4 ab (h1 ist der Offert-Titel)', () => {
    const offerte = {
      ...baueBeispielOfferte(),
      dokument: {
        inhalt: {
          type: 'doc' as const,
          content: [
            { type: 'heading' as const, attrs: { level: 2 as const },
              content: [{ type: 'text' as const, text: 'Konzept' }] },
            { type: 'heading' as const, attrs: { level: 3 as const },
              content: [{ type: 'text' as const, text: 'Detail' }] },
          ],
        },
        vorlageVersion: '1',
      },
    };
    const html = renderToStaticMarkup(<VermarktungsOfferte offerte={offerte} />);
    expect(html).toContain('<h3>Konzept</h3>');
    expect(html).toContain('<h4>Detail</h4>');
  });

  it('rendert die italic-Markierung als <em>', () => {
    const offerte = {
      ...baueBeispielOfferte(),
      dokument: {
        inhalt: {
          type: 'doc' as const,
          content: [{
            type: 'paragraph' as const,
            content: [{ type: 'text' as const, text: 'betont', marks: [{ type: 'italic' as const }] }],
          }],
        },
        vorlageVersion: '1',
      },
    };
    const html = renderToStaticMarkup(<VermarktungsOfferte offerte={offerte} />);
    expect(html).toContain('<em>betont</em>');
  });
});
