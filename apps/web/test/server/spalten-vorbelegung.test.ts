import { describe, expect, it } from 'vitest';
import type { Konfiguration, KernAnpassungsVorlage } from '@offert/core';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { spalteAusVorlage, vorbelegteSpalten } from '../../src/server/spalten-vorbelegung.js';

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
      // Dieselbe Konfiguration traegt sowohl 'relativ'- als auch 'absolut'-Vorlagen
      // (z. B. 'stockwerklage').
      expect(s.erfassungsform).toBe(v.erfassungsform);
    }
  });

  it('vergibt eindeutige Spaltenkennungen', () => {
    const ids = vorbelegteSpalten(standardKonfiguration()).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // `bezeichnung` ist das kurze Etikett der Vorlage, nicht der ausformulierte
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

  // Ohne Bedingung bleibt der Vorgabewert neutral, weil eine unbedingte Vorbelegung
  // jeder Einheit alle Anpassungen zugleich gaebe.
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

  it('vergibt S-1…S-n in Vorlagenreihenfolge und uebernimmt je Vorlage deren Form', () => {
    const k = standardKonfiguration();
    const spalten = vorbelegteSpalten(k);

    expect(spalten.map((s) => s.id)).toEqual(k.anpassungsVorlagen.map((_, i) => `S-${i + 1}`));
    for (const [s, v] of spalten.map((s, i) => [s, k.anpassungsVorlagen[i]!] as const)) {
      expect(s.bezeichnung).toBe(v.bezeichnung);
      expect(s.erfassungsform).toBe(v.erfassungsform);
      if (v.regel === undefined) {
        expect(s).not.toHaveProperty('regel');
        expect(s.vorgabewert).toBe(0);
      } else {
        expect(s.regel).toEqual(v.regel);
        expect(s).not.toHaveProperty('vorgabewert');
      }
    }
  });
});

describe('spalteAusVorlage', () => {
  it('setzt bei einer Vorlage OHNE Regel den neutralen Vorgabewert 0, nie den Vorgabefaktor', () => {
    const v = { id: 'seesicht', bezeichnung: 'Seesicht', vorgabefaktor: 0.08,
      erfassungsform: 'relativ' as const, begruendungVorschlag: 'Seesicht.' };
    const s = spalteAusVorlage(v, 'S-7');
    expect(s).toEqual({
      id: 'S-7', bezeichnung: 'Seesicht', erfassungsform: 'relativ', vorgabewert: 0,
    });
  });

  it('uebernimmt bei einer Vorlage MIT Regel die Regel und KEINEN Vorgabewert', () => {
    const v = { id: 'stockwerklage', bezeichnung: 'Zuschlag Stockwerklage',
      vorgabefaktor: 0, erfassungsform: 'absolut' as const,
      begruendungVorschlag: 'Staffel.',
      regel: { merkmal: 'stockwerk', bereiche: [{ unter: 1, wert: 860000 }, { wert: 0 }] } };
    const s = spalteAusVorlage(v, 'S-2');
    expect(s.regel).toEqual(v.regel);
    expect(s).not.toHaveProperty('vorgabewert');
  });

  it('kopiert die Bereiche flach statt sie durchzureichen', () => {
    const bereiche = [{ wert: 0 }];
    const v = { id: 'x', bezeichnung: 'X', vorgabefaktor: 0,
      erfassungsform: 'absolut' as const, begruendungVorschlag: '',
      regel: { merkmal: 'stockwerk', bereiche } };
    const s = spalteAusVorlage(v, 'S-1');
    expect(s.regel!.bereiche[0]).not.toBe(bereiche[0]);
  });
});
