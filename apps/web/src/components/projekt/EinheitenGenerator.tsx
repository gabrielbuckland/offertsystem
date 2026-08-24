'use client';

/**
 * Erzeugt Einheitenzeilen aus Wuenschen der Form «2 mal 3.5 Zimmer» (Design-Spec §4).
 * Ruft `erzeugeEinheiten` auf und haengt das Ergebnis an die vorhandenen Einheiten an —
 * die Erzeugung selbst ist reine Funktion (Task 10), dieser Block liefert nur die
 * Eingabe der Anzahl je Referenzobjekt.
 */
import { useState } from 'react';
import { erzeugeEinheiten, type Wunsch } from '../../server/einheiten-generator.js';
import type { ProjektEinheit, Referenzobjekt } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';

export interface EinheitenGeneratorProps {
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly einheiten: readonly ProjektEinheit[];
  readonly aendere: (einheiten: readonly ProjektEinheit[]) => void;
}

export function EinheitenGenerator({
  referenzobjekte, einheiten, aendere,
}: EinheitenGeneratorProps) {
  const [anzahlen, setAnzahlen] = useState<Record<string, number>>({});

  function anlegen() {
    const wuensche: Wunsch[] = referenzobjekte
      .map((r) => ({ referenzobjektId: r.id, anzahl: anzahlen[r.id] ?? 0 }))
      .filter((w) => w.anzahl > 0);
    if (wuensche.length === 0) return;
    const neue = erzeugeEinheiten(wuensche, referenzobjekte, einheiten);
    aendere([...einheiten, ...neue]);
    setAnzahlen({});
  }

  if (referenzobjekte.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium">Einheiten anlegen</h2>
        <p className="text-muted-foreground">
          Zuerst ein Referenzobjekt anlegen, danach koennen Einheiten erzeugt werden.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-medium">Einheiten anlegen</h2>
      <div className="mb-3 flex flex-wrap items-end gap-4">
        {referenzobjekte.map((r) => (
          <div key={r.id} className="flex flex-col gap-1">
            <Label htmlFor={`anzahl-${r.id}`}>{r.zimmerzahl} Zimmer</Label>
            <Input
              id={`anzahl-${r.id}`}
              type="number"
              min={0}
              step={1}
              value={anzahlen[r.id] ?? ''}
              onChange={(e) => {
                const wert = e.target.value === '' ? 0 : Number(e.target.value);
                setAnzahlen((a) => ({ ...a, [r.id]: wert }));
              }}
              className="w-24"
            />
          </div>
        ))}
      </div>
      <Button type="button" onClick={anlegen}>Einheiten anlegen</Button>
    </section>
  );
}
