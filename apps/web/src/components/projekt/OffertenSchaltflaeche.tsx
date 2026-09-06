'use client';

// Natives <dialog> mit showModal() — Fokusfalle, Esc und Backdrop kommen vom Browser,
// kein eigener Offen-Zustand noetig.
import { useRef } from 'react';
import type { ListenEintrag } from '../../server/offerten-ablage.js';
import { Button } from '../ui/button.js';
import { ProjektOfferten } from './ProjektOfferten.js';

export interface OffertenSchaltflaecheProps {
  readonly eintraege: readonly ListenEintrag[];
}

export function OffertenSchaltflaeche({ eintraege }: OffertenSchaltflaecheProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => dialogRef.current?.showModal()}
      >
        Offerten{eintraege.length > 0 ? ` (${eintraege.length})` : ''}
      </Button>
      <dialog
        ref={dialogRef}
        aria-label="Offerten"
        // m-auto: Tailwinds Preflight ueberschreibt sonst die UA-Zentrierung nativer Dialoge.
        className="m-auto w-[min(56rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-background p-6 backdrop:bg-foreground/40"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Offerten</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => dialogRef.current?.close()}>
            Schliessen
          </Button>
        </div>
        <ProjektOfferten eintraege={eintraege} />
      </dialog>
    </>
  );
}
