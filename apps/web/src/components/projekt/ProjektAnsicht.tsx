'use client';

/**
 * Client-Klammer der Detailseite (Design-Spec §4): Kopf mit Adresse, darunter die
 * Bloecke Referenzobjekte, Einheiten anlegen, Zu-/Abschlaege und Einheitentabelle.
 * Nur der erste Block ist hier bereits verdrahtet; die uebrigen folgen in Task 9-11 als
 * je ein weiterer Baustein unterhalb, verdrahtet ueber dieselben `projekt`/`aendere`.
 *
 * Der Projektstand lebt genau einmal (`verwendeProjekt`) — jeder Block aendert nur
 * seinen Ausschnitt und ruft dafuer `aendere` mit dem VOLLEN Projekt auf, damit die
 * Persistenz an einer einzigen Stelle (PUT) bleibt.
 */
import { useState } from 'react';
import type { Projekt } from '../../server/projekt-schema.js';
import { verwendeProjekt } from './verwende-projekt.js';
import { Referenzobjekte } from './Referenzobjekte.js';

export interface ProjektAnsichtProps {
  readonly projekt: Projekt;
}

interface BewertungsAntwort {
  readonly projekt?: Projekt;
  readonly vollstaendig?: boolean;
  readonly fehlgeschlagenerTyp?: string;
  readonly fehler?: { readonly text: string };
}

export function ProjektAnsicht({ projekt: anfang }: ProjektAnsichtProps) {
  const { projekt, aendere, speichernLaeuft, speichernFehler } = verwendeProjekt(anfang);
  const [abrufMeldung, setAbrufMeldung] = useState<string | undefined>(undefined);
  const [abrufLaeuft, setAbrufLaeuft] = useState(false);

  async function rufeAb() {
    setAbrufMeldung(undefined);
    setAbrufLaeuft(true);
    try {
      const antwort = await fetch(`/api/projekt/${projekt.id}/bewertung`, { method: 'POST' });
      const rumpf = await antwort.json() as BewertungsAntwort;
      if (!antwort.ok || rumpf.projekt === undefined) {
        setAbrufMeldung(rumpf.fehler?.text ?? 'Die Bewertungen konnten nicht bezogen werden.');
        return;
      }
      aendere(rumpf.projekt);
      // `vollstaendig`/`fehlgeschlagenerTyp` unterscheiden einen Teilerfolg vom
      // vollstaendigen Abruf (Task 6) — ohne diese Meldung saehe der Vermarkter nur
      // aktualisierte Zeilen und hielte den Abruf faelschlich fuer vollstaendig.
      if (!rumpf.vollstaendig) {
        setAbrufMeldung(
          `Für den Referenzobjekttyp ${rumpf.fehlgeschlagenerTyp ?? '—'} liegt keine `
            + 'Bewertung vor. Die übrigen Bewertungen wurden übernommen.',
        );
      }
    } finally {
      setAbrufLaeuft(false);
    }
  }

  return (
    <main className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {projekt.adresse.strasse} {projekt.adresse.hausnummer}, {projekt.adresse.plz}{' '}
          {projekt.adresse.ort}
        </h1>
        {speichernLaeuft && <p className="text-sm text-muted-foreground">Speichert…</p>}
        {speichernFehler !== undefined && (
          <p className="text-sm text-red-600" role="alert">{speichernFehler}</p>
        )}
      </header>
      {abrufMeldung !== undefined && (
        <p className="mb-4 text-sm text-red-600">{abrufMeldung}</p>
      )}
      <Referenzobjekte
        referenzobjekte={projekt.referenzobjekte}
        aendere={(referenzobjekte) => aendere({ ...projekt, referenzobjekte: [...referenzobjekte] })}
        rufeAb={() => { if (!abrufLaeuft) void rufeAb(); }}
      />
    </main>
  );
}
