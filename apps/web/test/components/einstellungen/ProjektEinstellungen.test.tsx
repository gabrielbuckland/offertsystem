import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EinstellungsEditor } from '../../../src/components/einstellungen/EinstellungsEditor.js';
import { FaktorenEditor } from '../../../src/components/einstellungen/FaktorenEditor.js';
import {
  BefundAuffang, ProjektEinstellungen,
} from '../../../src/components/einstellungen/ProjektEinstellungen.js';

// Echte company-defaults.json: Editoren lesen Teilbäume ungeprueft, Fixture würde fehlen.
const FIRMA = JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../../../../../config/company-defaults.json'), 'utf8',
)) as Readonly<Record<string, unknown>>;

// Konstante für not.toContain, um Falsch-Positive im Hinweis zu vermeiden.
const ZURUECKSETZEN = 'Auf Firmenwert zurücksetzen';

// Eindeutige Konstante; "entfernen" steht mehrfach im Markup.
const FAKTOR_ENTFERNEN_TITEL = 'Projekte, die diesen Faktor erfasst haben';

function baueMarkup(delta: Readonly<Record<string, unknown>>): string {
  return renderToStaticMarkup(
    <ProjektEinstellungen projektId="p1" firmenwerte={FIRMA} delta={delta} />,
  );
}

describe('ProjektEinstellungen', () => {
  it('zeigt ohne Delta durchgaengig «firmenweit» und keinen Zuruecksetzen-Knopf', () => {
    const html = baueMarkup({});
    expect(html).toContain('firmenweit');
    expect(html).not.toContain('projektbezogen');
    expect(html).not.toContain(ZURUECKSETZEN);
  });

  it('kennzeichnet bei einem Bereich mit mehreren Wurzeln nur die uebersteuerte', () => {
    // Abzeichen je Wurzel: eine Uebersteuerung faerbt nicht den ganzen Bereich.
    const html = baueMarkup({ flaeche: { alpha: 0.6 } });
    const projektbezogen = html.match(/projektbezogen/g) ?? [];
    const firmenweit = html.match(/firmenweit/g) ?? [];
    expect(projektbezogen).toHaveLength(1);
    expect(firmenweit.length).toBeGreaterThan(1);
  });

  it('bindet den Auffangblock fuer nicht verankerbare Befunde ein (K-1)', () => {
    // Quelltextnahe Verdrahtungsprüfung; Befundzustand ohne Hook-Testbibliothek nicht herstellbar.
    const quelle = readFileSync(resolve(
      import.meta.dirname,
      '../../../src/components/einstellungen/ProjektEinstellungen.tsx',
    ), 'utf8');
    expect(quelle).toMatch(/<BefundAuffang befunde=\{befunde\}/);
  });

  it('meldet eine wirkungslose leere Delta-Wurzel nicht als Uebersteuerung', () => {
    // bildeDelta raeumt leere Wurzeln ab.
    const html = baueMarkup({ honorar: {} });
    expect(html).not.toContain('projektbezogen');
  });

  it('zeigt die EFFEKTIVE Konfiguration, nicht nur das Delta', () => {
    // Vermarkter muss alle Bereiche sehen, auch nicht-überstetuerte.
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
});

describe('JSON-Reiter der Projektebene (W-2)', () => {
  it('bietet den Umschalter Formular/JSON an', () => {
    const html = baueMarkup({});
    expect(html).toContain('aria-label="Darstellung"');
    expect(html).toContain('>JSON<');
    expect(html).toContain('>Formular<');
  });

  it('verdrahtet das Delta schreibbar und die effektive Konfiguration nur lesend', () => {
    // Quelltextnahe Verdrahtungsprüfung: schreibbar=Delta verhindert Vollkopie.
    const quelle = readFileSync(resolve(
      import.meta.dirname,
      '../../../src/components/einstellungen/ProjektEinstellungen.tsx',
    ), 'utf8');
    expect(quelle).toContain("wert={jsonSicht === 'delta' ? aktuellesDelta : entwurf}");
    expect(quelle).toContain("schreibbar={jsonSicht === 'delta'}");
  });
});

describe('Entfernen auf Projektebene (K-3)', () => {
  // K-3: bildeDelta iteriert Entwurf-Schlüssel; gelöschter Firmenschlüssel = kein Delta-Eintrag.
  it('bietet auf Projektebene kein Entfernen eines Aufwandfaktors an', () => {
    const html = baueMarkup({});
    expect(html).not.toContain(FAKTOR_ENTFERNEN_TITEL);
    // Stattdessen die Begruendung, damit die fehlende Aktion nicht wie ein Mangel wirkt.
    expect(html).toContain('nur firmenweit');
  });

  it('behaelt das Entfernen auf der Firmenebene', () => {
    // Gegenprobe: firmenweit ist gelöschter Schlüssel ausdrückbar und erlaubt.
    const html = renderToStaticMarkup(
      <EinstellungsEditor
        titel="Aufwandfaktoren"
        zweck="Gegenprobe zur Projektebene."
        bereichPraefix="aufwandfaktoren"
        anfang={FIRMA}
        Editor={FaktorenEditor}
      />,
    );
    expect(html).toContain(FAKTOR_ENTFERNEN_TITEL);
  });
});

describe('BefundAuffang (K-1)', () => {
  const WURZELN = ['dossierDefaults', 'flaeche', 'aufwandfaktoren', 'honorar'];

  it('zeigt einen Befund, den keine Bereichskarte verankern kann', () => {
    // api ist nicht im Formular; Befund darauf war zuvor unsichtbar.
    const html = renderToStaticMarkup(
      <BefundAuffang
        befunde={[{ pfad: 'api', text: 'projektbezogen nicht überschreibbar' }]}
        wurzeln={WURZELN}
      />,
    );
    expect(html).toContain('projektbezogen nicht überschreibbar');
    expect(html).toContain('api');
  });

  it('wiederholt einen Befund nicht, den bereits eine Bereichskarte traegt', () => {
    const html = renderToStaticMarkup(
      <BefundAuffang
        befunde={[{ pfad: 'honorar.stuetzstellen[1].hMin', text: 'Degression verletzt.' }]}
        wurzeln={WURZELN}
      />,
    );
    expect(html).toBe('');
  });

  it('ueberlaesst den unanhaengigen Befund (leerer Pfad) den Bereichskarten', () => {
    // pfad='' ist Netz-/500-Fallback; rahmenBefunde zeigt ihn bereits.
    const html = renderToStaticMarkup(
      <BefundAuffang
        befunde={[{ pfad: '', text: 'Nicht gespeichert.' }]}
        wurzeln={WURZELN}
      />,
    );
    expect(html).toBe('');
  });
});
