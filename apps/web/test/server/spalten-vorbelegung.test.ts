import { describe, expect, it } from 'vitest';
import { standardKonfiguration } from '../bau/offerte-bauer.js';
import { vorbelegteSpalten } from '../../src/server/spalten-vorbelegung.js';

describe('vorbelegteSpalten', () => {
  it('erzeugt je firmenweiter Vorlage eine Spalte', () => {
    const spalten = vorbelegteSpalten(standardKonfiguration());
    expect(spalten.length).toBeGreaterThan(0);
    for (const s of spalten) {
      expect(s.bezeichnung).not.toBe('');
      expect(s.erfassungsform).toBe('relativ');
    }
  });

  it('vergibt eindeutige Spaltenkennungen', () => {
    const ids = vorbelegteSpalten(standardKonfiguration()).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Erwartung verschaerft, nicht abgeschwaecht: Zuvor pruefte dieser Fall nur, dass der
  // Vorgabewert ueberhaupt eine Zahl ist. Seit der Vorgabewert in jede neu erzeugte
  // Einheit uebernommen wird (einheiten-generator.ts), ist entscheidend, WELCHE Zahl:
  // Truege eine vorbelegte Spalte den `vorgabefaktor` der Vorlage, erhielte jede Einheit
  // alle sieben Anpassungen gleichzeitig, ausgewiesen als Entscheidung des Vermarkters —
  // der Herkunftsfehler, den anpassungsvorlagen.ts ausdruecklich ausschliesst.
  it('startet den Vorgabewert neutral, statt den Vorgabefaktor der Vorlage zu setzen', () => {
    const spalten = vorbelegteSpalten(standardKonfiguration());
    const vorlagenFaktoren = standardKonfiguration().anpassungsVorlagen.map((v) => v.vorgabefaktor);
    expect(vorlagenFaktoren.some((f) => f !== 0)).toBe(true);
    expect(spalten.every((s) => s.vorgabewert === 0)).toBe(true);
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
});
