// Offerten dieses Projekts. Die Pruefsumme steht bewusst in der Liste: sie belegt, dass
// jede Offerte ihren eigenen eingefrorenen Konfigurationsstand traegt
// (`metadata.konfigurationsAbdruck`) — eine spaetere Anpassung der Firmen- oder
// Projekteinstellungen aendert an einer abgelegten Offerte nichts.
import Link from 'next/link';
import type { Route } from 'next';
// Modulpfad statt Paketindex: Der Index re-exportiert auch die React-Komponenten (.tsx).
import { formatiereDatum } from '@offert/offer';
import type { ListenEintrag } from '../../server/offerten-ablage.js';
import { LeererZustand } from '../ui/leerer-zustand.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { honorarProzentZelle, referenzAus } from './offerten-logik.js';

export interface ProjektOffertenProps {
  // Filterung auf `projektId` obliegt dem Aufrufer; die Komponente stellt nur dar.
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
          <TableHead>Honorar</TableHead>
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
              {/* Prozentsatz der Verkaufssumme statt Frankenbetrag: der Offerte
                  zugrundeliegender Betrag statt der internen Range, wenn vorhanden. Ein
                  Altartefakt ohne gewaehlten Betrag zeigt ersatzweise die Range der
                  Herleitung (`honorarProzentZelle`). */}
              {honorarProzentZelle(e)}
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
