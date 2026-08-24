'use client';

/**
 * Legt ein Projekt an. Die Kennung entsteht serverseitig in `POST /api/projekt`
 * (E-29) — dieses Formular erfasst nur die Adresse, mit der Menschen ein Projekt
 * identifizieren (Design-Spec §2/§3), nie eine Kennung.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';

interface AdresseEingabe {
  readonly strasse: string;
  readonly hausnummer: string;
  readonly plz: string;
  readonly ort: string;
}

const LEER: AdresseEingabe = { strasse: '', hausnummer: '', plz: '', ort: '' };

export function NeuesProjekt() {
  const router = useRouter();
  const [adresse, setAdresse] = useState<AdresseEingabe>(LEER);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laedt, setLaedt] = useState(false);

  async function anlegen() {
    setLaedt(true);
    setMeldung(undefined);
    try {
      const antwort = await fetch('/api/projekt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adresse),
      });
      const rumpf = await antwort.json() as { id?: string; fehler?: { text: string } };
      if (!antwort.ok) {
        setMeldung(rumpf.fehler?.text ?? 'Das Projekt konnte nicht angelegt werden.');
        return;
      }
      router.push(`/projekte/${rumpf.id}` as Route);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="neues-projekt-strasse">Strasse</Label>
        <Input id="neues-projekt-strasse" value={adresse.strasse}
               onChange={(e) => setAdresse({ ...adresse, strasse: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="neues-projekt-hausnummer">Hausnummer</Label>
        <Input id="neues-projekt-hausnummer" value={adresse.hausnummer}
               onChange={(e) => setAdresse({ ...adresse, hausnummer: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="neues-projekt-plz">PLZ</Label>
        <Input id="neues-projekt-plz" value={adresse.plz}
               onChange={(e) => setAdresse({ ...adresse, plz: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="neues-projekt-ort">Ort</Label>
        <Input id="neues-projekt-ort" value={adresse.ort}
               onChange={(e) => setAdresse({ ...adresse, ort: e.target.value })} />
      </div>
      <Button type="button" onClick={() => void anlegen()} disabled={laedt}>
        Neues Projekt
      </Button>
      {meldung !== undefined && <p className="w-full text-sm text-red-600">{meldung}</p>}
    </div>
  );
}
