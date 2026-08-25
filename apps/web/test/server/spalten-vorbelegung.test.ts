import { describe, expect, it } from 'vitest';
import type { Konfiguration, KernAnpassungsVorlage } from '@offert/core';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { vorbelegteSpalten } from '../../src/server/spalten-vorbelegung.js';

function konfigurationMitVorlage(v: KernAnpassungsVorlage): Konfiguration {
  return { ...standardKonfiguration(), anpassungsVorlagen: [v] };
}

describe('vorbelegteSpalten', () => {
  it('erzeugt je firmenweiter Vorlage eine Spalte', () => {
    const konfiguration = standardKonfiguration();
    const spalten = vorbelegteSpalten(konfiguration);
    expect(spalten.length).toBeGreaterThan(0);
    for (const [s, v] of spalten.map((s, i) => [s, konfiguration.anpassungsVorlagen[i]!] as const)) {
      expect(s.bezeichnung).not.toBe('');
      // Die Erfassungsform kommt jetzt aus der Vorlage, nicht mehr aus einer
      // Konstanten — dieselbe Konfiguration traegt sowohl 'relativ'- als auch
      // 'absolut'-Vorlagen (z. B. 'stockwerklage').
      expect(s.erfassungsform).toBe(v.erfassungsform);
    }
  });

  it('vergibt eindeutige Spaltenkennungen', () => {
    const ids = vorbelegteSpalten(standardKonfiguration()).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Regression: `bezeichnung` ist das kurze Etikett der Vorlage, nicht der ausformulierte
  // `begruendungVorschlag`-Satz. Eine Verwechslung faellt am Spaltenkopf nicht sofort auf
  // (beides ist ein nichtleerer String), darum wird hier explizit auf den Wortlaut geprueft.
  it('uebernimmt die Vorlagenbezeichnung, nicht den Begruendungsvorschlag', () => {
    const vorlagen = standardKonfiguration().anpassungsVorlagen;
    const spalten = vorbelegteSpalten(standardKonfiguration());
    expect(spalten.map((s) => s.bezeichnung)).toEqual(vorlagen.map((v) => v.bezeichnung));
    for (const [s, v] of spalten.map((s, i) => [s, vorlagen[i]!] as const)) {
      expect(s.bezeichnung).not.toBe(v.begruendungVorschlag);
    }
  });

  it('uebernimmt Erfassungsform und Regel aus der Vorlage', () => {
    const k = konfigurationMitVorlage({
      id: 'stockwerklage', bezeichnung: 'Zuschlag Stockwerklage',
      vorgabefaktor: 0, erfassungsform: 'absolut',
      begruendungVorschlag: 'Zuschlag fuer die Stockwerklage gemaess firmenweiter Staffel.',
      regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 0 }, { wert: 1000000 }] },
    });
    const spalten = vorbelegteSpalten(k);
    expect(spalten[0]!.erfassungsform).toBe('absolut');
    expect(spalten[0]!.regel?.merkmal).toBe('stockwerk');
    expect(spalten[0]!.vorgabewert).toBeUndefined();
  });

  // Haelt bewusst am bisherigen Verhalten fest: Ohne Bedingung bleibt der Vorgabewert
  // neutral, weil eine unbedingte Vorbelegung jeder Einheit alle Anpassungen zugleich
  // gaebe. Genau diese Unterscheidung ist der Kern der Aenderung.
  it('laesst eine Vorlage ohne Regel weiterhin ohne Vorgabewert starten', () => {
    const k = konfigurationMitVorlage({
      id: 'laermexposition', bezeichnung: 'Laermexposition',
      vorgabefaktor: -0.1, erfassungsform: 'relativ',
      begruendungVorschlag: 'Ausrichtung zur Hauptverkehrsachse mit erhoehter Laermbelastung.',
    });
    const spalten = vorbelegteSpalten(k);
    expect(spalten[0]!.regel).toBeUndefined();
    expect(spalten[0]!.vorgabewert).toBe(0);
  });
});
