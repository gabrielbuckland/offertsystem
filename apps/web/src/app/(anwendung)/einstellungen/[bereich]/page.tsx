import { notFound } from 'next/navigation';
import { EinstellungsEditor } from '../../../../components/einstellungen/EinstellungsEditor.js';
import { HonorarEditor } from '../../../../components/einstellungen/HonorarEditor.js';
import { PreisanpassungEditor } from '../../../../components/einstellungen/PreisanpassungEditor.js';
import { Brotkrume } from '../../../../components/shell/Brotkrume.js';
import { holeLaufzeit } from '../../../../server/laufzeit.js';
import type { BereichsEditor } from '../../../../components/einstellungen/verwende-einstellungen.js';

/**
 * Die vier Bereiche entsprechen den Editor-Pfaden aus `PipelineAnsicht`
 * (`pipeline-daten.ts`, dort ebenso als fester Vier-Werte-Aufzaehlung typisiert — diese
 * Zuordnung ist Routing-Metadatum, kein Faktor-/Vorlagenbezeichner im Sinn der Regel
 * "kein Konfigurationsbezeichner fest verdrahtet in components/einstellungen/", die nur
 * fuer den Inhalt der Editoren gilt).
 *
 * `praefix` kann mehrere Konfigurationswurzeln nennen: «Preisanpassung» deckt sowohl
 * `flaeche` (α) als auch `preisanpassung` (zMin/zMax/Begruendung) und
 * `anpassungsVorlagen` ab, siehe `baueStufeVerkaufssumme` in `pipeline-daten.ts`.
 *
 * DIESE ZUORDNUNG BLEIBT BEWUSST HIER UND WANDERT NICHT NACH `components/einstellungen/`:
 * Genau dieser Ordner wird von einem Architekturtest (Task 17) auf fest verdrahtete
 * Konfigurationsbezeichner gescannt, und Werte wie `honorar`/`aufwandfaktoren` SIND
 * solche Bezeichner. Als Routing-Metadatum der Seite (Next.js braucht ohnehin eine Datei
 * pro Route) faellt die Zuordnung nicht unter das Verbot — im Editor-Ordner selbst
 * waere sie es. Bitte nicht "aufraeumend" verschieben.
 */
const BEREICHE = {
  dossier: {
    titel: 'Dossier-Voreinstellungen',
    zweck: 'Voreinstellungen fuer neue Projekte — leer lassen heisst: keine Vorgabe.',
    praefix: 'dossierDefaults',
  },
  preisanpassung: {
    titel: 'Preisanpassung & Vorlagen',
    zweck: 'Gewicht der Aussenflaeche, Grenzen der Zu-/Abschlaege und die '
      + 'Vorlagenliste fuer deren Begruendung.',
    praefix: ['flaeche', 'preisanpassung', 'anpassungsVorlagen'],
    Editor: PreisanpassungEditor,
  },
  faktoren: {
    titel: 'Aufwandfaktoren',
    zweck: 'Normalisierung, Gewichtung und Herkunft der Faktoren, aus denen sich der '
      + 'Aufwandindikator D ergibt.',
    praefix: 'aufwandfaktoren',
  },
  honorar: {
    titel: 'Honorar',
    zweck: 'Stuetzstellen der Honorarstaffel und die Skalierungsfunktion g(D).',
    praefix: 'honorar',
    Editor: HonorarEditor,
  },
} as const satisfies Record<string, {
  titel: string; zweck: string; praefix: string | readonly string[]; Editor?: BereichsEditor;
}>;

type Bereich = keyof typeof BEREICHE;

function istGueltigerBereich(wert: string): wert is Bereich {
  return Object.hasOwn(BEREICHE, wert);
}

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ readonly bereich: string }>;
}

export default async function BereichSeite({ params }: Props) {
  const { bereich } = await params;
  if (!istGueltigerBereich(bereich)) notFound();

  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Einstellungen</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }

  const eintrag = BEREICHE[bereich];
  return (
    <main>
      <Brotkrume stufen={[
        { beschriftung: 'Einstellungen', href: '/einstellungen' },
        { beschriftung: eintrag.titel },
      ]}
      />
      {/* Task 16 liefert die verbleibenden bereichsspezifischen Formularfelder
          (FaktorenEditor, DossierEditor) ueber dieselbe `Editor`-Prop. Bis dahin zeigt
          der Rahmen sich dort ohne Formularfelder — er bleibt damit unabhaengig von den
          konkreten Editoren pruefbar. */}
      <EinstellungsEditor
        titel={eintrag.titel}
        zweck={eintrag.zweck}
        bereichPraefix={eintrag.praefix}
        anfang={laufzeit.wert.rohKonfiguration}
        {...('Editor' in eintrag ? { Editor: eintrag.Editor } : {})}
      />
    </main>
  );
}
