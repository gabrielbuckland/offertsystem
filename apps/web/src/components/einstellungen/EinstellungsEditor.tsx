'use client';

// Gemeinsamer Rahmen aller vier Bereichs-Editoren (Spec §6, kein Autosave — siehe
// `verwende-einstellungen.ts`). `verwendeEinstellungen` wird GENAU HIER aufgerufen (nicht in
// der Server-Komponente `[bereich]/page.tsx`, nicht im `Editor`-Prop), damit genau EIN
// Entwurfsstand existiert; ein zweiter Hook-Aufruf im Feld-Editor liesse dessen Eingaben dem
// Speichern-Knopf hier unbekannt bleiben. `Editor` ist bewusst eine Komponenten-Referenz
// (`BereichsEditor`), kein `children`, damit der Props-Vertrag typgeprueft an einer Stelle
// steht statt per `cloneElement` injiziert zu werden.
import { useState } from 'react';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { JsonReiter } from './JsonReiter.js';
import { verwendeEinstellungen, type BereichsEditor } from './verwende-einstellungen.js';

export interface EinstellungsEditorProps {
  readonly titel: string;
  readonly zweck: string;
  // Wurzelpfad(e) dieses Bereichs; Befunde darunter verankert der Feld-Editor selbst
  // (`befundeFuerPfad`). Mehrere Wurzeln moeglich, z. B. «Preisanpassung» deckt `flaeche`,
  // `preisanpassung` und `anpassungsVorlagen` ab.
  readonly bereichPraefix: string | readonly string[];
  readonly anfang: Readonly<Record<string, unknown>>;
  readonly Editor: BereichsEditor;
}

// Befunde, die kein Feld-Editor an seiner Zeile verankert (Gegenmenge zu `befundeFuerPfad`,
// die als Praefix-Treffer arbeitet): der ortlose Befund (`pfad === ''`, Netz-/500-Fallback)
// und ein Befund auf der Bereichswurzel selbst, zu der es keine Formularzeile gibt.
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
  // Ein Aufruf von `verwendeEinstellungen` fuer beide Reiter (Formular/JSON) — der
  // Umschalter waehlt nur die Darstellung desselben Entwurfsstands, damit beide Reiter in
  // denselben Zustand schreiben.
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
            // JsonReiter bekommt ALLE Befunde, nicht nur die rahmenfaehigen: die
            // zeilenverankerten Meldungen haetten sonst keine Formularzeile zum Andocken.
            <JsonReiter
              wert={zustand.entwurf}
              aendere={zustand.aendere}
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
