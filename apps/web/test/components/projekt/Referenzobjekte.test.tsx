// renderToStaticMarkup: Mocks fangen Closures ab, Input und dialog brauchen keinen Mock.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DossierDefaults } from '@offert/core';
import type {
  AnpassungsSpalte, ProjektEinheit, Referenzobjekt,
} from '../../../src/server/projekt-schema.js';
import { BEWERTUNGEN_STANDARD } from '../../bau/bewertungen.js';

interface ErfassteZelle {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}
interface ErfassterButton {
  readonly children: unknown;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onClick: () => void;
  readonly 'aria-label'?: string;
}
interface ErfassteSelect {
  readonly value: unknown;
  readonly onChange: (e: { readonly target: { readonly value: string } }) => void;
  readonly children: unknown;
}

const erfasst = vi.hoisted(() => ({
  zellen: [] as ErfassteZelle[],
  buttons: [] as ErfassterButton[],
  selects: [] as ErfassteSelect[],
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
vi.mock('../../../src/components/ui/select.js', () => ({
  Select: (props: ErfassteSelect) => {
    erfasst.selects.push(props);
    return null;
  },
}));

import { Referenzobjekte } from '../../../src/components/projekt/Referenzobjekte.js';

const R: Referenzobjekt = {
  id: 'R1', zimmerzahl: 3.5,
  parametrisierung: {
    flaecheInnen: 86, flaecheAussen: 19, stockwerk: 0, energielabel: 'minergie_p' as const,
    ...BEWERTUNGEN_STANDARD,
    anzahlBadezimmer: 1, lift: true, baujahr: 2027, heizungsart: 'heat_pump_air' as const,
  },
};

// Fixture: Standard für Tests ohne spezifische Zustand/Qualitätsanforderungen.
const dossierDefaultsStandard: DossierDefaults = { ...BEWERTUNGEN_STANDARD };

function zeichne(
  referenzobjekte: readonly Referenzobjekt[],
  aendere: (referenzobjekte: readonly Referenzobjekt[], einheiten: readonly ProjektEinheit[]) => void,
  einheiten: readonly ProjektEinheit[] = [],
  spalten: readonly AnpassungsSpalte[] = [],
  baujahr: number | undefined = undefined,
) {
  erfasst.zellen.length = 0;
  erfasst.buttons.length = 0;
  erfasst.selects.length = 0;
  return renderToStaticMarkup(
    <Referenzobjekte
      referenzobjekte={referenzobjekte}
      einheiten={einheiten}
      spalten={spalten}
      dossierDefaults={dossierDefaultsStandard}
      baujahr={baujahr}
      aendere={aendere}
      rufeAb={() => undefined}
      abrufLaufend={undefined}
    />);
}

function hinzufuegenKnopf() {
  return erfasst.buttons.find((b) => b.children === 'Referenzobjekt hinzufügen')!;
}

describe('Referenzobjekte — Anzeige', () => {
  it('weist einen fehlenden Referenzwert als solchen aus', () => {
    const html = zeichne([R], () => undefined);
    expect(html).toContain('nicht bezogen');
  });

  it('zeigt beim Referenzwert nur die Zahl, kein Datum und keine Konfidenzklasse', () => {
    const html = zeichne(
      [{ ...R, bewertung: { wert: 85_000_000, bewertungsdatum: '2026-08-16', konfidenzklasse: 'good' } }],
      () => undefined);
    expect(html).not.toContain('2026-08-16');
    expect(html).not.toContain('good');
  });

  it('zeigt keine Stockwerk-Spalte — sie ist bei einem Referenzobjekt immer 0', () => {
    const html = zeichne([R], () => undefined);
    expect(html).not.toContain('Stockwerk');
  });
});

const KEINE_EINHEITEN: readonly ProjektEinheit[] = [];

// Typbestimmende Merkmale editierbar; Zimmerzahl-Kollision verhindert (ZIMMERZAHL_MEHRFACH).
describe('Referenzobjekte — typbestimmende Merkmale sind editierbar', () => {
  it('bindet Zimmerzahl und Wohnflaeche als Zahleneingaben (kein Stockwerk mehr)', () => {
    zeichne([R], () => undefined);
    expect(erfasst.zellen.map((z) => z.wert)).toEqual([3.5, 86]);
  });

  it('meldet eine geaenderte Zimmerzahl als vollstaendige Liste, Einheiten unveraendert', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.zellen[0]!.aendere(4.5);
    expect(aendere).toHaveBeenCalledWith([{ ...R, zimmerzahl: 4.5 }], KEINE_EINHEITEN);
  });

  it('meldet eine geaenderte Wohnflaeche in der Parametrisierung', () => {
    const aendere = vi.fn();
    zeichne([R], aendere);
    erfasst.zellen[1]!.aendere(92);
    expect(aendere).toHaveBeenCalledWith(
      [{ ...R, parametrisierung: { ...R.parametrisierung, flaecheInnen: 92 } }], KEINE_EINHEITEN);
  });

  it('aendert nur die angefasste Zeile, die uebrigen bleiben referenzgleich', () => {
    const zweites: Referenzobjekt = { ...R, id: 'R2', zimmerzahl: 4.5 };
    const aendere = vi.fn();
    zeichne([R, zweites], aendere);
    erfasst.zellen[2]!.aendere(5.5);
    const neu = aendere.mock.calls[0]![0] as readonly Referenzobjekt[];
    expect(neu[0]).toBe(R);
    expect(neu[1]!.zimmerzahl).toBe(5.5);
  });
});

// Dialog: Zimmerzahl aus Select (nicht berechnet), Wohnfläche bewusst eingeben.
describe('Referenzobjekte — Anlegen ueber den Dialog', () => {
  it('bietet ein optionales Feld fuer die Anzahl Wohnungen — dieser Typ entfaellt sonst '
    + 'nicht den separaten, vorgelagerten Nacherfassen-Block', () => {
    const html = zeichne([], () => undefined);
    expect(html).toContain('Anzahl Wohnungen (optional)');
  });

  // Verknüpfung nicht hier getestet: renderToStaticMarkup keine echten State-Updates (alle Handler Ausgangszustand).
  it('sperrt «Hinzufügen» im Dialog, solange nichts eingetragen ist, und ruehrt «aendere» nicht an', () => {
    const aendere = vi.fn();
    zeichne([], aendere);
    hinzufuegenKnopf().onClick();
    const hinzufuegenImDialog = erfasst.buttons.find((b) => b.children === 'Hinzufügen')!;
    expect(hinzufuegenImDialog.disabled).toBe(true);
    hinzufuegenImDialog.onClick();
    expect(aendere).not.toHaveBeenCalled();
  });
});

// Alle 11 Halbschritte vergeben: keine unterscheidbare Zimmerzahl mehr, Dialog sinnlos.
describe('Referenzobjekte — alle Zimmerzahlen vergeben', () => {
  function volleBelegung(): readonly Referenzobjekt[] {
    return [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].map((zimmerzahl, i) => ({
      ...R, id: `R${i + 1}`, zimmerzahl,
    }));
  }

  it('sperrt "Referenzobjekt hinzufügen" mit Begruendung, wenn alle Zimmerzahlen vergeben sind', () => {
    const aendere = vi.fn();
    zeichne(volleBelegung(), aendere);
    const knopf = hinzufuegenKnopf();
    expect(knopf.disabled).toBe(true);
    expect(knopf.title).toBe('Alle unterscheidbaren Zimmerzahlen sind vergeben.');
  });

  it('bleibt nutzbar, solange ein Halbschritt frei ist (eine Luecke in der Belegung), '
    + 'und bietet genau diese Luecke im Dialog an', () => {
    const fastVoll = volleBelegung().filter((r) => r.zimmerzahl !== 6);
    const aendere = vi.fn();
    zeichne(fastVoll, aendere);
    expect(hinzufuegenKnopf().disabled).toBeFalsy();
    hinzufuegenKnopf().onClick();
    const optionen = (erfasst.selects[0]!.children as { readonly props: { readonly value: number } }[])
      .map((o) => o.props.value);
    expect(optionen).toEqual([6]);
  });
});

// Referenzobjekt löschen würde Einheit ohne Typ hinterlassen (REFERENZOBJEKT_UNBEKANNT).
describe('Referenzobjekte — Loeschung', () => {
  function entfernenKnopf() {
    return erfasst.buttons.find((b) => b['aria-label'] === 'entfernen')!;
  }

  it('entfernt ein unbenutztes Referenzobjekt, Einheiten unveraendert', () => {
    const aendere = vi.fn();
    zeichne([R], aendere, []);
    expect(entfernenKnopf().disabled).toBeFalsy();
    entfernenKnopf().onClick();
    expect(aendere).toHaveBeenCalledWith([], KEINE_EINHEITEN);
  });

  it('sperrt die Loeschung, solange eine Einheit das Referenzobjekt verwendet', () => {
    const aendere = vi.fn();
    const einheit: ProjektEinheit = {
      id: 'E-1', wohnungsnummer: 'A-01', referenzobjektId: R.id,
      flaecheInnen: 60, flaecheAussen: 0, spaltenwerte: {}, merkmalswerte: {},
    };
    zeichne([R], aendere, [einheit]);
    expect(entfernenKnopf().disabled).toBe(true);
  });
});
