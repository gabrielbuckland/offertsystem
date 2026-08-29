import { DossierEditor } from '../../../components/einstellungen/DossierEditor.js';
import { FaktorenEditor } from '../../../components/einstellungen/FaktorenEditor.js';
import { HonorarEditor } from '../../../components/einstellungen/HonorarEditor.js';
import { PreisanpassungEditor } from '../../../components/einstellungen/PreisanpassungEditor.js';
import type { BereichsEditor } from '../../../components/einstellungen/verwende-einstellungen.js';

/**
 * Die vier Bereiche entsprechen den Editor-Pfaden aus `PipelineAnsicht` (`pipeline-daten.ts`).
 * `praefix` kann mehrere Konfigurationswurzeln nennen: «Preisanpassung» deckt sowohl
 * `flaeche` (α) als auch `preisanpassung` (zMin/zMax/Begruendung) und `anpassungsVorlagen`
 * ab, siehe `baueStufeVerkaufssumme` in `pipeline-daten.ts`.
 *
 * DIESE ZUORDNUNG BLEIBT BEWUSST HIER UND WANDERT NICHT NACH `components/einstellungen/`:
 * Ein Architekturtest scannt genau diesen Ordner auf fest verdrahtete Konfigurations-
 * bezeichner, und Werte wie `honorar`/`aufwandfaktoren` SIND solche Bezeichner. Als
 * Routing-Metadatum faellt die Zuordnung hier nicht unter das Verbot — im Editor-Ordner
 * selbst waere sie es. Bitte nicht "aufraeumend" verschieben.
 */
export const BEREICHE = {
  dossier: {
    titel: 'Dossier-Voreinstellungen',
    zweck: 'Voreinstellungen fuer neue Projekte; leer lassen heisst keine Vorgabe.',
    praefix: 'dossierDefaults',
    Editor: DossierEditor,
  },
  preisanpassung: {
    titel: 'Preisanpassung & Vorlagen',
    zweck: 'Gewicht der Aussenflaeche, Grenzen der Zu-/Abschlaege und die '
      + 'Vorlagenliste fuer deren Begruendung.',
    praefix: ['flaeche', 'preisanpassung', 'anpassungsVorlagen', 'merkmale'],
    Editor: PreisanpassungEditor,
  },
  faktoren: {
    titel: 'Aufwandfaktoren',
    zweck: 'Normalisierung, Gewichtung und Herkunft der Faktoren, aus denen sich der '
      + 'Aufwandindikator D ergibt.',
    praefix: 'aufwandfaktoren',
    Editor: FaktorenEditor,
  },
  honorar: {
    titel: 'Honorar',
    zweck: 'Stuetzstellen der Honorarstaffel und die Skalierungsfunktion g(D).',
    praefix: 'honorar',
    Editor: HonorarEditor,
  },
} as const satisfies Record<string, {
  titel: string; zweck: string; praefix: string | readonly string[]; Editor: BereichsEditor;
}>;

export type Bereich = keyof typeof BEREICHE;

export function istGueltigerBereich(wert: string): wert is Bereich {
  return Object.hasOwn(BEREICHE, wert);
}
