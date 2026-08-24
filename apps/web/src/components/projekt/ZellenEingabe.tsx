'use client';
import { useEffect, useState } from 'react';
import { Input } from '../ui/input.js';

export interface ZellenEingabeProps {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}

/**
 * Haelt den Eingabewert lokal und meldet ihn erst beim Verlassen des Feldes.
 *
 * Ohne lokalen Zustand schriebe jeder Tastendruck in den Projektstand; die Tabelle
 * renderte neu und der Fokus ginge verloren. Der Abgleich per useEffect holt Aenderungen
 * nach, die von aussen kommen — etwa nach dem Einheitengenerator.
 */
export function ZellenEingabe({ wert, aendere }: ZellenEingabeProps) {
  const [entwurf, setzeEntwurf] = useState(String(wert));
  useEffect(() => { setzeEntwurf(String(wert)); }, [wert]);

  return (
    <Input
      type="number"
      className="h-8 w-full"
      value={entwurf}
      onChange={(e) => setzeEntwurf(e.target.value)}
      onBlur={() => {
        const zahl = Number(entwurf);
        aendere(Number.isFinite(zahl) ? zahl : 0);
      }}
    />
  );
}
