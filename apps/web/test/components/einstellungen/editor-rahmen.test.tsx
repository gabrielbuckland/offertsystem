import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  baueSpeicherSteuerung, befundeFuerPfad, entwurfGeaendert,
} from '../../../src/components/einstellungen/verwende-einstellungen.js';
import { EinstellungsEditor } from '../../../src/components/einstellungen/EinstellungsEditor.js';

/** Steuerbares Promise, um eine spaet eintreffende Antwort zu erzwingen — gleiches
 *  Vorgehen wie in verwende-projekt.test.ts. */
function steuerbar<T>() {
  let aufloesen!: (wert: T) => void;
  const versprechen = new Promise<T>((r) => { aufloesen = r; });
  return { versprechen, aufloesen };
}

/** Laesst bereits angestossene Promise-Ketten (then/finally) abarbeiten. */
async function leeren(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('befundeFuerPfad', () => {
  it('liefert nur die Befunde unterhalb des uebergebenen Praefixes', () => {
    const befunde = [
      { pfad: 'honorar.stuetzstellen[1].hMin', text: 'Degression verletzt.' },
      { pfad: 'flaeche.alpha', text: 'Ausserhalb des Wertebereichs.' },
    ];
    expect(befundeFuerPfad(befunde, 'honorar')).toEqual([befunde[0]]);
  });

  it('laesst einen unanhaengigen Befund (leerer Pfad) unabhaengig vom Praefix durch', () => {
    // pfad: '' ist der Netz-/500-Fallback aus verwendeEinstellungen — er hat keinen
    // genaueren Ort im Formular und muss deshalb bei JEDEM Bereich auftauchen koennen,
    // dessen Editor gerade den gescheiterten Speicherversuch ausgeloest hat.
    const befunde = [{ pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' }];
    expect(befundeFuerPfad(befunde, 'honorar')).toEqual(befunde);
  });
});

describe('EinstellungsEditor', () => {
  it('zeigt den Wirkungshinweis und die Speichern-Schaltflaeche im statischen Markup', () => {
    const html = renderToStaticMarkup(
      <EinstellungsEditor
        titel="Honorar"
        zweck="Testzweck fuer die Rahmenpruefung."
        bereichPraefix="honorar"
        anfang={{}}
      />,
    );
    expect(html).toContain('Wirkt auf alle Projekte.');
    expect(html).toContain('Speichern');
    expect(html).toContain('Verwerfen');
  });

  it('ruft den uebergebenen Editor mit dem lebenden Zustand auf (typgeprueft statt injiziert)', () => {
    const html = renderToStaticMarkup(
      <EinstellungsEditor
        titel="Honorar"
        zweck="Testzweck fuer die Rahmenpruefung."
        bereichPraefix="honorar"
        anfang={{ honorar: 'wert' }}
        Editor={({ einstellungen }) => (
          <p data-testid="editor-inhalt">{String(einstellungen.entwurf['honorar'])}</p>
        )}
      />,
    );
    expect(html).toContain('data-testid="editor-inhalt"');
    expect(html).toContain('wert');
  });
});

describe('entwurfGeaendert', () => {
  it('ist false, wenn ein Feld auf seinen Ausgangswert zurueckgesetzt wurde (Fix: Strukturvergleich)', () => {
    const anfang = { honorar: { gMin: 0.85 } };
    const bearbeitet = { honorar: { gMin: 0.9 } };
    const zurueckgesetzt = { honorar: { gMin: 0.85 } }; // neue Referenz, gleicher Inhalt
    expect(entwurfGeaendert(bearbeitet, anfang)).toBe(true);
    expect(entwurfGeaendert(zurueckgesetzt, anfang)).toBe(false);
  });
});

describe('baueSpeicherSteuerung', () => {
  it('verwirft eine spaet eintreffende Antwort, wenn zwischenzeitlich weiterbearbeitet wurde', async () => {
    const antwort = steuerbar<{ ok: true; pruefsumme: string | undefined }>();
    const sende = vi.fn().mockReturnValueOnce(antwort.versprechen);
    const aufErgebnis = vi.fn();
    const aufSpeichertWechsel = vi.fn();
    const steuerung = baueSpeicherSteuerung(sende, { aufSpeichertWechsel, aufErgebnis });

    steuerung.starte({ a: 1 });
    steuerung.vermerkeAenderung(); // Nutzer bearbeitet weiter, waehrend die Anfrage laeuft
    antwort.aufloesen({ ok: true, pruefsumme: 'ALT' });
    await leeren();

    expect(aufErgebnis).not.toHaveBeenCalled();
    // Der Ladezustand endet trotzdem — es ist ja nichts mehr unterwegs.
    expect(aufSpeichertWechsel).toHaveBeenLastCalledWith(false);
  });

  it('haelt den Ladezustand aktiv, wenn eine zweite Anfrage laeuft, waehrend die erste (veraltet) eintrifft', async () => {
    const erste = steuerbar<{ ok: true; pruefsumme: string | undefined }>();
    const sende = vi.fn()
      .mockReturnValueOnce(erste.versprechen)
      .mockReturnValueOnce(new Promise(() => { /* haengt absichtlich */ }));
    const aufErgebnis = vi.fn();
    const aufSpeichertWechsel = vi.fn();
    const steuerung = baueSpeicherSteuerung(sende, { aufSpeichertWechsel, aufErgebnis });

    steuerung.starte({ a: 1 });
    steuerung.starte({ a: 2 }); // zweiter Speicherversuch, bevor der erste beantwortet ist
    erste.aufloesen({ ok: true, pruefsumme: 'ALT' });
    await leeren();

    expect(aufErgebnis).not.toHaveBeenCalled();
    expect(aufSpeichertWechsel).toHaveBeenLastCalledWith(true);
  });
});
