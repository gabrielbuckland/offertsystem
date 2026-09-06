// K-2: Seite zeigt, womit sie rechnet — Projektlaufzeit statt Firmenkonfiguration.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { OffertKonfiguration, UeberschreibungsProtokoll } from '@offert/core';
import ProjektSeite from '../../src/app/(anwendung)/projekte/[id]/page.js';
import { ProjektAnsicht } from '../../src/components/projekt/ProjektAnsicht.js';
import { legeProjektAn, speichereProjekt } from '../../src/server/projekt-ablage.js';
import type { Faktorformular } from '../../src/server/faktorformular.js';
import { standardKonfiguration } from '../bau/offerte-bauer.js';

const ADRESSE = { strasse: 'Seestrasse', hausnummer: '1', plz: '8001', ort: 'Zürich' };

const DELTA = {
  dossierDefaults: { zustandsbewertungen: { kitchen: 'well_maintained' } },
  aufwandfaktoren: {
    lage_gesamt: { gewicht: 0.45 },
    laerm: {
      bezeichnung: 'Lärmbelastung',
      quelle: 'manuell',
      quellSchluessel: 'laerm',
      strategie: 'minmax',
      min: 1,
      max: 6,
      gewicht: 0.1,
    },
  },
};

async function seitenBaum(delta?: Readonly<Record<string, unknown>>) {
  const verzeichnis = await mkdtemp(join(tmpdir(), 'projekte-'));
  process.env['PROJEKTE_VERZEICHNIS'] = verzeichnis;
  const projekt = await legeProjektAn(ADRESSE, verzeichnis, standardKonfiguration());
  if (delta !== undefined) {
    await speichereProjekt({ ...projekt, einstellungen: delta }, verzeichnis);
  }
  return ProjektSeite({ params: Promise.resolve({ id: projekt.id }) });
}

function finde(knoten: unknown, typ: unknown): ReactElement | undefined {
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const treffer = finde(kind, typ);
      if (treffer !== undefined) return treffer;
    }
    return undefined;
  }
  if (!isValidElement(knoten)) return undefined;
  if (knoten.type === typ) return knoten;
  return finde((knoten.props as { children?: unknown }).children, typ);
}

interface AnsichtProps {
  readonly faktorformular: Faktorformular;
  readonly konfigurationBasis: OffertKonfiguration;
  readonly ueberschreibungen?: readonly UeberschreibungsProtokoll[];
}

async function ansichtProps(delta?: Readonly<Record<string, unknown>>): Promise<AnsichtProps> {
  const element = finde(await seitenBaum(delta), ProjektAnsicht);
  if (element === undefined) throw new Error('ProjektAnsicht nicht im Seitenbaum gefunden');
  return element.props as AnsichtProps;
}

describe('Projektdetailseite rechnet und zeigt auf derselben Konfiguration (K-2)', () => {
  it('baut das Faktorformular aus der PROJEKTBEZOGENEN Konfiguration', async () => {
    const props = await ansichtProps(DELTA);
    expect(props.faktorformular.felder.map((f) => f.faktorId)).toContain('laerm');
  });

  it('belegt die Referenzobjekte mit den projektbezogenen Dossier-Vorgaben vor', async () => {
    const props = await ansichtProps(DELTA);
    expect(props.konfigurationBasis.dossierDefaults.zustandsbewertungen.kitchen).toBe('well_maintained');
  });

  it('reicht das Ueberschreibungsprotokoll an den Rechenweg durch', async () => {
    // Ohne diese Liste weist der Rechenweg-Dialog jede uebersteuerte Groesse als
    // «firmenweit» aus — genau die Anzeige, die den Nachvollzug belegen soll (A-13).
    const props = await ansichtProps(DELTA);
    expect(props.ueberschreibungen ?? []).not.toHaveLength(0);
    expect((props.ueberschreibungen ?? []).map((u) => u.pfad))
      .toContain('dossierDefaults.zustandsbewertungen.kitchen');
  });

  it('bleibt ohne Delta auf den Firmenwerten', async () => {
    const props = await ansichtProps();
    expect(props.konfigurationBasis.dossierDefaults.zustandsbewertungen.kitchen)
      .toBe('new_or_recently_renovated');
    expect(props.faktorformular.felder).toHaveLength(0);
    expect(props.ueberschreibungen ?? []).toHaveLength(0);
  });
});
