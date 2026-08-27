/**
 * Prüft die Dokumentwahl der Darstellung als reine Funktion der Artefaktform —
 * kein Oberflächentest, sondern die Zusage: Neues Artefakt -> Kundendokument,
 * Alt-Artefakt ohne Dokumentblock -> bisheriger Rechenweg (I-24: nie halb).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErgebnisDarstellung } from '../../src/components/ErgebnisDarstellung.js';
import { baueBeispielOfferte } from '../bau/offerte-bauer.js';

const DOKUMENT = {
  inhalt: {
    type: 'doc' as const,
    content: [{ type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: 'Kundentext' }] }],
  },
  vorlageVersion: '1',
};

describe('ErgebnisDarstellung', () => {
  it('zeigt bei neuem Artefakt das Kundendokument und den Rechenweg nur eingeklappt', () => {
    const html = renderToStaticMarkup(
      <ErgebnisDarstellung offerte={{ ...baueBeispielOfferte(), dokument: DOKUMENT }} />,
    );
    expect(html).toContain('Kundentext');
    expect(html).toContain('vermarktungsofferte');
    expect(html).toContain('Rechenweg');            // Tool-Ansicht bleibt erreichbar
    expect(html).toContain('<details');             // aber nicht Teil des Dokuments
  });

  it('zeigt Alt-Artefakte ohne Dokumentblock weiterhin als Rechenweg', () => {
    const html = renderToStaticMarkup(
      <ErgebnisDarstellung offerte={baueBeispielOfferte()} />,
    );
    expect(html).not.toContain('vermarktungsofferte');
    expect(html).toContain('Aufwandfaktor');
  });
});
