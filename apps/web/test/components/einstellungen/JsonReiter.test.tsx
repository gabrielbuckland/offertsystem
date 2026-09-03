import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonReiter } from '../../../src/components/einstellungen/JsonReiter.js';

describe('JsonReiter', () => {
  it('zeigt den Wert im Textfeld', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{ flaeche: { alpha: 0.5 } }} aendere={() => {}}
                  schreibbar befunde={[]} />,
    );
    expect(html).toContain('flaeche');
  });

  it('sperrt das Feld im Nur-Lese-Modus', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{}} aendere={() => {}} schreibbar={false} befunde={[]} />,
    );
    expect(html).toContain('readOnly=""');
  });

  it('laesst das Feld im schreibbaren Modus ohne readOnly-Attribut', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{}} aendere={() => {}} schreibbar befunde={[]} />,
    );
    expect(html).not.toContain('readOnly');
  });

  it('zeigt uebergebene Befunde am Feld an', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{}} aendere={() => {}} schreibbar
                  befunde={[{ pfad: 'honorar', text: 'Der Honorarbereich ist unvollstaendig.' }]} />,
    );
    expect(html).toContain('Der Honorarbereich ist unvollstaendig.');
  });
});
