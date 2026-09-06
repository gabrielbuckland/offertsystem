'use client';

// E-29: Kennung entsteht serverseitig in POST /api/projekt, dieses Formular erfasst nur die Adresse.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Hinweis } from './ui/hinweis.js';
import { rufeApi } from './rufe-api.js';

interface AdresseEingabe {
  readonly strasse: string;
  readonly hausnummer: string;
  readonly plz: string;
  readonly ort: string;
}

interface AnlegenAntwort {
  readonly id?: string;
  readonly fehler?: { readonly text: string };
}

const LEER: AdresseEingabe = { strasse: '', hausnummer: '', plz: '', ort: '' };

export function NeuesProjekt() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [adresse, setAdresse] = useState<AdresseEingabe>(LEER);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laedt, setLaedt] = useState(false);

  async function anlegen() {
    setLaedt(true);
    setMeldung(undefined);
    const { ok, rumpf } = await rufeApi<AnlegenAntwort>('/api/projekt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adresse),
    });
    setLaedt(false);
    if (!ok) {
      setMeldung(rumpf.fehler?.text ?? 'Das Projekt konnte nicht angelegt werden.');
      return;
    }
    router.push(`/projekte/${rumpf.id}` as Route);
  }

  // Am close-Ereignis statt am Abbrechen-Knopf: Dialog laesst sich auch per Escape schliessen.
  function setzeZurueck() {
    setAdresse(LEER);
    setMeldung(undefined);
  }

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}>
        Neues Projekt
      </Button>
      <dialog
        ref={dialogRef}
        onClose={setzeZurueck}
        aria-label="Neues Projekt"
        // m-auto gegen Tailwinds Preflight-margin: 0 (siehe RechenwegDialog).
        className="m-auto rounded-lg border border-border bg-background p-6 backdrop:bg-foreground/30"
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        {meldung !== undefined && (
          <Hinweis art="fehler" className="mt-4">{meldung}</Hinweis>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
            Abbrechen
          </Button>
          <Button type="button" onClick={() => void anlegen()} disabled={laedt}>
            Anlegen
          </Button>
        </div>
      </dialog>
    </>
  );
}
