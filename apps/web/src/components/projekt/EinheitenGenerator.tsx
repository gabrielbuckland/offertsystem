'use client';

// Nacherfassen, nicht Ersterfassung: deckt nur den Fall, dass spaeter weitere Wohnungen
// eines BEREITS bestehenden Typs dazukommen.
import { useRef, useState } from 'react';
import { erzeugeEinheiten, type Wunsch } from '../../server/einheiten-generator.js';
import type {
  AnpassungsSpalte, ProjektEinheit, Referenzobjekt,
} from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';

export interface EinheitenGeneratorProps {
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly einheiten: readonly ProjektEinheit[];
  readonly spalten: readonly AnpassungsSpalte[];
  readonly aendere: (einheiten: readonly ProjektEinheit[]) => void;
}

export function EinheitenGenerator({
  referenzobjekte, einheiten, spalten, aendere,
}: EinheitenGeneratorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [anzahlen, setAnzahlen] = useState<Record<string, number>>({});

  function oeffneDialog(): void {
    setAnzahlen({});
    dialogRef.current?.showModal();
  }

  const wuensche: Wunsch[] = referenzobjekte
    .map((r) => ({ referenzobjektId: r.id, anzahl: anzahlen[r.id] ?? 0 }))
    .filter((w) => w.anzahl > 0);

  function anlegen() {
    if (wuensche.length === 0) return;
    const neue = erzeugeEinheiten(wuensche, referenzobjekte, einheiten, spalten);
    aendere([...einheiten, ...neue]);
    dialogRef.current?.close();
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="outline"
        disabled={referenzobjekte.length === 0}
        title={referenzobjekte.length === 0
          ? 'Zuerst ein Referenzobjekt anlegen, danach können Einheiten erzeugt werden.'
          : undefined}
        onClick={oeffneDialog}
      >
        Wohnungen nacherfassen
      </Button>
      <dialog
        ref={dialogRef}
        aria-label="Wohnungen nacherfassen"
        // m-auto: Preflight ueberschreibt sonst die UA-Zentrierung nativer Dialoge.
        className="m-auto rounded-lg border border-border bg-background p-6 backdrop:bg-foreground/30"
      >
        <h3 className="mb-1 text-base font-semibold">Wohnungen nacherfassen</h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
          Ergänzt die Einheitentabelle um weitere Wohnungen eines bestehenden Wohnungstyps.
        </p>
        <div className="grid gap-4">
          {referenzobjekte.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-6">
              <Label htmlFor={`anzahl-${r.id}`}>{r.zimmerzahl} Zimmer</Label>
              <Input
                id={`anzahl-${r.id}`}
                type="number"
                min={0}
                step={1}
                placeholder="0"
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
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
            Abbrechen
          </Button>
          <Button type="button" onClick={anlegen} disabled={wuensche.length === 0}>
            Hinzufügen
          </Button>
        </div>
      </dialog>
    </div>
  );
}
