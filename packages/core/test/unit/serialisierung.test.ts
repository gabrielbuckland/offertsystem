import { describe, expect, it } from 'vitest';
import { berechne } from '../../src/pipeline/berechne.js';
import {
  SERIALISIERUNGS_VERSION, deserialisiereEingang, serialisiereEingang,
} from '../../src/pipeline/serialisierung.js';
import { eingangsArgumente } from '../helper/projekt.js';

describe('Serialisierung der Berechnungseingabe (PE-08, AK-4.4, US-13)', () => {
  it('erzeugt reines JSON — keine Map ueberlebt stringify', () => {
    const roh = serialisiereEingang(eingangsArgumente());
    const text = JSON.stringify(roh);
    const zurueck = JSON.parse(text) as Record<string, unknown>;
    expect(zurueck['version']).toBe(SERIALISIERUNGS_VERSION);
    expect(Array.isArray((zurueck['vermarkterFaktoren'] as { werte: unknown }).werte)).toBe(true);
    expect(Array.isArray((zurueck['konfiguration'] as { faktoren: unknown }).faktoren)).toBe(true);
  });

  it('schreibt die Paare in Codepoint-Ordnung — zeichengleiche Ausgabe (I-14)', () => {
    const a = JSON.stringify(serialisiereEingang(eingangsArgumente()));
    const b = JSON.stringify(serialisiereEingang(eingangsArgumente()));
    expect(a).toBe(b);
    const faktoren = (JSON.parse(a) as { konfiguration: { faktoren: [string, unknown][] } })
      .konfiguration.faktoren.map(([k]) => k);
    expect(faktoren).toEqual([...faktoren].sort());
  });

  it('fuehrt den Rundlauf: gleiche Eingabe, gleiches Ergebnis (AK-4.4)', () => {
    const e = eingangsArgumente();
    const wieder = deserialisiereEingang(JSON.parse(JSON.stringify(serialisiereEingang(e))));
    expect(wieder.ok).toBe(true);
    if (!wieder.ok) return;
    expect(berechne(wieder.wert)).toStrictEqual(berechne(e));
  });

  it('baut die Liegenschaft ueber die Eingabeschicht, nicht am Aggregat vorbei (I-02)', () => {
    const e = eingangsArgumente();
    const roh = JSON.parse(JSON.stringify(serialisiereEingang(e))) as
      { liegenschaft: { einheiten: unknown[] } };
    roh.liegenschaft.einheiten = []; // Aggregatregel: keine Einheit -> Fehlschlag
    const r = deserialisiereEingang(roh);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.map((f) => f.code)).toContain('KEINE_EINHEIT');
  });

  it('stellt die Lagescores samt meta wieder her (E-08, I-26)', () => {
    const e = eingangsArgumente();
    const r = deserialisiereEingang(serialisiereEingang(e));
    if (!r.ok) throw new Error('unerwarteter Fehlschlag');
    expect([...r.wert.lagescores.werte.entries()]).toEqual([...e.lagescores.werte.entries()]);
    expect([...r.wert.lagescores.meta.entries()]).toEqual([...e.lagescores.meta.entries()]);
  });

  it('fuehrt die D-Uebersteuerung durch den Rundlauf — und laesst sie sonst weg', () => {
    const mit = { ...eingangsArgumente(), aufwandindikatorUebersteuerung: 0.7 };
    const wieder = deserialisiereEingang(JSON.parse(JSON.stringify(serialisiereEingang(mit))));
    expect(wieder.ok).toBe(true);
    if (wieder.ok) expect(wieder.wert.aufwandindikatorUebersteuerung).toBe(0.7);
    // Ohne Uebersteuerung traegt die serialisierte Form den Schluessel NICHT — fehlend
    // heisst «keine Uebersteuerung», auch nach dem Rundlauf (Anwesenheit entscheidet).
    const roh = serialisiereEingang(eingangsArgumente()) as Record<string, unknown>;
    expect('aufwandindikatorUebersteuerung' in roh).toBe(false);
    const ohne = deserialisiereEingang(JSON.parse(JSON.stringify(roh)));
    if (ohne.ok) expect('aufwandindikatorUebersteuerung' in ohne.wert).toBe(false);
  });

  it('weist eine fremde Version und Strukturfehler zurueck, ohne zu werfen', () => {
    for (const eingabe of [null, 7, {}, { version: 99 }]) {
      const r = deserialisiereEingang(eingabe);
      expect(r.ok).toBe(false);
    }
  });
});
