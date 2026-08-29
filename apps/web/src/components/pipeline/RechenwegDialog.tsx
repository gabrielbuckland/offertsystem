'use client';

// Seitenfuellender Dialog fuer den Rechenweg. Natives `<dialog>` mit `showModal()` wie die
// uebrigen Dialoge der Anwendung — Fokusfalle, Esc und Backdrop kommen vom Browser. Zustand
// lebt beim Aufrufer; `onClose` haelt ihn synchron, wenn der Dialog sich selbst schliesst
// (Esc). Inhalt wird nur im offenen Zustand gerendert, damit die Seite nicht bei jedem
// Projekt-Update auch den ganzen Rechenweg neu aufbaut.
import { useEffect, useRef } from 'react';
import { Button } from '../ui/button.js';
import { PipelineAnsicht } from './PipelineAnsicht.js';
import type { PipelineStufe } from './pipeline-daten.js';

export interface RechenwegDialogProps {
  readonly offen: boolean;
  readonly schliesse: () => void;
  readonly stufen: readonly PipelineStufe[];
}

export function RechenwegDialog({ offen, schliesse, stufen }: RechenwegDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (offen && !dialog.open) dialog.showModal();
    if (!offen && dialog.open) dialog.close();
  }, [offen]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Rechenweg"
      onClose={schliesse}
      // `m-auto` gegen Tailwinds Preflight-`margin: 0` (siehe Referenzobjekte.tsx).
      className="m-auto h-[calc(100dvh-2.5rem)] w-[min(72rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-background p-0 backdrop:bg-foreground/40"
    >
      {offen && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">Rechenweg</h2>
              <p className="text-sm text-muted-foreground">
                Alle fünf Stufen vom Referenzwert bis zur Honorarrange, mit den eingesetzten
                Werten in der Reihenfolge der Rechnung.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={schliesse}>
              Schliessen
            </Button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <PipelineAnsicht stufen={stufen} />
          </div>
        </div>
      )}
    </dialog>
  );
}
