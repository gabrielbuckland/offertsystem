'use client';

/**
 * Erster Block der Detailseite (Design-Spec §4): Referenzobjekte je Wohnungstyp mit
 * ihren bezogenen Bewertungen. Der Abruf ist ein eigener Klick (`rufeAb`), keine
 * Nebenwirkung des Renderns — er verbraucht Anbieter-Guthaben (NFA-12, I-27), das darf
 * nicht beim blossen Anzeigen der Seite geschehen.
 */
import { formatiereAggregat } from '@offert/offer';
import type { ProjektEinheit, Referenzobjekt } from '../../server/projekt-schema.js';
import { Button } from '../ui/button.js';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table.js';
import { ZellenEingabe } from './ZellenEingabe.js';

export interface ReferenzobjekteProps {
  readonly referenzobjekte: readonly Referenzobjekt[];
  // Nur um eine Loeschung zu sperren, die eine Einheit ohne Typ zurueckliesse
  // (REFERENZOBJEKT_UNBEKANNT, `projekt-schema.ts`) — die Komponente aendert `einheiten`
  // selbst nicht.
  readonly einheiten: readonly ProjektEinheit[];
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
  // Die Zimmerzahl unterscheidet die Wohnungstypen, `liegenschaft.ts` weist ein zweites
  // Referenzobjekt mit derselben Zimmerzahl als ZIMMERZAHL_MEHRFACH zurueck. Ein festes
  // `1` erzeugte deshalb beim zweiten Objekt einen garantiert ungueltigen Stand, noch
  // bevor der Vermarkter etwas eingeben konnte. Die naechste freie ganze Zahl ist kein
  // erfundener Messwert, sondern die Fortschreibung eines Unterscheidungsmerkmals — die
  // Flaechen bleiben bewusst am Minimum, sie MUESSEN erfasst werden.
  const naechsteZimmerzahl = Math.min(
    12, vorhandene.reduce((max, r) => Math.max(max, Math.floor(r.zimmerzahl) + 1), 1));
  return {
    id: `R${hoechste + 1}`,
    zimmerzahl: naechsteZimmerzahl,
    parametrisierung: {
      flaecheInnen: 1, flaecheAussen: 0, stockwerk: 0, energielabel: '',
      zustandsbewertungen: {}, qualitaetsbewertungen: {},
      anzahlBadezimmer: 0, lift: false, baujahr: 0, heizungsart: '',
    },
  };
}

/** Ersetzt genau ein Referenzobjekt; die uebrigen bleiben referenzgleich. */
function ersetze(
  referenzobjekte: readonly Referenzobjekt[], index: number, naechstes: Referenzobjekt,
): readonly Referenzobjekt[] {
  return referenzobjekte.map((r, i) => (i === index ? naechstes : r));
}

/**
 * Die Merkmale, die den Wohnungstyp bestimmen, sind an Ort und Stelle editierbar
 * (Design-Spec §4). Ohne sie liesse sich ueber die Oberflaeche nur EIN Wohnungstyp
 * fuehren: Jedes weitere Referenzobjekt truege die Vorgaben des ersten, und der Kern
 * wiese das Paar mit ZIMMERZAHL_MEHRFACH zurueck — das Mehrtypenmodell, auf dem die
 * ganze Auslegung beruht, waere durch die Oberflaeche nicht erreichbar.
 *
 * Bewusst nicht alle zehn Felder der `parametrisierung`: Erfasst wird, was den Typ
 * unterscheidet und in die Bewertungsanfrage eingeht. Zahlen laufen ueber
 * `ZellenEingabe`, damit ein geleertes Feld verworfen wird, statt auf 0 zu fallen
 * (`entscheideZellenwert`) — bei der Zimmerzahl waere die erfundene 0 zudem ein
 * schemawidriger Wert (`min(1)`).
 */
export function Referenzobjekte({
  referenzobjekte, einheiten, aendere, rufeAb,
}: ReferenzobjekteProps) {
  function setzeMerkmal(
    index: number,
    patch: Partial<Referenzobjekt['parametrisierung']>,
  ): void {
    const r = referenzobjekte[index]!;
    aendere(ersetze(referenzobjekte, index, {
      ...r, parametrisierung: { ...r.parametrisierung, ...patch },
    }));
  }

  function verwendetVon(id: string): number {
    return einheiten.filter((e) => e.referenzobjektId === id).length;
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Referenzobjekte</h2>
          <p className="text-sm text-muted-foreground">
            Je Wohnungstyp eine Referenzbewertung — sie ist der Ausgangswert der Preisableitung.
          </p>
        </div>
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
              <TableHead>Wohnfläche (m²)</TableHead>
              <TableHead>Stockwerk</TableHead>
              <TableHead>Referenzwert</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {referenzobjekte.map((r, index) => {
              const verwendungen = verwendetVon(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <ZellenEingabe
                      wert={r.zimmerzahl}
                      aendere={(zimmerzahl) => aendere(
                        ersetze(referenzobjekte, index, { ...r, zimmerzahl }))}
                    />
                  </TableCell>
                  <TableCell>
                    <ZellenEingabe
                      wert={r.parametrisierung.flaecheInnen}
                      aendere={(flaecheInnen) => setzeMerkmal(index, { flaecheInnen })}
                    />
                  </TableCell>
                  <TableCell>
                    <ZellenEingabe
                      wert={r.parametrisierung.stockwerk}
                      aendere={(stockwerk) => setzeMerkmal(index, { stockwerk })}
                    />
                  </TableCell>
                  <TableCell>
                    {r.bewertung === undefined ? 'nicht bezogen' : (
                      <>
                        {formatiereAggregat(r.bewertung.wert)} · {r.bewertung.bewertungsdatum} ·
                        {' '}{r.bewertung.konfidenzklasse}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={verwendungen > 0}
                      title={verwendungen > 0
                        ? `Wird von ${verwendungen} Einheit${verwendungen === 1 ? '' : 'en'} verwendet.`
                        : undefined}
                      onClick={() => aendere(referenzobjekte.filter((_, i) => i !== index))}
                    >
                      entfernen
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
