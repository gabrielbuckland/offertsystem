'use client';

/**
 * Gemeinsamer Rahmen aller vier Bereichs-Editoren (dossier/preisanpassung/faktoren/
 * honorar) — Karte mit Titel, Zweck-Satz, dem Formular des Bereichs, sammelfaehigen
 * Befunden und einer Fussleiste mit explizitem Speichern/Verwerfen (kein Autosave).
 *
 * EIGENTUEMER des Bearbeitungszustands: `verwendeEinstellungen` wird GENAU HIER
 * aufgerufen, nicht in den Bereichsseiten und nicht im konkreten Feld-Editor
 * (`Editor`-Prop). Zwei UNABHAENGIGE Hook-Aufrufe haetten zwei getrennte Entwuerfe zur
 * Folge — eine Eingabe im Feld-Editor bliebe dem Speichern-Knopf hier unbekannt. Der
 * Zustand entsteht deshalb EINMAL, aus der rohen Startkonfiguration (`anfang`-Prop),
 * und wird dem konkreten Editor explizit als `einstellungen`-Prop gereicht
 * (`<Editor einstellungen={zustand} />`).
 *
 * `Editor` ist eine KOMPONENTEN-Referenz (`BereichsEditor`), kein `children: ReactNode`
 * mit stillschweigend hineingereichter Prop: Der Vertrag "welche Props bekommt der
 * Editor" steht damit an EINER Stelle und ist typgeprueft; eine per `cloneElement` in
 * beliebige Kinder injizierte Prop waere das nicht.
 */
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
  /**
   * Wurzelpfad(e) dieses Bereichs im Konfigurationsbaum. Der Rahmen zeigt Befunde
   * GENAU auf diesen Pfaden; alles darunter verankert der Feld-Editor an seiner Zeile
   * (`befundeFuerPfad`). Ein Bereich kann mehrere Wurzeln umfassen — «Preisanpassung»
   * etwa deckt sowohl `flaeche` als auch `preisanpassung` und `anpassungsVorlagen` ab —
   * deshalb ein String ODER mehrere.
   */
  readonly bereichPraefix: string | readonly string[];
  /** Rohe Startkonfiguration (ganzer Baum) — siehe Dateikommentar zur Aufteilung. */
  readonly anfang: Readonly<Record<string, unknown>>;
  /** Konkreter Feld-Editor des Bereichs. */
  readonly Editor: BereichsEditor;
}

/**
 * Befunde, die KEIN Feld-Editor an seiner Zeile verankern kann — die Gegenmenge zu
 * `befundeFuerPfad` (reine Funktion, deshalb ohne DOM pruefbar).
 *
 * Jeder Bereichseditor zeigt die Befunde seiner Felder selbst, je Zeile ueber
 * `befundeFuerPfad`. Das ist ein PRAEFIX-Treffer: Ein Befund auf
 * `honorar.stuetzstellen[1].hMin` erschiene an seiner Zeile UND noch einmal in einer
 * Sammelliste des Rahmens — der Nutzer laese zwei Probleme, wo eines ist. Dem Rahmen
 * bleiben genau die zwei ortlosen Formen: der unanhaengige Befund (`pfad === ''`) und
 * ein Befund auf der Bereichswurzel selbst, zu der es keine Formularzeile gibt.
 */
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
  /**
   * GENAU EIN Aufruf von `verwendeEinstellungen` fuer BEIDE Reiter — der Umschalter
   * waehlt nur die Darstellung desselben Entwurfsstands. Ein zweiter Hook-Aufruf im
   * JSON-Zweig haette zwei unabhaengige Entwuerfe zur Folge; der Speichern-Knopf in der
   * Fussleiste kennte dann die Eingaben des jeweils anderen Reiters nicht, und welcher
   * der beiden Staende beim Klick gewaenne, haette allein die Aufrufreihenfolge
   * entschieden. Deshalb steht der Zustand hier, oberhalb der Verzweigung.
   *
   * `zustand.aendere` passt namensgleich auf die `aendere`-Prop von `JsonReiter` — die
   * JSON-Sicht schreibt in denselben Entwurf wie jedes Formularfeld.
   */
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
            /**
             * Im JSON-Reiter bekommt `JsonReiter` ALLE Befunde, nicht nur die
             * rahmenfaehigen: Die zeilenverankerten Meldungen haengen sonst an
             * Formularzeilen, die hier gar nicht gerendert sind — ein gescheitertes
             * Speichern bliebe im JSON-Reiter ohne jede Begruendung sichtbar.
             */
            /* Die gesperrten Wurzeln werden ausgeblendet und beim Zurueckschreiben aus
             * dem unveraenderten Bestand wieder eingesetzt. Sonst hoebe der JSON-Reiter
             * die Rollentrennung auf: `api` ist im Formular bewusst nur lesend
             * (Betriebsparameter der IT, US-08). */
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
