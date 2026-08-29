import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../../src/components/shell/AppShell.js';
import { Brotkrume } from '../../src/components/shell/Brotkrume.js';

describe('AppShell', () => {
  it('fuehrt keinen zentralen Einstellungspunkt mehr in der Kopfleiste', () => {
    const markup = renderToStaticMarkup(<AppShell><p>Inhalt</p></AppShell>);
    expect(markup).toContain('Projekte');
    // Einstellungen gelten je Ebene und sind dort erreichbar, wo sie wirken.
    expect(markup).not.toContain('>Einstellungen<');
  });
});

describe('Brotkrume', () => {
  it('verlinkt alle Stufen ausser der letzten', () => {
    const html = renderToStaticMarkup(
      <Brotkrume stufen={[
        { beschriftung: 'Projekte', href: '/projekte' },
        { beschriftung: 'Seestrasse 1, 8001 Zürich' },
      ]} />,
    );
    expect(html).toContain('href="/projekte"');
    expect(html).toContain('Seestrasse 1');
    expect(html).toContain('aria-current="page"');
  });
});
