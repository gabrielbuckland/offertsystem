'use client';

/**
 * Firmenweite Einstellungen (Ebene 1) mit GENAU EINEM Entwurf fuer alle vier
 * Bereichskarten. Getrennte Entwuerfe je Karte liessen sich beim Speichern gegenseitig
 * ueberschreiben: Wer nacheinander zwei Karten speicherte, verlor die zuerst gespeicherte
 * Aenderung wieder. Mit EINEM `verwendeEinstellungen`-Aufruf hier oben, geteilt von allen
 * vier Karten, ist das strukturell ausgeschlossen: Es gibt nur noch einen Entwurf und
 * eine Fussleiste, die ihn schreibt.
 */
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

/**
 * Reihenfolge der Pipeline-Stufen (US-09/A-10) fuer die Uebersicht: Stufe 3
 * (Normalisierung) und Stufe 4 (Gewichtung) teilen sich einen Bereich (`faktoren`) — ein
 * Faktor traegt Min/Max UND Gewicht in einem Editor. Zwei eingebettete Editoren fuer
 * denselben Bereich haetten zwei unabhaengige Entwuerfe zur Folge; deshalb genau EIN
 * Editor pro Bereich, mit dem Stufenlabel, das er inhaltlich abdeckt.
 */
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
            {/* `meta` und `api` bleiben aussen vor und werden beim Zurueckschreiben aus
                dem unveraenderten Bestand wieder eingesetzt: Betriebsparameter der IT
                (US-08), die das Formular bewusst nur lesend zeigt. */}
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
