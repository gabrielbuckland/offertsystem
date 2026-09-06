'use client';
import { useEffect, useState } from 'react';
import { Input } from '../ui/input.js';
import { entscheideZellenwert } from './zellen-logik.js';

export interface ZellenEingabeProps {
  readonly wert: number;
  readonly aendere: (wert: number) => void;
}

// Ohne lokalen Zustand schriebe jeder Tastendruck in den Projektstand; die Tabelle
// renderte neu und der Fokus ginge verloren.
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
        const entscheid = entscheideZellenwert(entwurf);
        if (entscheid.art === 'verwerfen') {
          setzeEntwurf(String(wert));
          return;
        }
        aendere(entscheid.wert);
      }}
    />
  );
}
