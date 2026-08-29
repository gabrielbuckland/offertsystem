import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjektEinstellungen } from '../../../src/components/einstellungen/ProjektEinstellungen.js';

/**
 * Nur Darstellung ueber `renderToStaticMarkup` (gleiches Muster wie `shell.test.tsx` und
 * `JsonReiter.test.tsx`) — das Repo hat weder `jsdom` noch `@testing-library/react`
 * installiert. Das Verhalten hinter den Knoepfen (effektiv anzeigen, Delta speichern)
 * deckt `projekt-einstellungen-logik.test.ts` an den reinen Funktionen ab.
 *
 * Firmenwerte sind die ECHTE `config/company-defaults.json` statt eines Minimal-Objekts:
 * Die vier Bereichs-Editoren lesen ihre Teilbaeume ungeprueft (`entwurf['honorar'] as
 * HonorarRoh` usw.), ein zurechtgeschnittenes Fixture liefe deshalb an einer fehlenden
 * Wurzel auf. Gleiches Vorgehen wie `standardkonfiguration.test.ts`.
 */
const FIRMA = JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../../../../../config/company-defaults.json'), 'utf8',
)) as Readonly<Record<string, unknown>>;

/**
 * Beschriftung des Zuruecksetzen-Knopfs. Als eigene Konstante, weil die Negativpruefung
 * sonst am Einleitungshinweis haengen bliebe: Dort steht «Abweichungen von den
 * Firmenwerten», ein blosses `not.toContain('Firmenwert')` waere immer rot.
 */
const ZURUECKSETZEN = 'Auf Firmenwert zurücksetzen';

function baueMarkup(delta: Readonly<Record<string, unknown>>): string {
  return renderToStaticMarkup(
    <ProjektEinstellungen projektId="p1" firmenwerte={FIRMA} delta={delta} />,
  );
}

describe('ProjektEinstellungen', () => {
  it('weist einen uebersteuerten Wert als projektbezogen aus', () => {
    const html = baueMarkup({ flaeche: { alpha: 0.6 } });
    expect(html).toContain('projektbezogen');
  });

  it('bietet fuer einen uebersteuerten Wert das Zuruecksetzen auf den Firmenwert an', () => {
    const html = baueMarkup({ flaeche: { alpha: 0.6 } });
    expect(html).toContain(ZURUECKSETZEN);
  });

  it('zeigt ohne Delta durchgaengig «firmenweit» und keinen Zuruecksetzen-Knopf', () => {
    const html = baueMarkup({});
    expect(html).toContain('firmenweit');
    expect(html).not.toContain('projektbezogen');
    expect(html).not.toContain(ZURUECKSETZEN);
  });

  it('zeigt die EFFEKTIVE Konfiguration, nicht nur das Delta', () => {
    // Der tragende Punkt: Auch die nicht uebersteuerten Bereiche stehen im Formular.
    // Waere das Delta die Anzeigegrundlage, saehe der Vermarkter drei leere Karten und
    // wuesste nicht, womit gerechnet wird. Das Honorar ist hier NICHT uebersteuert, sein
    // Firmenwert muss trotzdem im Markup stehen.
    const honorar = FIRMA['honorar'] as { readonly skalierung: { readonly gMin: number } };
    const html = baueMarkup({ flaeche: { alpha: 0.6 } });
    expect(html).toContain(String(honorar.skalierung.gMin));
  });

  it('zeigt den uebersteuerten Wert statt des Firmenwerts im Feld', () => {
    const firmenAlpha = (FIRMA['flaeche'] as { readonly alpha: number }).alpha;
    const html = baueMarkup({ flaeche: { alpha: 0.42 } });
    expect(html).toContain('value="0.42"');
    expect(html).not.toContain(`value="${firmenAlpha}"`);
  });

  it('rendert alle vier Bereiche mit Titel und Zweck', () => {
    const html = baueMarkup({});
    expect(html).toContain('Dossier-Voreinstellungen');
    expect(html).toContain('Preisanpassung');
    expect(html).toContain('Aufwandfaktoren');
    expect(html).toContain('Honorar');
  });

  it('benennt die projektbezogene Wirkung in der Fussleiste', () => {
    // Abgrenzung zur Firmenseite, die dort «Wirkt auf alle Projekte.» schreibt.
    const html = baueMarkup({});
    expect(html).toContain('Wirkt nur auf dieses Projekt.');
    expect(html).toContain('Speichern');
    expect(html).toContain('Verwerfen');
  });

  it('kennzeichnet bei einem Bereich mit mehreren Wurzeln nur die uebersteuerte', () => {
    // «Preisanpassung» deckt vier Konfigurationswurzeln ab (`bereiche.ts`). Ein Abzeichen
    // je Wurzel statt eines je Karte: Sonst faerbte eine einzige Uebersteuerung den
    // ganzen Bereich als projektbezogen ein, obwohl drei Wurzeln den Firmenwerten folgen.
    const html = baueMarkup({ flaeche: { alpha: 0.6 } });
    const projektbezogen = html.match(/projektbezogen/g) ?? [];
    const firmenweit = html.match(/firmenweit/g) ?? [];
    expect(projektbezogen).toHaveLength(1);
    expect(firmenweit.length).toBeGreaterThan(1);
  });

  it('meldet eine wirkungslose leere Delta-Wurzel nicht als Uebersteuerung', () => {
    // `{ honorar: {} }` legt keinen Wert ein; `bildeDelta` raeumt die Wurzel ab, das
    // Abzeichen darf sie deshalb nicht als abweichend melden.
    const html = baueMarkup({ honorar: {} });
    expect(html).not.toContain('projektbezogen');
  });
});
