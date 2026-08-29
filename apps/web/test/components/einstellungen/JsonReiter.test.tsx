import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonReiter } from '../../../src/components/einstellungen/JsonReiter.js';

/**
 * Nur Darstellung ueber `renderToStaticMarkup` (gleiches Muster wie `shell.test.tsx`) —
 * das Repo hat weder `jsdom` noch `@testing-library/react` installiert, deshalb keine
 * `fireEvent`-Interaktionstests hier. Das Parse-/Serialisierungsverhalten (gueltiges
 * JSON, kaputtes JSON, Rundlauf) deckt `json-reiter-logik.test.ts` an den reinen
 * Funktionen ab, die diese Komponente verdrahtet.
 */
describe('JsonReiter', () => {
  it('zeigt den Wert als eingeruecktes JSON im Textfeld', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{ flaeche: { alpha: 0.5 } }} beiAenderung={() => {}}
                  schreibbar befunde={[]} />,
    );
    expect(html).toContain(JSON.stringify({ flaeche: { alpha: 0.5 } }, null, 2)
      .replace(/"/g, '&quot;'));
  });

  it('sperrt das Feld im Nur-Lese-Modus', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{}} beiAenderung={() => {}} schreibbar={false} befunde={[]} />,
    );
    expect(html).toContain('readOnly=""');
  });

  it('laesst das Feld im schreibbaren Modus ohne readOnly-Attribut', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{}} beiAenderung={() => {}} schreibbar befunde={[]} />,
    );
    expect(html).not.toContain('readOnly');
  });

  it('zeigt uebergebene Befunde am Feld an', () => {
    const html = renderToStaticMarkup(
      <JsonReiter wert={{}} beiAenderung={() => {}} schreibbar
                  befunde={[{ pfad: 'honorar', text: 'Der Honorarbereich ist unvollstaendig.' }]} />,
    );
    expect(html).toContain('Der Honorarbereich ist unvollstaendig.');
  });
});
