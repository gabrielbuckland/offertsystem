import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  baueSpeicherSteuerung, befundeFuerPfad, entwurfGeaendert,
} from '../../../src/components/einstellungen/verwende-einstellungen.js';
import {
  EinstellungsEditor, rahmenBefunde,
} from '../../../src/components/einstellungen/EinstellungsEditor.js';

/** Steuerbares Promise, um eine spaet eintreffende Antwort zu erzwingen. */
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

  it('fuehrt die gesperrten Wurzeln nicht in den JSON-Reiter (W-1)', () => {
    /**
     * Der JSON-Reiter liegt hinter einem Umschalter im Client-Zustand und ist ohne
     * Hook-Testbibliothek nicht zu oeffnen; geprueft wird deshalb quelltextnah. Die Aussage
     * selbst ist scharf: `zustand.entwurf` ist die VOLLE Rohkonfiguration; ging sie
     * ungefiltert an den schreibbaren Reiter, war `api` ueber jede der vier Karten
     * editier- und speicherbar — die Rollentrennung aus US-08 haette danach nur noch im
     * Formularreiter existiert.
     */
    const quelle = readFileSync(new URL(
      '../../../src/components/einstellungen/EinstellungsEditor.tsx', import.meta.url,
    ), 'utf8');
    expect(quelle).toContain('wert={ohneWurzeln(zustand.entwurf, GESPERRTE_PFADE)}');
    expect(quelle).toContain('mitWurzeln(naechster, zustand.entwurf, GESPERRTE_PFADE)');
    expect(quelle).not.toContain('wert={zustand.entwurf}');
    // Die Sperrliste wird bezogen, nicht nachgebaut — keine zweite Wahrheit.
    expect(quelle).toContain("import { GESPERRTE_PFADE } from '@offert/core'");
  });
});

describe('rahmenBefunde (Naht Rahmen <-> Feld-Editor)', () => {
  const zeile = { pfad: 'honorar.stuetzstellen[1].hMin', text: 'Degression verletzt.' };
  const wurzel = { pfad: 'honorar', text: 'Der Honorarbereich ist unvollstaendig.' };
  const ortlos = { pfad: '', text: 'Die Einstellungen konnten nicht gespeichert werden.' };
  const alle = [zeile, wurzel, ortlos];

  it('zeigt einen zeilenverankerten Befund GENAU EINMAL — beim Editor, nicht im Rahmen', () => {
    // `befundeFuerPfad` trifft per Praefix. Sammelte der Rahmen weiterhin alles unter
    // seinem Bereich ein, stuende dieser Befund an der Stuetzstellenzeile UND in der
    // Rahmenliste: zwei Meldungen fuer ein Problem.
    expect(befundeFuerPfad(alle, 'honorar.stuetzstellen[1]')).toContain(zeile);
    expect(rahmenBefunde(alle, ['honorar'])).not.toContain(zeile);
  });

  it('behaelt die ortlosen Formen im Rahmen: leerer Pfad und Bereichswurzel', () => {
    expect(rahmenBefunde(alle, ['honorar'])).toEqual([wurzel, ortlos]);
  });

  it('haelt den leeren Pfad bei mehreren Praefixen trotzdem nur einmal', () => {
    // «Preisanpassung» deckt drei Wurzeln ab; der frueher noetige Doppel-Filter entfaellt,
    // weil ueber die Befundliste statt ueber die Praefixe iteriert wird.
    expect(rahmenBefunde([ortlos], ['flaeche', 'preisanpassung', 'anpassungsVorlagen']))
      .toEqual([ortlos]);
  });

  it('zeigt einen Befund auf der Merkmale-Wurzel, seit `merkmale` zu den Praefixen von '
    + '«Preisanpassung» gehoert (Task 7)', () => {
    // Regression: `BEREICHE.preisanpassung.praefix` bekam `'merkmale'`
    // zusaetzlich zu `flaeche`/`preisanpassung`/`anpassungsVorlagen`. Ohne diesen Eintrag
    // waere ein Befund GENAU auf der Merkmale-Wurzel (z. B. ein Schemafehler auf dem
    // Schluessel selbst, kein zeilenverankerter `anpassungsVorlagen[i].regel.merkmal`-
    // Befund) in KEINER Bereichs-Karte sichtbar — der Nutzer saehe nur ein gescheitertes
    // Speichern ohne jeden Hinweis, woran es lag.
    const merkmaleWurzel = { pfad: 'merkmale', text: 'Die Merkmalliste ist ungueltig.' };
    expect(rahmenBefunde([merkmaleWurzel], ['flaeche', 'preisanpassung', 'anpassungsVorlagen', 'merkmale']))
      .toEqual([merkmaleWurzel]);
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
