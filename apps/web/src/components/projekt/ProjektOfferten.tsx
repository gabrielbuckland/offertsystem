/**
 * Offerten dieses Projekts. Schliesst `listeOfferten()` wieder an, das seit dem Umbau
 * auf die Projektansicht von keiner Seite mehr aufgerufen wurde: Eine einmal erzeugte
 * Offerte war in der Oberflaeche nicht wieder auffindbar.
 *
 * Die Pruefsumme steht bewusst in der Liste. Sie belegt an der Oberflaeche, dass jede
 * Offerte ihren eigenen eingefrorenen Konfigurationsstand traegt
 * (`metadata.konfigurationsAbdruck`) — deshalb aendert eine spaetere Anpassung der
 * Firmen- oder Projekteinstellungen an einer abgelegten Offerte nichts.
 */
import Link from 'next/link';
import type { Route } from 'next';
// Modulpfad statt Paketindex: Der Index re-exportiert auch die React-Komponenten
// (.tsx); dieselbe Begruendung wie in offerten-ablage.ts und Aggregatleiste.tsx.
import { formatiereAggregat, formatiereDatum } from '@offert/offer/src/format/de-ch.js';
import type { ListenEintrag } from '../../server/offerten-ablage.js';
import { LeererZustand } from '../ui/leerer-zustand.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { referenzAus } from './offerten-logik.js';

export interface ProjektOffertenProps {
  // Die Filterung auf `projektId` obliegt dem Aufrufer (Seite) — die Komponente
  // stellt nur dar, was ihr uebergeben wird (Task 11, Schnittstellenvorgabe).
  readonly eintraege: readonly ListenEintrag[];
}

export function ProjektOfferten({ eintraege }: ProjektOffertenProps) {
  if (eintraege.length === 0) {
    return (
      <LeererZustand
        titel="Noch keine Offerte erzeugt"
        beschreibung="Für dieses Projekt liegt noch keine Offerte vor."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Referenz</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Honorarrange</TableHead>
          <TableHead>Konfigurationsprüfsumme</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {eintraege.map((e) => (
          <TableRow key={e.offertId}>
            <TableCell>
              <Link href={`/offerte/${e.offertId}` as Route}>{referenzAus(e.offertId)}</Link>
            </TableCell>
            <TableCell>{formatiereDatum(e.erstelltAm)}</TableCell>
            <TableCell>
              {e.honorarMin === undefined || e.honorarMax === undefined
                ? '—'
                : `${formatiereAggregat(e.honorarMin)} – ${formatiereAggregat(e.honorarMax)}`}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {e.konfigPruefsumme ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
