import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DossierEditor } from '../../../src/components/einstellungen/DossierEditor.js';
import { EinstellungsEditor } from '../../../src/components/einstellungen/EinstellungsEditor.js';
import { FaktorenEditor } from '../../../src/components/einstellungen/FaktorenEditor.js';
import type {
  VerwendeEinstellungenErgebnis,
} from '../../../src/components/einstellungen/verwende-einstellungen.js';
import {
  BefundAuffang, ProjektEinstellungen,
} from '../../../src/components/einstellungen/ProjektEinstellungen.js';

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

/**
 * Der Hinweistext des Faktor-Entfernen-Knopfs. Eindeutiger als das Wort «entfernen», das
 * im selben Markup auch an den Zeilen der Stuetzstellen, Vorlagen und Merkmale steht —
 * dort ist Entfernen korrekt, weil Arrays im Merge vollstaendig ersetzt werden.
 */
const FAKTOR_ENTFERNEN_TITEL = 'Projekte, die diesen Faktor erfasst haben';

/** Ruhender Editor-Zustand ohne Hooks — genug, um einen Bereichs-Editor zu rendern. */
function zustandFuer(entwurf: Readonly<Record<string, unknown>>): VerwendeEinstellungenErgebnis {
  return {
    entwurf,
    geaendert: false,
    speichert: false,
    pruefsumme: undefined,
    befunde: [],
    aendere: () => undefined,
    speichere: () => undefined,
    verwerfe: () => undefined,
  };
}

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
    // «Preisanpassung» deckt vier Konfigurationswurzeln ab (`bereiche.ts`). Ein Abzeichen
    // je Wurzel statt eines je Karte: Sonst faerbte eine einzige Uebersteuerung den
    // ganzen Bereich als projektbezogen ein, obwohl drei Wurzeln den Firmenwerten folgen.
    const html = baueMarkup({ flaeche: { alpha: 0.6 } });
    const projektbezogen = html.match(/projektbezogen/g) ?? [];
    const firmenweit = html.match(/firmenweit/g) ?? [];
    expect(projektbezogen).toHaveLength(1);
    expect(firmenweit.length).toBeGreaterThan(1);
  });

  it('bindet den Auffangblock fuer nicht verankerbare Befunde ein (K-1)', () => {
    // Quelltextnahe Verdrahtungspruefung nach demselben Vorgehen wie
    // `ProjektAnsicht.test.ts`: Befunde entstehen erst nach einem gescheiterten
    // Speicherversuch und damit im Zustand, der ohne Hook-Testbibliothek nicht
    // herstellbar ist. Die Anzeige selbst prueft `BefundAuffang` unten direkt.
    const quelle = readFileSync(resolve(
      import.meta.dirname,
      '../../../src/components/einstellungen/ProjektEinstellungen.tsx',
    ), 'utf8');
    expect(quelle).toMatch(/<BefundAuffang befunde=\{befunde\}/);
  });

  it('meldet eine wirkungslose leere Delta-Wurzel nicht als Uebersteuerung', () => {
    // `{ honorar: {} }` legt keinen Wert ein; `bildeDelta` raeumt die Wurzel ab, das
    // Abzeichen darf sie deshalb nicht als abweichend melden.
    const html = baueMarkup({ honorar: {} });
    expect(html).not.toContain('projektbezogen');
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
});

describe('JSON-Reiter der Projektebene (W-2)', () => {
  it('bietet den Umschalter Formular/JSON an', () => {
    // Entwurf §4 verlangt den Umschalter auf BEIDEN Ebenen; umgesetzt war er nur
    // firmenweit, wodurch der Nur-Lese-Zweig von `JsonReiter` toter Produktionscode war.
    const html = baueMarkup({});
    expect(html).toContain('aria-label="Darstellung"');
    expect(html).toContain('>JSON<');
    expect(html).toContain('>Formular<');
  });

  it('verdrahtet das Delta schreibbar und die effektive Konfiguration nur lesend', () => {
    // Der Umschalter liegt im Client-Zustand; quelltextnahe Verdrahtungspruefung wie in
    // `ProjektAnsicht.test.ts`. Die Richtung ist die tragende Aussage: Bearbeitet wird
    // das Delta — waere die effektive Konfiguration schreibbar, machte jedes Speichern
    // aus dem Projekt eine Vollkopie.
    const quelle = readFileSync(resolve(
      import.meta.dirname,
      '../../../src/components/einstellungen/ProjektEinstellungen.tsx',
    ), 'utf8');
    expect(quelle).toContain("wert={jsonSicht === 'delta' ? aktuellesDelta : entwurf}");
    expect(quelle).toContain("schreibbar={jsonSicht === 'delta'}");
  });
});

describe('Entfernen auf Projektebene (K-3)', () => {
  /**
   * `bildeDelta` iteriert ueber die Schluessel des Entwurfs; ein im Entwurf GELOESCHTER
   * Firmenschluessel erzeugt deshalb keinen Delta-Eintrag. Das ist eine bewusste,
   * dokumentierte und getestete Modellgrenze — also darf die Oberflaeche die Aktion auf
   * dieser Ebene nicht anbieten. Sie war ein stiller No-Op: Karte weg, Delta unveraendert,
   * «Speichern» ausgegraut, beim naechsten Laden ist der Faktor wieder da.
   */
  it('bietet auf Projektebene kein Entfernen eines Aufwandfaktors an', () => {
    const html = baueMarkup({});
    expect(html).not.toContain(FAKTOR_ENTFERNEN_TITEL);
    // Stattdessen die Begruendung, damit die fehlende Aktion nicht wie ein Mangel wirkt.
    expect(html).toContain('nur firmenweit');
  });

  it('bietet auf Projektebene kein Entfernen einer Bewertungszeile an', () => {
    // Dieselbe Modellgrenze fuer die offenen Woerterbuecher unter `dossierDefaults`.
    // Direkt am Bereichs-Editor geprueft: Im Markup der ganzen Seite steht
    // `aria-label="entfernen"` auch an Stuetzstellen, Vorlagen und Merkmalen — das sind
    // ARRAYS, die der Merge vollstaendig ersetzt, dort ist Entfernen korrekt.
    const projekt = renderToStaticMarkup(
      <DossierEditor einstellungen={zustandFuer(FIRMA)} ebene="projekt" />,
    );
    expect(projekt).not.toContain('aria-label="entfernen"');
    const firma = renderToStaticMarkup(
      <DossierEditor einstellungen={zustandFuer(FIRMA)} ebene="firma" />,
    );
    expect(firma).toContain('aria-label="entfernen"');
  });

  it('behaelt das Entfernen auf der Firmenebene', () => {
    // Gegenprobe: Firmenweit wird die vollstaendige Konfiguration geschrieben, ein
    // geloeschter Schluessel ist dort ausdrueckbar und bleibt erlaubt.
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
    // `api` ist bewusst kein Bereich der Oberflaeche — ein Befund darauf war zuvor
    // nirgends sichtbar, und ein abgelehntes Delta wirkte wie ein erfolgreiches
    // Speichern.
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
    // `pfad: ''` ist der Netz-/500-Fallback; `rahmenBefunde` zeigt ihn in jeder Karte.
    // Der Auffangblock darf ihn nicht ein zweites Mal bringen.
    const html = renderToStaticMarkup(
      <BefundAuffang
        befunde={[{ pfad: '', text: 'Nicht gespeichert.' }]}
        wurzeln={WURZELN}
      />,
    );
    expect(html).toBe('');
  });
});
