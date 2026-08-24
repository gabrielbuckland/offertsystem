import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FaktorParameter, Faktormenge, FaktorId, Gewicht, Konfiguration } from '@offert/core';
import { Aufwandfaktoren } from '../../src/components/projekt/Aufwandfaktoren.js';
import { baueFaktorformular, pruefeFaktorwerte } from '../../src/server/faktorformular.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

type Teilparameter = Partial<FaktorParameter> & Pick<FaktorParameter, 'quelle'>;

/** Baut eine Konfiguration mit genau der uebergebenen Faktormenge. */
function konfigMit(faktoren: Readonly<Record<string, Teilparameter>>): Konfiguration {
  const basis = standardKonfiguration();
  const menge: Faktormenge = new Map(
    Object.entries(faktoren).map(([id, teil]) => [id as FaktorId, {
      grenzeMin: 1,
      grenzeMax: 5,
      gewicht: 1 as Gewicht,
      strategie: 'min-max',
      quellSchluessel: id,
      bezeichnung: id,
      ...teil,
    } as FaktorParameter]),
  );
  return { ...basis, faktoren: menge };
}

function konfigMitManuellen(anzahl: number): Konfiguration {
  const eintraege: Record<string, Teilparameter> = {};
  for (let i = 1; i <= anzahl; i += 1) {
    eintraege[`m${i}`] = { quelle: 'manuell', bezeichnung: `Faktor ${i}` };
  }
  return konfigMit(eintraege);
}

describe('Genau n Felder aus n manuellen Faktoren', () => {
  it('erzeugt je manuellem Faktor genau ein Feld', () => {
    const konfig = konfigMit({
      lage_gesamt: { quelle: 'lagescore', grenzeMin: 1, grenzeMax: 0 },
      objektzustand: { quelle: 'manuell', grenzeMin: 1, grenzeMax: 5 },
      vermarktung: { quelle: 'manuell', grenzeMin: 1, grenzeMax: 5 },
      projektumfang: { quelle: 'abgeleitet', grenzeMin: 4, grenzeMax: 60 },
    });
    expect(baueFaktorformular(konfig).felder.map((f) => f.faktorId))
      .toEqual(['objektzustand', 'vermarktung']);
  });

  it('liefert dieselbe Struktur mit n+1 Faktoren ohne Teste-Aenderung', () => {
    // Der Vorabnachweis, der die Null-Dateien-Messung in 6.3 erst aussagekraeftig macht.
    const basis = baueFaktorformular(konfigMitManuellen(3)).felder;
    const erweitert = baueFaktorformular(konfigMitManuellen(4)).felder;
    expect(basis).toHaveLength(3);
    expect(erweitert).toHaveLength(4);
    expect(erweitert.slice(0, 3)).toEqual(basis);
  });
});

describe('Feldeigenschaften stammen aus der Konfiguration', () => {
  it('bezieht jede Feldeigenschaft aus dem Konfigurationseintrag, nicht aus Literalen', () => {
    const konfig = konfigMit({
      objektzustand: {
        quelle: 'manuell', bezeichnung: 'Objektzustand', grenzeMin: 1, grenzeMax: 5,
        skala: { form: 'ordinal', stufen: [
          { wert: 1, bezeichnung: 'sehr gut' },
          { wert: 5, bezeichnung: 'sanierungsbeduerftig' },
        ] },
      },
    });
    const [feld] = baueFaktorformular(konfig).felder;
    expect(feld).toEqual({
      faktorId: 'objektzustand',
      beschriftung: 'Objektzustand',
      untergrenze: 1,
      obergrenze: 5,
      eingabeform: 'ordinal',
      stufen: [{ wert: 1, bezeichnung: 'sehr gut' },
               { wert: 5, bezeichnung: 'sanierungsbeduerftig' }],
      pflicht: true,
      validierungsmeldung: 'Wert muss zwischen 1 und 5 liegen.',
    });
  });

  it('kehrt vertauschte Grenzen fuer die Feldgrenzen um, ohne die Umpolung zu veraendern', () => {
    const konfig = konfigMit({ f: { quelle: 'manuell', grenzeMin: 5, grenzeMax: 1 } });
    const [feld] = baueFaktorformular(konfig).felder;
    expect(feld!.untergrenze).toBe(1);
    expect(feld!.obergrenze).toBe(5);
    // Die Konfiguration selbst bleibt umgepolt — sonst kippte die Normalisierungsrichtung.
    expect(konfig.faktoren.get('f' as FaktorId)?.grenzeMin).toBe(5);
  });
});

describe('Vollstaendigkeitspflicht je manuellem Faktor', () => {
  const KONFIG = konfigMit({
    objektzustand: { quelle: 'manuell', bezeichnung: 'Objektzustand', grenzeMin: 1, grenzeMax: 5 },
    vermarktung: { quelle: 'manuell', bezeichnung: 'Vermarktungsaufwand', grenzeMin: 1, grenzeMax: 5 },
  });

  it('meldet einen fehlenden manuellen Faktor am Feld, nicht als Kernabbruch', () => {
    expect(pruefeFaktorwerte(baueFaktorformular(KONFIG), { objektzustand: 3 })).toEqual([{
      feldpfad: 'aufwandfaktoren.vermarktung',
      text: 'Vermarktungsaufwand ist ein Pflichtfeld. Wert muss zwischen 1 und 5 liegen.',
    }]);
  });

  it('meldet einen Wert ausserhalb der Grenzen mit dem konkreten Bereich', () => {
    const meldungen = pruefeFaktorwerte(baueFaktorformular(KONFIG),
                                        { objektzustand: 9, vermarktung: 3 });
    expect(meldungen[0]!.text).toContain('zwischen 1 und 5');
  });
});

describe('Stufenbeschriftungen erreichen die Maske (AK-3.7, PE-05)', () => {
  it('rendert je Ordinalstufe eine beschriftete Auswahl, nicht ein nacktes Zahlenfeld', () => {
    const formular = baueFaktorformular(konfigMit({
      objektzustand: {
        quelle: 'manuell', bezeichnung: 'Objektzustand', grenzeMin: 1, grenzeMax: 5,
        skala: { form: 'ordinal', stufen: [
          { wert: 1, bezeichnung: 'sehr gut' },
          { wert: 5, bezeichnung: 'sanierungsbeduerftig' },
        ] },
      },
    }));
    const html = renderToStaticMarkup(
      <Aufwandfaktoren formular={formular} werte={{}} aendere={() => undefined} />);
    expect(html).toContain('sehr gut');
    expect(html).toContain('sanierungsbeduerftig');
    expect(html).toContain('<select');
  });
});

describe('Kein Faktorbezeichner im Code der Erfassung (I-13)', () => {
  it('faellt ohne skala auf ein Zahlenfeld zurueck, ohne die Grenzen zu verlieren', () => {
    const formular = baueFaktorformular(konfigMit({
      vermarktung: { quelle: 'manuell', bezeichnung: 'Vermarktungsaufwand',
                     grenzeMin: 1, grenzeMax: 5 },
    }));
    expect(formular.felder[0]!.eingabeform).toBe('zahl');
    expect(formular.felder[0]!.stufen).toBeUndefined();
    expect(formular.felder[0]).toMatchObject({ untergrenze: 1, obergrenze: 5 });
  });

  it('nennt in Formularbeschreibung und Komponente keinen einzelnen Faktorbezeichner', () => {
    const wurzel = fileURLToPath(new URL('../../../..', import.meta.url));
    for (const datei of ['apps/web/src/server/faktorformular.ts',
                         'apps/web/src/components/projekt/Aufwandfaktoren.tsx']) {
      const quelle = readFileSync(`${wurzel}${datei}`, 'utf8');
      for (const verboten of ['lage_gesamt', 'objektzustand', 'projektumfang',
                              'preissegment', 'vermarktung']) {
        expect(quelle, `${datei} nennt ${verboten}`).not.toContain(verboten);
      }
    }
  });
});
