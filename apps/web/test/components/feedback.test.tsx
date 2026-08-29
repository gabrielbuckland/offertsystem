import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hinweis } from '../../src/components/ui/hinweis.js';

describe('Hinweis', () => {
  it('traegt bei Fehlern immer role=alert, sonst role=status', () => {
    expect(renderToStaticMarkup(<Hinweis art="fehler">kaputt</Hinweis>))
      .toContain('role="alert"');
    expect(renderToStaticMarkup(<Hinweis art="info">nur so</Hinweis>))
      .toContain('role="status"');
  });
});
