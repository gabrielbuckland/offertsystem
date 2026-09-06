'use client';

// GENAU EIN `verwendeEinstellungen`-Aufruf fuer alle vier Bereichskarten: getrennte
// Entwuerfe je Karte liessen sich beim Speichern gegenseitig ueberschreiben.
import { Fragment, useState } from 'react';
import { GESPERRTE_PFADE } from '@offert/core';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { rahmenBefunde } from './EinstellungsEditor.js';
import { JsonReiter } from './JsonReiter.js';
import { BefundAuffang } from './ProjektEinstellungen.js';
import { mitWurzeln, ohneWurzeln } from './json-reiter-logik.js';
import { verwendeEinstellungen } from './verwende-einstellungen.js';
import { BEREICHE, wurzeln, type Bereich } from '../../app/(anwendung)/einstellungen/bereiche.js';

// US-09/A-10: Stufe 3 (Normalisierung) und Stufe 4 (Gewichtung) teilen sich den Bereich
// `faktoren` (ein Faktor traegt Min/Max UND Gewicht) — deshalb ein Eintrag statt zwei.
const PIPELINE_REIHENFOLGE: ReadonlyArray<{
  readonly stufenLabel: string; readonly bereich: Bereich;
}> = [
  { stufenLabel: 'Stufe 1 · Eingabe', bereich: 'dossier' },
  { stufenLabel: 'Stufe 2 · Verkaufssumme', bereich: 'preisanpassung' },
  { stufenLabel: 'Stufe 3–4 · Normalisierung & Gewichtung', bereich: 'faktoren' },
  { stufenLabel: 'Stufe 5 · Honorar', bereich: 'honorar' },
];

type Reiter = 'formular' | 'json';

const REITER: ReadonlyArray<{ readonly wert: Reiter; readonly beschriftung: string }> = [
  { wert: 'formular', beschriftung: 'Formular' },
  { wert: 'json', beschriftung: 'JSON' },
];

export function FirmenEinstellungen(
  { anfang }: { readonly anfang: Readonly<Record<string, unknown>> },
) {
  const zustand = verwendeEinstellungen(anfang);
  const [reiter, setzeReiter] = useState<Reiter>('formular');
  const alleWurzeln = Object.values(BEREICHE).flatMap((bereich) => wurzeln(bereich.praefix));

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Darstellung" className="flex gap-1">
        {REITER.map((eintrag) => (
          <Button
            key={eintrag.wert}
            type="button"
            role="tab"
            aria-selected={reiter === eintrag.wert}
            variant={reiter === eintrag.wert ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setzeReiter(eintrag.wert)}
          >
            {eintrag.beschriftung}
          </Button>
        ))}
      </div>

      {reiter === 'json' && (
        <Card>
          <CardHeader>
            <CardTitle>JSON</CardTitle>
            <CardDescription>
              Derselbe Entwurfsstand wie im Formular — die Fussleiste speichert in beiden
              Ansichten dasselbe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* US-08: `meta`/`api` sind Betriebsparameter der IT, nur lesend. */}
            <JsonReiter
              wert={ohneWurzeln(zustand.entwurf, GESPERRTE_PFADE)}
              aendere={(naechster) => zustand.aendere(
                mitWurzeln(naechster, zustand.entwurf, GESPERRTE_PFADE),
              )}
              schreibbar
              befunde={zustand.befunde}
            />
          </CardContent>
        </Card>
      )}

      {reiter === 'formular' && PIPELINE_REIHENFOLGE.map((eintrag, index) => {
        const bereich = BEREICHE[eintrag.bereich];
        const praefixe = wurzeln(bereich.praefix);
        const bereichsBefunde = rahmenBefunde(zustand.befunde, praefixe);
        const Editor = bereich.Editor;
        return (
          <Fragment key={eintrag.bereich}>
            {index > 0 && (
              <span aria-hidden="true" className="text-center text-muted-foreground">↓</span>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {eintrag.stufenLabel}
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>{bereich.titel}</CardTitle>
                  <CardDescription>{bereich.zweck}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Editor einstellungen={zustand} />
                  {bereichsBefunde.length > 0 && (
                    <div className="space-y-2">
                      {bereichsBefunde.map((befund, i) => (
                        <Hinweis key={`${befund.pfad}-${i}`} art="fehler">{befund.text}</Hinweis>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </Fragment>
        );
      })}

      <BefundAuffang befunde={zustand.befunde} wurzeln={alleWurzeln} />

      <Card>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-sm text-muted-foreground">Wirkt auf alle Projekte.</p>
          <div className="flex items-center gap-2">
            {zustand.pruefsumme !== undefined && (
              <Hinweis art="erfolg">{`Prüfsumme ${zustand.pruefsumme}`}</Hinweis>
            )}
            <Button
              type="button" variant="outline" onClick={zustand.verwerfe}
              disabled={!zustand.geaendert}
            >
              Verwerfen
            </Button>
            <Button
              type="button" onClick={zustand.speichere}
              disabled={!zustand.geaendert || zustand.speichert}
            >
              {zustand.speichert ? 'Speichert …' : 'Speichern'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
