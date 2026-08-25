import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BereichsregelEditor } from '../../../src/components/einstellungen/BereichsregelEditor.js';

const MERKMALE = [{ id: 'stockwerk', bezeichnung: 'Stockwerk', form: 'zahl' as const }];
const REGEL = {
  merkmal: 'stockwerk',
  bereiche: [{ unter: 1, wert: 0 }, { unter: 2, wert: 1000000 }, { wert: 2000000 }],
};

describe('BereichsregelEditor', () => {
  it('zeigt je Bereich eine Zeile', () => {
    const html = renderToStaticMarkup(
      <BereichsregelEditor
        regel={REGEL}
        merkmale={MERKMALE}
        erfassungsform="absolut"
        aendere={() => undefined}
      />,
    );
    expect(html.match(/data-bereich=/g)).toHaveLength(3);
  });

  it('weist den letzten Bereich als Restfall aus, ohne Schwelleneingabe', () => {
    const html = renderToStaticMarkup(
      <BereichsregelEditor
        regel={REGEL}
        merkmale={MERKMALE}
        erfassungsform="absolut"
        aendere={() => undefined}
      />,
    );
    expect(html).toContain('Restfall');
  });

  it('meldet eine ungueltige Staffel, statt sie stillschweigend zu speichern', () => {
    const html = renderToStaticMarkup(
      <BereichsregelEditor
        regel={{ merkmal: 'stockwerk', bereiche: [{ unter: 2, wert: 0 }, { unter: 1, wert: 5 }, { wert: 9 }] }}
        merkmale={MERKMALE}
        erfassungsform="relativ"
        aendere={() => undefined}
      />,
    );
    expect(html).toContain('aufsteigend');
  });
});
