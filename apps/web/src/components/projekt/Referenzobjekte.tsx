'use client';

/**
 * Erster Block der Detailseite (Design-Spec §4): Referenzobjekte je Wohnungstyp mit
 * ihren bezogenen Bewertungen. Der Abruf ist ein eigener Klick (`rufeAb`), keine
 * Nebenwirkung des Renderns — er verbraucht Anbieter-Guthaben (NFA-12, I-27), das darf
 * nicht beim blossen Anzeigen der Seite geschehen.
 */
import { formatiereAggregat } from '@offert/offer';
import type { Referenzobjekt } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';

export interface ReferenzobjekteProps {
  readonly referenzobjekte: readonly Referenzobjekt[];
  readonly aendere: (referenzobjekte: readonly Referenzobjekt[]) => void;
  readonly rufeAb: () => void;
}

// Fortlaufend statt zufaellig (wie `T${n}` in ablauf-zustand.ts): Eine UUID entstuende
// ausserhalb von `apps/web/src/server` und verletzte damit E-29/NFA-06.
function neuesReferenzobjekt(vorhandene: readonly Referenzobjekt[]): Referenzobjekt {
  const hoechste = vorhandene.reduce((max, r) => {
    const treffer = /^R(\d+)$/.exec(r.id);
    return treffer === null ? max : Math.max(max, Number(treffer[1]));
  }, 0);
  return {
    id: `R${hoechste + 1}`,
    zimmerzahl: 1,
    parametrisierung: {
      flaecheInnen: 1, flaecheAussen: 0, stockwerk: 0, energielabel: '',
      zustandsbewertungen: {}, qualitaetsbewertungen: {},
      anzahlBadezimmer: 0, lift: false, baujahr: 0, heizungsart: '',
    },
  };
}

export function Referenzobjekte({ referenzobjekte, aendere, rufeAb }: ReferenzobjekteProps) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Referenzobjekte</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={rufeAb}>
            Bewertungen beziehen
          </Button>
          <Button
            type="button"
            onClick={() => aendere([...referenzobjekte, neuesReferenzobjekt(referenzobjekte)])}
          >
            Referenzobjekt hinzufügen
          </Button>
        </div>
      </div>
      {referenzobjekte.length === 0 ? (
        <p className="text-muted-foreground">Noch kein Referenzobjekt erfasst.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zimmerzahl</TableHead>
              <TableHead>Wohnfläche</TableHead>
              <TableHead>Aussenfläche</TableHead>
              <TableHead>Stockwerk</TableHead>
              <TableHead>Energielabel</TableHead>
              <TableHead>Referenzwert</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referenzobjekte.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.zimmerzahl}</TableCell>
                <TableCell>{r.parametrisierung.flaecheInnen} m²</TableCell>
                <TableCell>{r.parametrisierung.flaecheAussen} m²</TableCell>
                <TableCell>{r.parametrisierung.stockwerk}</TableCell>
                <TableCell>{r.parametrisierung.energielabel}</TableCell>
                <TableCell>
                  {r.bewertung === undefined ? 'nicht bezogen' : (
                    <>
                      {formatiereAggregat(r.bewertung.wert)} · {r.bewertung.bewertungsdatum} ·
                      {' '}{r.bewertung.konfidenzklasse}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
