'use client';

/**
 * Gemeinsamer Rahmen aller vier Bereichs-Editoren (dossier/preisanpassung/faktoren/
 * honorar) — Karte mit Titel, Zweck-Satz, dem Formular des Bereichs, sammelfaehigen
 * Befunden und einer Fussleiste mit explizitem Speichern/Verwerfen (Spec §6, kein
 * Autosave — Begruendung in `verwende-einstellungen.ts`).
 *
 * EIGENTUEMER des Bearbeitungszustands: `verwendeEinstellungen` wird GENAU HIER
 * aufgerufen, nicht in den Bereichsseiten (`[bereich]/page.tsx`) und nicht im konkreten
 * Feld-Editor (`Editor`-Prop; HonorarEditor usw., Tasks 15/16). Grund: Die Bereichsseite
 * ist eine Server-Komponente (sie laedt `rohKonfiguration` vom Dateisystem) und darf
 * keine Hooks aufrufen; zwei UNABHAENGIGE Hook-Aufrufe (einer hier, einer im
 * Feld-Editor) haetten zwei getrennte Entwuerfe zur Folge — eine Eingabe im Feld-Editor
 * bliebe dem Speichern-Knopf hier unbekannt. Der Zustand entsteht deshalb EINMAL, aus
 * der rohen Startkonfiguration (`anfang`-Prop, vom Server geladen und damit
 * serialisierbar), und wird dem konkreten Editor explizit als `einstellungen`-Prop
 * gereicht (`<Editor einstellungen={zustand} />`).
 *
 * `Editor` ist eine KOMPONENTEN-Referenz (`BereichsEditor`, `verwende-einstellungen.ts`),
 * kein `children: ReactNode` mit stillschweigend hineingereichter Prop: Eine
 * Server-Komponente darf eine Client-Komponentenreferenz als Prop uebergeben (sie
 * serialisiert als Modulverweis, genau wie ein Element) — `[bereich]/page.tsx` bleibt
 * damit eine Server-Komponente und uebergibt einfach `Editor={HonorarEditor}`. Der
 * Vertrag "welche Props bekommt der Editor" steht dabei an EINER Stelle (`BereichsEditor`)
 * und ist typgeprueft; eine per `cloneElement` in beliebige Kinder injizierte Prop waere
 * das nicht — an der Definition von `HonorarEditor` selbst stuende nirgends, woher
 * `einstellungen` kommt.
 */
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card.js';
import { Hinweis } from '../ui/hinweis.js';
import { befundeFuerPfad, verwendeEinstellungen, type BereichsEditor } from './verwende-einstellungen.js';

export interface EinstellungsEditorProps {
  readonly titel: string;
  readonly zweck: string;
  /**
   * Konfigurationspfad(e), unter denen dieser Bereich Befunde einsammelt
   * (`befundeFuerPfad`). Ein Bereich kann mehrere Wurzeln umfassen — «Preisanpassung»
   * etwa deckt sowohl `flaeche` als auch `preisanpassung` und `anpassungsVorlagen` ab —
   * deshalb ein String ODER mehrere.
   */
  readonly bereichPraefix: string | readonly string[];
  /** Rohe Startkonfiguration (ganzer Baum) — siehe Dateikommentar zur Aufteilung. */
  readonly anfang: Readonly<Record<string, unknown>>;
  /** Konkreter Feld-Editor des Bereichs (Tasks 15/16). Optional: Solange er noch nicht
   *  existiert, zeigt der Rahmen sich selbst ohne Formularfelder — das Geruest bleibt
   *  damit unabhaengig von den konkreten Editoren pruefbar. */
  readonly Editor?: BereichsEditor;
}

/** Doppelte Treffer (v.a. der unanhaengige leere Pfad, der jedes Praefix erfuellt —
 *  siehe `befundeFuerPfad`) faellen bei mehreren Praefixen sonst mehrfach an. */
function ohneDoppelte(befunde: readonly { readonly pfad: string; readonly text: string }[]) {
  const gesehen = new Set<string>();
  return befunde.filter((befund) => {
    const schluessel = `${befund.pfad} ${befund.text}`;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
}

export function EinstellungsEditor({ titel, zweck, bereichPraefix, anfang, Editor }: EinstellungsEditorProps) {
  const zustand = verwendeEinstellungen(anfang);
  const praefixe = typeof bereichPraefix === 'string' ? [bereichPraefix] : bereichPraefix;
  // Nur Befunde OHNE genauere Feldverankerung: Solange kein konkreter Feld-Editor sie
  // selbst an ihrer Zeile anzeigt (Tasks 15/16), gilt das fuer alle Befunde des
  // Bereichs — deshalb hier keine weitere Ausduennung ueber `befundeFuerPfad` hinaus.
  const bereichsBefunde = ohneDoppelte(praefixe.flatMap((praefix) => befundeFuerPfad(zustand.befunde, praefix)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titel}</CardTitle>
        <CardDescription>{zweck}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Editor !== undefined && <Editor einstellungen={zustand} />}
        {bereichsBefunde.length > 0 && (
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
