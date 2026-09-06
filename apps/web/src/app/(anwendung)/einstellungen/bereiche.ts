import { DossierEditor } from '../../../components/einstellungen/DossierEditor.js';
import { FaktorenEditor } from '../../../components/einstellungen/FaktorenEditor.js';
import { HonorarEditor } from '../../../components/einstellungen/HonorarEditor.js';
import { PreisanpassungEditor } from '../../../components/einstellungen/PreisanpassungEditor.js';
import type { BereichsEditor } from '../../../components/einstellungen/verwende-einstellungen.js';

// Bewusst nicht in components/einstellungen/: Architekturtest scannt dort auf fest
// verdrahtete Konfigurationsbezeichner (z.B. `honorar`); hier als Routing-Metadatum ausgenommen.
export const BEREICHE = {
  dossier: {
    titel: 'Dossier-Voreinstellungen',
    zweck: 'Firmenweite Zustands- und Qualitaetsvorgabe fuer die PriceHubble-Anfrage; '
      + 'alle Felder sind Pflicht.',
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

export function wurzeln(praefix: string | readonly string[]): readonly string[] {
  return typeof praefix === 'string' ? [praefix] : praefix;
}

export function istGueltigerBereich(wert: string): wert is Bereich {
  return Object.hasOwn(BEREICHE, wert);
}
