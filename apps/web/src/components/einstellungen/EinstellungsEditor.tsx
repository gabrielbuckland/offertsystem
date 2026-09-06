'use client';

// `verwendeEinstellungen` wird GENAU HIER aufgerufen, nicht im `Editor`-Prop: zwei
// unabhaengige Hook-Aufrufe haetten zwei getrennte Entwuerfe zur Folge, eine Eingabe im
// Feld-Editor bliebe dem Speichern-Knopf hier unbekannt.
import { useState } from 'react';
import { GESPERRTE_PFADE } from '@offert/core';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { JsonReiter } from './JsonReiter.js';
import { mitWurzeln, ohneWurzeln } from './json-reiter-logik.js';
import { verwendeEinstellungen, type BereichsEditor } from './verwende-einstellungen.js';

export interface EinstellungsEditorProps {
  readonly titel: string;
  readonly zweck: string;
  // Ein Bereich kann mehrere Wurzeln umfassen (z. B. "Preisanpassung": `flaeche` +
  // `preisanpassung` + `anpassungsVorlagen`).
  readonly bereichPraefix: string | readonly string[];
  readonly anfang: Readonly<Record<string, unknown>>;
  readonly Editor: BereichsEditor;
}

// Gegenmenge zu `befundeFuerPfad`: nur die zwei ortlosen Formen (unabhaengiger Befund
// `pfad === ''` und ein Befund auf der Bereichswurzel selbst), da jeder Bereichseditor
// seine Feldbefunde bereits selbst je Zeile zeigt und ein Praefix-Treffer sonst doppelt erschiene.
export function rahmenBefunde<T extends { readonly pfad: string }>(
  befunde: readonly T[], praefixe: readonly string[],
): readonly T[] {
  return befunde.filter((befund) => befund.pfad === '' || praefixe.includes(befund.pfad));
}

type Reiter = 'formular' | 'json';

const REITER: ReadonlyArray<{ readonly wert: Reiter; readonly beschriftung: string }> = [
  { wert: 'formular', beschriftung: 'Formular' },
  { wert: 'json', beschriftung: 'JSON' },
];

export function EinstellungsEditor({ titel, zweck, bereichPraefix, anfang, Editor }: EinstellungsEditorProps) {
  // GENAU EIN Aufruf fuer BEIDE Reiter: ein zweiter im JSON-Zweig haette zwei unabhaengige
  // Entwuerfe zur Folge, und welcher beim Speichern gewaenne, entschiede nur die Aufrufreihenfolge.
  const zustand = verwendeEinstellungen(anfang);
  const [reiter, setzeReiter] = useState<Reiter>('formular');
  const praefixe = typeof bereichPraefix === 'string' ? [bereichPraefix] : bereichPraefix;
  const bereichsBefunde = rahmenBefunde(zustand.befunde, praefixe);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titel}</CardTitle>
        <CardDescription>{zweck}</CardDescription>
        <div role="tablist" aria-label="Darstellung" className="flex gap-1 pt-2">
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
      </CardHeader>
      <CardContent className="space-y-4">
        {reiter === 'formular'
          ? <Editor einstellungen={zustand} />
          : (
            // JsonReiter bekommt ALLE Befunde, nicht nur die rahmenfaehigen: zeilenverankerte
            // Meldungen haengen sonst an Formularzeilen, die hier nicht gerendert sind.
            // Gesperrte Wurzeln (US-08, `api` nur lesend) werden aus-/wieder eingeblendet.
            <JsonReiter
              wert={ohneWurzeln(zustand.entwurf, GESPERRTE_PFADE)}
              aendere={(naechster) => zustand.aendere(
                mitWurzeln(naechster, zustand.entwurf, GESPERRTE_PFADE),
              )}
              schreibbar
              befunde={zustand.befunde}
            />
          )}
        {reiter === 'formular' && bereichsBefunde.length > 0 && (
          <div className="space-y-2">
            {bereichsBefunde.map((befund, index) => (
              <Hinweis key={`${befund.pfad}-${index}`} art="fehler">{befund.text}</Hinweis>
            ))}
          </div>
        )}
        {zustand.pruefsumme !== undefined && (
          <Hinweis art="erfolg">{`Prüfsumme ${zustand.pruefsumme}`}</Hinweis>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Wirkt auf alle Projekte.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={zustand.verwerfe} disabled={!zustand.geaendert}>
            Verwerfen
          </Button>
          <Button type="button" onClick={zustand.speichere} disabled={!zustand.geaendert || zustand.speichert}>
            {zustand.speichert ? 'Speichert …' : 'Speichern'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
