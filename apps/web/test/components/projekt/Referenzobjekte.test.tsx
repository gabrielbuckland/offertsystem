/**
 * `renderToStaticMarkup` liefert keine anfassbaren Handler (das Repo hat weder jsdom noch
 * @testing-library/react), darum werden `ZellenEingabe`/`Button` gemockt, um die waehrend
 * eines echten Renderdurchlaufs erzeugten Closures abzufangen und direkt aufzurufen —
 * dasselbe Vorgehen wie in `AnpassungsSpalten.test.tsx`.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DossierDefaults } from '@offert/core';
import type { ProjektEinheit, Referenzobjekt } from '../../../src/server/projekt-schema.js';

interface ErfassteZelle {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}
interface ErfassterButton {
  readonly children: unknown;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onClick: () => void;
}

const erfasst = vi.hoisted(() => ({
  zellen: [] as ErfassteZelle[],
  buttons: [] as ErfassterButton[],
}));

vi.mock('../../../src/components/projekt/ZellenEingabe.js', () => ({
  ZellenEingabe: (props: ErfassteZelle) => {
    erfasst.zellen.push(props);
    return null;
  },
}));
vi.mock('../../../src/components/ui/button.js', () => ({
  Button: (props: ErfassterButton) => {
    erfasst.buttons.push(props);
    return null;
  },
}));

import { Referenzobjekte } from '../../../src/components/projekt/Referenzobjekte.js';

const R: Referenzobjekt = {
  id: 'R1', zimmerzahl: 3.5,
  parametrisierung: {
    flaecheInnen: 86, flaecheAussen: 19, stockwerk: 1, energielabel: 'B',
    zustandsbewertungen: {}, qualitaetsbewertungen: {},
    anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump',
  },
};

// Durchgehend `null`: keine dieser Bestandstests prueft die Herkunftsauszeichnung
// (`ParametrisierungsDetail.tsx`, eigener Test), ein zufaellig deckungsgleicher
// firmenweiter Default duerfte hier also nichts an der bisherigen Aussage der
// Assertions aendern.
const dossierDefaultsLeer: DossierDefaults = {
  flaecheInnen: null, flaecheAussen: null, stockwerk: null, energielabel: null,
  zustandsbewertungen: {}, qualitaetsbewertungen: {},
};

function zeichne(
  referenzobjekte: readonly Referenzobjekt[],
  aendere: (r: readonly Referenzobjekt[]) => void,
  einheiten: readonly ProjektEinheit[] = [],
) {
  erfasst.zellen.length = 0;
  erfasst.buttons.length = 0;
  return renderToStaticMarkup(
    <Referenzobjekte
      referenzobjekte={referenzobjekte}
      einheiten={einheiten}
      dossierDefaults={dossierDefaultsLeer}
      aendere={aendere}
      rufeAb={() => undefined}
      abrufLaeuft={false}
    />);
}

describe('Referenzobjekte — Anzeige', () => {
  it('weist einen fehlenden Referenzwert als solchen aus', () => {
    const html = zeichne([R], () => undefined);
    expect(html).toContain('nicht bezogen');
  });

  it('zeigt Bewertungsdatum und Konfidenz, wenn ein Wert vorliegt', () => {
    const html = zeichne(
      [{ ...R, bewertung: { wert: 85_000_000, bewertungsdatum: '2026-08-16', konfidenzklasse: 'good' } }],
      () => undefined);
    expect(html).toContain('2026-08-16');
    expect(html).toContain('good');
  });
});

/**
 * Diese Suite haelt die Eigenschaft fest, ohne die das Mehrtypenmodell durch die
 * Oberflaeche unerreichbar bleibt: Die typbestimmenden Merkmale muessen editierbar sein,
 * und ein zweites Referenzobjekt darf nicht mit der Zimmerzahl des ersten kollidieren
 * (ZIMMERZAHL_MEHRFACH, `packages/core/src/domain/liegenschaft.ts`).
 */
describe('Referenzobjekte — typbestimmende Merkmale sind editierbar', () => {
  it('bindet Zimmerzahl, Wohnflaeche und Stockwerk als Zahleneingaben', () => {
    zeichne([R], () => undefined);
    expect(erfasst.zellen.map((z) => z.wert)).toEqual([3.5, 86, 1]);
  });

  it('meldet eine geaenderte Zimmerzahl als vollstaendige Liste', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.zellen[0]!.aendere(4.5);
    expect(aendere).toHaveBeenCalledWith([{ ...R, zimmerzahl: 4.5 }]);
  });

  it('meldet eine geaenderte Wohnflaeche in der Parametrisierung', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.zellen[1]!.aendere(92);
    expect(aendere).toHaveBeenCalledWith(
      [{ ...R, parametrisierung: { ...R.parametrisierung, flaecheInnen: 92 } }]);
  });

  it('aendert nur die angefasste Zeile, die uebrigen bleiben referenzgleich', () => {
    const zweites: Referenzobjekt = { ...R, id: 'R2', zimmerzahl: 4.5 };
    const aendere = vi.fn();
    zeichne([R, zweites], aendere);
    erfasst.zellen[3]!.aendere(5.5);
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(neu[0]).toBe(R);
    expect(neu[1]!.zimmerzahl).toBe(5.5);
  });
});

describe('Referenzobjekte — ein zweites Objekt ist ohne Nacharbeit gueltig', () => {
  it('vergibt einem neuen Referenzobjekt eine noch nicht belegte Zimmerzahl', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!.onClick();
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(neu).toHaveLength(2);
    // Ein festes `1` kollidierte hier nicht, wohl aber beim naechsten Objekt — die
    // Fortschreibung haelt die Zimmerzahlen ueber beliebig viele Objekte verschieden.
    expect(new Set(neu.map((r) => r.zimmerzahl)).size).toBe(2);
    expect(neu[1]!.id).toBe('R2');
  });

  it('kollidiert auch beim dritten Objekt nicht', () => {
    const zwei = [R, { ...R, id: 'R2', zimmerzahl: 4 }];
    const aendere = vi.fn();
    zeichne(zwei, aendere);
    erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!.onClick();
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(new Set(neu.map((r) => r.zimmerzahl)).size).toBe(3);
  });
});

// Obere Grenze aus dem Schema (`zimmerzahl: z.number().min(1).max(12)`,
// `projekt-schema.ts`) — dieselbe Zahl deckelt `naechsteZimmerzahl` in
// `neuesReferenzobjekt` (`Math.min(12, …)`, Referenzobjekte.tsx). Aus dem Code gelesen,
// nicht frei erfunden: ein hier abweichender Wert prüfte eine andere Grenze als die
// implementierte.
const OBERE_ZIMMERZAHL_GRENZE = 12;

/**
 * Die Zwoelfergrenze (`docs/offene-punkte-projektansicht.md`): Sind bereits alle
 * unterscheidbaren Zimmerzahlen 1..12 vergeben, deckelt `Math.min(12, …)` die naechste
 * Zahl weiterhin auf 12 — ohne die Kollisionspruefung waere das serverseitig ein
 * garantiertes ZIMMERZAHL_MEHRFACH gewesen, unsichtbar bis zum Speicherversuch.
 */
describe('Referenzobjekte — Zwoelfergrenze', () => {
  function volleBelegung(): readonly Referenzobjekt[] {
    return Array.from({ length: OBERE_ZIMMERZAHL_GRENZE }, (_, i) => ({
      ...R, id: `R${i + 1}`, zimmerzahl: i + 1,
    }));
  }

  it('sperrt "Referenzobjekt hinzufügen" mit Begruendung, wenn alle Zimmerzahlen vergeben sind', () => {
    const aendere = vi.fn();
    zeichne(volleBelegung(), aendere);
    const knopf = erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!;
    expect(knopf.disabled).toBe(true);
    expect(knopf.title).toBe('Alle unterscheidbaren Zimmerzahlen sind vergeben.');
    knopf.onClick();
    expect(aendere).not.toHaveBeenCalled();
  });

  it('bleibt nutzbar, solange eine Zimmerzahl frei ist (eine Luecke in der Belegung)', () => {
    // Elf von zwoelf vergeben, keine Luecke am oberen Ende: ohne die Kollisionspruefung
    // deckelte `Math.min(12, …)` trotzdem korrekt auf die freie 12 — dieser Fall bleibt
    // also der Kontrollfall fuer den unveraenderten Normalpfad.
    const fastVoll = volleBelegung().filter((r) => r.zimmerzahl !== OBERE_ZIMMERZAHL_GRENZE);
    const aendere = vi.fn();
    zeichne(fastVoll, aendere);
    const knopf = erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!;
    expect(knopf.disabled).toBeFalsy();
    knopf.onClick();
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(neu).toHaveLength(OBERE_ZIMMERZAHL_GRENZE);
    expect(neu[neu.length - 1]!.zimmerzahl).toBe(OBERE_ZIMMERZAHL_GRENZE);
  });
});

/**
 * Ein entferntes Referenzobjekt liesse eine Einheit ohne gueltigen Typ zurueck
 * (REFERENZOBJEKT_UNBEKANNT, `projekt-schema.ts`) — die Loeschung muss deshalb gesperrt
 * sein, solange eine Einheit noch darauf zeigt.
 */
describe('Referenzobjekte — Loeschung', () => {
  function entfernenKnopf() {
    return erfasst.buttons.find((b) => b.children === 'entfernen')!;
  }

  it('entfernt ein unbenutztes Referenzobjekt', () => {
    const aendere = vi.fn();
    zeichne([R], aendere, []);
    expect(entfernenKnopf().disabled).toBeFalsy();
    entfernenKnopf().onClick();
    expect(aendere).toHaveBeenCalledWith([]);
  });

  it('sperrt die Loeschung, solange eine Einheit das Referenzobjekt verwendet', () => {
    const aendere = vi.fn();
    const einheit: ProjektEinheit = {
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: R.id,
      flaecheInnen: 60, flaecheAussen: 0, stockwerk: 0, spaltenwerte: {},
    };
    zeichne([R], aendere, [einheit]);
    expect(entfernenKnopf().disabled).toBe(true);
  });
});
