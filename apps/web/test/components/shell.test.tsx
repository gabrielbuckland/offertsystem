import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../../src/components/shell/AppShell.js';
import { Brotkrume } from '../../src/components/shell/Brotkrume.js';

describe('AppShell', () => {
  it('traegt Wortmarke und beide Navigationsziele', () => {
    const html = renderToStaticMarkup(<AppShell><p>Inhalt</p></AppShell>);
    expect(html).toContain('Offertsystem');
    expect(html).toContain('href="/projekte"');
    expect(html).toContain('href="/einstellungen"');
    expect(html).toContain('Inhalt');
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
